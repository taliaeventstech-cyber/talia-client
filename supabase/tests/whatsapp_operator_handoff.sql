create extension if not exists pgtap with schema extensions;

begin;

select plan(27);

select ok(
  not has_function_privilege('authenticated', 'public.get_whatsapp_handoff_queue(uuid,uuid,integer)', 'execute'),
  'authenticated cannot read the private WhatsApp handoff queue'
);
select ok(
  not has_function_privilege('authenticated', 'public.prepare_whatsapp_operator_reply(uuid,uuid,uuid,text,uuid)', 'execute'),
  'authenticated cannot obtain private Meta send context'
);
select ok(
  not has_function_privilege('authenticated', 'public.resolve_whatsapp_handoff(uuid,uuid,uuid)', 'execute'),
  'authenticated cannot resolve handoffs directly'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'operator-handoff@example.com', '',
  clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp()
), (
  'a1000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'viewer-handoff@example.com', '',
  clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp()
);

insert into public.accounts (id, name, slug)
values ('a2000000-0000-0000-0000-000000000001', 'Operator handoff tenant', 'operator-handoff-tenant');

insert into public.theatres (id, account_id, name, slug, primary_language)
values (
  'a3000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'Operator handoff venue', 'operator-handoff-venue', 'es'
);

insert into public.profiles (id, auth_user_id, email, full_name)
values (
  'a4000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'operator-handoff@example.com', 'Ada Operator'
), (
  'a4000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000002',
  'viewer-handoff@example.com', 'Vera Viewer'
);

insert into public.venue_memberships (theatre_id, profile_id, role)
values (
  'a3000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001',
  'operator'
), (
  'a3000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000002',
  'viewer'
);

insert into public.whatsapp_connections (id, theatre_id, waba_id, phone_number_id, status, rollout_enabled)
values (
  'a5000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'operator-waba', 'operator-phone', 'connected', true
);

insert into public.whatsapp_contacts (id, theatre_id, connection_id, wa_id, profile_name)
values (
  'a6000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001',
  '34123456789', 'Alex'
);

insert into public.whatsapp_conversations (
  id, theatre_id, connection_id, contact_id, status, last_message_at, metadata
) values (
  'a7000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001',
  'handoff', '2026-08-17T12:00:00Z', '{"handoff_reason":"low_confidence"}'::jsonb
);

insert into public.whatsapp_messages (
  id, theatre_id, connection_id, conversation_id, contact_id,
  provider_message_id, direction, message_type, body_text, processing_status
) values (
  'a8000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001',
  'a7000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001',
  'wamid.operator.inbound', 'inbound', 'text', 'Necesito hablar con una persona', 'handoff'
);

select is(
  public.get_whatsapp_handoff_queue(
    'a3000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', 100
  ) #>> '{count}',
  '1',
  'an operator can read the tenant handoff queue'
);
select is(
  public.get_whatsapp_handoff_queue(
    'a3000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002', 100
  ) #>> '{items,0,contact_masked}',
  '•••• 6789',
  'viewers see a masked contact identifier'
);
select is(
  public.get_whatsapp_handoff_detail(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002'
  ) #>> '{messages,0,body_text}',
  'Necesito hablar con una persona',
  'viewers can inspect the tenant-scoped transcript'
);
select throws_ok(
  $$ select public.claim_whatsapp_handoff(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002'
  ) $$,
  'P0001', 'whatsapp_operator_access_denied',
  'viewers cannot claim a handoff'
);
select is(
  public.claim_whatsapp_handoff(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001'
  ),
  'claimed',
  'an operator can claim an unassigned handoff'
);
select is(
  (select assigned_profile_id from public.whatsapp_conversations where id = 'a7000000-0000-0000-0000-000000000001'),
  'a4000000-0000-0000-0000-000000000001'::uuid,
  'claiming persists the assigned profile'
);
select is(
  public.claim_whatsapp_handoff(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001'
  ),
  'already_claimed',
  'claiming is idempotent for the same operator'
);
select is(
  (select count(*) from public.audit_events where action = 'whatsapp.handoff_claimed')::bigint,
  1::bigint,
  'the claim is audited once'
);

create temporary table first_prepared_reply as
select public.prepare_whatsapp_operator_reply(
  'a3000000-0000-0000-0000-000000000001',
  'a7000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'Hola, te atiendo personalmente.',
  'a9000000-0000-0000-0000-000000000001'
) as result;

select is((select result ->> 'state' from first_prepared_reply), 'prepared', 'a manual reply is durably prepared');
select is((select result ->> 'recipient_wa_id' from first_prepared_reply), '34123456789', 'only the private preparation RPC returns the recipient');
select is(
  public.prepare_whatsapp_operator_reply(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Texto distinto que no debe duplicarse.',
    'a9000000-0000-0000-0000-000000000001'
  ) ->> 'state',
  'existing',
  'the operator idempotency key cannot create duplicate outbound messages'
);
select is(
  (select count(*) from public.whatsapp_messages where metadata ->> 'operator_idempotency_key' = 'a9000000-0000-0000-0000-000000000001')::bigint,
  1::bigint,
  'one idempotency key has one outbound row'
);
select is(
  public.start_whatsapp_operator_reply_send(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    (select (result ->> 'outbound_message_id')::uuid from first_prepared_reply),
    'a1000000-0000-0000-0000-000000000001'
  ),
  'started',
  'the provider boundary is crossed explicitly'
);
select is(
  public.resolve_whatsapp_handoff(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001'
  ),
  'send_in_progress',
  'a conversation cannot resolve across an in-flight provider send'
);
select ok(
  public.fail_whatsapp_operator_reply(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    (select (result ->> 'outbound_message_id')::uuid from first_prepared_reply),
    'a1000000-0000-0000-0000-000000000001',
    'unknown', 'meta_network_outcome_unknown'
  ),
  'an uncertain provider result is persisted without retry'
);
select is(
  (select delivery_status from public.whatsapp_messages where metadata ->> 'operator_idempotency_key' = 'a9000000-0000-0000-0000-000000000001'),
  'unknown',
  'uncertain delivery stays visibly uncertain'
);
select is(
  (select status from public.whatsapp_conversations where id = 'a7000000-0000-0000-0000-000000000001'),
  'handoff',
  'a failed manual send keeps the handoff open'
);

create temporary table second_prepared_reply as
select public.prepare_whatsapp_operator_reply(
  'a3000000-0000-0000-0000-000000000001',
  'a7000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'Segunda respuesta confirmada.',
  'a9000000-0000-0000-0000-000000000002'
) as result;

select is(
  public.start_whatsapp_operator_reply_send(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    (select (result ->> 'outbound_message_id')::uuid from second_prepared_reply),
    'a1000000-0000-0000-0000-000000000001'
  ),
  'started',
  'a later manual reply can start independently'
);
select ok(
  public.complete_whatsapp_operator_reply(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    (select (result ->> 'outbound_message_id')::uuid from second_prepared_reply),
    'a1000000-0000-0000-0000-000000000001',
    'wamid.operator.outbound'
  ),
  'a confirmed Meta send completes the manual reply'
);
select is(
  (select delivery_status from public.whatsapp_messages where provider_message_id = 'wamid.operator.outbound'),
  'sent',
  'the confirmed provider message starts delivery reconciliation at sent'
);
select is(
  (select count(*) from public.audit_events where action = 'whatsapp.operator_reply_sent')::bigint,
  1::bigint,
  'the confirmed manual send is audited'
);
select is(
  public.resolve_whatsapp_handoff(
    'a3000000-0000-0000-0000-000000000001',
    'a7000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001'
  ),
  'resolved',
  'the assigned operator can resolve the handoff'
);
select is(
  (select status from public.whatsapp_conversations where id = 'a7000000-0000-0000-0000-000000000001'),
  'resolved',
  'resolution closes the current conversation'
);
select is(
  public.get_whatsapp_handoff_queue(
    'a3000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', 100
  ) #>> '{count}',
  '0',
  'resolved conversations disappear from the handoff queue'
);

select * from finish();
rollback;
