create table if not exists public.security_rate_limits (
  scope text not null check (char_length(scope) between 1 and 100),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 86400),
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope, key_hash, window_started_at)
);

create index if not exists security_rate_limits_expires_at_idx
  on public.security_rate_limits (expires_at);

alter table public.security_rate_limits enable row level security;

revoke all on table public.security_rate_limits from public, anon, authenticated;

create or replace function public.consume_security_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_expires_at timestamptz;
  v_request_count integer;
begin
  if p_scope is null or char_length(p_scope) not between 1 and 100 then
    raise exception 'invalid rate-limit scope';
  end if;

  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit key hash';
  end if;

  if p_limit is null or p_limit not between 1 and 10000 then
    raise exception 'invalid rate-limit limit';
  end if;

  if p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate-limit window';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_started_at + make_interval(secs => p_window_seconds);

  delete from public.security_rate_limits
  where ctid in (
    select ctid
    from public.security_rate_limits
    where expires_at < v_now
    order by expires_at
    limit 100
  );

  insert into public.security_rate_limits (
    scope,
    key_hash,
    window_started_at,
    window_seconds,
    request_count,
    expires_at
  ) values (
    p_scope,
    p_key_hash,
    v_window_started_at,
    p_window_seconds,
    1,
    v_expires_at
  )
  on conflict (scope, key_hash, window_started_at)
  do update set request_count = security_rate_limits.request_count + 1
  returning request_count into v_request_count;

  return query select
    v_request_count <= p_limit,
    greatest(0, p_limit - v_request_count),
    greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer);
end;
$$;

revoke all on function public.consume_security_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, text, integer, integer) to service_role;

comment on table public.security_rate_limits is
  'Short-lived distributed abuse-prevention counters. Keys are HMAC digests; raw IP and email values are never stored.';
