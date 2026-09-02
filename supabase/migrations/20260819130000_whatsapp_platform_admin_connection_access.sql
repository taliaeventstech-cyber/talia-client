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
    and profile.status = 'active';

  -- Platform administrators are authorized by auth user ID and do not need a
  -- tenant profile. Keep the nullable profile ID for audit events when one
  -- happens to exist.
  if exists (
    select 1
    from public.platform_admins platform_admin
    where platform_admin.user_id = p_actor_user_id
  ) then
    return v_profile_id;
  end if;

  if v_profile_id is not null and (
    exists (
      select 1
      from public.venue_memberships membership
      where membership.theatre_id = p_theatre_id
        and membership.profile_id = v_profile_id
        and membership.revoked_at is null
        and membership.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.theatres theatre
      join public.account_memberships membership
        on membership.account_id = theatre.account_id
      where theatre.id = p_theatre_id
        and membership.profile_id = v_profile_id
        and membership.revoked_at is null
        and membership.role in ('owner', 'admin')
    )
  ) then
    return v_profile_id;
  end if;

  raise exception 'whatsapp_connection_admin_access_denied';
end;
$$;

revoke all on function public.authorize_whatsapp_connection_admin(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.authorize_whatsapp_connection_admin(uuid, uuid)
  to service_role;
