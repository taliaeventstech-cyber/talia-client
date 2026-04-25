-- Enum: roles de usuario en el dashboard
create type public.user_role as enum ('admin', 'viewer');

-- Enum: roles de mensaje en conversación
create type public.message_role as enum ('user', 'assistant');

-- ─────────────────────────────────────────
-- Tabla: theatres (raíz multi-tenant)
-- ─────────────────────────────────────────
create table public.theatres (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  n8n_webhook_url text,
  n8n_hmac_secret text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.theatres enable row level security;

-- ─────────────────────────────────────────
-- Tabla: users (mapeados a auth.users)
-- ─────────────────────────────────────────
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  email      text not null,
  role       public.user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- ─────────────────────────────────────────
-- Tabla: conversations
-- ─────────────────────────────────────────
create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  theatre_id    uuid not null references public.theatres(id) on delete cascade,
  session_id    text not null unique,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  message_count integer not null default 0,
  metadata      jsonb
);

alter table public.conversations enable row level security;

-- ─────────────────────────────────────────
-- Tabla: messages
-- ─────────────────────────────────────────
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  theatre_id      uuid not null references public.theatres(id) on delete cascade,
  role            public.message_role not null,
  content         text not null,
  created_at      timestamptz not null default now()
);

alter table public.messages enable row level security;

-- ─────────────────────────────────────────
-- Tabla: analytics_daily (precalculados)
-- ─────────────────────────────────────────
create table public.analytics_daily (
  id                            uuid primary key default gen_random_uuid(),
  theatre_id                    uuid not null references public.theatres(id) on delete cascade,
  date                          date not null,
  total_conversations           integer not null default 0,
  total_messages                integer not null default 0,
  avg_messages_per_conversation numeric(10,2) not null default 0,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique(theatre_id, date)
);

alter table public.analytics_daily enable row level security;

-- ─────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────
create index conversations_theatre_id_idx on public.conversations(theatre_id);
create index conversations_started_at_idx on public.conversations(started_at desc);
create index messages_conversation_id_idx on public.messages(conversation_id);
create index messages_theatre_id_idx on public.messages(theatre_id);
create index analytics_daily_theatre_date_idx on public.analytics_daily(theatre_id, date desc);

-- ─────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────

-- theatres: solo admins de ese teatro
create policy "theatre_members_select" on public.theatres
  for select using (
    id in (
      select theatre_id from public.users where id = auth.uid()
    )
  );

-- users: solo ves usuarios de tu teatro
create policy "users_select_own_theatre" on public.users
  for select using (
    theatre_id in (
      select theatre_id from public.users where id = auth.uid()
    )
  );

-- conversations: solo de tu teatro
create policy "conversations_select_own_theatre" on public.conversations
  for select using (
    theatre_id in (
      select theatre_id from public.users where id = auth.uid()
    )
  );

-- messages: solo de tu teatro
create policy "messages_select_own_theatre" on public.messages
  for select using (
    theatre_id in (
      select theatre_id from public.users where id = auth.uid()
    )
  );

-- analytics_daily: solo de tu teatro
create policy "analytics_daily_select_own_theatre" on public.analytics_daily
  for select using (
    theatre_id in (
      select theatre_id from public.users where id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- Trigger: actualizar updated_at automáticamente
-- ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger theatres_updated_at
  before update on public.theatres
  for each row execute function public.set_updated_at();

create trigger analytics_daily_updated_at
  before update on public.analytics_daily
  for each row execute function public.set_updated_at();
