create extension if not exists pgcrypto with schema extensions;

create table if not exists public.email_message_suppressions (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  connection_id uuid not null,
  provider_message_id_hash text not null check (provider_message_id_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint email_message_suppressions_tenant_connection_fk
    foreign key (theatre_id, connection_id)
    references public.email_connections(theatre_id, id)
    on delete cascade,
  unique (connection_id, provider_message_id_hash)
);

alter table public.email_message_suppressions enable row level security;

revoke all on table public.email_message_suppressions from public, anon, authenticated;

create index if not exists email_message_suppressions_theatre_created_idx
  on public.email_message_suppressions(theatre_id, created_at desc);

comment on table public.email_message_suppressions is
  'Backend-only SHA-256 markers for provider messages deleted from TALIA. No mailbox content or raw provider message identifiers are retained.';

create or replace function public.delete_email_threads_from_talia(
  p_theatre_id uuid,
  p_thread_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_deleted integer := 0;
begin
  if p_theatre_id is null or coalesce(cardinality(p_thread_ids), 0) = 0 then
    return 0;
  end if;

  insert into public.email_message_suppressions (
    theatre_id,
    connection_id,
    provider_message_id_hash
  )
  select
    message.theatre_id,
    message.connection_id,
    encode(
      extensions.digest(
        convert_to(message.connection_id::text || ':' || message.provider_message_id, 'UTF8'),
        'sha256'
      ),
      'hex'
    )
  from public.email_messages message
  inner join public.email_threads thread
    on thread.theatre_id = message.theatre_id
   and thread.connection_id = message.connection_id
   and thread.id = message.thread_id
  where thread.theatre_id = p_theatre_id
    and thread.id = any(p_thread_ids)
  on conflict (connection_id, provider_message_id_hash) do nothing;

  delete from public.email_threads thread
  where thread.theatre_id = p_theatre_id
    and thread.id = any(p_thread_ids);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_email_threads_from_talia(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.delete_email_threads_from_talia(uuid, uuid[]) to service_role;

comment on function public.delete_email_threads_from_talia(uuid, uuid[]) is
  'Atomically records content-free message suppression hashes and deletes tenant-owned TALIA email threads.';

notify pgrst, 'reload schema';
