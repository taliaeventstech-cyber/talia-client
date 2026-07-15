drop policy if exists "knowledge_sync_runs_select_own_theatre" on public.knowledge_sync_runs;
create policy "knowledge_sync_runs_select_own_theatre" on public.knowledge_sync_runs
  for select using (
    theatre_id in (select public.current_theatre_ids())
    or exists (select 1 from public.platform_admins where platform_admins.user_id = auth.uid())
  );

alter table public.knowledge_sync_runs replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.knowledge_sync_runs;
exception when duplicate_object then null;
end;
$$;

create or replace function public.checkpoint_knowledge_sync_run(
  p_run_id uuid, p_worker_id text, p_phase text,
  p_discovered_count integer, p_checked_count integer,
  p_changed_count integer, p_unchanged_count integer,
  p_failed_count integer, p_blocked_count integer
)
returns public.knowledge_sync_runs
language plpgsql security definer set search_path = public
as $$
declare checkpointed_run public.knowledge_sync_runs%rowtype;
begin
  if p_phase not in ('discovering', 'fetching', 'chunking', 'finishing') then
    raise exception 'invalid_sync_phase';
  end if;
  update public.knowledge_sync_runs
  set discovered_count = greatest(discovered_count, greatest(p_discovered_count, 0)),
      checked_count = greatest(checked_count, greatest(p_checked_count, 0)),
      changed_count = greatest(changed_count, greatest(p_changed_count, 0)),
      unchanged_count = greatest(unchanged_count, greatest(p_unchanged_count, 0)),
      failed_count = greatest(failed_count, greatest(p_failed_count, 0)),
      blocked_count = greatest(blocked_count, greatest(p_blocked_count, 0)),
      metadata = jsonb_set(metadata, '{phase}', to_jsonb(p_phase), true),
      updated_at = now()
  where id = p_run_id and worker_id = p_worker_id
    and status = 'running' and lease_expires_at > now()
  returning * into checkpointed_run;
  if checkpointed_run.id is null then raise exception 'knowledge_sync_checkpoint_rejected'; end if;
  return checkpointed_run;
end;
$$;

revoke all on function public.checkpoint_knowledge_sync_run(uuid, text, text, integer, integer, integer, integer, integer, integer) from public;
grant execute on function public.checkpoint_knowledge_sync_run(uuid, text, text, integer, integer, integer, integer, integer, integer) to service_role;
