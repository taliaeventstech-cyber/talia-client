create table public.meta_marketing_daily_insights (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null,
  insight_date date not null,
  spend numeric(18, 2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  reach bigint not null default 0 check (reach >= 0),
  link_clicks bigint not null default 0 check (link_clicks >= 0),
  ctr numeric(12, 6) not null default 0 check (ctr >= 0),
  cpc numeric(18, 6) check (cpc >= 0),
  frequency numeric(12, 6) not null default 0 check (frequency >= 0),
  synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, insight_date),
  foreign key (theatre_id, connection_id)
    references public.meta_marketing_connections(theatre_id, id)
    on delete cascade
);

create index meta_marketing_daily_insights_theatre_date_idx
  on public.meta_marketing_daily_insights(theatre_id, insight_date desc);

alter table public.meta_marketing_daily_insights enable row level security;
revoke all on table public.meta_marketing_daily_insights
  from public, anon, authenticated;

create trigger meta_marketing_daily_insights_updated_at
  before update on public.meta_marketing_daily_insights
  for each row execute function public.set_updated_at();

create or replace function public.replace_meta_marketing_campaign_snapshot(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
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
  v_campaign_count integer;
  v_daily_insight_count integer;
  v_synced_at timestamptz;
begin
  if jsonb_typeof(p_daily_insights) <> 'array'
     or jsonb_array_length(p_daily_insights) > 31 then
    raise exception 'meta_marketing_snapshot_invalid';
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

  v_campaign_count := public.replace_meta_marketing_campaign_snapshot(
    p_theatre_id,
    p_actor_user_id,
    p_connection_id,
    p_summary,
    p_campaigns
  );
  v_synced_at := clock_timestamp();

  delete from public.meta_marketing_daily_insights
  where connection_id = p_connection_id;

  insert into public.meta_marketing_daily_insights (
    theatre_id,
    connection_id,
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

  update public.meta_marketing_connections
  set metadata = jsonb_set(
        metadata,
        '{marketing_sync}',
        coalesce(metadata -> 'marketing_sync', '{}'::jsonb) || jsonb_build_object(
          'daily_insight_count', v_daily_insight_count
        ),
        true
      ),
      updated_at = v_synced_at
  where id = p_connection_id
    and theatre_id = p_theatre_id;

  return v_campaign_count;
end;
$$;

create or replace function public.get_meta_marketing_dashboard_snapshot(
  p_theatre_id uuid,
  p_actor_user_id uuid
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

  v_sync := coalesce(v_connection.metadata -> 'marketing_sync', '{}'::jsonb);

  return jsonb_build_object(
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
    ), '[]'::jsonb)
  );
end;
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
    new.metadata := new.metadata - 'marketing_sync';
  end if;
  return new;
end;
$$;

revoke all on function public.replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_meta_marketing_dashboard_snapshot(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.clear_meta_marketing_snapshot_on_account_change()
  from public, anon, authenticated;

grant execute on function public.replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.get_meta_marketing_dashboard_snapshot(uuid, uuid)
  to service_role;

comment on table public.meta_marketing_daily_insights is
  'Backend-only daily account-level Insights for the current Meta last-30-day snapshot.';
