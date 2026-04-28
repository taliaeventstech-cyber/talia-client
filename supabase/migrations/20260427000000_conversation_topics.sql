create or replace function public.current_theatre_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select theatre_id from public.users where id = auth.uid();
$$;

create table if not exists public.conversation_topics (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid references public.theatres(id) on delete cascade,
  session_id text,
  topic text,
  user_message text,
  created_at timestamptz default now()
);

alter table public.conversation_topics
  add column if not exists theatre_id uuid references public.theatres(id) on delete cascade,
  add column if not exists session_id text,
  add column if not exists topic text,
  add column if not exists user_message text,
  add column if not exists created_at timestamptz default now();

alter table public.conversation_topics enable row level security;

drop policy if exists "tenant_select" on public.conversation_topics;

create policy "tenant_select" on public.conversation_topics
  for select using (theatre_id = public.current_theatre_id());

create index if not exists conversation_topics_theatre_topic_idx
  on public.conversation_topics(theatre_id, topic);

create index if not exists conversation_topics_created_at_idx
  on public.conversation_topics(created_at desc);
