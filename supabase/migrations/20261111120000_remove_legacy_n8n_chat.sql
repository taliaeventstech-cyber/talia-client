-- The web agent now runs exclusively through talia-ai. The former n8n
-- provider, callback routes and rollback configuration have been removed.
alter table public.theatres
  drop column if exists n8n_webhook_url,
  drop column if exists n8n_hmac_secret,
  drop column if exists webhook_secret;
