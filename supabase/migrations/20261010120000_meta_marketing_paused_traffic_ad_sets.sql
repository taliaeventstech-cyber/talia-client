create table public.meta_marketing_ad_set_creation_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null,
  actor_profile_id uuid not null references public.profiles(id),
  actor_user_id uuid not null,
  provider_campaign_id text not null,
  name text not null,
  objective text not null default 'OUTCOME_TRAFFIC'
    check (objective = 'OUTCOME_TRAFFIC'),
  daily_budget_minor bigint not null check (daily_budget_minor between 1 and 1000000000000),
  currency text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  countries text[] not null,
  age_min integer not null check (age_min between 18 and 65),
  age_max integer not null check (age_max between 18 and 65),
  status text not null default 'processing'
    check (status in ('processing', 'succeeded', 'failed')),
  provider_ad_set_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (theatre_id, connection_id)
    references public.meta_marketing_connections(theatre_id, id)
    on delete cascade,
  constraint meta_marketing_ad_set_creation_name_check
    check (char_length(trim(name)) between 1 and 200),
  constraint meta_marketing_ad_set_creation_campaign_id_check
    check (char_length(trim(provider_campaign_id)) between 1 and 200),
  constraint meta_marketing_ad_set_creation_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint meta_marketing_ad_set_creation_dates_check
    check (end_time > start_time and end_time <= start_time + interval '366 days'),
  constraint meta_marketing_ad_set_creation_countries_check
    check (cardinality(countries) between 1 and 25),
  constraint meta_marketing_ad_set_creation_age_check
    check (age_max >= age_min),
  constraint meta_marketing_ad_set_creation_provider_id_check
    check (
      provider_ad_set_id is null
      or char_length(trim(provider_ad_set_id)) between 1 and 200
    ),
  constraint meta_marketing_ad_set_creation_error_code_check
    check (error_code is null or char_length(error_code) between 1 and 120),
  constraint meta_marketing_ad_set_creation_result_check
    check (
      (status = 'processing' and provider_ad_set_id is null and error_code is null)
      or (status = 'succeeded' and provider_ad_set_id is not null and error_code is null)
      or (status = 'failed' and provider_ad_set_id is null and error_code is not null)
    )
);

create unique index meta_marketing_ad_set_creation_provider_id_idx
  on public.meta_marketing_ad_set_creation_requests(connection_id, provider_ad_set_id)
  where provider_ad_set_id is not null;

create index meta_marketing_ad_set_creation_theatre_created_idx
  on public.meta_marketing_ad_set_creation_requests(theatre_id, created_at desc);

alter table public.meta_marketing_ad_set_creation_requests enable row level security;
revoke all on table public.meta_marketing_ad_set_creation_requests
  from public, anon, authenticated;

create trigger meta_marketing_ad_set_creation_requests_updated_at
  before update on public.meta_marketing_ad_set_creation_requests
  for each row execute function public.set_updated_at();

create or replace function public.list_meta_marketing_eligible_traffic_campaigns(
  p_theatre_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection_id uuid;
begin
  perform public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  select connection.id into v_connection_id
  from public.meta_marketing_connections connection
  where connection.theatre_id = p_theatre_id
    and connection.status = 'connected'
  limit 1;

  if v_connection_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'campaign_id', campaign.campaign_id,
      'name', campaign.name,
      'configured_status', campaign.configured_status,
      'source', campaign.source
    ) order by campaign.name, campaign.campaign_id)
    from (
      select distinct on (candidate.campaign_id)
        candidate.campaign_id,
        candidate.name,
        candidate.configured_status,
        candidate.source,
        candidate.source_priority
      from (
        select
          snapshot.campaign_id,
          snapshot.name,
          snapshot.configured_status,
          'snapshot'::text as source,
          1 as source_priority
        from public.meta_marketing_campaign_snapshots snapshot
        where snapshot.connection_id = v_connection_id
          and snapshot.objective = 'OUTCOME_TRAFFIC'
          and snapshot.configured_status not in ('ARCHIVED', 'DELETED')

        union all

        select
          request.provider_campaign_id as campaign_id,
          request.name,
          'PAUSED'::text as configured_status,
          'talia'::text as source,
          0 as source_priority
        from public.meta_marketing_campaign_creation_requests request
        where request.connection_id = v_connection_id
          and request.objective = 'OUTCOME_TRAFFIC'
          and request.status = 'succeeded'
      ) candidate
      order by candidate.campaign_id, candidate.source_priority
    ) campaign
  ), '[]'::jsonb);
end;
$$;

create or replace function public.claim_meta_marketing_ad_set_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_provider_campaign_id text,
  p_name text,
  p_daily_budget_minor bigint,
  p_expected_currency text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_countries text[],
  p_age_min integer,
  p_age_max integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_connection public.meta_marketing_connections%rowtype;
  v_request public.meta_marketing_ad_set_creation_requests%rowtype;
  v_countries text[];
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  select coalesce(array_agg(distinct upper(trim(country)) order by upper(trim(country))), '{}'::text[])
    into v_countries
  from unnest(coalesce(p_countries, '{}'::text[])) country;

  if p_request_id is null
     or nullif(trim(coalesce(p_provider_campaign_id, '')), '') is null
     or char_length(trim(p_provider_campaign_id)) > 200
     or nullif(trim(coalesce(p_name, '')), '') is null
     or char_length(trim(p_name)) > 200
     or p_daily_budget_minor is null
     or p_daily_budget_minor not between 1 and 1000000000000
     or upper(trim(coalesce(p_expected_currency, ''))) !~ '^[A-Z]{3}$'
     or p_start_time is null
     or p_start_time <= clock_timestamp()
     or p_end_time is null
     or p_end_time <= p_start_time
     or p_end_time > p_start_time + interval '366 days'
     or cardinality(v_countries) not between 1 and 25
     or exists (select 1 from unnest(v_countries) country where country !~ '^[A-Z]{2}$')
     or p_age_min is null
     or p_age_min not between 18 and 65
     or p_age_max is null
     or p_age_max not between 18 and 65
     or p_age_max < p_age_min then
    raise exception 'meta_marketing_ad_set_creation_invalid';
  end if;

  select * into v_request
  from public.meta_marketing_ad_set_creation_requests request
  where request.request_id = p_request_id
    and request.theatre_id = p_theatre_id
    and request.actor_user_id = p_actor_user_id
  limit 1;

  if v_request.id is not null then
    return jsonb_build_object(
      'outcome', v_request.status,
      'request_id', v_request.request_id,
      'provider_ad_set_id', v_request.provider_ad_set_id
    );
  end if;

  select * into v_connection
  from public.meta_marketing_connections connection
  where connection.theatre_id = p_theatre_id
    and connection.status = 'connected'
    and connection.rollout_enabled = true
    and connection.scopes @> array['ads_management']::text[]
    and connection.ad_account_currency = upper(trim(p_expected_currency))
  limit 1;

  if v_connection.id is null then
    raise exception 'meta_marketing_ad_set_creation_unavailable';
  end if;

  if not (
    exists (
      select 1
      from public.meta_marketing_campaign_snapshots snapshot
      where snapshot.connection_id = v_connection.id
        and snapshot.campaign_id = trim(p_provider_campaign_id)
        and snapshot.objective = 'OUTCOME_TRAFFIC'
        and snapshot.configured_status not in ('ARCHIVED', 'DELETED')
    )
    or exists (
      select 1
      from public.meta_marketing_campaign_creation_requests request
      where request.connection_id = v_connection.id
        and request.provider_campaign_id = trim(p_provider_campaign_id)
        and request.objective = 'OUTCOME_TRAFFIC'
        and request.status = 'succeeded'
    )
  ) then
    raise exception 'meta_marketing_ad_set_campaign_unavailable';
  end if;

  insert into public.meta_marketing_ad_set_creation_requests (
    request_id,
    theatre_id,
    connection_id,
    actor_profile_id,
    actor_user_id,
    provider_campaign_id,
    name,
    daily_budget_minor,
    currency,
    start_time,
    end_time,
    countries,
    age_min,
    age_max
  ) values (
    p_request_id,
    p_theatre_id,
    v_connection.id,
    v_profile_id,
    p_actor_user_id,
    trim(p_provider_campaign_id),
    trim(p_name),
    p_daily_budget_minor,
    v_connection.ad_account_currency,
    p_start_time,
    p_end_time,
    v_countries,
    p_age_min,
    p_age_max
  )
  on conflict (request_id) do nothing
  returning * into v_request;

  if v_request.id is null then
    select * into v_request
    from public.meta_marketing_ad_set_creation_requests request
    where request.request_id = p_request_id
      and request.theatre_id = p_theatre_id
      and request.actor_user_id = p_actor_user_id
    limit 1;

    if v_request.id is null then
      raise exception 'meta_marketing_ad_set_creation_request_conflict';
    end if;

    return jsonb_build_object(
      'outcome', v_request.status,
      'request_id', v_request.request_id,
      'provider_ad_set_id', v_request.provider_ad_set_id
    );
  end if;

  return jsonb_build_object(
    'outcome', 'claimed',
    'request_id', v_request.request_id,
    'connection_id', v_connection.id,
    'ad_account_id', v_connection.ad_account_id,
    'currency', v_connection.ad_account_currency,
    'credential_metadata', v_connection.credential_metadata
  );
end;
$$;

create or replace function public.complete_meta_marketing_ad_set_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_provider_ad_set_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_request public.meta_marketing_ad_set_creation_requests%rowtype;
  v_account_id uuid;
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  if nullif(trim(coalesce(p_provider_ad_set_id, '')), '') is null
     or char_length(trim(p_provider_ad_set_id)) > 200 then
    raise exception 'meta_marketing_ad_set_creation_provider_id_invalid';
  end if;

  update public.meta_marketing_ad_set_creation_requests
  set status = 'succeeded',
      provider_ad_set_id = trim(p_provider_ad_set_id),
      error_code = null
  where request_id = p_request_id
    and theatre_id = p_theatre_id
    and actor_user_id = p_actor_user_id
    and status = 'processing'
  returning * into v_request;

  if v_request.id is null then
    return false;
  end if;

  select account_id into v_account_id
  from public.theatres
  where id = p_theatre_id;

  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'marketing.meta_ad_set_created', 'meta_marketing_ad_set', v_request.id,
    jsonb_build_object(
      'connection_id', v_request.connection_id,
      'provider_campaign_id', v_request.provider_campaign_id,
      'provider_ad_set_id', v_request.provider_ad_set_id,
      'objective', v_request.objective,
      'daily_budget_minor', v_request.daily_budget_minor,
      'currency', v_request.currency,
      'start_time', v_request.start_time,
      'end_time', v_request.end_time,
      'countries', v_request.countries,
      'age_min', v_request.age_min,
      'age_max', v_request.age_max,
      'status', 'PAUSED'
    )
  );

  return true;
end;
$$;

create or replace function public.fail_meta_marketing_ad_set_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_request public.meta_marketing_ad_set_creation_requests%rowtype;
  v_account_id uuid;
  v_error_code text;
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );
  v_error_code := nullif(left(trim(coalesce(p_error_code, '')), 120), '');

  if v_error_code is null then
    raise exception 'meta_marketing_ad_set_creation_error_code_invalid';
  end if;

  update public.meta_marketing_ad_set_creation_requests
  set status = 'failed',
      provider_ad_set_id = null,
      error_code = v_error_code
  where request_id = p_request_id
    and theatre_id = p_theatre_id
    and actor_user_id = p_actor_user_id
    and status = 'processing'
  returning * into v_request;

  if v_request.id is null then
    return false;
  end if;

  select account_id into v_account_id
  from public.theatres
  where id = p_theatre_id;

  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'marketing.meta_ad_set_create_failed', 'meta_marketing_ad_set', v_request.id,
    jsonb_build_object(
      'connection_id', v_request.connection_id,
      'provider_campaign_id', v_request.provider_campaign_id,
      'objective', v_request.objective,
      'error_code', v_error_code
    )
  );

  return true;
end;
$$;

revoke all on function public.list_meta_marketing_eligible_traffic_campaigns(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_meta_marketing_ad_set_creation(
  uuid, uuid, uuid, text, text, bigint, text, timestamptz, timestamptz, text[], integer, integer
) from public, anon, authenticated;
revoke all on function public.complete_meta_marketing_ad_set_creation(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_meta_marketing_ad_set_creation(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.list_meta_marketing_eligible_traffic_campaigns(uuid, uuid)
  to service_role;
grant execute on function public.claim_meta_marketing_ad_set_creation(
  uuid, uuid, uuid, text, text, bigint, text, timestamptz, timestamptz, text[], integer, integer
) to service_role;
grant execute on function public.complete_meta_marketing_ad_set_creation(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.fail_meta_marketing_ad_set_creation(uuid, uuid, uuid, text)
  to service_role;

comment on table public.meta_marketing_ad_set_creation_requests is
  'Backend-only idempotency and audit state for supervised paused traffic ad-set creation.';
