create table if not exists public.knowledge_domain_fetch_windows (
  domain text primary key,
  next_allowed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_domain_fetch_windows_domain_check
    check (
      domain = lower(domain)
      and char_length(domain) between 1 and 253
      and domain ~ '^[a-z0-9.:-]+$'
    )
);

create table if not exists public.knowledge_domain_fetch_leases (
  id uuid primary key default gen_random_uuid(),
  domain text not null references public.knowledge_domain_fetch_windows(domain) on delete cascade,
  worker_id text not null,
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint knowledge_domain_fetch_leases_worker_check
    check (char_length(trim(worker_id)) between 1 and 200)
);

create index if not exists knowledge_domain_fetch_leases_domain_expiry_idx
  on public.knowledge_domain_fetch_leases(domain, lease_expires_at);

alter table public.knowledge_domain_fetch_windows enable row level security;
alter table public.knowledge_domain_fetch_leases enable row level security;

create or replace function public.claim_knowledge_domain_fetch_lease(
  p_domain text,
  p_worker_id text,
  p_max_concurrency integer default 2,
  p_lease_seconds integer default 90,
  p_min_interval_ms integer default 250
)
returns table (
  lease_id uuid,
  retry_after_ms integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_domain text := lower(trim(trailing '.' from trim(coalesce(p_domain, ''))));
  normalized_worker_id text := trim(coalesce(p_worker_id, ''));
  concurrency_limit integer := greatest(1, least(coalesce(p_max_concurrency, 2), 10));
  lease_duration integer := greatest(30, least(coalesce(p_lease_seconds, 90), 300));
  interval_ms integer := greatest(0, least(coalesce(p_min_interval_ms, 250), 10000));
  current_time timestamptz := clock_timestamp();
  available_at timestamptz;
  earliest_expiry timestamptz;
  active_count integer;
  claimed_lease_id uuid;
begin
  if normalized_domain = ''
    or char_length(normalized_domain) > 253
    or normalized_domain !~ '^[a-z0-9.:-]+$'
  then
    raise exception 'invalid_knowledge_fetch_domain';
  end if;

  if normalized_worker_id = '' or char_length(normalized_worker_id) > 200 then
    raise exception 'invalid_knowledge_fetch_worker';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_domain, 0)
  );

  insert into public.knowledge_domain_fetch_windows (domain, next_allowed_at)
  values (normalized_domain, current_time)
  on conflict (domain) do nothing;

  delete from public.knowledge_domain_fetch_leases as lease
   where lease.domain = normalized_domain
     and lease.lease_expires_at <= current_time;

  select count(*)::integer, min(lease.lease_expires_at)
    into active_count, earliest_expiry
    from public.knowledge_domain_fetch_leases as lease
   where lease.domain = normalized_domain;

  select fetch_window.next_allowed_at
  into available_at
  from public.knowledge_domain_fetch_windows as fetch_window
 where fetch_window.domain = normalized_domain
 for update;

  if active_count >= concurrency_limit or available_at > current_time then
    return query select
      null::uuid,
      least(
        1000,
        greatest(
          25,
          ceil(
            extract(epoch from (
              greatest(
                available_at,
                case
                  when active_count >= concurrency_limit then earliest_expiry
                  else current_time
                end
              ) - current_time
            )) * 1000
          )::integer
        )
      );
    return;
  end if;

  insert into public.knowledge_domain_fetch_leases (
    domain,
    worker_id,
    lease_expires_at
  ) values (
    normalized_domain,
    normalized_worker_id,
    current_time + make_interval(secs => lease_duration)
  )
  returning id into claimed_lease_id;

  update public.knowledge_domain_fetch_windows
     set next_allowed_at = current_time + (interval '1 millisecond' * interval_ms),
         updated_at = current_time
   where domain = normalized_domain;

  return query select claimed_lease_id, 0;
end;
$$;

create or replace function public.release_knowledge_domain_fetch_lease(
  p_lease_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_count integer;
begin
  delete from public.knowledge_domain_fetch_leases as lease
   where lease.id = p_lease_id
     and lease.worker_id = trim(p_worker_id);

  get diagnostics released_count = row_count;
  return released_count > 0;
end;
$$;

revoke all on table public.knowledge_domain_fetch_windows from public, anon, authenticated;
revoke all on table public.knowledge_domain_fetch_leases from public, anon, authenticated;
revoke all on function public.claim_knowledge_domain_fetch_lease(text, text, integer, integer, integer) from public;
revoke all on function public.release_knowledge_domain_fetch_lease(uuid, text) from public;

grant execute on function public.claim_knowledge_domain_fetch_lease(text, text, integer, integer, integer) to service_role;
grant execute on function public.release_knowledge_domain_fetch_lease(uuid, text) to service_role;
