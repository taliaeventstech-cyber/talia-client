create extension if not exists pgtap with schema extensions;

begin;

select plan(10);

select ok(
  not has_function_privilege(
    'anon',
    'public.search_knowledge_text(uuid,text,integer)',
    'execute'
  ),
  'anon cannot execute tenant knowledge full-text retrieval'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.search_knowledge_text(uuid,text,integer)',
    'execute'
  ),
  'authenticated cannot execute tenant knowledge full-text retrieval'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.match_knowledge(uuid,extensions.vector,integer,double precision)',
    'execute'
  ),
  'anon cannot execute tenant semantic retrieval'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.match_knowledge(uuid,extensions.vector,integer,double precision)',
    'execute'
  ),
  'authenticated cannot execute tenant semantic retrieval'
);

insert into public.accounts (id, name, slug)
values
  ('31000000-0000-0000-0000-000000000001', 'Knowledge tenant A', 'knowledge-tenant-a'),
  ('31000000-0000-0000-0000-000000000002', 'Knowledge tenant B', 'knowledge-tenant-b');

insert into public.theatres (id, account_id, name, slug)
values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Knowledge venue A', 'knowledge-venue-a'),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'Knowledge venue B', 'knowledge-venue-b');

insert into public.knowledge_sources (id, theatre_id, type, name, status)
values
  ('33000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'url', 'Venue A web', 'ready'),
  ('33000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', 'manual', 'Venue A FAQs', 'ready'),
  ('33000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000002', 'manual', 'Venue B FAQs', 'ready');

insert into public.knowledge_chunks (
  id,
  theatre_id,
  source_id,
  chunk_index,
  content,
  language,
  active
) values
  (
    '34000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',
    0,
    'Ens trobareu al Carrer de la Cultura, 24, Barcelona.',
    'ca',
    true
  ),
  (
    '34000000-0000-0000-0000-000000000002',
    '32000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',
    1,
    'secretinactiu',
    'ca',
    false
  );

with embedding_value as (
  select (
    '[' || string_agg('0.1', ',') || ']'
  )::extensions.vector as value
  from generate_series(1, 1536)
)
insert into public.knowledge_items (
  id,
  theatre_id,
  source_id,
  question,
  answer,
  category,
  language,
  priority,
  active,
  embedding,
  embedding_status
)
select
  row.id,
  row.theatre_id,
  row.source_id,
  row.question,
  row.answer,
  row.category,
  row.language,
  row.priority,
  row.active,
  embedding_value.value,
  'ready'
from (
  values
    (
      '35000000-0000-0000-0000-000000000001'::uuid,
      '32000000-0000-0000-0000-000000000001'::uuid,
      '33000000-0000-0000-0000-000000000002'::uuid,
      'Política de devolución',
      'Las entradas no admiten cambios ni devoluciones.',
      'entradas',
      'es',
      80,
      true
    ),
    (
      '35000000-0000-0000-0000-000000000002'::uuid,
      '32000000-0000-0000-0000-000000000001'::uuid,
      '33000000-0000-0000-0000-000000000002'::uuid,
      'Información general',
      'Consulta aquí la política de devolución.',
      'información',
      'es',
      10,
      true
    ),
    (
      '35000000-0000-0000-0000-000000000003'::uuid,
      '32000000-0000-0000-0000-000000000001'::uuid,
      '33000000-0000-0000-0000-000000000002'::uuid,
      'secretinactiu',
      'No debe recuperarse.',
      'interno',
      'es',
      100,
      false
    ),
    (
      '35000000-0000-0000-0000-000000000004'::uuid,
      '32000000-0000-0000-0000-000000000002'::uuid,
      '33000000-0000-0000-0000-000000000003'::uuid,
      'Política de devolución',
      'Respuesta perteneciente a otro tenant.',
      'entradas',
      'es',
      100,
      true
    )
) as row(id, theatre_id, source_id, question, answer, category, language, priority, active)
cross join embedding_value;

select is(
  (
    select count(*)::integer
    from public.search_knowledge_text(
      '32000000-0000-0000-0000-000000000001',
      'carrer cultura',
      10
    )
  ),
  1,
  'full-text retrieval searches the active tenant corpus'
);

select is(
  (
    select count(*)::integer
    from public.search_knowledge_text(
      '32000000-0000-0000-0000-000000000001',
      'secretinactiu',
      10
    )
  ),
  0,
  'full-text retrieval excludes inactive evidence'
);

select is(
  (
    select count(*)::integer
    from public.search_knowledge_text(
      '32000000-0000-0000-0000-000000000001',
      'devolución',
      10
    )
  ),
  2,
  'full-text retrieval preserves accented lexemes'
);

select is(
  (
    select id
    from public.search_knowledge_text(
      '32000000-0000-0000-0000-000000000001',
      'devolución',
      10
    )
    limit 1
  ),
  '35000000-0000-0000-0000-000000000001'::uuid,
  'an item question match ranks above the same term in an answer'
);

select ok(
  (
    with query_embedding as (
      select (
        '[' || string_agg('0.1', ',') || ']'
      )::extensions.vector as value
      from generate_series(1, 1536)
    )
    select bool_and(match.id <> '35000000-0000-0000-0000-000000000004'::uuid)
    from query_embedding
    cross join lateral public.match_knowledge(
      '32000000-0000-0000-0000-000000000001',
      query_embedding.value,
      10,
      0.5
    ) as match
  ),
  'semantic retrieval never returns another tenant item'
);

update public.knowledge_items
set answer = 'Respuesta actualizada.'
where id = '35000000-0000-0000-0000-000000000001';

select ok(
  (
    select embedding is null and embedding_status = 'pending'
    from public.knowledge_items
    where id = '35000000-0000-0000-0000-000000000001'
  ),
  'editing semantic item content resets its embedding'
);

select * from finish();
rollback;
