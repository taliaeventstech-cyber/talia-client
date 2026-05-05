-- Voice agent columns on theatres
alter table public.theatres
  add column if not exists voice_enabled         boolean not null default false,
  add column if not exists voice_phone_number    text,
  add column if not exists voice_id              text,
  add column if not exists voice_language        text not null default 'ca',
  add column if not exists voice_system_prompt   text,
  add column if not exists voice_max_turns       int not null default 10;

-- Voice conversations log
create table if not exists public.voice_conversations (
  id           uuid primary key default gen_random_uuid(),
  theatre_id   uuid not null references public.theatres(id) on delete cascade,
  call_sid     text not null,
  from_number  text,
  duration_sec int,
  turns        int,
  transcript   jsonb,
  topic        text,
  created_at   timestamptz not null default now()
);

alter table public.voice_conversations enable row level security;

drop policy if exists "tenant_select" on public.voice_conversations;

create policy "tenant_select" on public.voice_conversations
  for select using (theatre_id = public.current_theatre_id());

create index if not exists idx_voice_conv_theatre
  on public.voice_conversations(theatre_id, created_at desc);

create index if not exists idx_voice_conv_call_sid
  on public.voice_conversations(call_sid);
