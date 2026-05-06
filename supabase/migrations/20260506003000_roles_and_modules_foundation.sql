alter type public.user_role add value if not exists 'owner';
alter type public.user_role add value if not exists 'operator';
alter type public.user_role add value if not exists 'analyst';

create table if not exists public.tenant_modules (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  module_key text not null check (
    module_key in ('chatbot', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  ),
  status text not null default 'disabled' check (
    status in ('disabled', 'trial', 'active', 'suspended')
  ),
  config jsonb not null default '{}'::jsonb,
  enabled_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(theatre_id, module_key)
);

alter table public.tenant_modules enable row level security;

drop policy if exists "tenant_modules_select_own_theatre" on public.tenant_modules;
create policy "tenant_modules_select_own_theatre" on public.tenant_modules
  for select using (theatre_id = public.current_theatre_id());

create index if not exists tenant_modules_theatre_status_idx
  on public.tenant_modules(theatre_id, status);

drop trigger if exists tenant_modules_updated_at on public.tenant_modules;
create trigger tenant_modules_updated_at
  before update on public.tenant_modules
  for each row execute function public.set_updated_at();

insert into public.tenant_modules (theatre_id, module_key, status, enabled_at)
select id, 'chatbot', 'active', now()
from public.theatres
on conflict (theatre_id, module_key) do nothing;

insert into public.tenant_modules (theatre_id, module_key, status, enabled_at)
select id, 'data', 'active', now()
from public.theatres
on conflict (theatre_id, module_key) do nothing;

insert into public.tenant_modules (theatre_id, module_key, status, enabled_at)
select id, 'voice', case when voice_enabled then 'active' else 'disabled' end, case when voice_enabled then now() else null end
from public.theatres
on conflict (theatre_id, module_key) do nothing;
