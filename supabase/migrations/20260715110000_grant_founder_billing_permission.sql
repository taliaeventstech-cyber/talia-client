-- Founder access is derived from existing Supabase Auth identities. Passwords
-- are never provisioned or stored in database migrations.
insert into public.platform_admins (user_id, role, permissions)
select
  auth_user.id,
  'owner',
  '["manage_customer_billing"]'::jsonb
from auth.users auth_user
where lower(auth_user.email) in (
  'ricardo@talia.events',
  'andrea@talia.events',
  'albert@talia.events'
)
on conflict (user_id) do update
set role = 'owner',
    permissions = case
      when public.platform_admins.permissions ? 'manage_customer_billing'
        then public.platform_admins.permissions
      else public.platform_admins.permissions || '["manage_customer_billing"]'::jsonb
    end;

notify pgrst, 'reload schema';
