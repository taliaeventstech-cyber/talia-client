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
    jsonb_build_object(
      'business_id', trim(p_business_id),
      'connection_source', 'meta_embedded_signup_v4',
      'connected_at', case when v_status = 'connected' then v_now else null end,
      'last_error_code', case when v_status = 'error' then left(coalesce(p_error_code, 'unknown'), 120) else null end
    )
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

revoke all on function public.save_whatsapp_embedded_connection(uuid, uuid, text, text, text, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.save_whatsapp_embedded_connection(uuid, uuid, text, text, text, text, text, jsonb, text, text)
  to service_role;
