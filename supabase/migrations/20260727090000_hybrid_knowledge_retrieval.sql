create extension if not exists vector with schema extensions;

alter table public.knowledge_items
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_status text not null default 'pending',
  add column if not exists embedding_model text,
  add column if not exists embedding_updated_at timestamptz;

alter table public.knowledge_items
  drop constraint if exists knowledge_items_embedding_status_check;

alter table public.knowledge_items
  add constraint knowledge_items_embedding_status_check
  check (embedding_status in ('pending', 'processing', 'ready', 'error'));

create index if not exists knowledge_items_embedding_status_idx
  on public.knowledge_items(theatre_id, embedding_status, created_at)
  where active = true;

create index if not exists knowledge_chunks_full_text_idx
  on public.knowledge_chunks
  using gin (to_tsvector('simple'::regconfig, content))
  where active = true;

create index if not exists knowledge_items_full_text_idx
  on public.knowledge_items
  using gin (
    (
      setweight(to_tsvector('simple'::regconfig, question), 'A') ||
      setweight(to_tsvector('simple'::regconfig, answer), 'B') ||
      setweight(to_tsvector('simple'::regconfig, coalesce(category, '')), 'C')
    )
  )
  where active = true;

create or replace function public.reset_knowledge_item_embedding()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.question is distinct from old.question
    or new.answer is distinct from old.answer
    or new.category is distinct from old.category
    or new.language is distinct from old.language
  then
    new.embedding := null;
    new.embedding_status := 'pending';
    new.embedding_model := null;
    new.embedding_updated_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists knowledge_items_reset_embedding on public.knowledge_items;
create trigger knowledge_items_reset_embedding
  before update of question, answer, category, language
  on public.knowledge_items
  for each row execute function public.reset_knowledge_item_embedding();

revoke all on function public.reset_knowledge_item_embedding() from public;

create or replace function public.search_knowledge_text(
  p_theatre_id uuid,
  p_query text,
  p_match_count integer default 20
)
returns table (
  record_type text,
  id uuid,
  source_id uuid,
  chunk_index integer,
  question text,
  answer text,
  category text,
  language text,
  priority integer,
  metadata jsonb,
  rank double precision
)
language sql
stable
set search_path = public
as $$
  with tokens as (
    select distinct token
    from regexp_split_to_table(lower(p_query), '[^[:alnum:]]+') as token
    where char_length(token) >= 2
    limit 96
  ),
  search_query as (
    select to_tsquery(
      'simple'::regconfig,
      string_agg(quote_literal(token), ' | ')
    ) as value
    from tokens
  ),
  ranked as (
    select
      'chunk'::text as record_type,
      chunk.id,
      chunk.source_id,
      chunk.chunk_index,
      null::text as question,
      chunk.content as answer,
      'documento'::text as category,
      chunk.language,
      45 as priority,
      chunk.metadata,
      ts_rank_cd(
        to_tsvector('simple'::regconfig, chunk.content),
        search_query.value,
        32
      )::double precision as rank
    from public.knowledge_chunks as chunk
    cross join search_query
    where chunk.theatre_id = p_theatre_id
      and chunk.active = true
      and not exists (
        select 1
        from public.knowledge_items as structured_item
        where structured_item.theatre_id = chunk.theatre_id
          and structured_item.source_id = chunk.source_id
          and structured_item.active = true
      )
      and to_tsvector('simple'::regconfig, chunk.content) @@ search_query.value

    union all

    select
      'item'::text as record_type,
      item.id,
      item.source_id,
      null::integer as chunk_index,
      item.question,
      item.answer,
      coalesce(item.category, 'faq') as category,
      item.language,
      item.priority,
      item.metadata,
      ts_rank_cd(
        (
          setweight(to_tsvector('simple'::regconfig, item.question), 'A') ||
          setweight(to_tsvector('simple'::regconfig, item.answer), 'B') ||
          setweight(to_tsvector('simple'::regconfig, coalesce(item.category, '')), 'C')
        ),
        search_query.value,
        32
      )::double precision as rank
    from public.knowledge_items as item
    cross join search_query
    where item.theatre_id = p_theatre_id
      and item.active = true
      and (
        setweight(to_tsvector('simple'::regconfig, item.question), 'A') ||
        setweight(to_tsvector('simple'::regconfig, item.answer), 'B') ||
        setweight(to_tsvector('simple'::regconfig, coalesce(item.category, '')), 'C')
      ) @@ search_query.value
  )
  select
    ranked.record_type,
    ranked.id,
    ranked.source_id,
    ranked.chunk_index,
    ranked.question,
    ranked.answer,
    ranked.category,
    ranked.language,
    ranked.priority,
    ranked.metadata,
    ranked.rank
  from ranked
  order by ranked.rank desc, ranked.priority desc, ranked.id
  limit greatest(1, least(p_match_count, 100));
$$;

create or replace function public.match_knowledge(
  p_theatre_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 20,
  p_min_similarity double precision default 0.5
)
returns table (
  record_type text,
  id uuid,
  source_id uuid,
  chunk_index integer,
  question text,
  answer text,
  category text,
  language text,
  priority integer,
  metadata jsonb,
  similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with matches as (
    (
      select
        'chunk'::text as record_type,
        chunk.id,
        chunk.source_id,
        chunk.chunk_index,
        null::text as question,
        chunk.content as answer,
        'documento'::text as category,
        chunk.language,
        45 as priority,
        chunk.metadata,
        1 - (chunk.embedding <=> p_query_embedding) as similarity
      from public.knowledge_chunks as chunk
      where chunk.theatre_id = p_theatre_id
        and chunk.active = true
        and chunk.embedding_status = 'ready'
        and chunk.embedding is not null
        and (
          not exists (
            select 1
            from public.knowledge_items as structured_item
            where structured_item.theatre_id = chunk.theatre_id
              and structured_item.source_id = chunk.source_id
              and structured_item.active = true
          )
          or exists (
            select 1
            from public.knowledge_items as unready_item
            where unready_item.theatre_id = chunk.theatre_id
              and unready_item.source_id = chunk.source_id
              and unready_item.active = true
              and (
                unready_item.embedding_status <> 'ready'
                or unready_item.embedding is null
              )
          )
        )
        and 1 - (chunk.embedding <=> p_query_embedding) >= p_min_similarity
      order by chunk.embedding <=> p_query_embedding
      limit greatest(1, least(p_match_count, 100))
    )

    union all

    (
      select
        'item'::text as record_type,
        item.id,
        item.source_id,
        null::integer as chunk_index,
        item.question,
        item.answer,
        coalesce(item.category, 'faq') as category,
        item.language,
        item.priority,
        item.metadata,
        1 - (item.embedding <=> p_query_embedding) as similarity
      from public.knowledge_items as item
      where item.theatre_id = p_theatre_id
        and item.active = true
        and item.embedding_status = 'ready'
        and item.embedding is not null
        and 1 - (item.embedding <=> p_query_embedding) >= p_min_similarity
      order by item.embedding <=> p_query_embedding
      limit greatest(1, least(p_match_count, 100))
    )
  )
  select
    matches.record_type,
    matches.id,
    matches.source_id,
    matches.chunk_index,
    matches.question,
    matches.answer,
    matches.category,
    matches.language,
    matches.priority,
    matches.metadata,
    matches.similarity
  from matches
  order by matches.similarity desc, matches.priority desc, matches.id
  limit greatest(1, least(p_match_count, 100));
$$;

revoke all on function public.search_knowledge_text(uuid, text, integer) from public;
grant execute on function public.search_knowledge_text(uuid, text, integer) to service_role;

revoke all on function public.match_knowledge(uuid, extensions.vector, integer, double precision) from public;
grant execute on function public.match_knowledge(uuid, extensions.vector, integer, double precision) to service_role;
