create or replace function public.canonicalize_knowledge_source_url(input_url text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  clean_url text := regexp_replace(trim(input_url), '#.*$', '');
  base_url text;
  query_string text;
  url_parts text[];
  scheme text;
  authority text;
  path text;
  normalized_query text;
begin
  base_url := split_part(clean_url, '?', 1);
  if strpos(clean_url, '?') > 0 then
    query_string := substring(clean_url from strpos(clean_url, '?') + 1);
  end if;

  url_parts := regexp_match(base_url, '^([A-Za-z][A-Za-z0-9+.-]*)://([^/]*)(/.*)?$');
  if url_parts is null then
    return clean_url;
  end if;

  scheme := lower(url_parts[1]);
  authority := regexp_replace(lower(url_parts[2]), '^www\.', '');
  if scheme = 'http' then
    authority := regexp_replace(authority, ':80$', '');
  elsif scheme = 'https' then
    authority := regexp_replace(authority, ':443$', '');
  end if;

  path := coalesce(url_parts[3], '/');
  path := regexp_replace(path, '/+$', '');
  if path = '' then path := '/'; end if;

  if query_string is not null and query_string <> '' then
    select string_agg(query_part, '&' order by lower(split_part(query_part, '=', 1)), query_part)
      into normalized_query
      from unnest(string_to_array(query_string, '&')) as query_parts(query_part)
     where query_part <> ''
       and left(lower(split_part(query_part, '=', 1)), 4) <> 'utm_'
       and left(lower(split_part(query_part, '=', 1)), 13) <> 'talia_capture'
       and lower(split_part(query_part, '=', 1)) not in (
         '_ga', '_gl', 'dclid', 'fbclid', 'gclid', 'igshid',
         'mc_cid', 'mc_eid', 'msclkid', 'ttclid', 'twclid', 'yclid'
       );
  end if;

  return scheme || '://' || authority || path
    || case when normalized_query is null then '' else '?' || normalized_query end;
end;
$$;

update public.knowledge_sources
   set source_url = public.canonicalize_knowledge_source_url(source_url),
       config = case
         when config ? 'capture_url' then jsonb_set(
           config,
           '{capture_url}',
           to_jsonb(public.canonicalize_knowledge_source_url(source_url)),
           true
         )
         else config
       end
 where type = 'web_snapshot'
   and source_url is not null;

create temporary table knowledge_source_duplicate_map on commit drop as
select id as duplicate_id, winner_id
from (
  select
    id,
    first_value(id) over (
      partition by theatre_id, type, source_url
      order by
        case status
          when 'ready' then 0
          when 'processing' then 1
          when 'connected' then 2
          when 'pending' then 3
          else 4
        end,
        last_synced_at desc nulls last,
        updated_at desc,
        created_at asc
    ) as winner_id
  from public.knowledge_sources
  where source_url is not null
) ranked
where id <> winner_id;

update public.knowledge_items as item
   set source_id = duplicate.winner_id
  from knowledge_source_duplicate_map as duplicate
 where item.source_id = duplicate.duplicate_id;

delete from public.knowledge_sources as source
using knowledge_source_duplicate_map as duplicate
where source.id = duplicate.duplicate_id;

drop index if exists public.knowledge_sources_theatre_type_url_idx;

create unique index knowledge_sources_theatre_type_url_idx
  on public.knowledge_sources(theatre_id, type, source_url);

create or replace function public.canonicalize_web_snapshot_source_url()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'web_snapshot' and new.source_url is not null then
    new.source_url := public.canonicalize_knowledge_source_url(new.source_url);
    if new.config ? 'capture_url' then
      new.config := jsonb_set(new.config, '{capture_url}', to_jsonb(new.source_url), true);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_sources_canonical_url on public.knowledge_sources;
create trigger knowledge_sources_canonical_url
  before insert or update of source_url, type, config on public.knowledge_sources
  for each row execute function public.canonicalize_web_snapshot_source_url();

revoke all on function public.canonicalize_knowledge_source_url(text) from public;
revoke all on function public.canonicalize_web_snapshot_source_url() from public;
