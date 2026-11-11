-- Removed Knowledge documents are durable tombstones. Their operational row
-- remains available for audit and prevents an installed-widget revisit from
-- silently recreating retired content, while all answerable content is deleted.
create or replace function public.cleanup_removed_knowledge_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'removed' then
    new.removed_at := coalesce(new.removed_at, now());
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'cleanup',
      coalesce(
        new.metadata -> 'cleanup',
        jsonb_build_object('reason', 'document_removed', 'retired_at', now())
      )
    );

    delete from public.programme_events
     where theatre_id = new.theatre_id
       and source_id = new.source_id
       and document_id = new.id;

    delete from public.knowledge_chunks
     where theatre_id = new.theatre_id
       and source_id = new.source_id
       and document_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.cleanup_removed_knowledge_document() from public;

drop trigger if exists knowledge_documents_cleanup_removed on public.knowledge_documents;
create trigger knowledge_documents_cleanup_removed
  before insert or update of status on public.knowledge_documents
  for each row
  when (new.status = 'removed')
  execute function public.cleanup_removed_knowledge_document();

-- Enforce the invariant for documents retired before this trigger existed.
delete from public.programme_events as event
using public.knowledge_documents as document
where document.id = event.document_id
  and document.source_id = event.source_id
  and document.theatre_id = event.theatre_id
  and document.status = 'removed';

delete from public.knowledge_chunks as chunk
using public.knowledge_documents as document
where document.id = chunk.document_id
  and document.source_id = chunk.source_id
  and document.theatre_id = chunk.theatre_id
  and document.status = 'removed';

-- Correct the exact stale source proven by response trace
-- 1b77d153-474b-494d-aafa-797135d54c58. The document tombstone remains so a
-- later visit to the still-public WordPress page cannot reintroduce it.
update public.knowledge_documents as document
   set status = 'removed',
       removed_at = now(),
       metadata = coalesce(document.metadata, '{}'::jsonb) || jsonb_build_object(
         'cleanup', 'stale_programme_trace_2026_11_11',
         'retired_at', now(),
         'response_trace_id', '1b77d153-474b-494d-aafa-797135d54c58'
       )
  from public.knowledge_sources as source
 where document.source_id = source.id
   and document.theatre_id = source.theatre_id
   and document.theatre_id = '2d6e9c5d-5558-43c0-b8c3-5263d161ef60'::uuid
   and source.type = 'web_snapshot'
   and trim(trailing '/' from split_part(document.canonical_url, '?', 1)) =
       'https://salafenix.com/constelaciones';
