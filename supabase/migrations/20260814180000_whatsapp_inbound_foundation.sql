create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null,
  display_phone_number text,
  verified_name text,
  status text not null default 'draft'
    check (status in ('draft', 'connected', 'error', 'revoked', 'disabled')),
  rollout_enabled boolean not null default false,
  credential_source text not null default 'environment'
    check (credential_source in ('environment', 'encrypted')),
  credential_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (waba_id, phone_number_id),
  unique (theatre_id, id),
  constraint whatsapp_connections_waba_id_check
    check (char_length(trim(waba_id)) between 1 and 200),
  constraint whatsapp_connections_phone_number_id_check
    check (char_length(trim(phone_number_id)) between 1 and 200)
);

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null,
  connection_id uuid not null,
  wa_id text not null,
  profile_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, wa_id),
  unique (theatre_id, connection_id, id),
  constraint whatsapp_contacts_connection_fk
    foreign key (theatre_id, connection_id)
    references public.whatsapp_connections(theatre_id, id)
    on delete cascade,
  constraint whatsapp_contacts_wa_id_check
    check (char_length(trim(wa_id)) between 1 and 100)
);

create table public.whatsapp_conversations (
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
  constraint whatsapp_conversations_contact_fk
    foreign key (theatre_id, connection_id, contact_id)
    references public.whatsapp_contacts(theatre_id, connection_id, id)
    on delete cascade
);

create unique index whatsapp_conversations_one_active_contact_idx
  on public.whatsapp_conversations(connection_id, contact_id)
  where status in ('open', 'pending', 'handoff');

create table public.whatsapp_messages (
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
    check (delivery_status is null or delivery_status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_message_id),
  unique (theatre_id, connection_id, id),
  constraint whatsapp_messages_conversation_fk
    foreign key (theatre_id, connection_id, conversation_id)
    references public.whatsapp_conversations(theatre_id, connection_id, id)
    on delete cascade,
  constraint whatsapp_messages_contact_fk
    foreign key (theatre_id, connection_id, contact_id)
    references public.whatsapp_contacts(theatre_id, connection_id, id)
    on delete cascade,
  constraint whatsapp_messages_provider_message_id_check
    check (char_length(trim(provider_message_id)) between 1 and 300),
  constraint whatsapp_messages_body_text_check
    check (body_text is null or char_length(body_text) <= 16000)
);

create table public.whatsapp_inbound_jobs (
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
  constraint whatsapp_inbound_jobs_message_fk
    foreign key (theatre_id, connection_id, message_id)
    references public.whatsapp_messages(theatre_id, connection_id, id)
    on delete cascade
);

create index whatsapp_connections_theatre_status_idx
  on public.whatsapp_connections(theatre_id, status, rollout_enabled);
create index whatsapp_contacts_theatre_last_seen_idx
  on public.whatsapp_contacts(theatre_id, last_seen_at desc);
create index whatsapp_conversations_theatre_last_message_idx
  on public.whatsapp_conversations(theatre_id, last_message_at desc);
create index whatsapp_messages_conversation_created_idx
  on public.whatsapp_messages(conversation_id, created_at);
create index whatsapp_inbound_jobs_claim_idx
  on public.whatsapp_inbound_jobs(status, available_at, created_at)
  where status in ('pending', 'retry', 'processing');

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_inbound_jobs enable row level security;

revoke all on table public.whatsapp_connections from public, anon, authenticated;
revoke all on table public.whatsapp_contacts from public, anon, authenticated;
revoke all on table public.whatsapp_conversations from public, anon, authenticated;
revoke all on table public.whatsapp_messages from public, anon, authenticated;
revoke all on table public.whatsapp_inbound_jobs from public, anon, authenticated;

create trigger whatsapp_connections_updated_at
  before update on public.whatsapp_connections
  for each row execute function public.set_updated_at();
create trigger whatsapp_contacts_updated_at
  before update on public.whatsapp_contacts
  for each row execute function public.set_updated_at();
create trigger whatsapp_conversations_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at();
create trigger whatsapp_messages_updated_at
  before update on public.whatsapp_messages
  for each row execute function public.set_updated_at();
create trigger whatsapp_inbound_jobs_updated_at
  before update on public.whatsapp_inbound_jobs
  for each row execute function public.set_updated_at();

create or replace function public.ingest_whatsapp_message(
  p_waba_id text,
  p_phone_number_id text,
  p_provider_message_id text,
  p_sender_wa_id text,
  p_profile_name text,
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
  v_connection public.whatsapp_connections%rowtype;
  v_contact_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_job_id uuid;
  v_module_enabled boolean;
  v_received_at timestamptz := coalesce(p_provider_timestamp, clock_timestamp());
begin
  if nullif(trim(coalesce(p_waba_id, '')), '') is null
     or nullif(trim(coalesce(p_phone_number_id, '')), '') is null
     or nullif(trim(coalesce(p_provider_message_id, '')), '') is null
     or nullif(trim(coalesce(p_sender_wa_id, '')), '') is null
     or nullif(trim(coalesce(p_message_type, '')), '') is null then
    raise exception 'invalid_whatsapp_message';
  end if;

  select *
    into v_connection
    from public.whatsapp_connections
   where waba_id = trim(p_waba_id)
     and phone_number_id = trim(p_phone_number_id)
     and status = 'connected'
   limit 1;

  if v_connection.id is null then
    return query select 'unmatched'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_connection.id::text || ':' || trim(p_sender_wa_id), 0)
  );

  select id
    into v_message_id
    from public.whatsapp_messages
   where connection_id = v_connection.id
     and provider_message_id = trim(p_provider_message_id);

  if v_message_id is not null then
    return query select 'duplicate'::text, v_message_id, null::uuid, v_connection.theatre_id;
    return;
  end if;

  insert into public.whatsapp_contacts (
    theatre_id,
    connection_id,
    wa_id,
    profile_name,
    last_seen_at
  ) values (
    v_connection.theatre_id,
    v_connection.id,
    trim(p_sender_wa_id),
    nullif(left(trim(coalesce(p_profile_name, '')), 300), ''),
    v_received_at
  )
  on conflict (connection_id, wa_id) do update
    set profile_name = coalesce(excluded.profile_name, public.whatsapp_contacts.profile_name),
        last_seen_at = greatest(public.whatsapp_contacts.last_seen_at, excluded.last_seen_at)
  returning id into v_contact_id;

  select id
    into v_conversation_id
    from public.whatsapp_conversations
   where connection_id = v_connection.id
     and contact_id = v_contact_id
     and status in ('open', 'pending', 'handoff')
   order by created_at desc
   limit 1
   for update;

  if v_conversation_id is null then
    insert into public.whatsapp_conversations (
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

  insert into public.whatsapp_messages (
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
    nullif(left(coalesce(p_body_text, ''), 16000), ''),
    p_provider_timestamp,
    nullif(left(trim(coalesce(p_context_provider_message_id, '')), 300), ''),
    'received',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (connection_id, provider_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select id into v_message_id
      from public.whatsapp_messages
     where connection_id = v_connection.id
       and provider_message_id = trim(p_provider_message_id);

    return query select 'duplicate'::text, v_message_id, null::uuid, v_connection.theatre_id;
    return;
  end if;

  update public.whatsapp_conversations
     set last_message_at = greatest(coalesce(last_message_at, v_received_at), v_received_at)
   where id = v_conversation_id;

  select v_connection.rollout_enabled
     and exists (
       select 1
         from public.tenant_modules module
        where module.theatre_id = v_connection.theatre_id
          and module.module_key = 'whatsapp'
          and module.status in ('active', 'trial')
     )
     and exists (
       select 1
         from public.tenant_module_entitlements entitlement
        where entitlement.theatre_id = v_connection.theatre_id
          and entitlement.module_key = 'whatsapp'
          and entitlement.enabled
     )
    into v_module_enabled;

  if not coalesce(v_module_enabled, false) then
    update public.whatsapp_messages
       set processing_status = 'ignored'
     where id = v_message_id;

    return query select 'disabled'::text, v_message_id, null::uuid, v_connection.theatre_id;
    return;
  end if;

  if not p_processable then
    update public.whatsapp_messages
       set processing_status = 'handoff'
     where id = v_message_id;
    update public.whatsapp_conversations
       set status = 'handoff'
     where id = v_conversation_id;

    return query select 'handoff'::text, v_message_id, null::uuid, v_connection.theatre_id;
    return;
  end if;

  update public.whatsapp_messages
     set processing_status = 'queued'
   where id = v_message_id;
  update public.whatsapp_conversations
     set status = 'pending'
   where id = v_conversation_id;

  insert into public.whatsapp_inbound_jobs (
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

create or replace function public.claim_whatsapp_inbound_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 120
)
returns table(
  job_id uuid,
  message_id uuid,
  theatre_id uuid,
  connection_id uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_id text := trim(coalesce(p_worker_id, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 120), 900));
begin
  if v_worker_id = '' or char_length(v_worker_id) > 200 then
    raise exception 'invalid_whatsapp_worker';
  end if;

  return query
  with candidates as (
    select job.id
      from public.whatsapp_inbound_jobs job
     where (
       job.status in ('pending', 'retry')
       and job.available_at <= clock_timestamp()
     ) or (
       job.status = 'processing'
       and job.lease_expires_at <= clock_timestamp()
     )
     order by job.available_at, job.created_at
     limit v_limit
     for update skip locked
  ), claimed as (
    update public.whatsapp_inbound_jobs job
       set status = 'processing',
           worker_id = v_worker_id,
           lease_expires_at = clock_timestamp() + make_interval(secs => v_lease_seconds),
           attempt_count = job.attempt_count + 1,
           error_code = null,
           error_message = null
      from candidates
     where job.id = candidates.id
    returning job.id, job.message_id, job.theatre_id, job.connection_id, job.attempt_count
  )
  select claimed.id, claimed.message_id, claimed.theatre_id, claimed.connection_id, claimed.attempt_count
    from claimed;
end;
$$;

create or replace function public.finish_whatsapp_inbound_job(
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_delay_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_count integer;
begin
  if p_status not in ('completed', 'retry', 'failed') then
    raise exception 'invalid_whatsapp_job_status';
  end if;

  update public.whatsapp_inbound_jobs
     set status = p_status,
         completed_at = case when p_status in ('completed', 'failed') then clock_timestamp() else null end,
         available_at = case
           when p_status = 'retry'
             then clock_timestamp() + make_interval(secs => greatest(10, least(coalesce(p_retry_delay_seconds, 60), 3600)))
           else available_at
         end,
         lease_expires_at = null,
         worker_id = null,
         error_code = nullif(left(trim(coalesce(p_error_code, '')), 100), ''),
         error_message = nullif(left(trim(coalesce(p_error_message, '')), 500), '')
   where id = p_job_id
     and status = 'processing'
     and worker_id = trim(p_worker_id);

  get diagnostics v_updated_count = row_count;
  return v_updated_count > 0;
end;
$$;

revoke all on function public.ingest_whatsapp_message(text, text, text, text, text, text, text, timestamptz, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.claim_whatsapp_inbound_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_inbound_job(uuid, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.ingest_whatsapp_message(text, text, text, text, text, text, text, timestamptz, text, boolean, jsonb) to service_role;
grant execute on function public.claim_whatsapp_inbound_jobs(text, integer, integer) to service_role;
grant execute on function public.finish_whatsapp_inbound_job(uuid, text, text, text, text, integer) to service_role;

alter function public.apply_data_retention(boolean)
  rename to apply_data_retention_before_whatsapp;
revoke all on function public.apply_data_retention_before_whatsapp(boolean) from public, anon, authenticated;

create function public.apply_data_retention(p_dry_run boolean default true)
returns table(category text, cutoff timestamptz, affected_rows bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_whatsapp_cutoff timestamptz := clock_timestamp() - interval '90 days';
  v_count bigint;
begin
  return query
    select * from public.apply_data_retention_before_whatsapp(p_dry_run);

  if p_dry_run then
    select count(*) into v_count
      from public.whatsapp_messages
     where coalesce(provider_timestamp, created_at) < v_whatsapp_cutoff;
  else
    with deleted as (
      delete from public.whatsapp_messages
       where coalesce(provider_timestamp, created_at) < v_whatsapp_cutoff
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'whatsapp_messages';
  cutoff := v_whatsapp_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
      from public.whatsapp_conversations conversation
     where coalesce(conversation.last_message_at, conversation.created_at) < v_whatsapp_cutoff
       and not exists (
         select 1 from public.whatsapp_messages message
          where message.conversation_id = conversation.id
            and coalesce(message.provider_timestamp, message.created_at) >= v_whatsapp_cutoff
       );
  else
    with deleted as (
      delete from public.whatsapp_conversations conversation
       where coalesce(conversation.last_message_at, conversation.created_at) < v_whatsapp_cutoff
         and not exists (
           select 1 from public.whatsapp_messages message
            where message.conversation_id = conversation.id
         )
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'whatsapp_conversations';
  cutoff := v_whatsapp_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
      from public.whatsapp_contacts contact
     where contact.last_seen_at < v_whatsapp_cutoff
       and not exists (
         select 1 from public.whatsapp_messages message
          where message.contact_id = contact.id
            and coalesce(message.provider_timestamp, message.created_at) >= v_whatsapp_cutoff
       );
  else
    with deleted as (
      delete from public.whatsapp_contacts contact
       where contact.last_seen_at < v_whatsapp_cutoff
         and not exists (
           select 1 from public.whatsapp_messages message
            where message.contact_id = contact.id
         )
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'whatsapp_contacts';
  cutoff := v_whatsapp_cutoff;
  affected_rows := v_count;
  return next;
end;
$$;

revoke all on function public.apply_data_retention(boolean) from public, anon, authenticated;
grant execute on function public.apply_data_retention(boolean) to service_role;

comment on table public.whatsapp_connections is
  'Backend-only mapping from a Meta WABA phone number to one TALIA venue. credential_metadata must never expose plaintext provider tokens.';
comment on table public.whatsapp_messages is
  'Backend-only WhatsApp content with tenant-safe composite relationships and 90-day retention.';
comment on function public.ingest_whatsapp_message(text, text, text, text, text, text, text, timestamptz, text, boolean, jsonb) is
  'Atomically resolves the WhatsApp venue, deduplicates one provider message, and enqueues eligible text messages.';
comment on function public.apply_data_retention(boolean) is
  'Applies TALIA retention policy, including 90-day WhatsApp content and channel-local identities.';

notify pgrst, 'reload schema';
