create table public.meta_marketing_campaign_creation_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null,
  actor_profile_id uuid not null references public.profiles(id),
  actor_user_id uuid not null,
  name text not null,
  objective text not null,
  status text not null default 'processing'
    check (status in ('processing', 'succeeded', 'failed')),
  provider_campaign_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (theatre_id, connection_id)
    references public.meta_marketing_connections(theatre_id, id)
    on delete cascade,
  constraint meta_marketing_campaign_creation_requests_name_check
    check (char_length(trim(name)) between 1 and 200),
  constraint meta_marketing_campaign_creation_requests_objective_check
    check (objective in ('OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS')),
  constraint meta_marketing_campaign_creation_requests_provider_id_check
    check (
      provider_campaign_id is null
      or char_length(trim(provider_campaign_id)) between 1 and 200
    ),
  constraint meta_marketing_campaign_creation_requests_error_code_check
    check (error_code is null or char_length(error_code) between 1 and 120),
  constraint meta_marketing_campaign_creation_requests_result_check
    check (
      (status = 'processing' and provider_campaign_id is null and error_code is null)
      or (status = 'succeeded' and provider_campaign_id is not null and error_code is null)
      or (status = 'failed' and provider_campaign_id is null and error_code is not null)
    )
);

create unique index meta_marketing_campaign_creation_provider_id_idx
  on public.meta_marketing_campaign_creation_requests(connection_id, provider_campaign_id)
  where provider_campaign_id is not null;

create index meta_marketing_campaign_creation_theatre_created_idx
  on public.meta_marketing_campaign_creation_requests(theatre_id, created_at desc);

alter table public.meta_marketing_campaign_creation_requests enable row level security;
revoke all on table public.meta_marketing_campaign_creation_requests
  from public, anon, authenticated;

create trigger meta_marketing_campaign_creation_requests_updated_at
  before update on public.meta_marketing_campaign_creation_requests
  for each row execute function public.set_updated_at();

create or replace function public.claim_meta_marketing_campaign_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_name text,
  p_objective text,
  p_no_special_ad_category_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_connection public.meta_marketing_connections%rowtype;
  v_request public.meta_marketing_campaign_creation_requests%rowtype;
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  if p_request_id is null
     or nullif(trim(coalesce(p_name, '')), '') is null
     or char_length(trim(p_name)) > 200
     or p_objective not in (
       'OUTCOME_TRAFFIC',
       'OUTCOME_ENGAGEMENT',
       'OUTCOME_AWARENESS'
     )
     or p_no_special_ad_category_confirmed is not true then
    raise exception 'meta_marketing_campaign_creation_invalid';
  end if;

  select * into v_request
  from public.meta_marketing_campaign_creation_requests request
  where request.request_id = p_request_id
    and request.theatre_id = p_theatre_id
    and request.actor_user_id = p_actor_user_id
  limit 1;

  if v_request.id is not null then
    return jsonb_build_object(
      'outcome', v_request.status,
      'request_id', v_request.request_id,
      'provider_campaign_id', v_request.provider_campaign_id
    );
  end if;

  select * into v_connection
  from public.meta_marketing_connections connection
  where connection.theatre_id = p_theatre_id
    and connection.status = 'connected'
    and connection.rollout_enabled = true
    and connection.scopes @> array['ads_management']::text[]
  limit 1;

  if v_connection.id is null then
    raise exception 'meta_marketing_campaign_creation_unavailable';
  end if;

  insert into public.meta_marketing_campaign_creation_requests (
    request_id,
    theatre_id,
    connection_id,
    actor_profile_id,
    actor_user_id,
    name,
    objective
  ) values (
    p_request_id,
    p_theatre_id,
    v_connection.id,
    v_profile_id,
    p_actor_user_id,
    trim(p_name),
    p_objective
  )
  on conflict (request_id) do nothing
  returning * into v_request;

  if v_request.id is null then
    select * into v_request
    from public.meta_marketing_campaign_creation_requests request
    where request.request_id = p_request_id
      and request.theatre_id = p_theatre_id
      and request.actor_user_id = p_actor_user_id
    limit 1;

    if v_request.id is null then
      raise exception 'meta_marketing_campaign_creation_request_conflict';
    end if;

    return jsonb_build_object(
      'outcome', v_request.status,
      'request_id', v_request.request_id,
      'provider_campaign_id', v_request.provider_campaign_id
    );
  end if;

  return jsonb_build_object(
    'outcome', 'claimed',
    'request_id', v_request.request_id,
    'connection_id', v_connection.id,
    'ad_account_id', v_connection.ad_account_id,
    'credential_metadata', v_connection.credential_metadata
  );
end;
$$;

create or replace function public.complete_meta_marketing_campaign_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_provider_campaign_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_request public.meta_marketing_campaign_creation_requests%rowtype;
  v_account_id uuid;
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  if nullif(trim(coalesce(p_provider_campaign_id, '')), '') is null
     or char_length(trim(p_provider_campaign_id)) > 200 then
    raise exception 'meta_marketing_campaign_creation_provider_id_invalid';
  end if;

  update public.meta_marketing_campaign_creation_requests
  set status = 'succeeded',
      provider_campaign_id = trim(p_provider_campaign_id),
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
    'marketing.meta_campaign_created', 'meta_marketing_campaign', v_request.id,
    jsonb_build_object(
      'connection_id', v_request.connection_id,
      'provider_campaign_id', v_request.provider_campaign_id,
      'objective', v_request.objective,
      'status', 'PAUSED',
      'special_ad_categories', jsonb_build_array()
    )
  );

  return true;
end;
$$;

create or replace function public.fail_meta_marketing_campaign_creation(
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
  v_request public.meta_marketing_campaign_creation_requests%rowtype;
  v_account_id uuid;
  v_error_code text;
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );
  v_error_code := nullif(left(trim(coalesce(p_error_code, '')), 120), '');

  if v_error_code is null then
    raise exception 'meta_marketing_campaign_creation_error_code_invalid';
  end if;

  update public.meta_marketing_campaign_creation_requests
  set status = 'failed',
      provider_campaign_id = null,
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
    'marketing.meta_campaign_create_failed', 'meta_marketing_campaign', v_request.id,
    jsonb_build_object(
      'connection_id', v_request.connection_id,
      'objective', v_request.objective,
      'error_code', v_error_code
    )
  );

  return true;
end;
$$;

revoke all on function public.claim_meta_marketing_campaign_creation(
  uuid, uuid, uuid, text, text, boolean
) from public, anon, authenticated;
revoke all on function public.complete_meta_marketing_campaign_creation(
  uuid, uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.fail_meta_marketing_campaign_creation(
  uuid, uuid, uuid, text
) from public, anon, authenticated;

grant execute on function public.claim_meta_marketing_campaign_creation(
  uuid, uuid, uuid, text, text, boolean
) to service_role;
grant execute on function public.complete_meta_marketing_campaign_creation(
  uuid, uuid, uuid, text
) to service_role;
grant execute on function public.fail_meta_marketing_campaign_creation(
  uuid, uuid, uuid, text
) to service_role;

comment on table public.meta_marketing_campaign_creation_requests is
  'Backend-only idempotency and audit state for supervised Meta campaign creation.';
comment on function public.claim_meta_marketing_campaign_creation(uuid, uuid, uuid, text, text, boolean) is
  'Claims one campaign creation and returns encrypted provider context only to service_role.';
