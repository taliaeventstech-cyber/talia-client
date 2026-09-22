create table public.instagram_contacts (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null,
  connection_id uuid not null,
  instagram_scoped_user_id text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, instagram_scoped_user_id),
  unique (theatre_id, connection_id, id),
  constraint instagram_contacts_connection_fk
    foreign key (theatre_id, connection_id)
    references public.instagram_connections(theatre_id, id)
    on delete cascade,
  constraint instagram_contacts_scoped_user_id_check
    check (char_length(trim(instagram_scoped_user_id)) between 1 and 200)
);

create table public.instagram_conversations (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null,
  connection_id uuid not null,
  contact_id uuid not null,
  status text not null default 'open'
    check (status in ('open', 'pending', 'handoff', 'resolved', 'blocked')),
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (theatre_id, connection_id, id),
  constraint instagram_conversations_contact_fk
    foreign key (theatre_id, connection_id, contact_id)
    references public.instagram_contacts(theatre_id, connection_id, id)
    on delete cascade
);

create unique index instagram_conversations_one_active_contact_idx
  on public.instagram_conversations(connection_id, contact_id)
  where status in ('open', 'pending', 'handoff');

create table public.instagram_messages (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null,
  connection_id uuid not null,
  conversation_id uuid not null,
  contact_id uuid not null,
  provider_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null,
  body_text text,
  provider_timestamp timestamptz,
  context_provider_message_id text,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'queued', 'processing', 'responded', 'handoff', 'ignored', 'failed')),
  delivery_status text
    check (delivery_status is null or delivery_status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_message_id),
  unique (theatre_id, connection_id, id),
  constraint instagram_messages_conversation_fk
    foreign key (theatre_id, connection_id, conversation_id)
    references public.instagram_conversations(theatre_id, connection_id, id)
    on delete cascade,
  constraint instagram_messages_contact_fk
    foreign key (theatre_id, connection_id, contact_id)
    references public.instagram_contacts(theatre_id, connection_id, id)
    on delete cascade,
  constraint instagram_messages_provider_message_id_check
    check (char_length(trim(provider_message_id)) between 1 and 1000),
  constraint instagram_messages_type_check
    check (char_length(trim(message_type)) between 1 and 100),
  constraint instagram_messages_body_text_check
    check (body_text is null or char_length(body_text) <= 16000)
);

create table public.instagram_inbound_jobs (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null,
  connection_id uuid not null,
  message_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  worker_id text,
  error_code text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id),
  constraint instagram_inbound_jobs_message_fk
    foreign key (theatre_id, connection_id, message_id)
    references public.instagram_messages(theatre_id, connection_id, id)
    on delete cascade
);

create index instagram_contacts_theatre_last_seen_idx
  on public.instagram_contacts(theatre_id, last_seen_at desc);
create index instagram_conversations_theatre_last_message_idx
  on public.instagram_conversations(theatre_id, last_message_at desc);
create index instagram_messages_conversation_created_idx
  on public.instagram_messages(conversation_id, created_at);
create index instagram_inbound_jobs_claim_idx
  on public.instagram_inbound_jobs(status, available_at, created_at)
  where status in ('pending', 'retry', 'processing');

alter table public.instagram_contacts enable row level security;
alter table public.instagram_conversations enable row level security;
alter table public.instagram_messages enable row level security;
alter table public.instagram_inbound_jobs enable row level security;

revoke all on table public.instagram_contacts from public, anon, authenticated;
revoke all on table public.instagram_conversations from public, anon, authenticated;
revoke all on table public.instagram_messages from public, anon, authenticated;
revoke all on table public.instagram_inbound_jobs from public, anon, authenticated;

create trigger instagram_contacts_updated_at
  before update on public.instagram_contacts
  for each row execute function public.set_updated_at();
create trigger instagram_conversations_updated_at
  before update on public.instagram_conversations
  for each row execute function public.set_updated_at();
create trigger instagram_messages_updated_at
  before update on public.instagram_messages
  for each row execute function public.set_updated_at();
create trigger instagram_inbound_jobs_updated_at
  before update on public.instagram_inbound_jobs
  for each row execute function public.set_updated_at();

create or replace function public.ingest_instagram_message(
  p_instagram_user_id text,
  p_sender_igsid text,
  p_provider_message_id text,
  p_message_type text,
  p_body_text text,
  p_provider_timestamp timestamptz,
  p_context_provider_message_id text default null,
  p_processable boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  outcome text,
  inbound_message_id uuid,
  inbound_job_id uuid,
  resolved_theatre_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.instagram_connections%rowtype;
  v_contact_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_job_id uuid;
  v_channel_enabled boolean;
  v_received_at timestamptz := coalesce(p_provider_timestamp, clock_timestamp());
begin
  if nullif(trim(coalesce(p_instagram_user_id, '')), '') is null
     or nullif(trim(coalesce(p_sender_igsid, '')), '') is null
     or nullif(trim(coalesce(p_provider_message_id, '')), '') is null
     or nullif(trim(coalesce(p_message_type, '')), '') is null
     or char_length(trim(p_instagram_user_id)) > 200
     or char_length(trim(p_sender_igsid)) > 200
     or char_length(trim(p_provider_message_id)) > 1000 then
    raise exception 'invalid_instagram_message';
  end if;

  select *
    into v_connection
    from public.instagram_connections
   where instagram_user_id = trim(p_instagram_user_id)
   limit 1;

  if v_connection.id is null then
    return query select 'unmatched'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  select v_connection.status = 'connected'
     and v_connection.rollout_enabled
     and exists (
       select 1
         from public.tenant_modules module
        where module.theatre_id = v_connection.theatre_id
          and module.module_key = 'instagram'
          and module.status in ('active', 'trial')
     )
     and exists (
       select 1
         from public.tenant_module_entitlements entitlement
        where entitlement.theatre_id = v_connection.theatre_id
          and entitlement.module_key = 'instagram'
          and entitlement.enabled
     )
    into v_channel_enabled;

  if not coalesce(v_channel_enabled, false) then
    return query select 'disabled'::text, null::uuid, null::uuid, v_connection.theatre_id;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_connection.id::text || ':' || trim(p_sender_igsid), 0)
  );

  select id
    into v_message_id
    from public.instagram_messages
   where connection_id = v_connection.id
     and provider_message_id = trim(p_provider_message_id);

  if v_message_id is not null then
    return query select 'duplicate'::text, v_message_id, null::uuid, v_connection.theatre_id;
    return;
  end if;

  insert into public.instagram_contacts (
    theatre_id,
    connection_id,
    instagram_scoped_user_id,
    last_seen_at
  ) values (
    v_connection.theatre_id,
    v_connection.id,
    trim(p_sender_igsid),
    v_received_at
  )
  on conflict (connection_id, instagram_scoped_user_id) do update
    set last_seen_at = greatest(public.instagram_contacts.last_seen_at, excluded.last_seen_at)
  returning id into v_contact_id;

  select id
    into v_conversation_id
    from public.instagram_conversations
   where connection_id = v_connection.id
     and contact_id = v_contact_id
     and status in ('open', 'pending', 'handoff')
   order by created_at desc
   limit 1
   for update;

  if v_conversation_id is null then
    insert into public.instagram_conversations (
      theatre_id,
      connection_id,
      contact_id,
      status,
      last_message_at
    ) values (
      v_connection.theatre_id,
      v_connection.id,
      v_contact_id,
      'open',
      v_received_at
    )
    returning id into v_conversation_id;
  end if;

  insert into public.instagram_messages (
    theatre_id,
    connection_id,
    conversation_id,
    contact_id,
    provider_message_id,
    direction,
    message_type,
    body_text,
    provider_timestamp,
    context_provider_message_id,
    processing_status,
    metadata
  ) values (
    v_connection.theatre_id,
    v_connection.id,
    v_conversation_id,
    v_contact_id,
    trim(p_provider_message_id),
    'inbound',
    left(trim(p_message_type), 100),
    case when p_processable then nullif(left(trim(coalesce(p_body_text, '')), 16000), '') else null end,
    p_provider_timestamp,
    nullif(left(trim(coalesce(p_context_provider_message_id, '')), 1000), ''),
    'received',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (connection_id, provider_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select id into v_message_id
      from public.instagram_messages
     where connection_id = v_connection.id
       and provider_message_id = trim(p_provider_message_id);

    return query select 'duplicate'::text, v_message_id, null::uuid, v_connection.theatre_id;
    return;
  end if;

  update public.instagram_conversations
     set last_message_at = greatest(coalesce(last_message_at, v_received_at), v_received_at)
   where id = v_conversation_id;

  if not p_processable or nullif(trim(coalesce(p_body_text, '')), '') is null then
    update public.instagram_messages
       set processing_status = 'handoff'
     where id = v_message_id;
    update public.instagram_conversations
       set status = 'handoff'
     where id = v_conversation_id;

    return query select 'handoff'::text, v_message_id, null::uuid, v_connection.theatre_id;
    return;
  end if;

  update public.instagram_messages
     set processing_status = 'queued'
   where id = v_message_id;
  update public.instagram_conversations
     set status = 'pending'
   where id = v_conversation_id;

  insert into public.instagram_inbound_jobs (
    theatre_id,
    connection_id,
    message_id
  ) values (
    v_connection.theatre_id,
    v_connection.id,
    v_message_id
  )
  returning id into v_job_id;

  return query select 'accepted'::text, v_message_id, v_job_id, v_connection.theatre_id;
end;
$$;

revoke all on function public.ingest_instagram_message(
  text, text, text, text, text, timestamptz, text, boolean, jsonb
) from public, anon, authenticated;

grant execute on function public.ingest_instagram_message(
  text, text, text, text, text, timestamptz, text, boolean, jsonb
) to service_role;

comment on table public.instagram_contacts is
  'Backend-only channel-local Instagram identities; never matched to another Attention channel.';
comment on table public.instagram_conversations is
  'Backend-only Instagram conversations isolated from WhatsApp and every other Attention channel.';
comment on table public.instagram_messages is
  'Minimal durable Instagram message records without raw Meta webhook envelopes.';
comment on table public.instagram_inbound_jobs is
  'Independent durable queue for the Instagram agent.';
comment on function public.ingest_instagram_message(
  text, text, text, text, text, timestamptz, text, boolean, jsonb
) is
  'Atomically resolves an active Instagram connection, deduplicates an inbound DM and queues or hands it off.';
