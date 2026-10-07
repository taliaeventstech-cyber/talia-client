alter table public.meta_marketing_campaign_snapshots
  add column period text not null default 'last_30d';

alter table public.meta_marketing_campaign_snapshots
  add constraint meta_marketing_campaign_snapshots_period_check
  check (period in ('last_7d', 'last_30d', 'last_90d'));

alter table public.meta_marketing_campaign_snapshots
  drop constraint if exists meta_marketing_campaign_snapshots_connection_id_campaign_id_key;

alter table public.meta_marketing_campaign_snapshots
  add constraint meta_marketing_campaign_snapshots_connection_period_campaign_key
  unique (connection_id, period, campaign_id);

alter table public.meta_marketing_daily_insights
  add column period text not null default 'last_30d';

alter table public.meta_marketing_daily_insights
  add constraint meta_marketing_daily_insights_period_check
  check (period in ('last_7d', 'last_30d', 'last_90d'));

alter table public.meta_marketing_daily_insights
  drop constraint if exists meta_marketing_daily_insights_connection_id_insight_date_key;

alter table public.meta_marketing_daily_insights
  add constraint meta_marketing_daily_insights_connection_period_date_key
  unique (connection_id, period, insight_date);

create index meta_marketing_campaign_snapshots_theatre_period_spend_idx
  on public.meta_marketing_campaign_snapshots(theatre_id, period, spend desc);

create index meta_marketing_daily_insights_theatre_period_date_idx
  on public.meta_marketing_daily_insights(theatre_id, period, insight_date desc);

update public.meta_marketing_connections
set metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb) - 'marketing_sync',
      '{marketing_sync_periods}',
      coalesce(metadata -> 'marketing_sync_periods', '{}'::jsonb)
        || jsonb_build_object('last_30d', metadata -> 'marketing_sync'),
      true
    )
where metadata ? 'marketing_sync';

create or replace function public.replace_meta_marketing_campaign_snapshot(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
  p_period text,
  p_summary jsonb,
  p_campaigns jsonb,
  p_daily_insights jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_account_id uuid;
  v_synced_at timestamptz := clock_timestamp();
  v_campaign_count integer;
  v_daily_insight_count integer;
  v_max_days integer;
  v_sync jsonb;
begin
  if p_period not in ('last_7d', 'last_30d', 'last_90d') then
    raise exception 'meta_marketing_period_invalid';
  end if;

  v_max_days := case p_period
    when 'last_7d' then 7
    when 'last_30d' then 30
    when 'last_90d' then 90
  end;

  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  if jsonb_typeof(p_summary) <> 'object'
     or jsonb_typeof(p_campaigns) <> 'array'
     or jsonb_array_length(p_campaigns) > 500
     or jsonb_typeof(p_daily_insights) <> 'array'
     or jsonb_array_length(p_daily_insights) > v_max_days then
    raise exception 'meta_marketing_snapshot_invalid';
  end if;

  if not (p_summary ?& array[
       'spend', 'impressions', 'reach', 'link_clicks', 'ctr', 'cpc',
       'frequency', 'date_start', 'date_stop'
     ])
     or coalesce((p_summary ->> 'spend')::numeric, -1) < 0
     or coalesce((p_summary ->> 'impressions')::bigint, -1) < 0
     or coalesce((p_summary ->> 'reach')::bigint, -1) < 0
     or coalesce((p_summary ->> 'link_clicks')::bigint, -1) < 0
     or coalesce((p_summary ->> 'ctr')::numeric, -1) < 0
     or (p_summary -> 'cpc' <> 'null'::jsonb and (p_summary ->> 'cpc')::numeric < 0)
     or coalesce((p_summary ->> 'frequency')::numeric, -1) < 0
     or (
       p_summary -> 'date_start' <> 'null'::jsonb
       and p_summary -> 'date_stop' <> 'null'::jsonb
       and (p_summary ->> 'date_start')::date > (p_summary ->> 'date_stop')::date
     ) then
    raise exception 'meta_marketing_summary_snapshot_invalid';
  end if;

  if not exists (
    select 1
    from public.meta_marketing_connections connection
    where connection.id = p_connection_id
      and connection.theatre_id = p_theatre_id
      and connection.status = 'connected'
  ) then
    raise exception 'meta_marketing_connection_unavailable';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_campaigns) as campaign(
      campaign_id text,
      name text,
      configured_status text,
      effective_status text,
      spend numeric,
      impressions bigint,
      reach bigint,
      link_clicks bigint,
      ctr numeric,
      cpc numeric,
      frequency numeric,
      insights_date_start date,
      insights_date_stop date
    )
    where nullif(trim(coalesce(campaign.campaign_id, '')), '') is null
       or char_length(campaign.campaign_id) > 200
       or nullif(trim(coalesce(campaign.name, '')), '') is null
       or char_length(campaign.name) > 500
       or campaign.spend < 0
       or campaign.impressions < 0
       or campaign.reach < 0
       or campaign.link_clicks < 0
       or campaign.ctr < 0
       or campaign.cpc < 0
       or campaign.frequency < 0
       or campaign.insights_date_start > campaign.insights_date_stop
  ) then
    raise exception 'meta_marketing_campaign_snapshot_invalid';
  end if;

  if (
    select count(*) <> count(distinct campaign.campaign_id)
    from jsonb_to_recordset(p_campaigns) as campaign(campaign_id text)
  ) then
    raise exception 'meta_marketing_campaign_snapshot_duplicate';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_daily_insights) as insight(
      date date,
      spend numeric,
      impressions bigint,
      reach bigint,
      link_clicks bigint,
      ctr numeric,
      cpc numeric,
      frequency numeric
    )
    where insight.date is null
       or coalesce(insight.spend, -1) < 0
       or coalesce(insight.impressions, -1) < 0
       or coalesce(insight.reach, -1) < 0
       or coalesce(insight.link_clicks, -1) < 0
       or coalesce(insight.ctr, -1) < 0
       or insight.cpc < 0
       or coalesce(insight.frequency, -1) < 0
  ) then
    raise exception 'meta_marketing_daily_insight_invalid';
  end if;

  if (
    select count(*) <> count(distinct insight.date)
    from jsonb_to_recordset(p_daily_insights) as insight(date date)
  ) then
    raise exception 'meta_marketing_daily_insight_duplicate';
  end if;

  delete from public.meta_marketing_campaign_snapshots
  where connection_id = p_connection_id
    and period = p_period;

  insert into public.meta_marketing_campaign_snapshots (
    theatre_id,
    connection_id,
    period,
    campaign_id,
    name,
    configured_status,
    effective_status,
    objective,
    campaign_created_at,
    campaign_updated_at,
    starts_at,
    ends_at,
    spend,
    impressions,
    reach,
    link_clicks,
    ctr,
    cpc,
    frequency,
    insights_date_start,
    insights_date_stop,
    synced_at
  )
  select
    p_theatre_id,
    p_connection_id,
    p_period,
    trim(campaign.campaign_id),
    trim(campaign.name),
    coalesce(nullif(trim(campaign.configured_status), ''), 'UNKNOWN'),
    coalesce(nullif(trim(campaign.effective_status), ''), 'UNKNOWN'),
    nullif(trim(campaign.objective), ''),
    campaign.campaign_created_at,
    campaign.campaign_updated_at,
    campaign.starts_at,
    campaign.ends_at,
    coalesce(campaign.spend, 0),
    coalesce(campaign.impressions, 0),
    coalesce(campaign.reach, 0),
    coalesce(campaign.link_clicks, 0),
    coalesce(campaign.ctr, 0),
    campaign.cpc,
    coalesce(campaign.frequency, 0),
    campaign.insights_date_start,
    campaign.insights_date_stop,
    v_synced_at
  from jsonb_to_recordset(p_campaigns) as campaign(
    campaign_id text,
    name text,
    configured_status text,
    effective_status text,
    objective text,
    campaign_created_at timestamptz,
    campaign_updated_at timestamptz,
    starts_at timestamptz,
    ends_at timestamptz,
    spend numeric,
    impressions bigint,
    reach bigint,
    link_clicks bigint,
    ctr numeric,
    cpc numeric,
    frequency numeric,
    insights_date_start date,
    insights_date_stop date
  );

  get diagnostics v_campaign_count = row_count;

  delete from public.meta_marketing_daily_insights
  where connection_id = p_connection_id
    and period = p_period;

  insert into public.meta_marketing_daily_insights (
    theatre_id,
    connection_id,
    period,
    insight_date,
    spend,
    impressions,
    reach,
    link_clicks,
    ctr,
    cpc,
    frequency,
    synced_at
  )
  select
    p_theatre_id,
    p_connection_id,
    p_period,
    insight.date,
    coalesce(insight.spend, 0),
    coalesce(insight.impressions, 0),
    coalesce(insight.reach, 0),
    coalesce(insight.link_clicks, 0),
    coalesce(insight.ctr, 0),
    insight.cpc,
    coalesce(insight.frequency, 0),
    v_synced_at
  from jsonb_to_recordset(p_daily_insights) as insight(
    date date,
    spend numeric,
    impressions bigint,
    reach bigint,
    link_clicks bigint,
    ctr numeric,
    cpc numeric,
    frequency numeric
  );

  get diagnostics v_daily_insight_count = row_count;

  v_sync := p_summary || jsonb_build_object(
    'status', 'success',
    'error_code', null,
    'campaign_count', v_campaign_count,
    'daily_insight_count', v_daily_insight_count,
    'last_attempted_at', v_synced_at,
    'last_synced_at', v_synced_at
  );

  update public.meta_marketing_connections
  set metadata = jsonb_set(
        jsonb_set(
          coalesce(metadata, '{}'::jsonb),
          '{marketing_sync_periods}',
          coalesce(metadata -> 'marketing_sync_periods', '{}'::jsonb),
          true
        ),
        array['marketing_sync_periods', p_period],
        v_sync,
        true
      ),
      updated_at = v_synced_at
  where id = p_connection_id
    and theatre_id = p_theatre_id;

  select account_id into v_account_id
  from public.theatres
  where id = p_theatre_id;

  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'marketing.meta_snapshot_synced', 'meta_marketing_connection', p_connection_id,
    jsonb_build_object(
      'campaign_count', v_campaign_count,
      'daily_insight_count', v_daily_insight_count,
      'period', p_period
    )
  );

  return v_campaign_count;
end;
$$;

create or replace function public.replace_meta_marketing_campaign_snapshot(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
  p_summary jsonb,
  p_campaigns jsonb,
  p_daily_insights jsonb
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.replace_meta_marketing_campaign_snapshot(
    p_theatre_id,
    p_actor_user_id,
    p_connection_id,
    'last_30d',
    p_summary,
    p_campaigns,
    p_daily_insights
  );
$$;

create or replace function public.record_meta_marketing_sync_failure(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
  p_period text,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_sync jsonb;
begin
  if p_period not in ('last_7d', 'last_30d', 'last_90d') then
    raise exception 'meta_marketing_period_invalid';
  end if;

  perform public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  select coalesce(
      metadata #> array['marketing_sync_periods', p_period],
      '{}'::jsonb
    )
    into v_sync
  from public.meta_marketing_connections
  where id = p_connection_id
    and theatre_id = p_theatre_id
    and status = 'connected';

  if not found then
    return false;
  end if;

  v_sync := v_sync || jsonb_build_object(
    'status', 'error',
    'last_attempted_at', v_now,
    'error_code', nullif(left(trim(coalesce(p_error_code, '')), 120), '')
  );

  update public.meta_marketing_connections
  set metadata = jsonb_set(
        jsonb_set(
          coalesce(metadata, '{}'::jsonb),
          '{marketing_sync_periods}',
          coalesce(metadata -> 'marketing_sync_periods', '{}'::jsonb),
          true
        ),
        array['marketing_sync_periods', p_period],
        v_sync,
        true
      ),
      updated_at = v_now
  where id = p_connection_id
    and theatre_id = p_theatre_id
    and status = 'connected';

  return found;
end;
$$;

create or replace function public.record_meta_marketing_sync_failure(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
  p_error_code text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.record_meta_marketing_sync_failure(
    p_theatre_id,
    p_actor_user_id,
    p_connection_id,
    'last_30d',
    p_error_code
  );
$$;

create or replace function public.get_meta_marketing_dashboard_snapshot(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_period text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.meta_marketing_connections%rowtype;
  v_sync jsonb;
begin
  if p_period not in ('last_7d', 'last_30d', 'last_90d') then
    raise exception 'meta_marketing_period_invalid';
  end if;

  perform public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  select *
    into v_connection
  from public.meta_marketing_connections
  where theatre_id = p_theatre_id
  limit 1;

  if v_connection.id is null then
    return null;
  end if;

  v_sync := coalesce(
    v_connection.metadata #> array['marketing_sync_periods', p_period],
    '{}'::jsonb
  );

  return jsonb_build_object(
    'period', p_period,
    'status', coalesce(v_sync ->> 'status', 'never'),
    'last_attempted_at', v_sync ->> 'last_attempted_at',
    'last_synced_at', v_sync ->> 'last_synced_at',
    'error_code', v_sync ->> 'error_code',
    'summary', case
      when v_sync ? 'last_synced_at' then jsonb_build_object(
        'spend', coalesce((v_sync ->> 'spend')::numeric, 0),
        'impressions', coalesce((v_sync ->> 'impressions')::bigint, 0),
        'reach', coalesce((v_sync ->> 'reach')::bigint, 0),
        'link_clicks', coalesce((v_sync ->> 'link_clicks')::bigint, 0),
        'ctr', coalesce((v_sync ->> 'ctr')::numeric, 0),
        'cpc', (v_sync ->> 'cpc')::numeric,
        'frequency', coalesce((v_sync ->> 'frequency')::numeric, 0),
        'date_start', v_sync ->> 'date_start',
        'date_stop', v_sync ->> 'date_stop'
      )
      else null
    end,
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'campaign_id', campaign.campaign_id,
        'name', campaign.name,
        'configured_status', campaign.configured_status,
        'effective_status', campaign.effective_status,
        'objective', campaign.objective,
        'campaign_created_at', campaign.campaign_created_at,
        'campaign_updated_at', campaign.campaign_updated_at,
        'starts_at', campaign.starts_at,
        'ends_at', campaign.ends_at,
        'spend', campaign.spend,
        'impressions', campaign.impressions,
        'reach', campaign.reach,
        'link_clicks', campaign.link_clicks,
        'ctr', campaign.ctr,
        'cpc', campaign.cpc,
        'frequency', campaign.frequency,
        'insights_date_start', campaign.insights_date_start,
        'insights_date_stop', campaign.insights_date_stop
      ) order by campaign.spend desc, campaign.name)
      from public.meta_marketing_campaign_snapshots campaign
      where campaign.connection_id = v_connection.id
        and campaign.period = p_period
    ), '[]'::jsonb),
    'daily_insights', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', insight.insight_date,
        'spend', insight.spend,
        'impressions', insight.impressions,
        'reach', insight.reach,
        'link_clicks', insight.link_clicks,
        'ctr', insight.ctr,
        'cpc', insight.cpc,
        'frequency', insight.frequency
      ) order by insight.insight_date)
      from public.meta_marketing_daily_insights insight
      where insight.connection_id = v_connection.id
        and insight.period = p_period
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_meta_marketing_dashboard_snapshot(
  p_theatre_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.get_meta_marketing_dashboard_snapshot(
    p_theatre_id,
    p_actor_user_id,
    'last_30d'
  );
$$;

create or replace function public.clear_meta_marketing_snapshot_on_account_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.ad_account_id is distinct from new.ad_account_id then
    delete from public.meta_marketing_campaign_snapshots
    where connection_id = old.id;
    delete from public.meta_marketing_daily_insights
    where connection_id = old.id;
    new.metadata := new.metadata - 'marketing_sync' - 'marketing_sync_periods';
  end if;
  return new;
end;
$$;

revoke all on function public.replace_meta_marketing_campaign_snapshot(
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.record_meta_marketing_sync_failure(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.get_meta_marketing_dashboard_snapshot(
  uuid, uuid, text
) from public, anon, authenticated;

grant execute on function public.replace_meta_marketing_campaign_snapshot(
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.record_meta_marketing_sync_failure(
  uuid, uuid, uuid, text, text
) to service_role;
grant execute on function public.get_meta_marketing_dashboard_snapshot(
  uuid, uuid, text
) to service_role;

comment on column public.meta_marketing_campaign_snapshots.period is
  'Validated Meta Insights date preset for this campaign snapshot.';
comment on column public.meta_marketing_daily_insights.period is
  'Validated Meta Insights date preset for this daily account series.';
