create extension if not exists pgtap with schema extensions;

begin;

select plan(6);

select ok(
  not has_table_privilege('anon', 'public.security_rate_limits', 'select'),
  'anon cannot read security rate-limit counters'
);
select ok(
  not has_table_privilege('authenticated', 'public.security_rate_limits', 'select'),
  'authenticated users cannot read security rate-limit counters'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.consume_security_rate_limit(text,text,integer,integer)',
    'execute'
  ),
  'anon cannot consume security rate limits directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_security_rate_limit(text,text,integer,integer)',
    'execute'
  ),
  'authenticated users cannot consume security rate limits directly'
);

select is(
  (
    select allowed
    from public.consume_security_rate_limit(
      'pgtap',
      repeat('a', 64),
      1,
      60
    )
  ),
  true,
  'the first request in a distributed window is allowed'
);
select is(
  (
    select allowed
    from public.consume_security_rate_limit(
      'pgtap',
      repeat('a', 64),
      1,
      60
    )
  ),
  false,
  'a request above the distributed window limit is rejected'
);

select * from finish();
rollback;
