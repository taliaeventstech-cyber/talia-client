create extension if not exists pgtap with schema extensions;

begin;

select plan(28);

select ok(
  not has_function_privilege('authenticated', 'public.get_whatsapp_connection_summary(uuid,uuid)', 'execute'),
  'authenticated cannot read WhatsApp connection details directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.save_whatsapp_embedded_connection(uuid,uuid,text,text,text,text,text,jsonb,text,text)', 'execute'),
  'authenticated cannot persist Embedded Signup credentials directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.get_whatsapp_connection_credentials(uuid,text)', 'execute'),
  'authenticated cannot retrieve encrypted WhatsApp credentials'
);
select ok(
  not has_function_privilege('authenticated', 'public.get_whatsapp_connection_disconnect_context(uuid,uuid,uuid)', 'execute'),
  'authenticated cannot retrieve backend disconnect credentials'
);
select ok(
  not has_function_privilege('authenticated', 'public.disconnect_whatsapp_connection(uuid,uuid,uuid,boolean,text)', 'execute'),
  'authenticated cannot disconnect WhatsApp directly'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'embedded-owner@example.com', '',
  clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp()
), (
  'd1000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'embedded-operator@example.com', '',
  clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp()
), (
  'd1000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'embedded-platform-admin@example.com', '',
  clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp()
);

insert into public.platform_admins (user_id, role)
values ('d1000000-0000-0000-0000-000000000003', 'admin');

insert into public.accounts (id, name, slug)
values ('d2000000-0000-0000-0000-000000000001', 'Embedded Signup tenant', 'embedded-signup-tenant');

insert into public.theatres (id, account_id, name, slug)
values (
  'd3000000-0000-0000-0000-000000000001',
  'd2000000-0000-0000-0000-000000000001',
  'Embedded Signup venue', 'embedded-signup-venue'
);

insert into public.profiles (id, auth_user_id, email, full_name)
values (
  'd4000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'embedded-owner@example.com', 'Embedded Owner'
), (
  'd4000000-0000-0000-0000-000000000002',
  'd1000000-0000-0000-0000-000000000002',
  'embedded-operator@example.com', 'Embedded Operator'
);

insert into public.venue_memberships (theatre_id, profile_id, role)
values (
  'd3000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000001',
  'owner'
), (
  'd3000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000002',
  'operator'
);

select lives_ok(
  $$
    select public.save_whatsapp_embedded_connection(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000001',
      'business-embedded', 'waba-embedded', 'phone-embedded',
      '+34 600 000 000', 'Embedded Venue',
      '{"encrypted_credentials":{"alg":"aes-256-gcm","iv":"iv","tag":"tag","ciphertext":"cipher"}}'::jsonb,
      'connected', null
    )
  $$,
  'a venue owner can persist an encrypted Embedded Signup connection'
);

select is(
  (select credential_source from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  'encrypted',
  'Embedded Signup connections use encrypted credentials'
);
select is(
  (select rollout_enabled from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  true,
  'a completed Embedded Signup connection enables provider routing'
);
select is(
  public.get_whatsapp_connection_summary(
    'd3000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  ) ->> 'status',
  'connected',
  'the owner receives a credential-free connection summary'
);
select ok(
  not (public.get_whatsapp_connection_summary(
    'd3000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  ) ? 'credential_metadata'),
  'the browser summary never includes credential metadata'
);

select lives_ok(
  $$
    select public.save_whatsapp_embedded_connection(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000001',
      'business-embedded', 'waba-embedded', 'phone-embedded',
      '+34 600 000 000', 'Embedded Venue',
      '{"encrypted_credentials":{"alg":"aes-256-gcm","iv":"iv","tag":"tag","ciphertext":"cipher"}}'::jsonb,
      'error', 'meta_phone_registration_http_400'
    )
  $$,
  'a provider failure can update an existing connection'
);
select is(
  (select metadata ->> 'connected_at' from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  null,
  'an error state clears a stale connection timestamp'
);
select is(
  (select metadata ->> 'last_error_code' from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  'meta_phone_registration_http_400',
  'an error state records its provider error'
);
select lives_ok(
  $$
    select public.save_whatsapp_embedded_connection(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000001',
      'business-embedded', 'waba-embedded', 'phone-embedded',
      '+34 600 000 000', 'Embedded Venue',
      '{"encrypted_credentials":{"alg":"aes-256-gcm","iv":"iv","tag":"tag","ciphertext":"cipher"}}'::jsonb,
      'connected', null
    )
  $$,
  'a reconciled provider connection can return to connected'
);
select is(
  (select metadata ->> 'last_error_code' from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  null,
  'a connected state clears a stale provider error'
);

select lives_ok(
  $$
    select public.get_whatsapp_connection_disconnect_context(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000001',
      (select id from public.whatsapp_connections where phone_number_id = 'phone-embedded')
    )
  $$,
  'an owner can load the backend disconnect context'
);

select lives_ok(
  $$
    select public.disconnect_whatsapp_connection(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000001',
      (select id from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
      true,
      null
    )
  $$,
  'an owner can disconnect the Embedded Signup connection'
);

select is(
  (select status from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  'disabled',
  'disconnecting disables the connection'
);
select is(
  (select rollout_enabled from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  false,
  'disconnecting disables provider routing'
);
select is(
  (select credential_metadata from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  '{}'::jsonb,
  'disconnecting removes the stored credential envelope'
);
select is(
  (select count(*) from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
  1::bigint,
  'disconnecting preserves the connection record and its history relationships'
);
select is(
  (
    select action
    from public.audit_events
    where target_id = (select id from public.whatsapp_connections where phone_number_id = 'phone-embedded')
      and action = 'whatsapp.connection_disconnected'
    order by created_at desc
    limit 1
  ),
  'whatsapp.connection_disconnected',
  'disconnecting records an audit event'
);

select throws_ok(
  $$
    select public.disconnect_whatsapp_connection(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000002',
      (select id from public.whatsapp_connections where phone_number_id = 'phone-embedded'),
      false,
      null
    )
  $$,
  'P0001',
  'whatsapp_connection_admin_access_denied',
  'an operator cannot disconnect the venue WhatsApp connection'
);

select lives_ok(
  $$
    select public.get_whatsapp_connection_summary(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000003'
    )
  $$,
  'a platform administrator without a tenant profile can read the connection summary'
);

select lives_ok(
  $$
    select public.save_whatsapp_embedded_connection(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000003',
      'business-platform-admin', 'waba-platform-admin', 'phone-platform-admin',
      '+34 611 111 111', 'Platform Admin Venue',
      '{"encrypted_credentials":{"alg":"aes-256-gcm","iv":"iv","tag":"tag","ciphertext":"cipher"}}'::jsonb,
      'connected', null
    )
  $$,
  'a platform administrator without a tenant profile can persist a connection'
);

select is(
  (
    select actor_profile_id
    from public.audit_events
    where actor_user_id = 'd1000000-0000-0000-0000-000000000003'
      and action = 'whatsapp.embedded_signup_completed'
    order by created_at desc
    limit 1
  ),
  null,
  'platform administrator connection audits retain the actor user without inventing a profile'
);

select throws_ok(
  $$
    select public.save_whatsapp_embedded_connection(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000002',
      'business-operator', 'waba-operator', 'phone-operator',
      null, null,
      '{"encrypted_credentials":{"alg":"aes-256-gcm"}}'::jsonb,
      'connected', null
    )
  $$,
  'P0001',
  'whatsapp_connection_admin_access_denied',
  'an operator cannot change the venue WhatsApp connection'
);

select throws_ok(
  $$
    select public.save_whatsapp_embedded_connection(
      'd3000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000001',
      'business-plaintext', 'waba-plaintext', 'phone-plaintext',
      null, null,
      '{"access_token":"must-not-be-stored","encrypted_credentials":{}}'::jsonb,
      'connected', null
    )
  $$,
  'P0001',
  'whatsapp_embedded_credentials_invalid',
  'plaintext provider credentials are rejected'
);

select * from finish();
rollback;
