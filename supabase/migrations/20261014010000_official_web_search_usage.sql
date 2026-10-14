alter table public.ai_model_pricing
  add column if not exists web_search_usd_micros_per_call numeric(20,6) not null default 0;

alter table public.ai_usage_events
  add column if not exists tool_call_count integer not null default 0
  check (tool_call_count >= 0);

alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_component_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_component_check
  check (component in (
    'answer_agent',
    'diagnostic_agent',
    'grounding_review_agent',
    'language_agent',
    'official_web_search',
    'retrieval_embedding'
  ));

insert into public.ai_model_pricing (
  provider,
  model,
  input_usd_micros_per_million,
  cached_input_usd_micros_per_million,
  output_usd_micros_per_million,
  web_search_usd_micros_per_call,
  effective_from,
  source_url
)
values
  ('openai', 'gpt-5.5', 5000000, 500000, 30000000, 10000, '2026-10-14T00:00:00Z', 'https://developers.openai.com/api/docs/pricing'),
  ('openai', 'gpt-5.5-2026-04-23', 5000000, 500000, 30000000, 10000, '2026-10-14T00:00:00Z', 'https://developers.openai.com/api/docs/pricing')
on conflict (provider, model, effective_from) do nothing;
