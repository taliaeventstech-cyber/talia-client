create table if not exists public.email_sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'scheduler' check (trigger_source in ('scheduler', 'manual')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  worker_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  lease_expires_at timestamptz not null,
  checked_count integer not null default 0 check (checked_count >= 0),
  synced_count integer not null default 0 check (synced_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  inspected_count integer not null default 0 check (inspected_count >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint email_sync_runs_worker_id_check check (char_length(trim(worker_id)) between 1 and 200)
);

create unique index if not exists email_sync_runs_one_active_idx
  on public.email_sync_runs ((status))
  where status = 'running';

create index if not exists email_sync_runs_created_at_idx
  on public.email_sync_runs (created_at desc);

alter table public.email_sync_runs enable row level security;

create or replace function public.claim_email_sync_run(
  p_worker_id text,
  p_lease_seconds integer default 600
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_worker_id text := trim(coalesce(p_worker_id, ''));
  lease_duration integer := greatest(60, least(coalesce(p_lease_seconds, 600), 900));
  claimed_run_id uuid;
  current_time timestamptz := clock_timestamp();
begin
  if normalized_worker_id = '' or char_length(normalized_worker_id) > 200 then
    raise exception 'invalid_email_sync_worker';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('email-sync-scheduler', 0));

  update public.email_sync_runs
     set status = 'failed',
         completed_at = current_time,
         error_code = 'lease_expired',
         error_message = 'The previous email sync run exceeded its lease.'
   where status = 'running'
     and lease_expires_at <= current_time;

  if exists (select 1 from public.email_sync_runs where status = 'running') then
    return null;
  end if;

  insert into public.email_sync_runs (worker_id, lease_expires_at)
  values (normalized_worker_id, current_time + make_interval(secs => lease_duration))
  returning id into claimed_run_id;

  return claimed_run_id;
end;
$$;

create or replace function public.finish_email_sync_run(
  p_run_id uuid,
  p_worker_id text,
  p_status text,
  p_checked_count integer default 0,
  p_synced_count integer default 0,
  p_failed_count integer default 0,
  p_imported_count integer default 0,
  p_skipped_count integer default 0,
  p_inspected_count integer default 0,
  p_processed_count integer default 0,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if p_status not in ('succeeded', 'partial', 'failed') then
    raise exception 'invalid_email_sync_status';
  end if;

  update public.email_sync_runs
     set status = p_status,
         completed_at = clock_timestamp(),
         checked_count = greatest(coalesce(p_checked_count, 0), 0),
         synced_count = greatest(coalesce(p_synced_count, 0), 0),
         failed_count = greatest(coalesce(p_failed_count, 0), 0),
         imported_count = greatest(coalesce(p_imported_count, 0), 0),
         skipped_count = greatest(coalesce(p_skipped_count, 0), 0),
         inspected_count = greatest(coalesce(p_inspected_count, 0), 0),
         processed_count = greatest(coalesce(p_processed_count, 0), 0),
         error_code = nullif(left(coalesce(p_error_code, ''), 100), ''),
         error_message = nullif(left(coalesce(p_error_message, ''), 500), '')
   where id = p_run_id
     and worker_id = trim(p_worker_id)
     and status = 'running';

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke all on table public.email_sync_runs from public, anon, authenticated;
revoke all on function public.claim_email_sync_run(text, integer) from public;
revoke all on function public.finish_email_sync_run(uuid, text, text, integer, integer, integer, integer, integer, integer, integer, text, text) from public;

grant execute on function public.claim_email_sync_run(text, integer) to service_role;
grant execute on function public.finish_email_sync_run(uuid, text, text, integer, integer, integer, integer, integer, integer, integer, text, text) to service_role;

update public.email_connections
set metadata = metadata
  - 'email_agent_provider'
  - 'n8n_email_classifier_webhook_url'
  - 'n8n_email_drafter_webhook_url'
  - 'n8n_email_agent_webhook_url'
where metadata ?| array[
  'email_agent_provider',
  'n8n_email_classifier_webhook_url',
  'n8n_email_drafter_webhook_url',
  'n8n_email_agent_webhook_url'
];

notify pgrst, 'reload schema';
