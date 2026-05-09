create table if not exists public.email_connections (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google', 'microsoft', 'imap', 'forwarding')),
  mailbox_email text not null,
  status text not null default 'draft' check (status in ('draft', 'connected', 'syncing', 'error', 'revoked', 'disabled')),
  sync_mode text not null default 'polling' check (sync_mode in ('polling', 'webhook', 'manual')),
  draft_mode text not null default 'provider_drafts' check (draft_mode in ('provider_drafts', 'agora_review', 'disabled')),
  oauth_metadata jsonb not null default '{}'::jsonb,
  sync_cursor text,
  last_synced_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(theatre_id, mailbox_email)
);

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null references public.email_connections(id) on delete cascade,
  provider_thread_id text not null,
  subject text,
  sender_email text,
  sender_name text,
  status text not null default 'new' check (
    status in ('new', 'drafted', 'waiting_human', 'sent', 'resolved', 'escalated', 'ignored')
  ),
  topic text not null default 'otro',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  last_message_at timestamptz,
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id, provider_thread_id)
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null references public.email_connections(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  provider_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text,
  from_name text,
  to_emails jsonb not null default '[]'::jsonb,
  cc_emails jsonb not null default '[]'::jsonb,
  body_text text,
  body_html text,
  received_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(connection_id, provider_message_id)
);

create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null references public.email_connections(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  provider_draft_id text,
  status text not null default 'generated' check (
    status in ('generated', 'created_in_provider', 'edited_by_human', 'approved', 'sent', 'discarded', 'error')
  ),
  generated_subject text,
  generated_body_text text,
  generated_body_html text,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_connections enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_drafts enable row level security;

drop policy if exists "email_connections_select_own_theatre" on public.email_connections;
create policy "email_connections_select_own_theatre" on public.email_connections
  for select using (theatre_id in (select public.current_theatre_ids()));

drop policy if exists "email_threads_select_own_theatre" on public.email_threads;
create policy "email_threads_select_own_theatre" on public.email_threads
  for select using (theatre_id in (select public.current_theatre_ids()));

drop policy if exists "email_messages_select_own_theatre" on public.email_messages;
create policy "email_messages_select_own_theatre" on public.email_messages
  for select using (theatre_id in (select public.current_theatre_ids()));

drop policy if exists "email_drafts_select_own_theatre" on public.email_drafts;
create policy "email_drafts_select_own_theatre" on public.email_drafts
  for select using (theatre_id in (select public.current_theatre_ids()));

create index if not exists email_connections_theatre_status_idx
  on public.email_connections(theatre_id, status);

create index if not exists email_threads_theatre_status_idx
  on public.email_threads(theatre_id, status, last_message_at desc);

create index if not exists email_threads_connection_provider_idx
  on public.email_threads(connection_id, provider_thread_id);

create index if not exists email_messages_thread_created_idx
  on public.email_messages(thread_id, created_at);

create index if not exists email_drafts_thread_status_idx
  on public.email_drafts(thread_id, status, updated_at desc);

drop trigger if exists email_connections_updated_at on public.email_connections;
create trigger email_connections_updated_at
  before update on public.email_connections
  for each row execute function public.set_updated_at();

drop trigger if exists email_threads_updated_at on public.email_threads;
create trigger email_threads_updated_at
  before update on public.email_threads
  for each row execute function public.set_updated_at();

drop trigger if exists email_drafts_updated_at on public.email_drafts;
create trigger email_drafts_updated_at
  before update on public.email_drafts
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
