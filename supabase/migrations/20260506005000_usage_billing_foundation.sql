create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  plan text not null default 'essential' check (plan in ('essential', 'professional', 'enterprise', 'custom')),
  status text not null default 'active' check (status in ('trialing', 'active', 'paused', 'cancelled')),
  billing_period_start date not null default date_trunc('month', now())::date,
  billing_period_end date not null default (date_trunc('month', now()) + interval '1 month')::date,
  included_chat_conversations integer not null default 1000,
  included_email_conversations integer not null default 0,
  included_voice_minutes numeric(10,2) not null default 0,
  overage_price_chat_cents integer not null default 10,
  overage_price_email_cents integer not null default 12,
  overage_price_voice_minute_cents integer not null default 35,
  hard_limit_enabled boolean not null default false,
  hard_limit_behavior text not null default 'notify_only' check (hard_limit_behavior in ('notify_only', 'fallback', 'block')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(theatre_id, billing_period_start)
);

create table if not exists public.tenant_module_entitlements (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  module_key text not null check (
    module_key in ('chatbot', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  ),
  enabled boolean not null default false,
  limits jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(theatre_id, module_key)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  subscription_id uuid references public.tenant_subscriptions(id) on delete set null,
  module_key text not null check (
    module_key in ('chatbot', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  ),
  channel text not null check (channel in ('chatbot', 'email', 'voice', 'instagram', 'whatsapp', 'backstage', 'system')),
  event_type text not null check (
    event_type in (
      'conversation_started',
      'message',
      'ai_call',
      'tool_call',
      'voice_minute',
      'resolution',
      'fallback',
      'limit_exceeded'
    )
  ),
  quantity numeric(12,4) not null default 1,
  unit text not null check (unit in ('conversation', 'message', 'token', 'minute', 'call', 'resolution', 'event')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_estimate_cents integer not null default 0,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(idempotency_key)
);

create table if not exists public.tenant_usage_daily (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  date date not null,
  module_key text not null check (
    module_key in ('chatbot', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  ),
  channel text not null check (channel in ('chatbot', 'email', 'voice', 'instagram', 'whatsapp', 'backstage', 'system')),
  conversations integer not null default 0,
  messages integer not null default 0,
  ai_calls integer not null default 0,
  tool_calls integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  voice_minutes numeric(10,2) not null default 0,
  resolutions integer not null default 0,
  fallbacks integer not null default 0,
  limit_exceeded_events integer not null default 0,
  estimated_cost_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(theatre_id, date, module_key, channel)
);

alter table public.tenant_subscriptions enable row level security;
alter table public.tenant_module_entitlements enable row level security;
alter table public.usage_events enable row level security;
alter table public.tenant_usage_daily enable row level security;

drop policy if exists "tenant_subscriptions_select_own_theatre" on public.tenant_subscriptions;
create policy "tenant_subscriptions_select_own_theatre" on public.tenant_subscriptions
  for select using (theatre_id = public.current_theatre_id());

drop policy if exists "tenant_module_entitlements_select_own_theatre" on public.tenant_module_entitlements;
create policy "tenant_module_entitlements_select_own_theatre" on public.tenant_module_entitlements
  for select using (theatre_id = public.current_theatre_id());

drop policy if exists "usage_events_select_own_theatre" on public.usage_events;
create policy "usage_events_select_own_theatre" on public.usage_events
  for select using (theatre_id = public.current_theatre_id());

drop policy if exists "tenant_usage_daily_select_own_theatre" on public.tenant_usage_daily;
create policy "tenant_usage_daily_select_own_theatre" on public.tenant_usage_daily
  for select using (theatre_id = public.current_theatre_id());

create index if not exists tenant_subscriptions_theatre_period_idx
  on public.tenant_subscriptions(theatre_id, billing_period_start desc, billing_period_end desc);

create index if not exists tenant_module_entitlements_theatre_enabled_idx
  on public.tenant_module_entitlements(theatre_id, enabled);

create index if not exists usage_events_theatre_occurred_idx
  on public.usage_events(theatre_id, occurred_at desc);

create index if not exists usage_events_theatre_channel_idx
  on public.usage_events(theatre_id, module_key, channel, event_type);

create index if not exists tenant_usage_daily_theatre_date_idx
  on public.tenant_usage_daily(theatre_id, date desc, module_key, channel);

drop trigger if exists tenant_subscriptions_updated_at on public.tenant_subscriptions;
create trigger tenant_subscriptions_updated_at
  before update on public.tenant_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists tenant_module_entitlements_updated_at on public.tenant_module_entitlements;
create trigger tenant_module_entitlements_updated_at
  before update on public.tenant_module_entitlements
  for each row execute function public.set_updated_at();

drop trigger if exists tenant_usage_daily_updated_at on public.tenant_usage_daily;
create trigger tenant_usage_daily_updated_at
  before update on public.tenant_usage_daily
  for each row execute function public.set_updated_at();

create or replace function public.increment_tenant_usage_daily(
  p_theatre_id uuid,
  p_date date,
  p_module_key text,
  p_channel text,
  p_event_type text,
  p_quantity numeric,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_estimate_cents integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_usage_daily (
    theatre_id,
    date,
    module_key,
    channel,
    conversations,
    messages,
    ai_calls,
    tool_calls,
    input_tokens,
    output_tokens,
    voice_minutes,
    resolutions,
    fallbacks,
    limit_exceeded_events,
    estimated_cost_cents
  )
  values (
    p_theatre_id,
    p_date,
    p_module_key,
    p_channel,
    case when p_event_type = 'conversation_started' then greatest(1, p_quantity::integer) else 0 end,
    case when p_event_type = 'message' then greatest(1, p_quantity::integer) else 0 end,
    case when p_event_type = 'ai_call' then greatest(1, p_quantity::integer) else 0 end,
    case when p_event_type = 'tool_call' then greatest(1, p_quantity::integer) else 0 end,
    coalesce(p_input_tokens, 0),
    coalesce(p_output_tokens, 0),
    case when p_event_type = 'voice_minute' then coalesce(p_quantity, 0) else 0 end,
    case when p_event_type = 'resolution' then greatest(1, p_quantity::integer) else 0 end,
    case when p_event_type = 'fallback' then greatest(1, p_quantity::integer) else 0 end,
    case when p_event_type = 'limit_exceeded' then greatest(1, p_quantity::integer) else 0 end,
    coalesce(p_cost_estimate_cents, 0)
  )
  on conflict (theatre_id, date, module_key, channel)
  do update set
    conversations = tenant_usage_daily.conversations + excluded.conversations,
    messages = tenant_usage_daily.messages + excluded.messages,
    ai_calls = tenant_usage_daily.ai_calls + excluded.ai_calls,
    tool_calls = tenant_usage_daily.tool_calls + excluded.tool_calls,
    input_tokens = tenant_usage_daily.input_tokens + excluded.input_tokens,
    output_tokens = tenant_usage_daily.output_tokens + excluded.output_tokens,
    voice_minutes = tenant_usage_daily.voice_minutes + excluded.voice_minutes,
    resolutions = tenant_usage_daily.resolutions + excluded.resolutions,
    fallbacks = tenant_usage_daily.fallbacks + excluded.fallbacks,
    limit_exceeded_events = tenant_usage_daily.limit_exceeded_events + excluded.limit_exceeded_events,
    estimated_cost_cents = tenant_usage_daily.estimated_cost_cents + excluded.estimated_cost_cents,
    updated_at = now();
end;
$$;

insert into public.tenant_subscriptions (
  theatre_id,
  plan,
  included_chat_conversations,
  included_email_conversations,
  included_voice_minutes,
  overage_price_chat_cents,
  overage_price_email_cents,
  overage_price_voice_minute_cents
)
select
  t.id,
  case
    when lower(t.plan) in ('professional', 'profesional') then 'professional'
    when lower(t.plan) in ('enterprise', 'empresa') then 'enterprise'
    when lower(t.plan) = 'custom' then 'custom'
    else 'essential'
  end,
  case
    when lower(t.plan) in ('professional', 'profesional') then 4000
    when lower(t.plan) in ('enterprise', 'empresa') then 12000
    when lower(t.plan) = 'custom' then 12000
    else 1000
  end,
  case
    when lower(t.plan) in ('professional', 'profesional') then 500
    when lower(t.plan) in ('enterprise', 'empresa') then 2000
    when lower(t.plan) = 'custom' then 2000
    else 0
  end,
  case
    when lower(t.plan) in ('enterprise', 'empresa', 'custom') then 120
    else 0
  end,
  case
    when lower(t.plan) in ('professional', 'profesional') then 8
    when lower(t.plan) in ('enterprise', 'empresa', 'custom') then 6
    else 10
  end,
  case
    when lower(t.plan) in ('professional', 'profesional') then 10
    when lower(t.plan) in ('enterprise', 'empresa', 'custom') then 8
    else 12
  end,
  35
from public.theatres t
on conflict (theatre_id, billing_period_start) do nothing;

insert into public.tenant_module_entitlements (theatre_id, module_key, enabled, limits)
select
  tm.theatre_id,
  tm.module_key,
  tm.status in ('trial', 'active'),
  case tm.module_key
    when 'chatbot' then jsonb_build_object('monthly_conversations', 1000)
    when 'email' then jsonb_build_object('monthly_conversations', 0)
    when 'voice' then jsonb_build_object('monthly_minutes', 0)
    else '{}'::jsonb
  end
from public.tenant_modules tm
on conflict (theatre_id, module_key) do update
set enabled = excluded.enabled,
    updated_at = now();

notify pgrst, 'reload schema';
