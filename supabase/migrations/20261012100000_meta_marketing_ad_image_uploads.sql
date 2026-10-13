alter table public.meta_marketing_ad_creation_requests
  alter column image_url drop not null,
  add column image_sha256 text,
  add column image_mime_type text,
  add column image_size_bytes integer,
  add column provider_image_hash text;

alter table public.meta_marketing_ad_creation_requests
  drop constraint meta_marketing_ad_creation_image_url_check,
  drop constraint meta_marketing_ad_creation_provider_ids_check,
  drop constraint meta_marketing_ad_creation_result_check,
  add constraint meta_marketing_ad_creation_media_check
    check (
      (
        image_url is not null
        and image_url ~ '^https://[^[:space:]]+$'
        and char_length(image_url) <= 2048
        and image_sha256 is null
        and image_mime_type is null
        and image_size_bytes is null
        and provider_image_hash is null
      )
      or (
        image_url is null
        and image_sha256 ~ '^[0-9a-f]{64}$'
        and image_mime_type in ('image/jpeg', 'image/png')
        and image_size_bytes between 1 and 3145728
      )
    ),
  add constraint meta_marketing_ad_creation_provider_ids_check
    check (
      (provider_creative_id is null or provider_creative_id ~ '^[0-9]{1,30}$')
      and (provider_ad_id is null or provider_ad_id ~ '^[0-9]{1,30}$')
      and (provider_image_hash is null or provider_image_hash ~ '^[0-9a-fA-F]{32}$')
    ),
  add constraint meta_marketing_ad_creation_result_check
    check (
      (
        status = 'processing'
        and provider_creative_id is null
        and provider_ad_id is null
        and provider_image_hash is null
        and error_code is null
      )
      or (
        status = 'succeeded'
        and provider_creative_id is not null
        and provider_ad_id is not null
        and error_code is null
        and (
          (image_url is not null and provider_image_hash is null)
          or (image_url is null and provider_image_hash is not null)
        )
      )
      or (
        status = 'failed'
        and provider_creative_id is null
        and provider_ad_id is null
        and provider_image_hash is null
        and error_code is not null
      )
    );

create or replace function public.claim_meta_marketing_ad_upload_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_provider_ad_set_id text,
  p_page_id text,
  p_name text,
  p_primary_text text,
  p_headline text,
  p_destination_url text,
  p_image_sha256 text,
  p_image_mime_type text,
  p_image_size_bytes integer,
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
     or lower(trim(coalesce(p_image_sha256, ''))) !~ '^[0-9a-f]{64}$'
     or lower(trim(coalesce(p_image_mime_type, ''))) not in ('image/jpeg', 'image/png')
     or p_image_size_bytes not between 1 and 3145728
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
    if v_request.image_url is not null
       or v_request.provider_ad_set_id <> trim(p_provider_ad_set_id)
       or v_request.page_id <> trim(p_page_id)
       or v_request.name <> trim(p_name)
       or v_request.primary_text <> trim(p_primary_text)
       or v_request.headline <> trim(p_headline)
       or v_request.destination_url <> trim(p_destination_url)
       or v_request.image_sha256 <> lower(trim(p_image_sha256))
       or v_request.image_mime_type <> lower(trim(p_image_mime_type))
       or v_request.image_size_bytes <> p_image_size_bytes
       or v_request.call_to_action <> upper(trim(p_call_to_action)) then
      raise exception 'meta_marketing_ad_creation_request_conflict';
    end if;

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
    image_sha256,
    image_mime_type,
    image_size_bytes,
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
    null,
    lower(trim(p_image_sha256)),
    lower(trim(p_image_mime_type)),
    p_image_size_bytes,
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

    if v_request.id is null
       or v_request.image_url is not null
       or v_request.provider_ad_set_id <> trim(p_provider_ad_set_id)
       or v_request.page_id <> trim(p_page_id)
       or v_request.name <> trim(p_name)
       or v_request.primary_text <> trim(p_primary_text)
       or v_request.headline <> trim(p_headline)
       or v_request.destination_url <> trim(p_destination_url)
       or v_request.image_sha256 <> lower(trim(p_image_sha256))
       or v_request.image_mime_type <> lower(trim(p_image_mime_type))
       or v_request.image_size_bytes <> p_image_size_bytes
       or v_request.call_to_action <> upper(trim(p_call_to_action)) then
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

create or replace function public.complete_meta_marketing_ad_upload_creation(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_provider_image_hash text,
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

  if trim(coalesce(p_provider_image_hash, '')) !~ '^[0-9a-fA-F]{32}$'
     or trim(coalesce(p_provider_creative_id, '')) !~ '^[0-9]{1,30}$'
     or trim(coalesce(p_provider_ad_id, '')) !~ '^[0-9]{1,30}$' then
    raise exception 'meta_marketing_ad_creation_provider_id_invalid';
  end if;

  update public.meta_marketing_ad_creation_requests
  set status = 'succeeded',
      provider_image_hash = lower(trim(p_provider_image_hash)),
      provider_creative_id = trim(p_provider_creative_id),
      provider_ad_id = trim(p_provider_ad_id),
      error_code = null
  where request_id = p_request_id
    and theatre_id = p_theatre_id
    and actor_user_id = p_actor_user_id
    and image_url is null
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
      'media_source', 'meta_upload',
      'image_mime_type', v_request.image_mime_type,
      'image_size_bytes', v_request.image_size_bytes,
      'status', 'PAUSED'
    )
  );

  return true;
end;
$$;

revoke all on function public.claim_meta_marketing_ad_upload_creation(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, integer, text
) from public, anon, authenticated;
revoke all on function public.complete_meta_marketing_ad_upload_creation(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.claim_meta_marketing_ad_upload_creation(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, integer, text
) to service_role;
grant execute on function public.complete_meta_marketing_ad_upload_creation(
  uuid, uuid, uuid, text, text, text
) to service_role;

comment on function public.claim_meta_marketing_ad_upload_creation(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, integer, text
) is 'Claims an idempotent paused ad creation using image bytes uploaded directly to Meta.';
