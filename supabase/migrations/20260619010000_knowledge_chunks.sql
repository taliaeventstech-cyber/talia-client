create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  source_id uuid references public.knowledge_sources(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  language text not null default 'es',
  token_count integer,
  active boolean not null default true,
  embedding_status text not null default 'pending' check (embedding_status in ('pending', 'processing', 'ready', 'error')),
  embedding_model text,
  embedding_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, chunk_index)
);

alter table public.knowledge_chunks enable row level security;

drop policy if exists "knowledge_chunks_select_own_theatre" on public.knowledge_chunks;
create policy "knowledge_chunks_select_own_theatre" on public.knowledge_chunks
  for select using (theatre_id = public.current_theatre_id());

create index if not exists knowledge_chunks_theatre_active_idx
  on public.knowledge_chunks(theatre_id, active, created_at desc);

create index if not exists knowledge_chunks_source_idx
  on public.knowledge_chunks(source_id, chunk_index);

create index if not exists knowledge_chunks_embedding_status_idx
  on public.knowledge_chunks(theatre_id, embedding_status);

drop trigger if exists knowledge_chunks_updated_at on public.knowledge_chunks;
create trigger knowledge_chunks_updated_at
  before update on public.knowledge_chunks
  for each row execute function public.set_updated_at();
