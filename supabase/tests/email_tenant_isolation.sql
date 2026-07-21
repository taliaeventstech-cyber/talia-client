create extension if not exists pgtap with schema extensions;

begin;

select plan(11);

select ok(not has_table_privilege('anon', 'public.email_connections', 'select'), 'anon cannot select email connections');
select ok(not has_table_privilege('anon', 'public.email_threads', 'select'), 'anon cannot select email threads');
select ok(not has_table_privilege('anon', 'public.email_messages', 'select'), 'anon cannot select email messages');
select ok(not has_table_privilege('anon', 'public.email_drafts', 'select'), 'anon cannot select email drafts');
select ok(not has_table_privilege('authenticated', 'public.email_connections', 'select'), 'authenticated cannot select email connections');
select ok(not has_table_privilege('authenticated', 'public.email_threads', 'select'), 'authenticated cannot select email threads');
select ok(not has_table_privilege('authenticated', 'public.email_messages', 'select'), 'authenticated cannot select email messages');
select ok(not has_table_privilege('authenticated', 'public.email_drafts', 'select'), 'authenticated cannot select email drafts');

insert into public.accounts (id, name, slug)
values
  ('21000000-0000-0000-0000-000000000001', 'CASA tenant A', 'casa-tenant-a'),
  ('21000000-0000-0000-0000-000000000002', 'CASA tenant B', 'casa-tenant-b');

insert into public.theatres (id, account_id, name, slug)
values
  ('22000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'CASA venue A', 'casa-venue-a'),
  ('22000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'CASA venue B', 'casa-venue-b');

insert into public.email_connections (id, theatre_id, mailbox_email)
values (
  '23000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'casa-a@example.com'
);

insert into public.email_threads (id, theatre_id, connection_id, provider_thread_id)
values (
  '24000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000001',
  'thread-a'
);

select throws_ok(
  $$
    insert into public.email_threads (theatre_id, connection_id, provider_thread_id)
    values (
      '22000000-0000-0000-0000-000000000002',
      '23000000-0000-0000-0000-000000000001',
      'cross-tenant-thread'
    )
  $$,
  '23503',
  null,
  'a thread cannot reference another tenant connection'
);

select throws_ok(
  $$
    insert into public.email_messages (
      theatre_id, connection_id, thread_id, provider_message_id, direction
    ) values (
      '22000000-0000-0000-0000-000000000002',
      '23000000-0000-0000-0000-000000000001',
      '24000000-0000-0000-0000-000000000001',
      'cross-tenant-message',
      'inbound'
    )
  $$,
  '23503',
  null,
  'a message cannot reference another tenant thread'
);

select throws_ok(
  $$
    insert into public.email_drafts (theatre_id, connection_id, thread_id)
    values (
      '22000000-0000-0000-0000-000000000002',
      '23000000-0000-0000-0000-000000000001',
      '24000000-0000-0000-0000-000000000001'
    )
  $$,
  '23503',
  null,
  'a draft cannot reference another tenant thread'
);

select * from finish();
rollback;
