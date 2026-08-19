create extension if not exists pgtap with schema extensions;

begin;

select plan(20);

select ok(not has_function_privilege('authenticated', 'public.get_whatsapp_inbound_job_context(uuid,text)', 'execute'), 'authenticated cannot load worker context');
select ok(not has_function_privilege('authenticated', 'public.prepare_whatsapp_agent_reply(uuid,text,text,jsonb)', 'execute'), 'authenticated cannot prepare agent replies');
select ok(not has_function_privilege('authenticated', 'public.mark_whatsapp_agent_send_started(uuid,text,uuid)', 'execute'), 'authenticated cannot start provider sends');
select ok(not has_function_privilege('authenticated', 'public.complete_whatsapp_agent_reply(uuid,text,uuid,text,jsonb,jsonb)', 'execute'), 'authenticated cannot complete agent replies');
select ok(not has_function_privilege('authenticated', 'public.retry_whatsapp_agent_reply(uuid,text,uuid,text,text,integer)', 'execute'), 'authenticated cannot retry agent replies');
select ok(not has_function_privilege('authenticated', 'public.complete_whatsapp_agent_handoff(uuid,text,text,jsonb,boolean,uuid,text)', 'execute'), 'authenticated cannot complete handoffs');

insert into public.accounts (id, name, slug)
values ('41000000-0000-0000-0000-000000000001', 'WhatsApp worker tenant', 'whatsapp-worker-tenant');

insert into public.theatres (id, account_id, name, slug, primary_language)
values ('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'WhatsApp worker venue', 'whatsapp-worker-venue', 'ca');

insert into public.tenant_modules (theatre_id, module_key, status)
values ('42000000-0000-0000-0000-000000000001', 'whatsapp', 'active')
on conflict (theatre_id, module_key) do update set status = excluded.status;

insert into public.tenant_module_entitlements (theatre_id, module_key, enabled)
values ('42000000-0000-0000-0000-000000000001', 'whatsapp', true)
on conflict (theatre_id, module_key) do update set enabled = excluded.enabled;

insert into public.whatsapp_connections (id, theatre_id, waba_id, phone_number_id, status, rollout_enabled)
values (
  '43000000-0000-0000-0000-000000000001',
  '42000000-0000-0000-0000-000000000001',
  'worker-waba',
  'worker-phone',
  'connected',
  true
);

select is(
  (select outcome from public.ingest_whatsapp_message(
    p_waba_id => 'worker-waba',
    p_phone_number_id => 'worker-phone',
    p_provider_message_id => 'wamid.worker.inbound',
    p_sender_wa_id => '34123456789',
    p_profile_name => 'Ada',
    p_message_type => 'text',
    p_body_text => 'Quan obriu?',
    p_provider_timestamp => '2026-08-16T10:00:00Z',
    p_processable => true
  )),
  'accepted',
  'the enabled connection creates one processable inbound job'
);

update public.whatsapp_inbound_jobs set available_at = clock_timestamp() - interval '1 second';

create temporary table claimed_whatsapp_job as
select * from public.claim_whatsapp_inbound_jobs('pg-worker', 1, 120);

select is(
  public.get_whatsapp_inbound_job_context((select job_id from claimed_whatsapp_job), 'other-worker'),
  null::jsonb,
  'a different worker cannot load the claimed context'
);
select is(
  public.get_whatsapp_inbound_job_context((select job_id from claimed_whatsapp_job), 'pg-worker') #>> '{tenant,id}',
  '42000000-0000-0000-0000-000000000001',
  'the claimed context stays on the resolved tenant'
);
select is(
  jsonb_array_length(public.get_whatsapp_inbound_job_context((select job_id from claimed_whatsapp_job), 'pg-worker') -> 'conversation_context'),
  0,
  'the first turn has empty channel-local history'
);

create temporary table prepared_whatsapp_reply as
select public.prepare_whatsapp_agent_reply(
  (select job_id from claimed_whatsapp_job),
  'pg-worker',
  'Obrim a les sis.',
  '{"agent":"whatsapp_agent"}'::jsonb
) as reply;

select is((select reply ->> 'delivery_status' from prepared_whatsapp_reply), 'queued', 'the provider effect is prepared durably as queued');
select is(
  public.prepare_whatsapp_agent_reply(
    (select job_id from claimed_whatsapp_job),
    'pg-worker',
    'A duplicate reply that must not win.',
    '{}'::jsonb
  ) ->> 'id',
  (select reply ->> 'id' from prepared_whatsapp_reply),
  'preparing the same inbound reply is idempotent'
);
select is((select count(*) from public.whatsapp_messages)::bigint, 2::bigint, 'only one outbound reply exists');
select ok(
  public.mark_whatsapp_agent_send_started(
    (select job_id from claimed_whatsapp_job),
    'pg-worker',
    (select (reply ->> 'id')::uuid from prepared_whatsapp_reply)
  ),
  'the worker crosses the provider-send boundary once'
);
select ok(
  public.complete_whatsapp_agent_reply(
    (select job_id from claimed_whatsapp_job),
    'pg-worker',
    (select (reply ->> 'id')::uuid from prepared_whatsapp_reply),
    'wamid.worker.outbound',
    '{"version":1,"state":"answered_with_evidence","clarification_attempts":0}'::jsonb,
    '{"response_language":"ca"}'::jsonb
  ),
  'a confirmed provider send completes atomically'
);
select is((select provider_message_id from public.whatsapp_messages where direction = 'outbound'), 'wamid.worker.outbound', 'the confirmed Meta message ID replaces the pending ID');
select is((select delivery_status from public.whatsapp_messages where direction = 'outbound'), 'sent', 'the outbound reply is marked sent');
select is((select processing_status from public.whatsapp_messages where direction = 'inbound'), 'responded', 'the inbound message is marked responded');
select is((select status from public.whatsapp_inbound_jobs), 'completed', 'the durable job is completed');
select is((select status from public.whatsapp_conversations), 'open', 'the conversation returns to open after a response');

select * from finish();
rollback;
