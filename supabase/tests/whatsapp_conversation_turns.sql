create extension if not exists pgtap with schema extensions;

begin;

select plan(25);

select ok(
  not has_function_privilege('authenticated', 'public.prepare_whatsapp_conversation_turn(uuid,text,text,jsonb)', 'execute'),
  'authenticated cannot prepare coalesced WhatsApp turns'
);
select ok(
  not has_function_privilege('authenticated', 'public.start_whatsapp_conversation_turn_send(uuid,text,uuid)', 'execute'),
  'authenticated cannot cross the coalesced provider-send boundary'
);
select ok(
  not has_function_privilege('authenticated', 'public.complete_whatsapp_conversation_turn(uuid,text,uuid,text,jsonb,jsonb)', 'execute'),
  'authenticated cannot complete coalesced WhatsApp turns'
);

insert into public.accounts (id, name, slug)
values ('81000000-0000-0000-0000-000000000001', 'WhatsApp turn tenant', 'whatsapp-turn-tenant');

insert into public.theatres (id, account_id, name, slug, primary_language)
values (
  '82000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  'WhatsApp turn venue',
  'whatsapp-turn-venue',
  'es'
);

insert into public.tenant_modules (theatre_id, module_key, status)
values ('82000000-0000-0000-0000-000000000001', 'whatsapp', 'active')
on conflict (theatre_id, module_key) do update set status = excluded.status;

insert into public.tenant_module_entitlements (theatre_id, module_key, enabled)
values ('82000000-0000-0000-0000-000000000001', 'whatsapp', true)
on conflict (theatre_id, module_key) do update set enabled = excluded.enabled;

insert into public.whatsapp_connections (id, theatre_id, waba_id, phone_number_id, status, rollout_enabled)
values (
  '83000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001',
  'turn-waba',
  'turn-phone',
  'connected',
  true
);

select is(
  (select outcome from public.ingest_whatsapp_message(
    p_waba_id => 'turn-waba',
    p_phone_number_id => 'turn-phone',
    p_provider_message_id => 'wamid.turn.1',
    p_sender_wa_id => '34111111111',
    p_profile_name => 'Ada',
    p_message_type => 'text',
    p_body_text => 'Hola, que tal?',
    p_provider_timestamp => '2026-08-16T16:00:00Z',
    p_processable => true
  )),
  'accepted',
  'the first burst message is accepted'
);
select is(
  (select outcome from public.ingest_whatsapp_message(
    p_waba_id => 'turn-waba',
    p_phone_number_id => 'turn-phone',
    p_provider_message_id => 'wamid.turn.2',
    p_sender_wa_id => '34111111111',
    p_profile_name => 'Ada',
    p_message_type => 'text',
    p_body_text => 'Me gustaria saber si el teatro',
    p_provider_timestamp => '2026-08-16T16:00:01Z',
    p_processable => true
  )),
  'accepted',
  'the second burst message is accepted'
);
select is(
  (select outcome from public.ingest_whatsapp_message(
    p_waba_id => 'turn-waba',
    p_phone_number_id => 'turn-phone',
    p_provider_message_id => 'wamid.turn.3',
    p_sender_wa_id => '34111111111',
    p_profile_name => 'Ada',
    p_message_type => 'text',
    p_body_text => 'es accesible, gracias.',
    p_provider_timestamp => '2026-08-16T16:00:02Z',
    p_processable => true
  )),
  'accepted',
  'the third burst message is accepted'
);

select is((select count(*) from public.whatsapp_inbound_jobs)::bigint, 3::bigint, 'every inbound message remains durable');
select is((select count(distinct available_at) from public.whatsapp_inbound_jobs)::bigint, 1::bigint, 'the burst shares one quiet-window deadline');
select ok((select min(available_at) > clock_timestamp() from public.whatsapp_inbound_jobs), 'the burst is not immediately claimable');

update public.whatsapp_inbound_jobs set available_at = clock_timestamp() - interval '1 second';
create temporary table first_turn_claim as
select * from public.claim_whatsapp_inbound_jobs('turn-worker-1', 3, 120);

select is((select count(*) from first_turn_claim)::bigint, 1::bigint, 'only one anchor is claimed for the conversation');
select is(
  public.get_whatsapp_inbound_job_context((select job_id from first_turn_claim), 'turn-worker-1') #>> '{turn,message_count}',
  '3',
  'loading the anchor claims all due burst jobs'
);
select is(
  public.get_whatsapp_inbound_job_context((select job_id from first_turn_claim), 'turn-worker-1') #>> '{message,body_text}',
  E'Hola, que tal?\nMe gustaria saber si el teatro\nes accesible, gracias.',
  'the agent receives one ordered natural-language turn'
);
select is(
  public.get_whatsapp_inbound_job_context((select job_id from first_turn_claim), 'turn-worker-1') #>> '{message,provider_message_id}',
  'wamid.turn.3',
  'the coalesced turn is linked to the latest provider message'
);
select is(
  public.get_whatsapp_inbound_job_context((select job_id from first_turn_claim), 'turn-worker-1') #>> '{turn,ai_disclosure_required}',
  'true',
  'the first automated response requires an AI disclosure'
);

create temporary table stale_prepared_reply as
select public.prepare_whatsapp_conversation_turn(
  (select job_id from first_turn_claim),
  'turn-worker-1',
  'Primera respuesta que quedara obsoleta.',
  '{"agent":"whatsapp_agent"}'::jsonb
) as result;

select is((select result ->> 'state' from stale_prepared_reply), 'prepared', 'the initial turn is prepared durably');

select is(
  (select outcome from public.ingest_whatsapp_message(
    p_waba_id => 'turn-waba',
    p_phone_number_id => 'turn-phone',
    p_provider_message_id => 'wamid.turn.4',
    p_sender_wa_id => '34111111111',
    p_profile_name => 'Ada',
    p_message_type => 'text',
    p_body_text => 'Y hay ascensor?',
    p_provider_timestamp => '2026-08-16T16:00:03Z',
    p_processable => true
  )),
  'accepted',
  'a message arriving during generation is accepted independently'
);
select is(
  public.start_whatsapp_conversation_turn_send(
    (select job_id from first_turn_claim),
    'turn-worker-1',
    (select (result #>> '{outbound,id}')::uuid from stale_prepared_reply)
  ),
  'stale',
  'the final freshness check prevents the obsolete provider send'
);
select is(
  (select delivery_status from public.whatsapp_messages where body_text = 'Primera respuesta que quedara obsoleta.'),
  'failed',
  'the obsolete prepared response is auditable as failed'
);
select is((select count(*) from public.whatsapp_inbound_jobs where status = 'pending')::bigint, 4::bigint, 'the full turn is requeued with the new message');

update public.whatsapp_inbound_jobs set available_at = clock_timestamp() - interval '1 second';
create temporary table final_turn_claim as
select * from public.claim_whatsapp_inbound_jobs('turn-worker-2', 3, 120);
create temporary table final_turn_context as
select public.get_whatsapp_inbound_job_context(
  (select job_id from final_turn_claim),
  'turn-worker-2'
) as context;

select is((select context #>> '{turn,message_count}' from final_turn_context), '4', 'the regenerated turn includes the late message');

create temporary table final_prepared_reply as
select public.prepare_whatsapp_conversation_turn(
  (select job_id from final_turn_claim),
  'turn-worker-2',
  'Hola, soy TALIA, el asistente virtual con IA. Si, el teatro es accesible.',
  '{"agent":"whatsapp_agent","ai_disclosure_included":true}'::jsonb
) as result;

select is(
  public.start_whatsapp_conversation_turn_send(
    (select job_id from final_turn_claim),
    'turn-worker-2',
    (select (result #>> '{outbound,id}')::uuid from final_prepared_reply)
  ),
  'started',
  'the fresh coalesced turn crosses the provider-send boundary'
);
select ok(
  public.complete_whatsapp_conversation_turn(
    (select job_id from final_turn_claim),
    'turn-worker-2',
    (select (result #>> '{outbound,id}')::uuid from final_prepared_reply),
    'wamid.turn.outbound',
    '{"version":1,"state":"answered_with_evidence","clarification_attempts":0}'::jsonb,
    '{"agent":"whatsapp_agent","ai_disclosure_included":true}'::jsonb
  ),
  'one confirmed provider send completes the coalesced turn'
);
select is((select count(*) from public.whatsapp_inbound_jobs where status = 'completed')::bigint, 4::bigint, 'all burst jobs complete together');
select is((select count(*) from public.whatsapp_messages where direction = 'inbound' and processing_status = 'responded')::bigint, 4::bigint, 'all burst messages are marked responded');
select ok(
  (select metadata ? 'ai_disclosure_sent_at' from public.whatsapp_conversations),
  'the disclosure is persisted only after the confirmed send'
);

select * from finish();
rollback;
