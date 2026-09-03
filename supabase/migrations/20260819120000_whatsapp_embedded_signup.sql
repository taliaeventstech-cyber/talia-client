create or replace function public.authorize_whatsapp_connection_admin(
  p_theatre_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  select profile.id
    into v_profile_id
  from public.profiles profile
  where profile.auth_user_id = p_actor_user_id
    and profile.status = 'active'
    and (
      exists (
        select 1
        from public.platform_admins platform_admin
        where platform_admin.user_id = p_actor_user_id
      )
      or exists (
        select 1
        from public.venue_memberships membership
        where membership.theatre_id = p_theatre_id
          and membership.profile_id = profile.id
          and membership.revoked_at is null
          and membership.role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.theatres theatre
        join public.account_memberships membership
          on membership.account_id = theatre.account_id
        where theatre.id = p_theatre_id
          and membership.profile_id = profile.id
          and membership.revoked_at is null
          and membership.role in ('owner', 'admin')
      )
    );

  if v_profile_id is null then
    raise exception 'whatsapp_connection_admin_access_denied';
  end if;

  return v_profile_id;
end;
$$;

create or replace function public.get_whatsapp_connection_summary(
  p_theatre_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.whatsapp_connections%rowtype;
begin
  perform public.authorize_whatsapp_connection_admin(p_theatre_id, p_actor_user_id);

  select *
    into v_connection
  from public.whatsapp_connections
  where theatre_id = p_theatre_id
  order by
    case status when 'connected' then 0 when 'error' then 1 else 2 end,
    updated_at desc
  limit 1;

  if v_connection.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_connection.id,
    'status', v_connection.status,
    'display_phone_number', v_connection.display_phone_number,
    'verified_name', v_connection.verified_name,
    'credential_source', v_connection.credential_source,
    'connected_at', v_connection.metadata ->> 'connected_at',
    'token_expires_at', v_connection.credential_metadata ->> 'expires_at',
    'last_error_code', v_connection.metadata ->> 'last_error_code',
    'updated_at', v_connection.updated_at
  );
end;
$$;

create or replace function public.save_whatsapp_embedded_connection(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_business_id text,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text,
  p_verified_name text,
  p_credential_metadata jsonb,
  p_status text,
  p_error_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_connection_id uuid;
  v_existing_theatre_id uuid;
  v_account_id uuid;
  v_now timestamptz := clock_timestamp();
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  v_profile_id := public.authorize_whatsapp_connection_admin(p_theatre_id, p_actor_user_id);

  if nullif(trim(coalesce(p_business_id, '')), '') is null
     or nullif(trim(coalesce(p_waba_id, '')), '') is null
     or nullif(trim(coalesce(p_phone_number_id, '')), '') is null
     or v_status not in ('draft', 'connected', 'error') then
    raise exception 'whatsapp_embedded_connection_invalid';
  end if;

  if jsonb_typeof(coalesce(p_credential_metadata, '{}'::jsonb) -> 'encrypted_credentials') <> 'object'
     or coalesce(p_credential_metadata, '{}'::jsonb) ? 'access_token'
     or coalesce(p_credential_metadata, '{}'::jsonb) ? 'two_step_pin' then
    raise exception 'whatsapp_embedded_credentials_invalid';
  end if;

  select theatre_id
    into v_existing_theatre_id
  from public.whatsapp_connections
  where waba_id = trim(p_waba_id)
    and phone_number_id = trim(p_phone_number_id)
  limit 1;

  if v_existing_theatre_id is not null and v_existing_theatre_id <> p_theatre_id then
    raise exception 'whatsapp_embedded_connection_owned_elsewhere';
  end if;

  insert into public.whatsapp_connections (
    theatre_id,
    waba_id,
    phone_number_id,
    display_phone_number,
    verified_name,
    status,
    rollout_enabled,
    credential_source,
    credential_metadata,
    metadata
  ) values (
    p_theatre_id,
    trim(p_waba_id),
    trim(p_phone_number_id),
    nullif(trim(coalesce(p_display_phone_number, '')), ''),
    nullif(trim(coalesce(p_verified_name, '')), ''),
    v_status,
    v_status = 'connected',
    'encrypted',
    p_credential_metadata,
    jsonb_strip_nulls(jsonb_build_object(
      'business_id', trim(p_business_id),
      'connection_source', 'meta_embedded_signup_v4',
      'connected_at', case when v_status = 'connected' then v_now else null end,
      'last_error_code', case when v_status = 'error' then left(coalesce(p_error_code, 'unknown'), 120) else null end
    ))
  )
  on conflict (waba_id, phone_number_id) do update
  set display_phone_number = excluded.display_phone_number,
      verified_name = excluded.verified_name,
      status = excluded.status,
      rollout_enabled = excluded.rollout_enabled,
      credential_source = 'encrypted',
      credential_metadata = excluded.credential_metadata,
      metadata = public.whatsapp_connections.metadata || excluded.metadata,
      updated_at = v_now
  where public.whatsapp_connections.theatre_id = p_theatre_id
  returning id into v_connection_id;

  if v_connection_id is null then
    raise exception 'whatsapp_embedded_connection_conflict';
  end if;

  if v_status = 'connected' then
    select account_id into v_account_id from public.theatres where id = p_theatre_id;
    insert into public.audit_events (
      account_id, theatre_id, actor_profile_id, actor_user_id,
      action, target_type, target_id, metadata
    ) values (
      v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
      'whatsapp.embedded_signup_completed', 'whatsapp_connection', v_connection_id,
      jsonb_build_object('credential_source', 'encrypted')
    );
  end if;

  return v_connection_id;
end;
$$;

create or replace function public.get_whatsapp_connection_credentials(
  p_theatre_id uuid,
  p_phone_number_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.whatsapp_connections%rowtype;
begin
  select *
    into v_connection
  from public.whatsapp_connections
  where theatre_id = p_theatre_id
    and phone_number_id = trim(coalesce(p_phone_number_id, ''))
    and status = 'connected'
    and rollout_enabled = true
  limit 1;

  if v_connection.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'credential_source', v_connection.credential_source,
    'credential_metadata', v_connection.credential_metadata
  );
end;
$$;

revoke all on function public.authorize_whatsapp_connection_admin(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_whatsapp_connection_summary(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_whatsapp_embedded_connection(uuid, uuid, text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.get_whatsapp_connection_credentials(uuid, text) from public, anon, authenticated;

grant execute on function public.authorize_whatsapp_connection_admin(uuid, uuid) to service_role;
grant execute on function public.get_whatsapp_connection_summary(uuid, uuid) to service_role;
grant execute on function public.save_whatsapp_embedded_connection(uuid, uuid, text, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function public.get_whatsapp_connection_credentials(uuid, text) to service_role;

comment on function public.get_whatsapp_connection_credentials(uuid, text) is
  'Returns one backend-only WhatsApp credential envelope to service_role callers. Never expose its result to a browser.';
