-- Keep commercial billing boundaries as exact UTC instants. Calendar dates are
-- retained for existing daily aggregates and period labels.
alter table public.tenant_subscriptions
  add column if not exists billing_period_start_at timestamptz,
  add column if not exists billing_period_end_at timestamptz;

update public.tenant_subscriptions
set
  billing_period_end_at = case
    when jsonb_typeof(metadata -> 'stripe_current_period_end') = 'number'
      then to_timestamp((metadata ->> 'stripe_current_period_end')::double precision)
    else billing_period_end::timestamp at time zone 'UTC'
  end,
  billing_period_start_at = case
    when jsonb_typeof(metadata -> 'stripe_current_period_end') = 'number'
      then to_timestamp((metadata ->> 'stripe_current_period_end')::double precision) - interval '1 month'
    else billing_period_start::timestamp at time zone 'UTC'
  end
where billing_period_start_at is null
   or billing_period_end_at is null;

alter table public.tenant_subscriptions
  alter column billing_period_start_at set not null,
  alter column billing_period_end_at set not null,
  alter column billing_period_start_at set default (
    date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'
  ),
  alter column billing_period_end_at set default (
    (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC'
  );

alter table public.tenant_subscriptions
  drop constraint if exists tenant_subscriptions_theatre_id_billing_period_start_key;

create unique index if not exists tenant_subscriptions_theatre_period_start_at_key
  on public.tenant_subscriptions(theatre_id, billing_period_start_at);

alter table public.tenant_subscriptions
  drop constraint if exists tenant_subscriptions_period_instants_check;

alter table public.tenant_subscriptions
  add constraint tenant_subscriptions_period_instants_check
  check (billing_period_end_at > billing_period_start_at);

create or replace function public.get_tenant_usage_totals(
  p_theatre_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns table(
  conversations bigint,
  messages bigint,
  ai_calls bigint,
  tool_calls bigint,
  input_tokens bigint,
  output_tokens bigint,
  voice_minutes numeric,
  resolutions bigint,
  fallbacks bigint,
  limit_exceeded_events bigint,
  estimated_cost_cents bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(case when event_type = 'conversation_started' then quantity else 0 end), 0)::bigint,
    coalesce(sum(case when event_type = 'message' then quantity else 0 end), 0)::bigint,
    coalesce(sum(case when event_type = 'ai_call' then quantity else 0 end), 0)::bigint,
    coalesce(sum(case when event_type = 'tool_call' then quantity else 0 end), 0)::bigint,
    coalesce(sum(input_tokens), 0)::bigint,
    coalesce(sum(output_tokens), 0)::bigint,
    coalesce(sum(case when event_type = 'voice_minute' then quantity else 0 end), 0)::numeric,
    coalesce(sum(case when event_type = 'resolution' then quantity else 0 end), 0)::bigint,
    coalesce(sum(case when event_type = 'fallback' then quantity else 0 end), 0)::bigint,
    coalesce(sum(case when event_type = 'limit_exceeded' then quantity else 0 end), 0)::bigint,
    coalesce(sum(cost_estimate_cents), 0)::bigint
  from public.usage_events
  where theatre_id = p_theatre_id
    and occurred_at >= p_period_start
    and occurred_at < p_period_end
    and p_period_end > p_period_start;
$$;

revoke all on function public.get_tenant_usage_totals(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_tenant_usage_totals(uuid, timestamptz, timestamptz)
  to service_role;

-- Use elapsed UTC durations for daily/weekly schedules and clamp monthly runs to
-- the final valid day of the target month. This keeps JavaScript and Postgres in
-- agreement for dates such as January 31.
create or replace function public.next_knowledge_sync_at(
  refresh_interval text,
  from_time timestamptz default now()
)
returns timestamptz
language sql
immutable
strict
set search_path = ''
as $$
  select case refresh_interval
    when 'daily' then from_time + interval '24 hours'
    when 'weekly' then from_time + interval '168 hours'
    when 'monthly' then (
      date_trunc('month', from_time at time zone 'UTC')
      + interval '1 month'
      + make_interval(days => least(
          extract(day from from_time at time zone 'UTC')::integer,
          extract(day from (
            date_trunc('month', from_time at time zone 'UTC')
            + interval '2 months - 1 day'
          ))::integer
        ) - 1)
      + (
          from_time at time zone 'UTC'
          - date_trunc('day', from_time at time zone 'UTC')
        )
    ) at time zone 'UTC'
    else null
  end;
$$;

notify pgrst, 'reload schema';
