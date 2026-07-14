create or replace function public.replace_knowledge_chunks(
  p_theatre_id uuid,
  p_source_id uuid,
  p_document_id uuid,
  p_chunks jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_chunks is null or jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'chunks_must_be_array';
  end if;

  if jsonb_array_length(p_chunks) > 1000 then
    raise exception 'too_many_chunks';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_chunks) as chunk(
        chunk_index integer,
        content text,
        language text,
        token_count integer,
        metadata jsonb
      )
     where chunk.chunk_index is null
        or chunk.chunk_index < 0
        or nullif(trim(chunk.content), '') is null
        or nullif(trim(chunk.language), '') is null
  ) then
    raise exception 'invalid_chunk_payload';
  end if;

  if exists (
    select chunk.chunk_index
      from jsonb_to_recordset(p_chunks) as chunk(chunk_index integer)
     group by chunk.chunk_index
    having count(*) > 1
  ) then
    raise exception 'duplicate_chunk_index';
  end if;

  if not exists (
    select 1
      from public.knowledge_sources as source
     where source.id = p_source_id
       and source.theatre_id = p_theatre_id
  ) then
    raise exception 'knowledge_source_not_found';
  end if;

  if p_document_id is not null and not exists (
    select 1
      from public.knowledge_documents as document
     where document.id = p_document_id
       and document.source_id = p_source_id
       and document.theatre_id = p_theatre_id
  ) then
    raise exception 'knowledge_document_not_found';
  end if;

  delete from public.knowledge_chunks as chunk
   where chunk.theatre_id = p_theatre_id
     and chunk.source_id = p_source_id
     and chunk.document_id is not distinct from p_document_id;

  insert into public.knowledge_chunks (
    theatre_id,
    source_id,
    document_id,
    chunk_index,
    content,
    language,
    token_count,
    active,
    embedding_status,
    embedding,
    embedding_model,
    embedding_updated_at,
    metadata
  )
  select
    p_theatre_id,
    p_source_id,
    p_document_id,
    chunk.chunk_index,
    chunk.content,
    chunk.language,
    chunk.token_count,
    true,
    'pending',
    null,
    null,
    null,
    chunk.metadata
  from jsonb_to_recordset(p_chunks) as chunk(
    chunk_index integer,
    content text,
    language text,
    token_count integer,
    metadata jsonb
  )
  order by chunk.chunk_index;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_knowledge_chunks(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.replace_knowledge_chunks(uuid, uuid, uuid, jsonb) to service_role;
