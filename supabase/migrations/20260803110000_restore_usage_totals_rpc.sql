-- This function was added to an already-applied migration in one environment,
-- so publish it again through a new immutable migration.
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

notify pgrst, 'reload schema';
