create extension if not exists pgtap with schema extensions;

begin;

select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'instagram-owner@example.com', '',
  clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp()
);

insert into public.accounts (id, name, slug)
values ('e2000000-0000-0000-0000-000000000001', 'Instagram tenant', 'instagram-reconnect-tenant');

insert into public.theatres (id, account_id, name, slug)
values (
  'e3000000-0000-0000-0000-000000000001',
  'e2000000-0000-0000-0000-000000000001',
  'Instagram venue', 'instagram-reconnect-venue'
);

insert into public.profiles (id, auth_user_id, email, full_name)
values (
  'e4000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  'instagram-owner@example.com', 'Instagram Owner'
);

insert into public.venue_memberships (theatre_id, profile_id, role)
values (
  'e3000000-0000-0000-0000-000000000001',
  'e4000000-0000-0000-0000-000000000001',
  'owner'
);

select lives_ok(
  $$
    select public.save_instagram_connection(
      'e3000000-0000-0000-0000-000000000001',
      'e1000000-0000-0000-0000-000000000001',
      '17841400000000001', 'approved.venue', 'business',
      array['instagram_business_basic', 'instagram_business_manage_messages'],
      '{"encrypted_credentials":{"alg":"aes-256-gcm","iv":"iv","tag":"tag","ciphertext":"cipher"}}'::jsonb
    )
  $$,
  'a new Instagram connection can be saved'
);

select is(
  (select rollout_enabled from public.instagram_connections where instagram_user_id = '17841400000000001'),
  false,
  'a brand-new Instagram account remains fail-closed'
);

update public.instagram_connections
set rollout_enabled = true,
    metadata = metadata || jsonb_build_object('rollout_approved', true)
where instagram_user_id = '17841400000000001';

select lives_ok(
  $$
    select public.disconnect_instagram_connection(
      'e3000000-0000-0000-0000-000000000001',
      'e1000000-0000-0000-0000-000000000001',
      (select id from public.instagram_connections where instagram_user_id = '17841400000000001'),
      true, null
    )
  $$,
  'an approved Instagram connection can be disconnected'
);

select is(
  (select rollout_enabled from public.instagram_connections where instagram_user_id = '17841400000000001'),
  false,
  'disconnecting still disables provider routing'
);

select lives_ok(
  $$
    select public.save_instagram_connection(
      'e3000000-0000-0000-0000-000000000001',
      'e1000000-0000-0000-0000-000000000001',
      '17841400000000001', 'approved.venue', 'business',
      array['instagram_business_basic', 'instagram_business_manage_messages'],
      '{"encrypted_credentials":{"alg":"aes-256-gcm","iv":"new-iv","tag":"new-tag","ciphertext":"new-cipher"}}'::jsonb
    )
  $$,
  'the same approved account can reconnect'
);

select is(
  (select rollout_enabled from public.instagram_connections where instagram_user_id = '17841400000000001'),
  true,
  'reconnecting the same approved account restores provider routing'
);

select is(
  (select metadata ->> 'rollout_approved' from public.instagram_connections where instagram_user_id = '17841400000000001'),
  'true',
  'the pilot approval survives the reconnect'
);

select lives_ok(
  $$
    select public.save_instagram_connection(
      'e3000000-0000-0000-0000-000000000001',
      'e1000000-0000-0000-0000-000000000001',
      '17841400000000002', 'different.venue', 'creator',
      array['instagram_business_basic', 'instagram_business_manage_messages'],
      '{"encrypted_credentials":{"alg":"aes-256-gcm","iv":"other-iv","tag":"other-tag","ciphertext":"other-cipher"}}'::jsonb
    )
  $$,
  'a different account can replace the previous account'
);

select ok(
  (
    select not rollout_enabled and not (metadata ? 'rollout_approved')
    from public.instagram_connections
    where instagram_user_id = '17841400000000002'
  ),
  'pilot approval is never transferred to a different Instagram account'
);

select * from finish();

rollback;
