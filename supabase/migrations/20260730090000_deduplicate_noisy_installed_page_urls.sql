create or replace function public.canonicalize_installed_web_page_url(input_url text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  normalized_url text := public.canonicalize_knowledge_source_url(input_url);
  base_url text;
  query_string text;
  normalized_query text;
begin
  base_url := split_part(normalized_url, '?', 1);
  if strpos(normalized_url, '?') = 0 then
    return normalized_url;
  end if;

  query_string := substring(normalized_url from strpos(normalized_url, '?') + 1);
  select string_agg(query_part, '&' order by lower(split_part(query_part, '=', 1)), query_part)
    into normalized_query
    from unnest(string_to_array(query_string, '&')) as query_parts(query_part)
   where split_part(query_part, '=', 1) <> ''
     and char_length(split_part(query_part, '=', 1)) <= 64
     and char_length(coalesce(split_part(query_part, '=', 2), '')) between 1 and 256;

  return base_url || case when normalized_query is null then '' else '?' || normalized_query end;
end;
$$;

create or replace function public.canonicalize_knowledge_source_url_on_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'web_snapshot' and new.source_url is not null then
    new.source_url := public.canonicalize_installed_web_page_url(new.source_url);
    if new.config ? 'capture_url' then
      new.config := jsonb_set(new.config, '{capture_url}', to_jsonb(new.source_url), true);
    end if;
  elsif new.type in ('url', 'sitemap', 'website') and new.source_url is not null then
    new.source_url := public.canonicalize_knowledge_source_url(new.source_url);
  end if;
  return new;
end;
$$;

create temporary table installed_web_source_duplicate_map on commit drop as
select id as duplicate_id, winner_id
from (
  select
    id,
    first_value(id) over (
      partition by theatre_id, type, public.canonicalize_installed_web_page_url(source_url)
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
  where type = 'web_snapshot'
    and source_url is not null
) ranked
where id <> winner_id;

update public.knowledge_items as item
   set source_id = duplicate.winner_id
  from installed_web_source_duplicate_map as duplicate
 where item.source_id = duplicate.duplicate_id;

delete from public.knowledge_sources as source
using installed_web_source_duplicate_map as duplicate
where source.id = duplicate.duplicate_id;

update public.knowledge_sources
   set source_url = public.canonicalize_installed_web_page_url(source_url)
 where type = 'web_snapshot'
   and source_url is not null;

revoke all on function public.canonicalize_installed_web_page_url(text) from public;
revoke all on function public.canonicalize_knowledge_source_url_on_write() from public;
