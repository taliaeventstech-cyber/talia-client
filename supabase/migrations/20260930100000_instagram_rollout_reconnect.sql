with latest_rollout as (
  select distinct on (audit.target_id)
    audit.target_id,
    audit.action
  from public.audit_events audit
  where audit.target_type = 'instagram_connection'
    and audit.action in ('instagram.rollout_enabled', 'instagram.rollout_disabled')
  order by audit.target_id, audit.created_at desc, audit.id desc
)
update public.instagram_connections connection
set metadata = connection.metadata || jsonb_build_object('rollout_approved', true),
    rollout_enabled = connection.status = 'connected',
    updated_at = clock_timestamp()
from latest_rollout
where latest_rollout.target_id = connection.id
  and latest_rollout.action = 'instagram.rollout_enabled';

create or replace function public.save_instagram_connection(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_instagram_user_id text,
  p_username text,
  p_account_type text,
  p_scopes text[],
  p_credential_metadata jsonb
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
  v_rollout_enabled boolean;
  v_now timestamptz := clock_timestamp();
  v_account_type text := lower(trim(coalesce(p_account_type, '')));
begin
  v_profile_id := public.authorize_instagram_connection_admin(p_theatre_id, p_actor_user_id);

  if nullif(trim(coalesce(p_instagram_user_id, '')), '') is null
     or nullif(trim(coalesce(p_username, '')), '') is null
     or v_account_type not in ('business', 'creator')
     or not (
       coalesce(p_scopes, '{}'::text[]) @> array[
         'instagram_business_basic',
         'instagram_business_manage_messages'
       ]::text[]
     )
     or cardinality(coalesce(p_scopes, '{}'::text[])) <> 2 then
    raise exception 'instagram_connection_invalid';
  end if;

  if jsonb_typeof(coalesce(p_credential_metadata, '{}'::jsonb) -> 'encrypted_credentials') <> 'object'
     or coalesce(p_credential_metadata, '{}'::jsonb) ? 'access_token'
     or coalesce(p_credential_metadata, '{}'::jsonb) ? 'accessToken'
     or coalesce(p_credential_metadata, '{}'::jsonb) -> 'encrypted_credentials' ->> 'alg' <> 'aes-256-gcm'
     or nullif(coalesce(p_credential_metadata, '{}'::jsonb) -> 'encrypted_credentials' ->> 'iv', '') is null
     or nullif(coalesce(p_credential_metadata, '{}'::jsonb) -> 'encrypted_credentials' ->> 'tag', '') is null
     or nullif(coalesce(p_credential_metadata, '{}'::jsonb) -> 'encrypted_credentials' ->> 'ciphertext', '') is null then
    raise exception 'instagram_connection_credentials_invalid';
  end if;

  select theatre_id
    into v_existing_theatre_id
  from public.instagram_connections
  where instagram_user_id = trim(p_instagram_user_id)
  limit 1;

  if v_existing_theatre_id is not null and v_existing_theatre_id <> p_theatre_id then
    raise exception 'instagram_connection_owned_elsewhere';
  end if;

  insert into public.instagram_connections (
    theatre_id,
    instagram_user_id,
    username,
    account_type,
    status,
    rollout_enabled,
    scopes,
    credential_metadata,
    metadata
  ) values (
    p_theatre_id,
    trim(p_instagram_user_id),
    left(trim(p_username), 200),
    v_account_type,
    'connected',
    false,
    p_scopes,
    p_credential_metadata,
    jsonb_build_object(
      'connection_source', 'instagram_login',
      'connected_at', v_now
    )
  )
  on conflict (theatre_id) do update
  set instagram_user_id = excluded.instagram_user_id,
      username = excluded.username,
      account_type = excluded.account_type,
      status = 'connected',
      rollout_enabled = (
        public.instagram_connections.instagram_user_id = excluded.instagram_user_id
        and public.instagram_connections.metadata -> 'rollout_approved' = 'true'::jsonb
      ),
      scopes = excluded.scopes,
      credential_metadata = excluded.credential_metadata,
      metadata = (
        case
          when public.instagram_connections.instagram_user_id = excluded.instagram_user_id
            then public.instagram_connections.metadata
          else public.instagram_connections.metadata - 'rollout_approved'
        end
      ) || excluded.metadata,
      updated_at = v_now
  returning id, rollout_enabled into v_connection_id, v_rollout_enabled;

  select account_id into v_account_id
  from public.theatres
  where id = p_theatre_id;

  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'instagram.connection_connected', 'instagram_connection', v_connection_id,
    jsonb_build_object(
      'account_type', v_account_type,
      'connection_source', 'instagram_login',
      'rollout_enabled', v_rollout_enabled,
      'rollout_restored', v_rollout_enabled
    )
  );

  return v_connection_id;
end;
$$;

comment on function public.save_instagram_connection(uuid, uuid, text, text, text, text[], jsonb) is
  'Persists a direct Instagram Login connection. New accounts fail closed; reconnecting the same approved pilot account restores its rollout.';
