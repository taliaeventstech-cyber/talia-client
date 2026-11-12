-- Drop the pre-period overloads of the Meta Marketing snapshot functions.
--
-- `20261007150000_meta_marketing_period_snapshots.sql` introduced a `p_period`
-- argument and deliberately kept the older signatures as compatibility shims
-- that delegate with 'last_30d', so a deploy in flight would not break. That
-- window closed a month ago: every call site in this repo passes `p_period`
-- (3 of 3 in src/lib/marketing/connection-service.ts), and no SQL other than
-- those shims references them.
--
-- They are not harmless leftovers. Each is `security definer` and reachable
-- through PostgREST, so they are live, unused, privileged surface — the kind
-- this app should not be carrying into a CASA assessment.
--
-- The pre-period `replace_meta_marketing_campaign_snapshot(…, p_summary,
-- p_campaigns)` from `20261006100000` is dropped too: it predates
-- `p_daily_insights` and was never a shim, just never cleaned up.
--
-- Data is untouched; only the redundant entry points go away. Dropping these
-- is safe only while the deployed application sends `p_period`, which is why
-- this must not be applied ahead of a deploy that still omits it.

-- Refuse to run if the signatures that must survive are not there: better to
-- fail the migration than to leave the feature with no entry point at all.
do $$
begin
  if to_regprocedure('public.get_meta_marketing_dashboard_snapshot(uuid, uuid, text)') is null
    or to_regprocedure('public.record_meta_marketing_sync_failure(uuid, uuid, uuid, text, text)') is null
    or to_regprocedure('public.replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, text, jsonb, jsonb, jsonb)') is null
  then
    raise exception
      'the p_period variants are missing; 20261007150000_meta_marketing_period_snapshots.sql must be applied first';
  end if;
end;
$$;

-- get_meta_marketing_dashboard_snapshot(p_theatre_id, p_actor_user_id)
drop function if exists public.get_meta_marketing_dashboard_snapshot(uuid, uuid);

-- record_meta_marketing_sync_failure(p_theatre_id, p_actor_user_id, p_connection_id, p_error_code)
drop function if exists public.record_meta_marketing_sync_failure(uuid, uuid, uuid, text);

-- replace_meta_marketing_campaign_snapshot(p_theatre_id, p_actor_user_id, p_connection_id, p_summary, p_campaigns)
drop function if exists public.replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb);

-- replace_meta_marketing_campaign_snapshot(p_theatre_id, p_actor_user_id, p_connection_id, p_summary, p_campaigns, p_daily_insights)
drop function if exists public.replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb, jsonb);
