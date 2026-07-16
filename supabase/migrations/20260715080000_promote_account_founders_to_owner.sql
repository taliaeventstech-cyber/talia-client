-- Self-service provisioning historically assigned the account creator as admin.
-- Promote the earliest active member only when an account has no owner yet.
with founder_memberships as (
  select id
  from (
    select
      am.id,
      row_number() over (
        partition by am.account_id
        order by am.created_at asc, am.id asc
      ) as membership_rank
    from public.account_memberships am
    where am.revoked_at is null
      and not exists (
        select 1
        from public.account_memberships owner_membership
        where owner_membership.account_id = am.account_id
          and owner_membership.role = 'owner'
          and owner_membership.revoked_at is null
      )
  ) ranked_memberships
  where membership_rank = 1
)
update public.account_memberships am
set role = 'owner',
    updated_at = now()
from founder_memberships founders
where am.id = founders.id;

-- Keep venue membership capabilities aligned with account ownership.
update public.venue_memberships vm
set role = 'owner',
    updated_at = now()
from public.account_memberships am,
     public.theatres t
where am.role = 'owner'
  and am.revoked_at is null
  and t.account_id = am.account_id
  and vm.theatre_id = t.id
  and vm.profile_id = am.profile_id
  and vm.revoked_at is null;

notify pgrst, 'reload schema';
