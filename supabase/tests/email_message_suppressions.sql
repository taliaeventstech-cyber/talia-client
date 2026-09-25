create extension if not exists pgtap with schema extensions;

begin;

select plan(9);

select ok(
  not has_table_privilege('anon', 'public.email_message_suppressions', 'select'),
  'anon cannot read email suppression markers'
);
select ok(
  not has_table_privilege('authenticated', 'public.email_message_suppressions', 'select'),
  'authenticated cannot read email suppression markers'
);

insert into public.accounts (id, name, slug)
values
  ('31000000-0000-0000-0000-000000000001', 'Suppression account A', 'suppression-account-a'),
  ('31000000-0000-0000-0000-000000000002', 'Suppression account B', 'suppression-account-b');

insert into public.theatres (id, account_id, name, slug)
values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Suppression venue A', 'suppression-venue-a'),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'Suppression venue B', 'suppression-venue-b');

insert into public.email_connections (id, theatre_id, mailbox_email)
values
  ('33000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'suppression-a@example.com'),
  ('33000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', 'suppression-b@example.com');

insert into public.email_threads (id, theatre_id, connection_id, provider_thread_id)
values
  ('34000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', 'provider-thread-a'),
  ('34000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000002', 'provider-thread-b');

insert into public.email_messages (
  theatre_id,
  connection_id,
  thread_id,
  provider_message_id,
  direction
)
values
  ('32000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', 'provider-message-a-1', 'inbound'),
  ('32000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', 'provider-message-a-2', 'inbound'),
  ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000002', 'provider-message-b-1', 'inbound');

select is(
  public.delete_email_threads_from_talia(
    '32000000-0000-0000-0000-000000000001',
    array['34000000-0000-0000-0000-000000000001']::uuid[]
  ),
  1,
  'the atomic deletion reports the deleted TALIA thread'
);

select is(
  (select count(*) from public.email_threads where id = '34000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the selected TALIA thread is deleted'
);
select is(
  (select count(*) from public.email_messages where thread_id = '34000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the selected thread messages are deleted in cascade'
);
select is(
  (select count(*) from public.email_message_suppressions where connection_id = '33000000-0000-0000-0000-000000000001'),
  2::bigint,
  'one suppression marker is retained for each deleted provider message'
);
select ok(
  exists (
    select 1
    from public.email_message_suppressions
    where connection_id = '33000000-0000-0000-0000-000000000001'
      and provider_message_id_hash = encode(
        extensions.digest(
          convert_to('33000000-0000-0000-0000-000000000001:provider-message-a-1', 'UTF8'),
          'sha256'
        ),
        'hex'
      )
  ),
  'the marker is a connection-scoped hash rather than mailbox content'
);
select is(
  public.delete_email_threads_from_talia(
    '32000000-0000-0000-0000-000000000001',
    array['34000000-0000-0000-0000-000000000002']::uuid[]
  ),
  0,
  'a venue cannot delete another tenant email thread'
);
select ok(
  exists (select 1 from public.email_threads where id = '34000000-0000-0000-0000-000000000002'),
  'the cross-tenant email thread remains intact'
);

select * from finish();
rollback;
