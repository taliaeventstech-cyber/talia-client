alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_type_check;

alter table public.knowledge_sources
  add constraint knowledge_sources_type_check
  check (type in ('manual', 'csv', 'xlsx', 'google_sheet', 'url', 'pdf', 'web_snapshot'));

create index if not exists knowledge_sources_theatre_type_url_idx
  on public.knowledge_sources(theatre_id, type, source_url);
