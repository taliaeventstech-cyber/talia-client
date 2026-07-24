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
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if normalized_worker_id = '' or char_length(normalized_worker_id) > 200 then
    raise exception 'invalid_email_sync_worker';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('email-sync-scheduler', 0));

  update public.email_sync_runs
     set status = 'failed',
         completed_at = v_now,
         error_code = 'lease_expired',
         error_message = 'The previous email sync run exceeded its lease.'
   where status = 'running'
     and lease_expires_at <= v_now;

  if exists (select 1 from public.email_sync_runs where status = 'running') then
    return null;
  end if;

  insert into public.email_sync_runs (worker_id, lease_expires_at)
  values (
    normalized_worker_id,
    v_now + pg_catalog.make_interval(secs => lease_duration)
  )
  returning id into claimed_run_id;

  return claimed_run_id;
end;
$$;

revoke all on function public.claim_email_sync_run(text, integer) from public;
grant execute on function public.claim_email_sync_run(text, integer) to service_role;

notify pgrst, 'reload schema';
