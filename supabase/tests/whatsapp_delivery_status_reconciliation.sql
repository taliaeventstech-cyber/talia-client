create extension if not exists pgtap with schema extensions;

begin;

select plan(16);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.reconcile_whatsapp_delivery_status(text,text,text,text,timestamptz,text,jsonb)',
    'execute'
  ),
  'authenticated cannot reconcile WhatsApp delivery statuses'
);

insert into public.accounts (id, name, slug)
values ('91000000-0000-0000-0000-000000000001', 'WhatsApp delivery tenant', 'whatsapp-delivery-tenant');

insert into public.theatres (id, account_id, name, slug, primary_language)
values (
  '92000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'WhatsApp delivery venue',
  'whatsapp-delivery-venue',
  'es'
);

insert into public.whatsapp_connections (id, theatre_id, waba_id, phone_number_id, status, rollout_enabled)
values (
  '93000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  'delivery-waba',
  'delivery-phone',
  'connected',
  true
);

insert into public.whatsapp_contacts (id, theatre_id, connection_id, wa_id)
values (
  '94000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '34123456789'
);

insert into public.whatsapp_conversations (id, theatre_id, connection_id, contact_id, status)
values (
  '95000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  'open'
);

insert into public.whatsapp_messages (
  id, theatre_id, connection_id, conversation_id, contact_id,
  provider_message_id, direction, message_type, body_text,
  processing_status, delivery_status
) values (
  '96000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  'wamid.delivery.1', 'outbound', 'text', 'Primera respuesta', 'responded', 'sent'
), (
  '96000000-0000-0000-0000-000000000002',
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  'wamid.delivery.2', 'outbound', 'text', 'Segunda respuesta', 'responded', 'sent'
);

select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'missing-waba', 'delivery-phone', 'wamid.delivery.1', 'sent', '2026-08-17T10:00:00Z'
  )),
  'unmatched_connection',
  'unknown connections are bounded and ignored'
);

select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'delivery-waba', 'delivery-phone', 'missing-message', 'sent', '2026-08-17T10:00:00Z'
  )),
  'unmatched_message',
  'unknown outbound messages are bounded and ignored'
);

select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'delivery-waba', 'delivery-phone', 'wamid.delivery.1', 'sent', '2026-08-17T10:00:00Z', '',
    '{"billable":false,"pricingCategory":"service","pricingModel":"PMP"}'::jsonb
  )),
  'updated',
  'the provider sent event enriches the locally sent message'
);
select is(
  (select sent_at from public.whatsapp_messages where id = '96000000-0000-0000-0000-000000000001'),
  '2026-08-17T10:00:00Z'::timestamptz,
  'the provider sent timestamp is retained'
);
select is(
  (select metadata ->> 'meta_pricing_category' from public.whatsapp_messages where id = '96000000-0000-0000-0000-000000000001'),
  'service',
  'bounded pricing metadata is retained'
);

select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'delivery-waba', 'delivery-phone', 'wamid.delivery.1', 'delivered', '2026-08-17T10:00:02Z'
  )),
  'updated',
  'delivery advances the message'
);
select is(
  (select delivery_status from public.whatsapp_messages where id = '96000000-0000-0000-0000-000000000001'),
  'delivered',
  'the message is marked delivered'
);
select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'delivery-waba', 'delivery-phone', 'wamid.delivery.1', 'sent', '2026-08-17T10:00:01Z'
  )),
  'stale',
  'an out-of-order sent event cannot regress delivery'
);

select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'delivery-waba', 'delivery-phone', 'wamid.delivery.1', 'read', '2026-08-17T10:00:03Z'
  )),
  'updated',
  'read advances the message'
);
select is(
  (select read_at from public.whatsapp_messages where id = '96000000-0000-0000-0000-000000000001'),
  '2026-08-17T10:00:03Z'::timestamptz,
  'the read timestamp is retained'
);
select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'delivery-waba', 'delivery-phone', 'wamid.delivery.1', 'read', '2026-08-17T10:00:03Z'
  )),
  'duplicate',
  'a repeated read webhook is idempotent'
);
select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'delivery-waba', 'delivery-phone', 'wamid.delivery.1', 'failed', '2026-08-17T10:00:04Z', '131026'
  )),
  'stale',
  'failure cannot replace confirmed delivery or read'
);

select is(
  (select outcome from public.reconcile_whatsapp_delivery_status(
    'delivery-waba', 'delivery-phone', 'wamid.delivery.2', 'failed', '2026-08-17T10:00:05Z', '131026'
  )),
  'updated',
  'a confirmed delivery failure is persisted'
);
select is(
  (select processing_status from public.whatsapp_messages where id = '96000000-0000-0000-0000-000000000002'),
  'failed',
  'a failed delivery is removed from usable conversation history'
);
select is(
  (select status from public.whatsapp_conversations where id = '95000000-0000-0000-0000-000000000001'),
  'handoff',
  'a failed delivery moves the conversation to operator handoff'
);

select * from finish();
rollback;
