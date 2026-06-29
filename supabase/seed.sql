-- Seed de desarrollo: un teatro de ejemplo
insert into public.theatres (
  id,
  name,
  slug,
  plan,
  fallback_email,
  fallback_phone,
  widget_config,
  n8n_webhook_url
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Teatro Demo',
  'teatro-demo',
  'esencial',
  'info@example.com',
  null,
  '{"assistantName":"TALIA","primaryColor":"#000000"}'::jsonb,
  null
)
on conflict (id) do update set
  plan = excluded.plan,
  fallback_email = excluded.fallback_email,
  fallback_phone = excluded.fallback_phone,
  widget_config = excluded.widget_config;
