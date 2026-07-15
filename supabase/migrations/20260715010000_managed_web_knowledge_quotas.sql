create or replace function public.knowledge_web_limit_value(
  p_limits jsonb,
  p_key text,
  p_default integer,
  p_minimum integer,
  p_maximum integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_limits, '{}'::jsonb) ->> p_key ~ '^[0-9]+$'
      then greatest(
        p_minimum,
        least((coalesce(p_limits, '{}'::jsonb) ->> p_key)::numeric, p_maximum)::integer
      )
    else p_default
  end;
$$;

create or replace function public.get_knowledge_web_limits(p_theatre_id uuid)
returns table (
  max_sources integer,
  max_documents integer,
  max_pages_per_source integer,
  max_manual_syncs_per_day integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with entitlement as (
    select coalesce(module.limits, '{}'::jsonb) as limits
      from public.tenant_module_entitlements as module
     where module.theatre_id = p_theatre_id
       and module.module_key = 'data'
     limit 1
  ), resolved as (
    select coalesce((select limits from entitlement), '{}'::jsonb) as limits
  )
  select
    public.knowledge_web_limit_value(limits, 'managed_web_sources', 10, 1, 100),
    public.knowledge_web_limit_value(limits, 'managed_web_documents', 500, 1, 10000),
    public.knowledge_web_limit_value(limits, 'managed_web_pages_per_source', 100, 1, 500),
    public.knowledge_web_limit_value(limits, 'managed_web_manual_syncs_per_day', 10, 1, 100)
  from resolved;
$$;

create or replace function public.enforce_managed_web_source_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits record;
  current_sources integer;
  current_documents integer;
begin
  if new.type not in ('url', 'sitemap', 'website') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.theatre_id::text, 201)
  );

  select * into limits
    from public.get_knowledge_web_limits(new.theatre_id);

  select count(*)::integer into current_sources
    from public.knowledge_sources as source
   where source.theatre_id = new.theatre_id
     and source.type in ('url', 'sitemap', 'website');

  if current_sources >= limits.max_sources then
    raise exception using
      errcode = 'P0001',
      message = 'managed_web_source_quota_exceeded',
      detail = format('The tenant is limited to %s managed web sources.', limits.max_sources);
  end if;

  select count(*)::integer into current_documents
    from public.knowledge_documents as document
    join public.knowledge_sources as source
      on source.id = document.source_id
     and source.theatre_id = document.theatre_id
   where document.theatre_id = new.theatre_id
     and source.type in ('url', 'sitemap', 'website')
     and document.status <> 'removed';

  if current_documents >= limits.max_documents then
    raise exception using
      errcode = 'P0001',
      message = 'managed_web_document_quota_exceeded',
      detail = format('The tenant is limited to %s active managed web documents.', limits.max_documents);
  end if;

  new.config := jsonb_set(
    coalesce(new.config, '{}'::jsonb),
    '{max_pages}',
    to_jsonb(least(
      public.knowledge_web_limit_value(new.config, 'max_pages', limits.max_pages_per_source, 1, 500),
      limits.max_pages_per_source
    )),
    true
  );
  return new;
end;
$$;

drop trigger if exists knowledge_sources_managed_web_quota on public.knowledge_sources;
create trigger knowledge_sources_managed_web_quota
  before insert on public.knowledge_sources
  for each row execute function public.enforce_managed_web_source_quota();

create or replace function public.enforce_managed_web_document_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits record;
  source_type text;
  tenant_documents integer;
  source_documents integer;
begin
  select source.type into source_type
    from public.knowledge_sources as source
   where source.id = new.source_id
     and source.theatre_id = new.theatre_id;

  if source_type is null or source_type not in ('url', 'sitemap', 'website') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.theatre_id::text, 202)
  );

  if exists (
    select 1
      from public.knowledge_documents as document
     where document.source_id = new.source_id
       and document.canonical_url = new.canonical_url
  ) then
    return new;
  end if;

  select * into limits
    from public.get_knowledge_web_limits(new.theatre_id);

  select count(*)::integer into tenant_documents
    from public.knowledge_documents as document
    join public.knowledge_sources as source
      on source.id = document.source_id
     and source.theatre_id = document.theatre_id
   where document.theatre_id = new.theatre_id
     and source.type in ('url', 'sitemap', 'website')
     and document.status <> 'removed';

  if tenant_documents >= limits.max_documents then
    raise exception using
      errcode = 'P0001',
      message = 'managed_web_document_quota_exceeded',
      detail = format('The tenant is limited to %s active managed web documents.', limits.max_documents);
  end if;

  select count(*)::integer into source_documents
    from public.knowledge_documents as document
   where document.source_id = new.source_id
     and document.status <> 'removed';

  if source_documents >= limits.max_pages_per_source then
    raise exception using
      errcode = 'P0001',
      message = 'managed_web_source_page_quota_exceeded',
      detail = format('The source is limited to %s active documents.', limits.max_pages_per_source);
  end if;

  return new;
end;
$$;

drop trigger if exists knowledge_documents_managed_web_quota on public.knowledge_documents;
create trigger knowledge_documents_managed_web_quota
  before insert on public.knowledge_documents
  for each row execute function public.enforce_managed_web_document_quota();

create or replace function public.enforce_managed_web_manual_sync_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits record;
  source_type text;
  manual_syncs_today integer;
begin
  if new.trigger <> 'manual' then
    return new;
  end if;

  select source.type into source_type
    from public.knowledge_sources as source
   where source.id = new.source_id
     and source.theatre_id = new.theatre_id;

  if source_type is null or source_type not in ('url', 'sitemap', 'website') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.theatre_id::text, 203)
  );

  select * into limits
    from public.get_knowledge_web_limits(new.theatre_id);

  select count(*)::integer into manual_syncs_today
    from public.knowledge_sync_runs as run
   where run.theatre_id = new.theatre_id
     and run.trigger = 'manual'
     and run.created_at >= date_trunc('day', now());

  if manual_syncs_today >= limits.max_manual_syncs_per_day then
    raise exception using
      errcode = 'P0001',
      message = 'managed_web_manual_sync_quota_exceeded',
      detail = format('The tenant is limited to %s manual web syncs per UTC day.', limits.max_manual_syncs_per_day);
  end if;

  return new;
end;
$$;

drop trigger if exists knowledge_sync_runs_manual_quota on public.knowledge_sync_runs;
create trigger knowledge_sync_runs_manual_quota
  before insert on public.knowledge_sync_runs
  for each row execute function public.enforce_managed_web_manual_sync_quota();

update public.tenant_module_entitlements
   set limits = jsonb_build_object(
         'managed_web_sources', 10,
         'managed_web_documents', 500,
         'managed_web_pages_per_source', 100,
         'managed_web_manual_syncs_per_day', 10
       ) || coalesce(limits, '{}'::jsonb),
       updated_at = now()
 where module_key = 'data';

revoke all on function public.knowledge_web_limit_value(jsonb, text, integer, integer, integer) from public;
revoke all on function public.get_knowledge_web_limits(uuid) from public;
revoke all on function public.enforce_managed_web_source_quota() from public;
revoke all on function public.enforce_managed_web_document_quota() from public;
revoke all on function public.enforce_managed_web_manual_sync_quota() from public;

grant execute on function public.get_knowledge_web_limits(uuid) to service_role;

notify pgrst, 'reload schema';
