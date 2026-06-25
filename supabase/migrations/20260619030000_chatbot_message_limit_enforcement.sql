-- Enforce chatbot message limits (Botsonic model: assistant replies are billable).
-- Default behavior moves from notify-only to graceful fallback: once the included
-- message allotment is consumed, TALIA replies with the venue fallback message
-- (no model call) instead of going silent.

alter table public.tenant_subscriptions
  alter column hard_limit_enabled set default true;

alter table public.tenant_subscriptions
  alter column hard_limit_behavior set default 'fallback';

-- Activate the new behavior on currently open (non-cancelled) subscription periods
-- that were created under the old notify-only default.
update public.tenant_subscriptions
set
  hard_limit_enabled = true,
  hard_limit_behavior = 'fallback',
  updated_at = now()
where status <> 'cancelled'
  and billing_period_end > now()::date
  and hard_limit_behavior = 'notify_only';

-- Index to keep the billable assistant-message count fast within a billing period.
create index if not exists usage_events_chatbot_assistant_idx
  on public.usage_events (theatre_id, occurred_at)
  where channel = 'chatbot' and event_type = 'message' and metadata->>'role' = 'assistant';
