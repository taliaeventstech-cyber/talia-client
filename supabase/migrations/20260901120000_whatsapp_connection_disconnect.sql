create or replace function public.get_whatsapp_connection_disconnect_context(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid
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
  where id = p_connection_id
    and theatre_id = p_theatre_id
    and status = 'connected'
    and rollout_enabled = true
    and credential_source = 'encrypted'
  limit 1;

  if v_connection.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_connection.id,
    'waba_id', v_connection.waba_id,
    'credential_metadata', v_connection.credential_metadata,
    'can_unsubscribe_provider', not exists (
      select 1
      from public.whatsapp_connections other_connection
      where other_connection.waba_id = v_connection.waba_id
        and other_connection.id <> v_connection.id
        and other_connection.status = 'connected'
        and other_connection.rollout_enabled = true
    )
  );
end;
$$;

create or replace function public.disconnect_whatsapp_connection(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
  p_provider_unsubscribed boolean default false,
  p_provider_error_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_connection_id uuid;
  v_account_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  v_profile_id := public.authorize_whatsapp_connection_admin(p_theatre_id, p_actor_user_id);

  update public.whatsapp_connections
  set status = 'disabled',
      rollout_enabled = false,
      credential_metadata = '{}'::jsonb,
      metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
        'disconnected_at', v_now,
        'disconnected_by', 'user',
        'provider_unsubscribed', coalesce(p_provider_unsubscribed, false),
        'provider_unsubscribe_error_code', nullif(left(trim(coalesce(p_provider_error_code, '')), 120), '')
      )),
      updated_at = v_now
  where id = p_connection_id
    and theatre_id = p_theatre_id
    and status = 'connected'
    and rollout_enabled = true
    and credential_source = 'encrypted'
  returning id into v_connection_id;

  if v_connection_id is null then
    return null;
  end if;

  select account_id into v_account_id
  from public.theatres
  where id = p_theatre_id;

  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.connection_disconnected', 'whatsapp_connection', v_connection_id,
    jsonb_strip_nulls(jsonb_build_object(
      'provider_unsubscribed', coalesce(p_provider_unsubscribed, false),
      'provider_error_code', nullif(left(trim(coalesce(p_provider_error_code, '')), 120), '')
    ))
  );

  return v_connection_id;
end;
$$;

revoke all on function public.get_whatsapp_connection_disconnect_context(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.disconnect_whatsapp_connection(uuid, uuid, uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function public.get_whatsapp_connection_disconnect_context(uuid, uuid, uuid)
  to service_role;
grant execute on function public.disconnect_whatsapp_connection(uuid, uuid, uuid, boolean, text)
  to service_role;

comment on function public.get_whatsapp_connection_disconnect_context(uuid, uuid, uuid) is
  'Returns backend-only disconnect data, including encrypted credentials, after tenant-admin authorization.';
comment on function public.disconnect_whatsapp_connection(uuid, uuid, uuid, boolean, text) is
  'Disables an Embedded Signup connection, removes stored credentials, and records the user-initiated disconnect.';
