alter table public.knowledge_sources
  add column if not exists sync_enabled boolean not null default false;

create index if not exists knowledge_sources_enabled_due_sync_idx
  on public.knowledge_sources(next_sync_at, theatre_id)
  where type in ('url', 'sitemap', 'website')
    and sync_enabled
    and next_sync_at is not null;

create or replace function public.set_knowledge_web_sync_enabled(
  p_theatre_id uuid,
  p_source_id uuid,
  p_enabled boolean
)
returns public.knowledge_sources
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_source public.knowledge_sources%rowtype;
  updated_source public.knowledge_sources%rowtype;
begin
  select *
    into current_source
    from public.knowledge_sources
   where id = p_source_id
     and theatre_id = p_theatre_id
   for update;

  if not found or current_source.type not in ('url', 'sitemap', 'website') then
    raise exception 'managed_web_source_not_found';
  end if;

  if not coalesce(p_enabled, false) then
    update public.knowledge_sync_runs
       set status = 'cancelled',
           lease_expires_at = null,
           finished_at = now(),
           error_code = 'operator_paused',
           error_details = 'Cancelled because managed web sync was paused from Backstage.'
     where source_id = p_source_id
       and theatre_id = p_theatre_id
       and status = 'queued';
  end if;

  update public.knowledge_sources
     set sync_enabled = coalesce(p_enabled, false),
         next_sync_at = case
           when coalesce(p_enabled, false) and current_source.refresh_interval <> 'manual' then now()
           else current_source.next_sync_at
         end
   where id = p_source_id
     and theatre_id = p_theatre_id
  returning * into updated_source;

  return updated_source;
end;
$$;

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
    and source.sync_enabled
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
      join public.knowledge_sources as source
        on source.id = run.source_id
       and source.theatre_id = run.theatre_id
      where source.sync_enabled
        and (
          run.status = 'queued'
          or (run.status = 'running' and run.lease_expires_at <= now())
        )
      order by run.created_at asc
      for update of run skip locked
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

revoke all on function public.set_knowledge_web_sync_enabled(uuid, uuid, boolean) from public;
revoke all on function public.claim_due_knowledge_sync_runs(text, integer, integer) from public;

grant execute on function public.set_knowledge_web_sync_enabled(uuid, uuid, boolean) to service_role;
grant execute on function public.claim_due_knowledge_sync_runs(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
