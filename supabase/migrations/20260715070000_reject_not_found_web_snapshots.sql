with rejected_sources as (
  update public.knowledge_sources
  set status = 'error',
      last_error = 'La página indica que el contenido no existe.',
      updated_at = now()
  where type = 'web_snapshot'
    and (
      lower(coalesce(config ->> 'page_title', name, '')) ~ '(^|[[:space:][:punct:]])(page not found|not found|página no encontrada|pagina no encontrada|pàgina no trobada|page introuvable|seite nicht gefunden)([[:space:][:punct:]]|$)'
      or lower(coalesce(config ->> 'page_title', name, '')) ~ '^[[:space:]]*(404|410)([[:space:][:punct:]]|$)'
    )
  returning id, theatre_id
)
update public.knowledge_chunks as chunk
set active = false,
    updated_at = now()
from rejected_sources
where chunk.source_id = rejected_sources.id
  and chunk.theatre_id = rejected_sources.theatre_id
  and chunk.active = true;
