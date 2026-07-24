create extension if not exists pgtap with schema extensions;

begin;

select plan(7);

create temporary table claimed_email_sync_run (
  id uuid not null
) on commit drop;

insert into claimed_email_sync_run (id)
select public.claim_email_sync_run('pgtap-worker', 600);

select isnt(
  (select id from claimed_email_sync_run),
  null::uuid,
  'a worker can claim an email sync run'
);

select is(
  public.claim_email_sync_run('second-worker', 600),
  null::uuid,
  'a second worker cannot claim a concurrent run'
);

select is(
  public.finish_email_sync_run(
    (select id from claimed_email_sync_run),
    'pgtap-worker',
    'succeeded'
  ),
  true,
  'the claiming worker can finish its run'
);

select is(
  (
    select status
    from public.email_sync_runs
    where id = (select id from claimed_email_sync_run)
  ),
  'succeeded',
  'the finished run is stored durably'
);

select ok(
  not has_table_privilege('anon', 'public.email_sync_runs', 'select'),
  'anon cannot read email sync runs'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_email_sync_run(text,integer)',
    'execute'
  ),
  'anon cannot claim email sync runs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_email_sync_run(text,integer)',
    'execute'
  ),
  'service role can claim email sync runs'
);

select * from finish();
rollback;
