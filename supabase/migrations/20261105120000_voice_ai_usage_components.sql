-- Web Agent voice mode (TAL-6/TAL-7): precise cost for speech-to-text and
-- text-to-speech calls made by talia-ai on behalf of a venue.
--
-- No new table, so no new RLS policy: ai_usage_events keeps its existing
-- select policies; rows are written by the service role after talia-client
-- has validated the venue, domain, rate and usage limits.

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
    'retrieval_embedding',
    'speech_to_text',
    'text_to_speech'
  ));

-- Prices in USD micros per 1M tokens.
-- gpt-4o-mini-transcribe: input (audio) $1.25, output (text) $5.00.
-- gpt-4o-mini-tts: input (text) $0.60, output (audio) $12.00.
-- MAINTAINER: verify these against https://developers.openai.com/api/docs/pricing
-- before applying (they were taken from consistent third-party listings; the
-- official page was not reachable from the authoring environment).
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
  ('openai', 'gpt-4o-mini-transcribe', 1250000, 0, 5000000, 0, '2026-11-05T00:00:00Z', 'https://developers.openai.com/api/docs/pricing'),
  ('openai', 'gpt-4o-mini-tts', 600000, 0, 12000000, 0, '2026-11-05T00:00:00Z', 'https://developers.openai.com/api/docs/pricing')
on conflict (provider, model, effective_from) do nothing;
