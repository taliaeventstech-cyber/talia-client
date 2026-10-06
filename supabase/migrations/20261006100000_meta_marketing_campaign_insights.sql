create table public.meta_marketing_campaign_snapshots (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null,
  campaign_id text not null,
  name text not null,
  configured_status text not null,
  effective_status text not null,
  objective text,
  campaign_created_at timestamptz,
  campaign_updated_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  spend numeric(18, 2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  reach bigint not null default 0 check (reach >= 0),
  link_clicks bigint not null default 0 check (link_clicks >= 0),
  ctr numeric(12, 6) not null default 0 check (ctr >= 0),
  cpc numeric(18, 6) check (cpc >= 0),
  frequency numeric(12, 6) not null default 0 check (frequency >= 0),
  insights_date_start date,
  insights_date_stop date,
  synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, campaign_id),
  foreign key (theatre_id, connection_id)
    references public.meta_marketing_connections(theatre_id, id)
    on delete cascade,
  constraint meta_marketing_campaign_snapshots_campaign_id_check
    check (char_length(trim(campaign_id)) between 1 and 200),
  constraint meta_marketing_campaign_snapshots_name_check
    check (char_length(trim(name)) between 1 and 500),
  constraint meta_marketing_campaign_snapshots_insights_dates_check
    check (
      insights_date_start is null
      or insights_date_stop is null
      or insights_date_start <= insights_date_stop
    )
);

create index meta_marketing_campaign_snapshots_theatre_spend_idx
  on public.meta_marketing_campaign_snapshots(theatre_id, spend desc);

alter table public.meta_marketing_campaign_snapshots enable row level security;
revoke all on table public.meta_marketing_campaign_snapshots
  from public, anon, authenticated;

create trigger meta_marketing_campaign_snapshots_updated_at
  before update on public.meta_marketing_campaign_snapshots
  for each row execute function public.set_updated_at();

create or replace function public.get_meta_marketing_sync_context(
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
begin
  perform public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  select *
    into v_connection
  from public.meta_marketing_connections
  where theatre_id = p_theatre_id
    and status = 'connected'
  limit 1;

  if v_connection.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'connection_id', v_connection.id,
    'ad_account_id', v_connection.ad_account_id,
    'currency', v_connection.ad_account_currency,
    'credential_metadata', v_connection.credential_metadata
  );
end;
$$;

create or replace function public.replace_meta_marketing_campaign_snapshot(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
  p_summary jsonb,
  p_campaigns jsonb
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
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  if jsonb_typeof(p_summary) <> 'object'
     or jsonb_typeof(p_campaigns) <> 'array'
     or jsonb_array_length(p_campaigns) > 500 then
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

  delete from public.meta_marketing_campaign_snapshots
  where connection_id = p_connection_id;

  insert into public.meta_marketing_campaign_snapshots (
    theatre_id,
    connection_id,
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

  update public.meta_marketing_connections
  set metadata = jsonb_set(
        metadata,
        '{marketing_sync}',
        p_summary || jsonb_build_object(
          'status', 'success',
          'campaign_count', v_campaign_count,
          'last_attempted_at', v_synced_at,
          'last_synced_at', v_synced_at
        ),
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
      'period', 'last_30d'
    )
  );

  return v_campaign_count;
end;
$$;

create or replace function public.record_meta_marketing_sync_failure(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  perform public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  update public.meta_marketing_connections
  set metadata = jsonb_set(
        metadata,
        '{marketing_sync}',
        coalesce(metadata -> 'marketing_sync', '{}'::jsonb) || jsonb_build_object(
          'status', 'error',
          'last_attempted_at', v_now,
          'error_code', nullif(left(trim(coalesce(p_error_code, '')), 120), '')
        ),
        true
      ),
      updated_at = v_now
  where id = p_connection_id
    and theatre_id = p_theatre_id
    and status = 'connected';

  return found;
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
    new.metadata := new.metadata - 'marketing_sync';
  end if;
  return new;
end;
$$;

create trigger meta_marketing_connections_clear_snapshot
  before update of ad_account_id on public.meta_marketing_connections
  for each row execute function public.clear_meta_marketing_snapshot_on_account_change();

revoke all on function public.get_meta_marketing_sync_context(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_meta_marketing_sync_failure(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_meta_marketing_dashboard_snapshot(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.clear_meta_marketing_snapshot_on_account_change()
  from public, anon, authenticated;

grant execute on function public.get_meta_marketing_sync_context(uuid, uuid)
  to service_role;
grant execute on function public.replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb)
  to service_role;
grant execute on function public.record_meta_marketing_sync_failure(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.get_meta_marketing_dashboard_snapshot(uuid, uuid)
  to service_role;

comment on table public.meta_marketing_campaign_snapshots is
  'Backend-only current campaign and last-30-day Insights snapshot for one Meta ad account.';
comment on function public.get_meta_marketing_sync_context(uuid, uuid) is
  'Returns encrypted Meta Marketing sync context only to an authorized service-role caller.';
