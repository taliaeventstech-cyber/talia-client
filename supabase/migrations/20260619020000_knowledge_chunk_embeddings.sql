create extension if not exists vector with schema extensions;

alter table public.knowledge_chunks
  add column if not exists embedding vector(1536);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100)
  where embedding is not null;

create or replace function public.match_knowledge_chunks(
  p_theatre_id uuid,
  p_query_embedding vector(1536),
  p_match_count integer default 5,
  p_min_similarity double precision default 0.72
)
returns table (
  id uuid,
  source_id uuid,
  chunk_index integer,
  content text,
  language text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    knowledge_chunks.id,
    knowledge_chunks.source_id,
    knowledge_chunks.chunk_index,
    knowledge_chunks.content,
    knowledge_chunks.language,
    knowledge_chunks.metadata,
    1 - (knowledge_chunks.embedding <=> p_query_embedding) as similarity
  from public.knowledge_chunks
  where knowledge_chunks.theatre_id = p_theatre_id
    and knowledge_chunks.active = true
    and knowledge_chunks.embedding_status = 'ready'
    and knowledge_chunks.embedding is not null
    and 1 - (knowledge_chunks.embedding <=> p_query_embedding) >= p_min_similarity
  order by knowledge_chunks.embedding <=> p_query_embedding
  limit p_match_count;
$$;

revoke all on function public.match_knowledge_chunks(uuid, extensions.vector, integer, double precision) from public;
grant execute on function public.match_knowledge_chunks(uuid, extensions.vector, integer, double precision) to service_role;
