create table public.meta_marketing_ad_creation_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null,
  actor_profile_id uuid not null references public.profiles(id),
  actor_user_id uuid not null,
  provider_ad_set_id text not null,
  page_id text not null,
  name text not null,
  primary_text text not null,
  headline text not null,
  destination_url text not null,
  image_url text not null,
  call_to_action text not null,
  status text not null default 'processing'
    check (status in ('processing', 'succeeded', 'failed')),
  provider_creative_id text,
  provider_ad_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (theatre_id, connection_id)
    references public.meta_marketing_connections(theatre_id, id)
    on delete cascade,
  constraint meta_marketing_ad_creation_ad_set_id_check
    check (provider_ad_set_id ~ '^[0-9]{1,30}$'),
  constraint meta_marketing_ad_creation_page_id_check
    check (page_id ~ '^[0-9]{1,30}$'),
  constraint meta_marketing_ad_creation_name_check
    check (char_length(trim(name)) between 1 and 200),
  constraint meta_marketing_ad_creation_primary_text_check
    check (char_length(trim(primary_text)) between 1 and 500),
  constraint meta_marketing_ad_creation_headline_check
    check (char_length(trim(headline)) between 1 and 200),
  constraint meta_marketing_ad_creation_destination_url_check
    check (destination_url ~ '^https://[^[:space:]]+$' and char_length(destination_url) <= 2048),
  constraint meta_marketing_ad_creation_image_url_check
    check (image_url ~ '^https://[^[:space:]]+$' and char_length(image_url) <= 2048),
  constraint meta_marketing_ad_creation_cta_check
    check (call_to_action in ('LEARN_MORE', 'BUY_TICKETS')),
  constraint meta_marketing_ad_creation_provider_ids_check
    check (
      (provider_creative_id is null or provider_creative_id ~ '^[0-9]{1,30}$')
      and (provider_ad_id is null or provider_ad_id ~ '^[0-9]{1,30}$')
    ),
  constraint meta_marketing_ad_creation_error_code_check
    check (error_code is null or char_length(error_code) between 1 and 120),
  constraint meta_marketing_ad_creation_result_check
    check (
      (status = 'processing' and provider_creative_id is null and provider_ad_id is null and error_code is null)
      or (status = 'succeeded' and provider_creative_id is not null and provider_ad_id is not null and error_code is null)
      or (status = 'failed' and provider_creative_id is null and provider_ad_id is null and error_code is not null)
    )
);

create unique index meta_marketing_ad_creation_provider_ad_id_idx
  on public.meta_marketing_ad_creation_requests(connection_id, provider_ad_id)
  where provider_ad_id is not null;

create index meta_marketing_ad_creation_theatre_created_idx
  on public.meta_marketing_ad_creation_requests(theatre_id, created_at desc);

alter table public.meta_marketing_ad_creation_requests enable row level security;
revoke all on table public.meta_marketing_ad_creation_requests
  from public, anon, authenticated;

create trigger meta_marketing_ad_creation_requests_updated_at
  before update on public.meta_marketing_ad_creation_requests
  for each row execute function public.set_updated_at();

create or replace function public.list_meta_marketing_eligible_traffic_ad_sets(
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
      'ad_set_id', request.provider_ad_set_id,
      'campaign_id', request.provider_campaign_id,
      'name', request.name,
      'status', 'PAUSED'
    ) order by request.created_at desc)
    from public.meta_marketing_ad_set_creation_requests request
    where request.connection_id = v_connection_id
      and request.status = 'succeeded'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.claim_meta_marketing_ad_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_provider_ad_set_id text,
  p_page_id text,
  p_name text,
  p_primary_text text,
  p_headline text,
  p_destination_url text,
  p_image_url text,
  p_call_to_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_connection public.meta_marketing_connections%rowtype;
  v_request public.meta_marketing_ad_creation_requests%rowtype;
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  if p_request_id is null
     or trim(coalesce(p_provider_ad_set_id, '')) !~ '^[0-9]{1,30}$'
     or trim(coalesce(p_page_id, '')) !~ '^[0-9]{1,30}$'
     or char_length(trim(coalesce(p_name, ''))) not between 1 and 200
     or char_length(trim(coalesce(p_primary_text, ''))) not between 1 and 500
     or char_length(trim(coalesce(p_headline, ''))) not between 1 and 200
     or trim(coalesce(p_destination_url, '')) !~ '^https://[^[:space:]]+$'
     or char_length(trim(p_destination_url)) > 2048
     or trim(coalesce(p_image_url, '')) !~ '^https://[^[:space:]]+$'
     or char_length(trim(p_image_url)) > 2048
     or upper(trim(coalesce(p_call_to_action, ''))) not in ('LEARN_MORE', 'BUY_TICKETS') then
    raise exception 'meta_marketing_ad_creation_invalid';
  end if;

  select * into v_request
  from public.meta_marketing_ad_creation_requests request
  where request.request_id = p_request_id
    and request.theatre_id = p_theatre_id
    and request.actor_user_id = p_actor_user_id
  limit 1;

  if v_request.id is not null then
    return jsonb_build_object(
      'outcome', v_request.status,
      'request_id', v_request.request_id,
      'provider_creative_id', v_request.provider_creative_id,
      'provider_ad_id', v_request.provider_ad_id
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
    raise exception 'meta_marketing_ad_creation_unavailable';
  end if;

  if not exists (
    select 1
    from public.meta_marketing_ad_set_creation_requests request
    where request.connection_id = v_connection.id
      and request.provider_ad_set_id = trim(p_provider_ad_set_id)
      and request.objective = 'OUTCOME_TRAFFIC'
      and request.status = 'succeeded'
  ) then
    raise exception 'meta_marketing_ad_set_unavailable';
  end if;

  insert into public.meta_marketing_ad_creation_requests (
    request_id,
    theatre_id,
    connection_id,
    actor_profile_id,
    actor_user_id,
    provider_ad_set_id,
    page_id,
    name,
    primary_text,
    headline,
    destination_url,
    image_url,
    call_to_action
  ) values (
    p_request_id,
    p_theatre_id,
    v_connection.id,
    v_profile_id,
    p_actor_user_id,
    trim(p_provider_ad_set_id),
    trim(p_page_id),
    trim(p_name),
    trim(p_primary_text),
    trim(p_headline),
    trim(p_destination_url),
    trim(p_image_url),
    upper(trim(p_call_to_action))
  )
  on conflict (request_id) do nothing
  returning * into v_request;

  if v_request.id is null then
    select * into v_request
    from public.meta_marketing_ad_creation_requests request
    where request.request_id = p_request_id
      and request.theatre_id = p_theatre_id
      and request.actor_user_id = p_actor_user_id
    limit 1;

    if v_request.id is null then
      raise exception 'meta_marketing_ad_creation_request_conflict';
    end if;

    return jsonb_build_object(
      'outcome', v_request.status,
      'request_id', v_request.request_id,
      'provider_creative_id', v_request.provider_creative_id,
      'provider_ad_id', v_request.provider_ad_id
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

create or replace function public.complete_meta_marketing_ad_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_provider_creative_id text,
  p_provider_ad_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_request public.meta_marketing_ad_creation_requests%rowtype;
  v_account_id uuid;
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );

  if trim(coalesce(p_provider_creative_id, '')) !~ '^[0-9]{1,30}$'
     or trim(coalesce(p_provider_ad_id, '')) !~ '^[0-9]{1,30}$' then
    raise exception 'meta_marketing_ad_creation_provider_id_invalid';
  end if;

  update public.meta_marketing_ad_creation_requests
  set status = 'succeeded',
      provider_creative_id = trim(p_provider_creative_id),
      provider_ad_id = trim(p_provider_ad_id),
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
    'marketing.meta_ad_created', 'meta_marketing_ad', v_request.id,
    jsonb_build_object(
      'connection_id', v_request.connection_id,
      'provider_ad_set_id', v_request.provider_ad_set_id,
      'provider_creative_id', v_request.provider_creative_id,
      'provider_ad_id', v_request.provider_ad_id,
      'page_id', v_request.page_id,
      'call_to_action', v_request.call_to_action,
      'destination_host', split_part(v_request.destination_url, '/', 3),
      'status', 'PAUSED'
    )
  );

  return true;
end;
$$;

create or replace function public.fail_meta_marketing_ad_creation(
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
  v_request public.meta_marketing_ad_creation_requests%rowtype;
  v_account_id uuid;
  v_error_code text;
begin
  v_profile_id := public.authorize_meta_marketing_connection_admin(
    p_theatre_id,
    p_actor_user_id
  );
  v_error_code := nullif(left(trim(coalesce(p_error_code, '')), 120), '');

  if v_error_code is null then
    raise exception 'meta_marketing_ad_creation_error_code_invalid';
  end if;

  update public.meta_marketing_ad_creation_requests
  set status = 'failed',
      provider_creative_id = null,
      provider_ad_id = null,
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
    'marketing.meta_ad_create_failed', 'meta_marketing_ad', v_request.id,
    jsonb_build_object(
      'connection_id', v_request.connection_id,
      'provider_ad_set_id', v_request.provider_ad_set_id,
      'page_id', v_request.page_id,
      'call_to_action', v_request.call_to_action,
      'error_code', v_error_code
    )
  );

  return true;
end;
$$;

revoke all on function public.list_meta_marketing_eligible_traffic_ad_sets(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_meta_marketing_ad_creation(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.complete_meta_marketing_ad_creation(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_meta_marketing_ad_creation(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.list_meta_marketing_eligible_traffic_ad_sets(uuid, uuid)
  to service_role;
grant execute on function public.claim_meta_marketing_ad_creation(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.complete_meta_marketing_ad_creation(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.fail_meta_marketing_ad_creation(uuid, uuid, uuid, text)
  to service_role;

comment on table public.meta_marketing_ad_creation_requests is
  'Backend-only idempotency and audit state for supervised paused traffic image-ad creation.';
