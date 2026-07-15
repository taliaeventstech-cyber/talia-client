alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_type_check;

alter table public.knowledge_sources
  add constraint knowledge_sources_type_check
  check (type in (
    'manual', 'csv', 'xlsx', 'google_sheet', 'url', 'pdf',
    'web_snapshot', 'sitemap', 'website'
  ));

alter table public.knowledge_sources
  add column if not exists refresh_interval text not null default 'manual',
  add column if not exists next_sync_at timestamptz,
  add column if not exists last_sync_run_id uuid;

alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_refresh_interval_check;

alter table public.knowledge_sources
  add constraint knowledge_sources_refresh_interval_check
  check (refresh_interval in ('manual', 'daily', 'weekly', 'monthly'));

alter table public.knowledge_sources
  add constraint knowledge_sources_id_theatre_key unique (id, theatre_id);

create or replace function public.canonicalize_knowledge_source_url_on_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type in ('web_snapshot', 'url', 'sitemap', 'website') and new.source_url is not null then
    new.source_url := public.canonicalize_knowledge_source_url(new.source_url);
    if new.type = 'web_snapshot' and new.config ? 'capture_url' then
      new.config := jsonb_set(new.config, '{capture_url}', to_jsonb(new.source_url), true);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_sources_canonical_url on public.knowledge_sources;
create trigger knowledge_sources_canonical_url
  before insert or update of source_url, type, config on public.knowledge_sources
  for each row execute function public.canonicalize_knowledge_source_url_on_write();

create or replace function public.next_knowledge_sync_at(
  refresh_interval text,
  from_time timestamptz default now()
)
returns timestamptz
language sql
immutable
strict
set search_path = ''
as $$
  select case refresh_interval
    when 'daily' then from_time + interval '1 day'
    when 'weekly' then from_time + interval '1 week'
    when 'monthly' then from_time + interval '1 month'
    else null
  end;
$$;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  source_id uuid not null,
  canonical_url text not null,
  fetched_url text,
  title text,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'blocked', 'error', 'removed')),
  capture_method text
    check (capture_method is null or capture_method in (
      'http', 'browser', 'installed_widget', 'manual_browser', 'cms_api'
    )),
  content_hash text,
  etag text,
  last_modified text,
  last_discovered_at timestamptz,
  last_fetched_at timestamptz,
  removed_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_documents_source_theatre_fkey
    foreign key (source_id, theatre_id)
    references public.knowledge_sources(id, theatre_id)
    on delete cascade,
  constraint knowledge_documents_source_url_key unique (source_id, canonical_url),
  constraint knowledge_documents_id_theatre_key unique (id, theatre_id)
);

alter table public.knowledge_documents enable row level security;

drop policy if exists "knowledge_documents_select_own_theatre" on public.knowledge_documents;
create policy "knowledge_documents_select_own_theatre" on public.knowledge_documents
  for select using (theatre_id in (select public.current_theatre_ids()));

create index if not exists knowledge_documents_theatre_status_idx
  on public.knowledge_documents(theatre_id, status, updated_at desc);

create index if not exists knowledge_documents_source_status_idx
  on public.knowledge_documents(source_id, status, canonical_url);

create or replace function public.canonicalize_knowledge_document_url_on_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.canonical_url := public.canonicalize_knowledge_source_url(new.canonical_url);
  return new;
end;
$$;

drop trigger if exists knowledge_documents_canonical_url on public.knowledge_documents;
create trigger knowledge_documents_canonical_url
  before insert or update of canonical_url on public.knowledge_documents
  for each row execute function public.canonicalize_knowledge_document_url_on_write();

drop trigger if exists knowledge_documents_updated_at on public.knowledge_documents;
create trigger knowledge_documents_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

create table if not exists public.knowledge_sync_runs (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  source_id uuid not null,
  trigger text not null default 'scheduled'
    check (trigger in ('initial', 'manual', 'scheduled', 'retry')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
  idempotency_key text not null,
  worker_id text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  discovered_count integer not null default 0 check (discovered_count >= 0),
  checked_count integer not null default 0 check (checked_count >= 0),
  changed_count integer not null default 0 check (changed_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  deactivated_count integer not null default 0 check (deactivated_count >= 0),
  error_code text,
  error_details text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_sync_runs_source_theatre_fkey
    foreign key (source_id, theatre_id)
    references public.knowledge_sources(id, theatre_id)
    on delete cascade,
  constraint knowledge_sync_runs_idempotency_key unique (theatre_id, idempotency_key)
);

alter table public.knowledge_sync_runs enable row level security;

drop policy if exists "knowledge_sync_runs_select_own_theatre" on public.knowledge_sync_runs;
create policy "knowledge_sync_runs_select_own_theatre" on public.knowledge_sync_runs
  for select using (theatre_id in (select public.current_theatre_ids()));

create unique index if not exists knowledge_sync_runs_one_active_per_source_idx
  on public.knowledge_sync_runs(source_id)
  where status in ('queued', 'running');

create index if not exists knowledge_sync_runs_theatre_created_idx
  on public.knowledge_sync_runs(theatre_id, created_at desc);

create index if not exists knowledge_sync_runs_claim_idx
  on public.knowledge_sync_runs(status, lease_expires_at, created_at);

drop trigger if exists knowledge_sync_runs_updated_at on public.knowledge_sync_runs;
create trigger knowledge_sync_runs_updated_at
  before update on public.knowledge_sync_runs
  for each row execute function public.set_updated_at();

alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_last_sync_run_id_fkey;

alter table public.knowledge_sources
  add constraint knowledge_sources_last_sync_run_id_fkey
  foreign key (last_sync_run_id)
  references public.knowledge_sync_runs(id)
  on delete set null;

alter table public.knowledge_chunks
  add column if not exists document_id uuid;

alter table public.knowledge_chunks
  drop constraint if exists knowledge_chunks_document_theatre_fkey;

alter table public.knowledge_chunks
  add constraint knowledge_chunks_document_theatre_fkey
  foreign key (document_id, theatre_id)
  references public.knowledge_documents(id, theatre_id)
  on delete cascade;

alter table public.knowledge_chunks
  drop constraint if exists knowledge_chunks_source_id_chunk_index_key;

create unique index if not exists knowledge_chunks_source_level_index_key
  on public.knowledge_chunks(source_id, chunk_index)
  where document_id is null;

create unique index if not exists knowledge_chunks_document_index_key
  on public.knowledge_chunks(document_id, chunk_index)
  where document_id is not null;

create index if not exists knowledge_sources_due_sync_idx
  on public.knowledge_sources(next_sync_at, theatre_id)
  where type in ('url', 'sitemap', 'website') and next_sync_at is not null;

create or replace function public.claim_due_knowledge_sync_runs(
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns setof public.knowledge_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.knowledge_sync_runs%rowtype;
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker_id_required';
  end if;

  insert into public.knowledge_sync_runs (
    theatre_id,
    source_id,
    trigger,
    status,
    idempotency_key
  )
  select
    source.theatre_id,
    source.id,
    'scheduled',
    'queued',
    'scheduled:' || source.id::text || ':' ||
      extract(epoch from date_trunc('minute', source.next_sync_at))::bigint::text
  from public.knowledge_sources as source
  where source.type in ('url', 'sitemap', 'website')
    and source.next_sync_at <= now()
    and not exists (
      select 1
      from public.knowledge_sync_runs as active_run
      where active_run.source_id = source.id
        and active_run.status in ('queued', 'running')
    )
  on conflict do nothing;

  for claimed in
    with candidates as (
      select run.id
      from public.knowledge_sync_runs as run
      where run.status = 'queued'
         or (run.status = 'running' and run.lease_expires_at <= now())
      order by run.created_at asc
      for update skip locked
      limit greatest(1, least(coalesce(p_limit, 10), 100))
    )
    update public.knowledge_sync_runs as run
       set status = 'running',
           worker_id = p_worker_id,
           lease_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 3600))),
           attempt_count = run.attempt_count + 1,
           started_at = coalesce(run.started_at, now())
      from candidates
     where run.id = candidates.id
    returning run.*
  loop
    update public.knowledge_sources
       set status = 'processing',
           last_sync_run_id = claimed.id
     where id = claimed.source_id;

    return next claimed;
  end loop;

  return;
end;
$$;

create or replace function public.finish_knowledge_sync_run(
  p_run_id uuid,
  p_worker_id text,
  p_status text,
  p_discovered_count integer default 0,
  p_checked_count integer default 0,
  p_changed_count integer default 0,
  p_unchanged_count integer default 0,
  p_failed_count integer default 0,
  p_blocked_count integer default 0,
  p_deactivated_count integer default 0,
  p_error_code text default null,
  p_error_details text default null
)
returns public.knowledge_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run public.knowledge_sync_runs%rowtype;
  finished_run public.knowledge_sync_runs%rowtype;
begin
  if p_status not in ('succeeded', 'partial', 'failed', 'cancelled') then
    raise exception 'invalid_terminal_status';
  end if;

  select *
    into current_run
    from public.knowledge_sync_runs
   where id = p_run_id
   for update;

  if not found then
    raise exception 'sync_run_not_found';
  end if;

  if current_run.status in ('succeeded', 'partial', 'failed', 'cancelled') then
    return current_run;
  end if;

  if current_run.status <> 'running' or current_run.worker_id is distinct from p_worker_id then
    raise exception 'sync_run_not_owned';
  end if;

  update public.knowledge_sync_runs
     set status = p_status,
         discovered_count = greatest(0, coalesce(p_discovered_count, 0)),
         checked_count = greatest(0, coalesce(p_checked_count, 0)),
         changed_count = greatest(0, coalesce(p_changed_count, 0)),
         unchanged_count = greatest(0, coalesce(p_unchanged_count, 0)),
         failed_count = greatest(0, coalesce(p_failed_count, 0)),
         blocked_count = greatest(0, coalesce(p_blocked_count, 0)),
         deactivated_count = greatest(0, coalesce(p_deactivated_count, 0)),
         error_code = nullif(left(coalesce(p_error_code, ''), 120), ''),
         error_details = nullif(left(coalesce(p_error_details, ''), 2000), ''),
         lease_expires_at = null,
         finished_at = now()
   where id = p_run_id
  returning * into finished_run;

  update public.knowledge_sources as source
     set status = case
           when p_status in ('succeeded', 'partial') then 'ready'
           when p_status = 'failed' then 'error'
           else source.status
         end,
         last_synced_at = case
           when p_status in ('succeeded', 'partial') then now()
           else source.last_synced_at
         end,
         last_error = case
           when p_status = 'succeeded' then null
           when p_status in ('partial', 'failed') then nullif(left(coalesce(p_error_details, p_error_code, ''), 2000), '')
           else source.last_error
         end,
         next_sync_at = case
           when p_status = 'cancelled' then source.next_sync_at
           else public.next_knowledge_sync_at(source.refresh_interval, now())
         end,
         last_sync_run_id = finished_run.id
   where source.id = finished_run.source_id;

  return finished_run;
end;
$$;

create or replace function public.renew_knowledge_sync_run_lease(
  p_run_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns public.knowledge_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  renewed_run public.knowledge_sync_runs%rowtype;
begin
  update public.knowledge_sync_runs
     set lease_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 3600)))
   where id = p_run_id
     and status = 'running'
     and worker_id = p_worker_id
  returning * into renewed_run;

  if not found then
    raise exception 'sync_run_not_owned';
  end if;

  return renewed_run;
end;
$$;

revoke all on function public.next_knowledge_sync_at(text, timestamptz) from public;
revoke all on function public.canonicalize_knowledge_source_url_on_write() from public;
revoke all on function public.canonicalize_knowledge_document_url_on_write() from public;
revoke all on function public.claim_due_knowledge_sync_runs(text, integer, integer) from public;
revoke all on function public.finish_knowledge_sync_run(
  uuid, text, text, integer, integer, integer, integer, integer, integer, integer, text, text
) from public;
revoke all on function public.renew_knowledge_sync_run_lease(uuid, text, integer) from public;

grant execute on function public.claim_due_knowledge_sync_runs(text, integer, integer) to service_role;
grant execute on function public.finish_knowledge_sync_run(
  uuid, text, text, integer, integer, integer, integer, integer, integer, integer, text, text
) to service_role;
grant execute on function public.renew_knowledge_sync_run_lease(uuid, text, integer) to service_role;
