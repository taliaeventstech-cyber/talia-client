create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  billing_email text,
  plan text not null default 'essential' check (plan in ('essential', 'professional', 'enterprise', 'custom')),
  status text not null default 'active' check (status in ('prospect', 'trialing', 'active', 'paused', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

alter table public.theatres
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;

insert into public.accounts (name, slug, billing_email, plan, status)
select
  t.name,
  t.slug,
  t.fallback_email,
  case
    when lower(t.plan) in ('professional', 'profesional') then 'professional'
    when lower(t.plan) in ('enterprise', 'empresa') then 'enterprise'
    when lower(t.plan) = 'custom' then 'custom'
    else 'essential'
  end,
  'active'
from public.theatres t
where t.account_id is null
on conflict (slug) do nothing;

update public.theatres t
set account_id = a.id
from public.accounts a
where t.account_id is null
  and a.slug = t.slug;

alter table public.theatres
  alter column account_id set not null;

create index if not exists theatres_account_idx
  on public.theatres(account_id, created_at desc);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = lower(email))
);

alter table public.profiles enable row level security;

create table if not exists public.account_memberships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'billing', 'viewer')),
  permissions jsonb not null default '[]'::jsonb,
  invited_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, profile_id)
);

alter table public.account_memberships enable row level security;

create table if not exists public.venue_memberships (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'viewer',
  permissions jsonb not null default '[]'::jsonb,
  invited_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(theatre_id, profile_id)
);

alter table public.venue_memberships enable row level security;

create table if not exists public.account_membership_permissions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.account_memberships(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  unique(membership_id, permission_key)
);

alter table public.account_membership_permissions enable row level security;

create table if not exists public.venue_membership_permissions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.venue_memberships(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  unique(membership_id, permission_key)
);

alter table public.venue_membership_permissions enable row level security;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete set null,
  theatre_id uuid references public.theatres(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

alter table public.signup_invites
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists permissions jsonb not null default '[]'::jsonb;

update public.signup_invites si
set account_id = t.account_id
from public.theatres t
where si.account_id is null
  and si.theatre_id = t.id;

alter table public.signup_invites
  alter column account_id set not null;

create index if not exists signup_invites_account_idx
  on public.signup_invites(account_id, created_at desc);

create index if not exists profiles_auth_user_idx
  on public.profiles(auth_user_id);

create index if not exists profiles_email_idx
  on public.profiles(email);

create index if not exists account_memberships_account_idx
  on public.account_memberships(account_id, role)
  where revoked_at is null;

create index if not exists account_memberships_profile_idx
  on public.account_memberships(profile_id)
  where revoked_at is null;

create index if not exists venue_memberships_theatre_idx
  on public.venue_memberships(theatre_id, role)
  where revoked_at is null;

create index if not exists venue_memberships_profile_idx
  on public.venue_memberships(profile_id)
  where revoked_at is null;

create index if not exists audit_events_account_created_idx
  on public.audit_events(account_id, created_at desc);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select account_id
  from public.account_memberships
  where profile_id = public.current_profile_id()
    and revoked_at is null;
$$;

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
  select theatre_id
  from public.users
  where id = auth.uid();
$$;

create or replace function public.current_theatre_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select public.current_theatre_ids() limit 1;
$$;

drop trigger if exists accounts_updated_at on public.accounts;
create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists account_memberships_updated_at on public.account_memberships;
create trigger account_memberships_updated_at
  before update on public.account_memberships
  for each row execute function public.set_updated_at();

drop trigger if exists venue_memberships_updated_at on public.venue_memberships;
create trigger venue_memberships_updated_at
  before update on public.venue_memberships
  for each row execute function public.set_updated_at();

drop policy if exists "accounts_select_member" on public.accounts;
create policy "accounts_select_member" on public.accounts
  for select using (id in (select public.current_account_ids()));

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select using (auth_user_id = auth.uid());

drop policy if exists "account_memberships_select_member" on public.account_memberships;
create policy "account_memberships_select_member" on public.account_memberships
  for select using (account_id in (select public.current_account_ids()));

drop policy if exists "venue_memberships_select_member" on public.venue_memberships;
create policy "venue_memberships_select_member" on public.venue_memberships
  for select using (
    theatre_id in (select public.current_theatre_ids())
    or exists (
      select 1
      from public.theatres t
      where t.id = venue_memberships.theatre_id
        and t.account_id in (select public.current_account_ids())
    )
  );

drop policy if exists "account_membership_permissions_select_member" on public.account_membership_permissions;
create policy "account_membership_permissions_select_member" on public.account_membership_permissions
  for select using (
    exists (
      select 1
      from public.account_memberships am
      where am.id = account_membership_permissions.membership_id
        and am.account_id in (select public.current_account_ids())
    )
  );

drop policy if exists "venue_membership_permissions_select_member" on public.venue_membership_permissions;
create policy "venue_membership_permissions_select_member" on public.venue_membership_permissions
  for select using (
    exists (
      select 1
      from public.venue_memberships vm
      where vm.id = venue_membership_permissions.membership_id
        and vm.theatre_id in (select public.current_theatre_ids())
    )
  );

drop policy if exists "audit_events_select_account_member" on public.audit_events;
create policy "audit_events_select_account_member" on public.audit_events
  for select using (account_id in (select public.current_account_ids()));

insert into public.profiles (auth_user_id, email, status)
select u.id, lower(coalesce(u.email, tu.email)), 'active'
from auth.users u
join public.users tu on tu.id = u.id
where coalesce(u.email, tu.email) is not null
on conflict (auth_user_id) do update
set email = excluded.email,
    updated_at = now();

insert into public.account_memberships (account_id, profile_id, role)
select distinct
  t.account_id,
  p.id,
  case when tu.role in ('owner', 'admin') then 'admin' else 'viewer' end
from public.users tu
join public.theatres t on t.id = tu.theatre_id
join public.profiles p on p.auth_user_id = tu.id
on conflict (account_id, profile_id) do nothing;

insert into public.venue_memberships (theatre_id, profile_id, role)
select tu.theatre_id, p.id, tu.role
from public.users tu
join public.profiles p on p.auth_user_id = tu.id
on conflict (theatre_id, profile_id) do nothing;

notify pgrst, 'reload schema';
