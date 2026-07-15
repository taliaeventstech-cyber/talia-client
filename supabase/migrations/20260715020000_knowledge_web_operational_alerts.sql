create index if not exists knowledge_sync_runs_source_created_idx
  on public.knowledge_sync_runs(source_id, created_at desc);

create or replace function public.get_knowledge_web_operational_alerts(
  p_theatre_id uuid default null,
  p_now timestamptz default now(),
  p_warning_ratio numeric default 0.8,
  p_limit integer default 100
)
returns table (
  alert_key text,
  theatre_id uuid,
  theatre_name text,
  source_id uuid,
  source_name text,
  kind text,
  severity text,
  current_value integer,
  limit_value integer,
  ratio numeric,
  latest_status text,
  error_code text,
  occurred_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with parameters as (
    select
      greatest(0.5, least(coalesce(p_warning_ratio, 0.8), 1)) as warning_ratio,
      greatest(1, least(coalesce(p_limit, 100), 500)) as result_limit,
      date_trunc('day', p_now at time zone 'UTC') at time zone 'UTC' as utc_day_start
  ), managed_sources as (
    select
      source.id,
      source.theatre_id,
      source.name,
      source.refresh_interval,
      source.next_sync_at,
      theatre.name as theatre_name
    from public.knowledge_sources as source
    join public.theatres as theatre on theatre.id = source.theatre_id
    where source.type in ('url', 'sitemap', 'website')
      and (p_theatre_id is null or source.theatre_id = p_theatre_id)
  ), terminal_runs as (
    select
      run.id,
      run.source_id,
      run.status,
      run.error_code,
      coalesce(run.finished_at, run.created_at) as occurred_at,
      row_number() over (
        partition by run.source_id
        order by run.created_at desc, run.id desc
      ) as run_number
    from public.knowledge_sync_runs as run
    join managed_sources as source on source.id = run.source_id
    where run.status in ('succeeded', 'partial', 'failed', 'cancelled')
  ), recent_terminal_runs as (
    select *
    from terminal_runs
    where run_number <= 10
  ), marked_runs as (
    select
      run.*,
      sum(case when run.status in ('failed', 'partial') then 0 else 1 end) over (
        partition by run.source_id
        order by run.run_number
        rows between unbounded preceding and current row
      ) as boundary_count
    from recent_terminal_runs as run
  ), problem_streaks as (
    select
      run.source_id,
      count(*) filter (
        where run.boundary_count = 0
          and run.status in ('failed', 'partial')
      )::integer as problem_streak
    from marked_runs as run
    group by run.source_id
  ), active_runs as (
    select distinct run.source_id
    from public.knowledge_sync_runs as run
    join managed_sources as source on source.id = run.source_id
    where run.status in ('queued', 'running')
  ), source_failure_alerts as (
    select
      'source-failure:' || source.id::text as alert_key,
      source.theatre_id,
      source.theatre_name,
      source.id as source_id,
      source.name as source_name,
      'source_failure_streak'::text as kind,
      case
        when latest.status = 'failed' and streak.problem_streak >= 3 then 'critical'
        else 'warning'
      end::text as severity,
      streak.problem_streak as current_value,
      3::integer as limit_value,
      least(streak.problem_streak::numeric / 3, 1) as ratio,
      latest.status as latest_status,
      latest.error_code,
      latest.occurred_at
    from managed_sources as source
    join terminal_runs as latest
      on latest.source_id = source.id
     and latest.run_number = 1
    join problem_streaks as streak on streak.source_id = source.id
    where latest.status in ('failed', 'partial')
      and streak.problem_streak >= 2
  ), source_overdue_alerts as (
    select
      'source-overdue:' || source.id::text as alert_key,
      source.theatre_id,
      source.theatre_name,
      source.id as source_id,
      source.name as source_name,
      'source_sync_overdue'::text as kind,
      case
        when source.next_sync_at <= p_now - interval '24 hours' then 'critical'
        else 'warning'
      end::text as severity,
      floor(extract(epoch from (p_now - source.next_sync_at)) / 3600)::integer as current_value,
      6::integer as limit_value,
      least(extract(epoch from (p_now - source.next_sync_at)) / 86400, 1)::numeric as ratio,
      null::text as latest_status,
      null::text as error_code,
      source.next_sync_at as occurred_at
    from managed_sources as source
    left join active_runs as active on active.source_id = source.id
    where source.refresh_interval <> 'manual'
      and source.next_sync_at <= p_now - interval '6 hours'
      and active.source_id is null
  ), managed_tenants as (
    select distinct source.theatre_id, source.theatre_name
    from managed_sources as source
  ), source_usage as (
    select source.theatre_id, count(*)::integer as current_value
    from managed_sources as source
    group by source.theatre_id
  ), document_usage as (
    select document.theatre_id, count(*)::integer as current_value
    from public.knowledge_documents as document
    join managed_sources as source
      on source.id = document.source_id
     and source.theatre_id = document.theatre_id
    where document.status <> 'removed'
    group by document.theatre_id
  ), source_document_usage as (
    select
      source.id as source_id,
      source.theatre_id,
      source.theatre_name,
      source.name as source_name,
      count(document.id) filter (where document.status <> 'removed')::integer as current_value
    from managed_sources as source
    left join public.knowledge_documents as document
      on document.source_id = source.id
     and document.theatre_id = source.theatre_id
    group by source.id, source.theatre_id, source.theatre_name, source.name
  ), manual_sync_usage as (
    select run.theatre_id, count(*)::integer as current_value
    from public.knowledge_sync_runs as run
    join managed_sources as source
      on source.id = run.source_id
     and source.theatre_id = run.theatre_id
    cross join parameters
    where run.trigger = 'manual'
      and run.created_at >= parameters.utc_day_start
      and run.created_at <= p_now
    group by run.theatre_id
  ), tenant_usage as (
    select
      tenant.theatre_id,
      tenant.theatre_name,
      coalesce(sources.current_value, 0) as source_count,
      coalesce(documents.current_value, 0) as document_count,
      coalesce(manual_syncs.current_value, 0) as manual_sync_count,
      limits.max_sources,
      limits.max_documents,
      limits.max_manual_syncs_per_day
    from managed_tenants as tenant
    left join source_usage as sources on sources.theatre_id = tenant.theatre_id
    left join document_usage as documents on documents.theatre_id = tenant.theatre_id
    left join manual_sync_usage as manual_syncs on manual_syncs.theatre_id = tenant.theatre_id
    cross join lateral public.get_knowledge_web_limits(tenant.theatre_id) as limits
  ), quota_facts as (
    select
      usage.theatre_id,
      usage.theatre_name,
      quota.kind,
      quota.current_value,
      quota.limit_value
    from tenant_usage as usage
    cross join lateral (
      values
        ('source_quota_usage'::text, usage.source_count, usage.max_sources),
        ('document_quota_usage'::text, usage.document_count, usage.max_documents),
        ('manual_sync_quota_usage'::text, usage.manual_sync_count, usage.max_manual_syncs_per_day)
    ) as quota(kind, current_value, limit_value)
  ), quota_alerts as (
    select
      'quota:' || quota.theatre_id::text || ':' || quota.kind as alert_key,
      quota.theatre_id,
      quota.theatre_name,
      null::uuid as source_id,
      null::text as source_name,
      quota.kind,
      case when quota.current_value >= quota.limit_value then 'critical' else 'warning' end::text as severity,
      quota.current_value,
      quota.limit_value,
      quota.current_value::numeric / quota.limit_value as ratio,
      null::text as latest_status,
      null::text as error_code,
      p_now as occurred_at
    from quota_facts as quota
    cross join parameters
    where quota.current_value::numeric / quota.limit_value >= parameters.warning_ratio
  ), source_page_quota_alerts as (
    select
      'source-page-quota:' || usage.source_id::text as alert_key,
      usage.theatre_id,
      usage.theatre_name,
      usage.source_id,
      usage.source_name,
      'source_page_quota_usage'::text as kind,
      case when usage.current_value >= limits.max_pages_per_source then 'critical' else 'warning' end::text as severity,
      usage.current_value,
      limits.max_pages_per_source as limit_value,
      usage.current_value::numeric / limits.max_pages_per_source as ratio,
      null::text as latest_status,
      null::text as error_code,
      p_now as occurred_at
    from source_document_usage as usage
    cross join lateral public.get_knowledge_web_limits(usage.theatre_id) as limits
    cross join parameters
    where usage.current_value::numeric / limits.max_pages_per_source >= parameters.warning_ratio
  ), alerts as (
    select * from source_failure_alerts
    union all
    select * from source_overdue_alerts
    union all
    select * from quota_alerts
    union all
    select * from source_page_quota_alerts
  )
  select alert.*
  from alerts as alert
  cross join parameters
  order by
    case alert.severity when 'critical' then 0 else 1 end,
    alert.occurred_at desc,
    alert.alert_key
  limit (select result_limit from parameters);
$$;

revoke all on function public.get_knowledge_web_operational_alerts(uuid, timestamptz, numeric, integer) from public;
grant execute on function public.get_knowledge_web_operational_alerts(uuid, timestamptz, numeric, integer) to service_role;

notify pgrst, 'reload schema';
