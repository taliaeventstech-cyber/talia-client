create table if not exists public.ai_model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  currency text not null default 'USD' check (currency = 'USD'),
  input_usd_micros_per_million numeric(20,6) not null default 0,
  cached_input_usd_micros_per_million numeric(20,6) not null default 0,
  output_usd_micros_per_million numeric(20,6) not null default 0,
  effective_from timestamptz not null,
  effective_to timestamptz,
  source_url text not null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  unique(provider, model, effective_from)
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  usage_event_id uuid references public.usage_events(id) on delete set null,
  pricing_id uuid references public.ai_model_pricing(id) on delete restrict,
  session_id text,
  component text not null check (component in ('answer_agent', 'language_agent', 'retrieval_embedding')),
  provider text not null,
  model text not null,
  request_count integer not null default 0 check (request_count >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0 and cached_input_tokens <= input_tokens),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd_micros numeric(20,6) not null default 0 check (cost_usd_micros >= 0),
  accuracy text not null check (accuracy in ('measured', 'estimated_legacy', 'reconciled')),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.ai_model_pricing enable row level security;
alter table public.ai_usage_events enable row level security;

drop policy if exists "ai_model_pricing_select_authenticated" on public.ai_model_pricing;
create policy "ai_model_pricing_select_authenticated" on public.ai_model_pricing
  for select to authenticated using (true);

drop policy if exists "ai_usage_events_select_own_theatre" on public.ai_usage_events;
create policy "ai_usage_events_select_own_theatre" on public.ai_usage_events
  for select using (theatre_id = public.current_theatre_id());

create index if not exists ai_model_pricing_lookup_idx
  on public.ai_model_pricing(provider, model, effective_from desc);

create index if not exists ai_usage_events_theatre_occurred_idx
  on public.ai_usage_events(theatre_id, occurred_at desc);

create index if not exists ai_usage_events_component_model_idx
  on public.ai_usage_events(component, provider, model, occurred_at desc);

insert into public.ai_model_pricing (
  provider,
  model,
  input_usd_micros_per_million,
  cached_input_usd_micros_per_million,
  output_usd_micros_per_million,
  effective_from,
  source_url
)
values
  ('openai', 'gpt-4o-mini', 150000, 75000, 600000, '2026-07-16T00:00:00Z', 'https://developers.openai.com/api/docs/pricing'),
  ('openai', 'gpt-4o-mini-2024-07-18', 150000, 75000, 600000, '2026-07-16T00:00:00Z', 'https://developers.openai.com/api/docs/pricing'),
  ('openai', 'text-embedding-3-small', 20000, 0, 0, '2026-07-16T00:00:00Z', 'https://developers.openai.com/api/docs/pricing')
on conflict (provider, model, effective_from) do nothing;

comment on table public.ai_usage_events is
  'Measured per-component AI usage. cost_usd_micros may contain fractional microdollars; raw tokens and pricing_id remain authoritative.';

create or replace view public.ai_usage_daily
with (security_invoker = true)
as
select
  theatre_id,
  occurred_at::date as date,
  component,
  provider,
  model,
  accuracy,
  sum(request_count)::bigint as request_count,
  sum(input_tokens)::bigint as input_tokens,
  sum(cached_input_tokens)::bigint as cached_input_tokens,
  sum(output_tokens)::bigint as output_tokens,
  sum(cost_usd_micros)::numeric(20,6) as cost_usd_micros
from public.ai_usage_events
group by theatre_id, occurred_at::date, component, provider, model, accuracy;

create or replace view public.ai_response_usage_daily
with (security_invoker = true)
as
select
  theatre_id,
  occurred_at::date as date,
  accuracy,
  count(distinct usage_event_id)::bigint as response_count,
  sum(request_count)::bigint as request_count,
  sum(input_tokens)::bigint as input_tokens,
  sum(cached_input_tokens)::bigint as cached_input_tokens,
  sum(output_tokens)::bigint as output_tokens,
  sum(cost_usd_micros)::numeric(20,6) as cost_usd_micros
from public.ai_usage_events
group by theatre_id, occurred_at::date, accuracy;

grant select on public.ai_usage_daily to authenticated, service_role;
grant select on public.ai_response_usage_daily to authenticated, service_role;
