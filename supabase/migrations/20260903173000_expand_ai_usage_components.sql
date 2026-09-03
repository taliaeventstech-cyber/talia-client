alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_component_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_component_check
  check (component in (
    'answer_agent',
    'diagnostic_agent',
    'grounding_review_agent',
    'language_agent',
    'retrieval_embedding'
  ));
