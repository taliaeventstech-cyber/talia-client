create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'support')),
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists "platform_admins_self_select" on public.platform_admins;
create policy "platform_admins_self_select" on public.platform_admins
  for select using (user_id = auth.uid());
