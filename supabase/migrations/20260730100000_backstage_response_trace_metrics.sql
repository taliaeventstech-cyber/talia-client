create or replace function public.get_backstage_response_trace_metrics(p_theatre_id uuid)
returns table (
  with_sources bigint,
  without_sources bigint,
  low_confidence bigint,
  fallbacks bigint,
  response_positive bigint,
  response_negative bigint,
  session_resolved bigint,
  session_unresolved bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with message_metrics as (
    select
      count(*) filter (
        where jsonb_typeof(metadata -> 'agent_sources') = 'array'
          and jsonb_array_length(metadata -> 'agent_sources') > 0
          or jsonb_typeof(metadata -> 'retrieval' -> 'chunks') = 'array'
          and jsonb_array_length(metadata -> 'retrieval' -> 'chunks') > 0
          or metadata ->> 'retrieval_status' in ('sources_used', 'direct_match')
      ) as with_sources,
      count(*) filter (
        where metadata ->> 'retrieval_status' in ('delegated_no_sources', 'filtered_no_sources', 'no_sources')
      ) as without_sources,
      count(*) filter (where metadata -> 'low_confidence' = 'true'::jsonb) as low_confidence,
      count(*) filter (where jsonb_typeof(metadata -> 'fallback_reason') = 'string') as fallbacks,
      count(*) filter (where metadata #>> '{feedback,rating}' = 'positive') as response_positive,
      count(*) filter (where metadata #>> '{feedback,rating}' = 'negative') as response_negative
    from public.messages
    where theatre_id = p_theatre_id
      and role = 'assistant'
  ),
  conversation_metrics as (
    select
      count(*) filter (where metadata #>> '{session_feedback,resolved}' = 'true') as session_resolved,
      count(*) filter (where metadata #>> '{session_feedback,resolved}' = 'false') as session_unresolved
    from public.conversations
    where theatre_id = p_theatre_id
  )
  select
    message_metrics.with_sources,
    message_metrics.without_sources,
    message_metrics.low_confidence,
    message_metrics.fallbacks,
    message_metrics.response_positive,
    message_metrics.response_negative,
    conversation_metrics.session_resolved,
    conversation_metrics.session_unresolved
  from message_metrics
  cross join conversation_metrics;
$$;

revoke all on function public.get_backstage_response_trace_metrics(uuid) from public;
