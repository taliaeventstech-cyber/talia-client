alter table public.platform_admins
  add column if not exists permissions jsonb not null default '[]'::jsonb;

alter table public.platform_admins
  add constraint platform_admins_permissions_array
  check (jsonb_typeof(permissions) = 'array') not valid;

alter table public.platform_admins
  validate constraint platform_admins_permissions_array;

comment on column public.platform_admins.permissions is
  'Explicit internal capabilities. manage_customer_billing is reserved for approved founders.';

notify pgrst, 'reload schema';
