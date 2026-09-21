create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  instagram_user_id text not null,
  username text not null,
  account_type text not null check (account_type in ('business', 'creator')),
  status text not null default 'connected'
    check (status in ('connected', 'error', 'revoked', 'disabled')),
  rollout_enabled boolean not null default false,
  scopes text[] not null default '{}'::text[],
  credential_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (theatre_id),
  unique (instagram_user_id),
  unique (theatre_id, id),
  constraint instagram_connections_user_id_check
    check (char_length(trim(instagram_user_id)) between 1 and 200),
  constraint instagram_connections_username_check
    check (char_length(trim(username)) between 1 and 200),
  constraint instagram_connections_required_scopes_check
    check (
      scopes @> array['instagram_business_basic', 'instagram_business_manage_messages']::text[]
      and cardinality(scopes) = 2
    )
);

create index instagram_connections_theatre_status_idx
  on public.instagram_connections(theatre_id, status, rollout_enabled);

alter table public.instagram_connections enable row level security;
revoke all on table public.instagram_connections from public, anon, authenticated;

create trigger instagram_connections_updated_at
  before update on public.instagram_connections
  for each row execute function public.set_updated_at();

create or replace function public.authorize_instagram_connection_admin(
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
    raise exception 'instagram_connection_admin_access_denied';
  end if;

  return v_profile_id;
end;
$$;

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
      rollout_enabled = false,
      scopes = excluded.scopes,
      credential_metadata = excluded.credential_metadata,
      metadata = public.instagram_connections.metadata || excluded.metadata,
      updated_at = v_now
  returning id into v_connection_id;

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
      'connection_source', 'instagram_login'
    )
  );

  return v_connection_id;
end;
$$;

create or replace function public.get_instagram_connection_summary(
  p_theatre_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.instagram_connections%rowtype;
begin
  perform public.authorize_instagram_connection_admin(p_theatre_id, p_actor_user_id);

  select *
    into v_connection
  from public.instagram_connections
  where theatre_id = p_theatre_id
  limit 1;

  if v_connection.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_connection.id,
    'status', v_connection.status,
    'username', v_connection.username,
    'account_type', v_connection.account_type,
    'rollout_enabled', v_connection.rollout_enabled,
    'connected_at', v_connection.metadata ->> 'connected_at',
    'token_expires_at', v_connection.credential_metadata ->> 'expires_at',
    'updated_at', v_connection.updated_at
  );
end;
$$;

create or replace function public.get_instagram_connection_credentials(
  p_theatre_id uuid,
  p_instagram_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.instagram_connections%rowtype;
begin
  select *
    into v_connection
  from public.instagram_connections
  where theatre_id = p_theatre_id
    and instagram_user_id = trim(coalesce(p_instagram_user_id, ''))
    and status = 'connected'
    and rollout_enabled = true
  limit 1;

  if v_connection.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'credential_metadata', v_connection.credential_metadata
  );
end;
$$;

create or replace function public.disconnect_instagram_connection(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid,
  p_provider_revoked boolean default false,
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
  v_profile_id := public.authorize_instagram_connection_admin(p_theatre_id, p_actor_user_id);

  update public.instagram_connections
  set status = 'disabled',
      rollout_enabled = false,
      credential_metadata = '{}'::jsonb,
      metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
        'disconnected_at', v_now,
        'disconnected_by', 'user',
        'provider_revoked', coalesce(p_provider_revoked, false),
        'provider_revoke_error_code', nullif(left(trim(coalesce(p_provider_error_code, '')), 120), '')
      )),
      updated_at = v_now
  where id = p_connection_id
    and theatre_id = p_theatre_id
    and status = 'connected'
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
    'instagram.connection_disconnected', 'instagram_connection', v_connection_id,
    jsonb_strip_nulls(jsonb_build_object(
      'provider_revoked', coalesce(p_provider_revoked, false),
      'provider_error_code', nullif(left(trim(coalesce(p_provider_error_code, '')), 120), '')
    ))
  );

  return v_connection_id;
end;
$$;

revoke all on function public.authorize_instagram_connection_admin(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.save_instagram_connection(uuid, uuid, text, text, text, text[], jsonb)
  from public, anon, authenticated;
revoke all on function public.get_instagram_connection_summary(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_instagram_connection_credentials(uuid, text)
  from public, anon, authenticated;
revoke all on function public.disconnect_instagram_connection(uuid, uuid, uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function public.authorize_instagram_connection_admin(uuid, uuid)
  to service_role;
grant execute on function public.save_instagram_connection(uuid, uuid, text, text, text, text[], jsonb)
  to service_role;
grant execute on function public.get_instagram_connection_summary(uuid, uuid)
  to service_role;
grant execute on function public.get_instagram_connection_credentials(uuid, text)
  to service_role;
grant execute on function public.disconnect_instagram_connection(uuid, uuid, uuid, boolean, text)
  to service_role;

comment on table public.instagram_connections is
  'Backend-only venue mapping and encrypted credentials for independent Instagram Agent connections.';
comment on function public.get_instagram_connection_credentials(uuid, text) is
  'Returns one backend-only Instagram credential envelope to service_role callers after rollout activation.';
