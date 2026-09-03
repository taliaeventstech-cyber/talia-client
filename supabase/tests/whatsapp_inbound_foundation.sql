create extension if not exists pgtap with schema extensions;

begin;

select plan(21);

select ok(not has_table_privilege('anon', 'public.whatsapp_connections', 'select'), 'anon cannot read WhatsApp connections');
select ok(not has_table_privilege('anon', 'public.whatsapp_contacts', 'select'), 'anon cannot read WhatsApp identities');
select ok(not has_table_privilege('anon', 'public.whatsapp_conversations', 'select'), 'anon cannot read WhatsApp conversations');
select ok(not has_table_privilege('anon', 'public.whatsapp_messages', 'select'), 'anon cannot read WhatsApp content');
select ok(not has_table_privilege('anon', 'public.whatsapp_inbound_jobs', 'select'), 'anon cannot read WhatsApp jobs');
select ok(not has_table_privilege('authenticated', 'public.whatsapp_connections', 'select'), 'authenticated cannot read WhatsApp connections');
select ok(not has_table_privilege('authenticated', 'public.whatsapp_contacts', 'select'), 'authenticated cannot read WhatsApp identities');
select ok(not has_table_privilege('authenticated', 'public.whatsapp_conversations', 'select'), 'authenticated cannot read WhatsApp conversations');
select ok(not has_table_privilege('authenticated', 'public.whatsapp_messages', 'select'), 'authenticated cannot read WhatsApp content');
select ok(not has_table_privilege('authenticated', 'public.whatsapp_inbound_jobs', 'select'), 'authenticated cannot read WhatsApp jobs');
select ok(
  not has_function_privilege(
    'authenticated',
    'public.ingest_whatsapp_message(text,text,text,text,text,text,text,timestamptz,text,boolean,jsonb)',
    'execute'
  ),
  'authenticated cannot call WhatsApp ingestion directly'
);

insert into public.accounts (id, name, slug)
values
  ('31000000-0000-0000-0000-000000000001', 'WhatsApp tenant A', 'whatsapp-tenant-a'),
  ('31000000-0000-0000-0000-000000000002', 'WhatsApp tenant B', 'whatsapp-tenant-b');

insert into public.theatres (id, account_id, name, slug)
values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'WhatsApp venue A', 'whatsapp-venue-a'),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'WhatsApp venue B', 'whatsapp-venue-b');

insert into public.tenant_modules (theatre_id, module_key, status)
values ('32000000-0000-0000-0000-000000000001', 'whatsapp', 'active')
on conflict (theatre_id, module_key) do update set status = excluded.status;

insert into public.tenant_module_entitlements (theatre_id, module_key, enabled)
values ('32000000-0000-0000-0000-000000000001', 'whatsapp', true)
on conflict (theatre_id, module_key) do update set enabled = excluded.enabled;

insert into public.whatsapp_connections (
  id,
  theatre_id,
  waba_id,
  phone_number_id,
  status,
  rollout_enabled
) values (
  '33000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  'waba-a',
  'phone-a',
  'connected',
  true
);

select is(
  (
    select outcome from public.ingest_whatsapp_message(
      p_waba_id => 'waba-a',
      p_phone_number_id => 'phone-a',
      p_provider_message_id => 'wamid-1',
      p_sender_wa_id => '34123456789',
      p_profile_name => 'Ada',
      p_message_type => 'text',
      p_body_text => 'When does the show start?',
      p_provider_timestamp => '2026-08-14T16:00:00Z',
      p_processable => true
    )
  ),
  'accepted',
  'an enabled connection accepts and queues a text message'
);
select is((select count(*) from public.whatsapp_messages)::bigint, 1::bigint, 'the inbound message is persisted once');
select is((select count(*) from public.whatsapp_inbound_jobs)::bigint, 1::bigint, 'the inbound message gets one durable job');

select is(
  (
    select outcome from public.ingest_whatsapp_message(
      p_waba_id => 'waba-a',
      p_phone_number_id => 'phone-a',
      p_provider_message_id => 'wamid-1',
      p_sender_wa_id => '34123456789',
      p_profile_name => 'Ada',
      p_message_type => 'text',
      p_body_text => 'When does the show start?',
      p_provider_timestamp => '2026-08-14T16:00:00Z',
      p_processable => true
    )
  ),
  'duplicate',
  'a retried Meta delivery is identified as a duplicate'
);
select is((select count(*) from public.whatsapp_messages)::bigint, 1::bigint, 'a retry does not duplicate content');
select is((select count(*) from public.whatsapp_inbound_jobs)::bigint, 1::bigint, 'a retry does not duplicate work');

select is(
  (
    select outcome from public.ingest_whatsapp_message(
      p_waba_id => 'unknown-waba',
      p_phone_number_id => 'unknown-phone',
      p_provider_message_id => 'wamid-unmatched',
      p_sender_wa_id => '34123456789',
      p_profile_name => 'Ada',
      p_message_type => 'text',
      p_body_text => 'Hello',
      p_provider_timestamp => '2026-08-14T16:01:00Z',
      p_processable => true
    )
  ),
  'unmatched',
  'unknown WABA numbers fail closed without selecting a tenant'
);

update public.whatsapp_connections set rollout_enabled = false where id = '33000000-0000-0000-0000-000000000001';
select is(
  (
    select outcome from public.ingest_whatsapp_message(
      p_waba_id => 'waba-a',
      p_phone_number_id => 'phone-a',
      p_provider_message_id => 'wamid-disabled',
      p_sender_wa_id => '34123456789',
      p_profile_name => 'Ada',
      p_message_type => 'text',
      p_body_text => 'Hello again',
      p_provider_timestamp => '2026-08-14T16:02:00Z',
      p_processable => true
    )
  ),
  'disabled',
  'a disabled rollout stores content but does not enqueue it'
);
select is((select count(*) from public.whatsapp_inbound_jobs)::bigint, 1::bigint, 'disabled rollout creates no additional job');

select throws_ok(
  $$
    insert into public.whatsapp_contacts (theatre_id, connection_id, wa_id)
    values (
      '32000000-0000-0000-0000-000000000002',
      '33000000-0000-0000-0000-000000000001',
      'cross-tenant-contact'
    )
  $$,
  '23503',
  null,
  'a WhatsApp contact cannot reference another tenant connection'
);

select * from finish();
rollback;
