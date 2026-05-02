create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  type text not null default 'manual' check (type in ('manual', 'csv', 'xlsx', 'google_sheet', 'url')),
  name text not null,
  status text not null default 'ready' check (status in ('pending', 'processing', 'connected', 'ready', 'error')),
  config jsonb not null default '{}'::jsonb,
  source_url text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_sources enable row level security;

create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  source_id uuid references public.knowledge_sources(id) on delete set null,
  question text not null,
  answer text not null,
  category text,
  language text not null default 'es',
  priority integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_items enable row level security;

drop policy if exists "knowledge_sources_select_own_theatre" on public.knowledge_sources;
create policy "knowledge_sources_select_own_theatre" on public.knowledge_sources
  for select using (theatre_id = public.current_theatre_id());

drop policy if exists "knowledge_items_select_own_theatre" on public.knowledge_items;
create policy "knowledge_items_select_own_theatre" on public.knowledge_items
  for select using (theatre_id = public.current_theatre_id());

create index if not exists knowledge_sources_theatre_status_idx
  on public.knowledge_sources(theatre_id, status);

create index if not exists knowledge_items_theatre_active_idx
  on public.knowledge_items(theatre_id, active, priority desc);

create index if not exists knowledge_items_theatre_category_idx
  on public.knowledge_items(theatre_id, category);

drop trigger if exists knowledge_sources_updated_at on public.knowledge_sources;
create trigger knowledge_sources_updated_at
  before update on public.knowledge_sources
  for each row execute function public.set_updated_at();

drop trigger if exists knowledge_items_updated_at on public.knowledge_items;
create trigger knowledge_items_updated_at
  before update on public.knowledge_items
  for each row execute function public.set_updated_at();
