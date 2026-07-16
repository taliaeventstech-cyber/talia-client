-- Account and venue memberships are the only source of client workspace access.
-- public.users remains temporarily available for legacy data inspection, but it
-- no longer grants access through RLS.
create or replace function public.current_theatre_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select theatre_id
  from public.venue_memberships
  where profile_id = public.current_profile_id()
    and revoked_at is null
  union
  select id
  from public.theatres
  where account_id in (select public.current_account_ids());
$$;

comment on function public.current_theatre_ids() is
  'Returns venues granted by active account or venue membership. Legacy public.users rows do not grant access.';

notify pgrst, 'reload schema';
