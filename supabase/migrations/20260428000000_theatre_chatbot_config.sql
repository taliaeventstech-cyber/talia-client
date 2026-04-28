alter table public.theatres
  add column if not exists plan text not null default 'esencial',
  add column if not exists system_prompt text,
  add column if not exists fallback_email text,
  add column if not exists fallback_phone text,
  add column if not exists scrape_urls jsonb not null default '[]'::jsonb,
  add column if not exists widget_config jsonb not null default '{}'::jsonb,
  add column if not exists webhook_secret text;

update public.theatres
set webhook_secret = coalesce(webhook_secret, n8n_hmac_secret)
where webhook_secret is null
  and n8n_hmac_secret is not null;

alter table public.conversations
  add column if not exists last_message_at timestamptz;

update public.conversations
set last_message_at = coalesce(ended_at, started_at)
where last_message_at is null;

create index if not exists conversations_last_message_at_idx
  on public.conversations(last_message_at desc);

notify pgrst, 'reload schema';
