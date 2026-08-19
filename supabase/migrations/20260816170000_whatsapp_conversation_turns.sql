create or replace function public.schedule_whatsapp_conversation_turn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_first_job_at timestamptz;
  v_available_at timestamptz;
begin
  select message.conversation_id
    into v_conversation_id
    from public.whatsapp_messages message
   where message.id = new.message_id;

  select min(job.created_at)
    into v_first_job_at
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where message.conversation_id = v_conversation_id
     and job.status in ('pending', 'retry', 'processing');

  v_available_at := least(
    coalesce(v_first_job_at, clock_timestamp()) + interval '8 seconds',
    clock_timestamp() + interval '2500 milliseconds'
  );

  update public.whatsapp_inbound_jobs job
     set available_at = v_available_at
    from public.whatsapp_messages message
   where message.id = job.message_id
     and message.conversation_id = v_conversation_id
     and job.status in ('pending', 'retry');

  return new;
end;
$$;

drop trigger if exists whatsapp_inbound_jobs_schedule_turn on public.whatsapp_inbound_jobs;
create trigger whatsapp_inbound_jobs_schedule_turn
  after insert on public.whatsapp_inbound_jobs
  for each row execute function public.schedule_whatsapp_conversation_turn();

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
  with eligible as (
    select
      job.id,
      message.conversation_id,
      job.available_at,
      job.created_at,
      row_number() over (
        partition by message.conversation_id
        order by coalesce(message.provider_timestamp, message.created_at) desc, message.created_at desc, message.id desc
      ) as conversation_rank,
      min(job.available_at) over (partition by message.conversation_id) as conversation_available_at,
      min(job.created_at) over (partition by message.conversation_id) as conversation_created_at
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where (
      job.status in ('pending', 'retry')
      and job.available_at <= clock_timestamp()
    ) or (
      job.status = 'processing'
      and job.lease_expires_at <= clock_timestamp()
    )
  ), candidate_ids as (
    select eligible.id
      from eligible
     where eligible.conversation_rank = 1
       and not exists (
         select 1
           from public.whatsapp_inbound_jobs active_job
           join public.whatsapp_messages active_message on active_message.id = active_job.message_id
          where active_message.conversation_id = eligible.conversation_id
            and active_job.status = 'processing'
            and active_job.lease_expires_at > clock_timestamp()
       )
     order by eligible.conversation_available_at, eligible.conversation_created_at
     limit v_limit
  ), locked as (
    select job.id
      from public.whatsapp_inbound_jobs job
      join candidate_ids candidate on candidate.id = job.id
     for update of job skip locked
  ), claimed as (
    update public.whatsapp_inbound_jobs job
       set status = 'processing',
           worker_id = v_worker_id,
           lease_expires_at = clock_timestamp() + make_interval(secs => v_lease_seconds),
           attempt_count = job.attempt_count + 1,
           error_code = null,
           error_message = null
      from locked
     where job.id = locked.id
    returning job.id, job.message_id, job.theatre_id, job.connection_id, job.attempt_count
  )
  select claimed.id, claimed.message_id, claimed.theatre_id, claimed.connection_id, claimed.attempt_count
    from claimed;
end;
$$;

create or replace function public.get_whatsapp_inbound_job_context(
  p_job_id uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.whatsapp_inbound_jobs%rowtype;
  v_anchor public.whatsapp_messages%rowtype;
  v_latest public.whatsapp_messages%rowtype;
  v_connection public.whatsapp_connections%rowtype;
  v_theatre public.theatres%rowtype;
  v_contact public.whatsapp_contacts%rowtype;
  v_conversation public.whatsapp_conversations%rowtype;
  v_job_ids uuid[];
  v_message_ids uuid[];
  v_combined_message text;
  v_turn_attempt_count integer;
begin
  select * into v_job
    from public.whatsapp_inbound_jobs
   where id = p_job_id
     and status = 'processing'
     and worker_id = trim(p_worker_id)
   for update;
  if v_job.id is null then return null; end if;

  select * into v_anchor from public.whatsapp_messages where id = v_job.message_id;
  if v_anchor.id is null or v_anchor.direction <> 'inbound' then return null; end if;

  update public.whatsapp_inbound_jobs sibling
     set status = 'processing',
         worker_id = trim(p_worker_id),
         lease_expires_at = v_job.lease_expires_at,
         attempt_count = sibling.attempt_count + 1,
         error_code = null,
         error_message = null
    from public.whatsapp_messages sibling_message
   where sibling_message.id = sibling.message_id
     and sibling_message.conversation_id = v_anchor.conversation_id
     and sibling.id <> v_job.id
     and (
       (
         sibling.status in ('pending', 'retry')
         and sibling.available_at <= clock_timestamp()
       ) or (
         sibling.status = 'processing'
         and sibling.lease_expires_at <= clock_timestamp()
       )
     );

  select
    array_agg(job.id order by coalesce(message.provider_timestamp, message.created_at), message.created_at, message.id),
    array_agg(message.id order by coalesce(message.provider_timestamp, message.created_at), message.created_at, message.id),
    left(string_agg(
      message.body_text,
      E'\n' order by coalesce(message.provider_timestamp, message.created_at), message.created_at, message.id
    ), 10000),
    max(job.attempt_count)
    into v_job_ids, v_message_ids, v_combined_message, v_turn_attempt_count
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  if coalesce(array_length(v_job_ids, 1), 0) = 0 then return null; end if;

  select * into v_latest
    from public.whatsapp_messages
   where id = v_message_ids[array_length(v_message_ids, 1)];
  select * into v_connection from public.whatsapp_connections where id = v_anchor.connection_id;
  select * into v_theatre from public.theatres where id = v_anchor.theatre_id;
  select * into v_contact from public.whatsapp_contacts where id = v_anchor.contact_id;
  select * into v_conversation from public.whatsapp_conversations where id = v_anchor.conversation_id;

  if v_connection.status <> 'connected' or not v_connection.rollout_enabled then return null; end if;

  return jsonb_build_object(
    'job', jsonb_build_object(
      'id', v_job.id,
      'attempt_count', v_turn_attempt_count
    ),
    'turn', jsonb_build_object(
      'job_ids', to_jsonb(v_job_ids),
      'message_ids', to_jsonb(v_message_ids),
      'message_count', array_length(v_message_ids, 1),
      'ai_disclosure_required', not (v_conversation.metadata ? 'ai_disclosure_sent_at')
    ),
    'connection', jsonb_build_object(
      'id', v_connection.id,
      'phone_number_id', v_connection.phone_number_id,
      'status', v_connection.status,
      'rollout_enabled', v_connection.rollout_enabled,
      'metadata', v_connection.metadata
    ),
    'tenant', jsonb_build_object(
      'id', v_theatre.id,
      'name', v_theatre.name,
      'fallback_language', v_theatre.primary_language,
      'fallback_email', v_theatre.fallback_email,
      'fallback_phone', v_theatre.fallback_phone
    ),
    'contact', jsonb_build_object(
      'id', v_contact.id,
      'wa_id', v_contact.wa_id
    ),
    'conversation', jsonb_build_object(
      'id', v_conversation.id,
      'status', v_conversation.status,
      'metadata', v_conversation.metadata
    ),
    'message', jsonb_build_object(
      'id', v_latest.id,
      'provider_message_id', v_latest.provider_message_id,
      'body_text', v_combined_message,
      'created_at', v_latest.created_at
    ),
    'conversation_context', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'role', case when history.direction = 'inbound' then 'user' else 'assistant' end,
          'content', history.body_text
        ) order by history.created_at, history.id
      )
      from (
        select previous.id, previous.direction, previous.body_text, previous.created_at
          from public.whatsapp_messages previous
         where previous.conversation_id = v_conversation.id
           and not (previous.id = any(v_message_ids))
           and previous.body_text is not null
           and previous.processing_status not in ('received', 'queued', 'processing', 'ignored', 'failed')
         order by previous.created_at desc, previous.id desc
         limit 6
      ) history
    ), '[]'::jsonb),
    'outbound', (
      select jsonb_build_object(
        'id', outbound.id,
        'body_text', outbound.body_text,
        'provider_message_id', outbound.provider_message_id,
        'delivery_status', outbound.delivery_status,
        'metadata', outbound.metadata
      )
        from public.whatsapp_messages outbound
       where outbound.connection_id = v_connection.id
         and outbound.direction = 'outbound'
         and outbound.metadata ->> 'agent_reply_to_message_id' = v_latest.id::text
       limit 1
    )
  );
end;
$$;

create or replace function public.defer_whatsapp_conversation_turn(
  p_job_id uuid,
  p_worker_id text,
  p_reason text default 'newer_inbound_message'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor public.whatsapp_messages%rowtype;
  v_first_job_at timestamptz;
  v_available_at timestamptz;
begin
  select message.* into v_anchor
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where job.id = p_job_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
   for update of job;
  if v_anchor.id is null then return false; end if;

  update public.whatsapp_messages message
     set processing_status = 'queued',
         metadata = message.metadata || jsonb_build_object(
           'turn_deferred_reason', left(trim(coalesce(p_reason, '')), 100),
           'turn_deferred_at', clock_timestamp()
         )
    from public.whatsapp_inbound_jobs job
   where job.message_id = message.id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  update public.whatsapp_inbound_jobs job
     set status = 'pending',
         lease_expires_at = null,
         worker_id = null,
         error_code = null,
         error_message = null
    from public.whatsapp_messages message
   where message.id = job.message_id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  select min(job.created_at)
    into v_first_job_at
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where message.conversation_id = v_anchor.conversation_id
     and job.status in ('pending', 'retry');

  v_available_at := least(
    coalesce(v_first_job_at, clock_timestamp()) + interval '8 seconds',
    clock_timestamp() + interval '2500 milliseconds'
  );

  update public.whatsapp_inbound_jobs job
     set available_at = v_available_at
    from public.whatsapp_messages message
   where message.id = job.message_id
     and message.conversation_id = v_anchor.conversation_id
     and job.status in ('pending', 'retry');

  return true;
end;
$$;

create or replace function public.prepare_whatsapp_conversation_turn(
  p_job_id uuid,
  p_worker_id text,
  p_reply text,
  p_agent_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor public.whatsapp_messages%rowtype;
  v_latest public.whatsapp_messages%rowtype;
  v_outbound public.whatsapp_messages%rowtype;
  v_reply text := trim(coalesce(p_reply, ''));
begin
  if v_reply = '' or char_length(v_reply) > 4096 then
    raise exception 'invalid_whatsapp_agent_reply';
  end if;

  select message.* into v_anchor
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where job.id = p_job_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
   for update of job;
  if v_anchor.id is null then return jsonb_build_object('state', 'invalid'); end if;

  select message.* into v_latest
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
   order by coalesce(message.provider_timestamp, message.created_at) desc, message.created_at desc, message.id desc
   limit 1;

  if exists (
    select 1
      from public.whatsapp_inbound_jobs newer_job
      join public.whatsapp_messages newer_message on newer_message.id = newer_job.message_id
     where newer_message.conversation_id = v_anchor.conversation_id
       and newer_job.status in ('pending', 'retry', 'processing')
       and not (
         newer_job.status = 'processing'
         and newer_job.worker_id = trim(p_worker_id)
       )
  ) then
    perform public.defer_whatsapp_conversation_turn(p_job_id, p_worker_id, 'newer_inbound_before_prepare');
    return jsonb_build_object('state', 'stale');
  end if;

  select * into v_outbound
    from public.whatsapp_messages
   where connection_id = v_anchor.connection_id
     and direction = 'outbound'
     and metadata ->> 'agent_reply_to_message_id' = v_latest.id::text
   limit 1
   for update;

  if v_outbound.id is null then
    insert into public.whatsapp_messages (
      theatre_id,
      connection_id,
      conversation_id,
      contact_id,
      provider_message_id,
      direction,
      message_type,
      body_text,
      context_provider_message_id,
      processing_status,
      delivery_status,
      metadata
    ) values (
      v_latest.theatre_id,
      v_latest.connection_id,
      v_latest.conversation_id,
      v_latest.contact_id,
      'agent-pending:' || v_latest.id::text,
      'outbound',
      'text',
      v_reply,
      v_latest.provider_message_id,
      'queued',
      'queued',
      coalesce(p_agent_metadata, '{}'::jsonb) || jsonb_build_object(
        'agent_reply_to_message_id', v_latest.id::text,
        'agent_turn_job_ids', to_jsonb((
          select array_agg(
            job.id order by coalesce(message.provider_timestamp, message.created_at), message.created_at, message.id
          )
            from public.whatsapp_inbound_jobs job
            join public.whatsapp_messages message on message.id = job.message_id
           where message.conversation_id = v_anchor.conversation_id
             and job.status = 'processing'
             and job.worker_id = trim(p_worker_id)
        )),
        'prepared_at', clock_timestamp()
      )
    )
    returning * into v_outbound;
  end if;

  update public.whatsapp_messages message
     set processing_status = 'processing'
    from public.whatsapp_inbound_jobs job
   where job.message_id = message.id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  return jsonb_build_object(
    'state', 'prepared',
    'outbound', jsonb_build_object(
      'id', v_outbound.id,
      'body_text', v_outbound.body_text,
      'delivery_status', v_outbound.delivery_status,
      'provider_message_id', v_outbound.provider_message_id,
      'metadata', v_outbound.metadata
    )
  );
end;
$$;

create or replace function public.start_whatsapp_conversation_turn_send(
  p_job_id uuid,
  p_worker_id text,
  p_outbound_message_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor public.whatsapp_messages%rowtype;
  v_updated_count integer;
begin
  select message.* into v_anchor
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where job.id = p_job_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
   for update of job;
  if v_anchor.id is null then return 'invalid'; end if;

  if exists (
    select 1
      from public.whatsapp_inbound_jobs newer_job
      join public.whatsapp_messages newer_message on newer_message.id = newer_job.message_id
     where newer_message.conversation_id = v_anchor.conversation_id
       and newer_job.status in ('pending', 'retry', 'processing')
       and not (
         newer_job.status = 'processing'
         and newer_job.worker_id = trim(p_worker_id)
       )
  ) then
    update public.whatsapp_messages
       set processing_status = 'failed',
           delivery_status = 'failed',
           metadata = metadata || jsonb_build_object(
             'handoff_reason', 'stale_conversation_turn',
             'send_finished_at', clock_timestamp()
           )
     where id = p_outbound_message_id
       and connection_id = v_anchor.connection_id
       and direction = 'outbound'
       and delivery_status = 'queued';
    perform public.defer_whatsapp_conversation_turn(p_job_id, p_worker_id, 'newer_inbound_before_send');
    return 'stale';
  end if;

  update public.whatsapp_messages
     set delivery_status = 'sending',
         metadata = metadata || jsonb_build_object('send_started_at', clock_timestamp())
   where id = p_outbound_message_id
     and connection_id = v_anchor.connection_id
     and direction = 'outbound'
     and delivery_status = 'queued';
  get diagnostics v_updated_count = row_count;

  return case when v_updated_count > 0 then 'started' else 'invalid' end;
end;
$$;

create or replace function public.complete_whatsapp_conversation_turn(
  p_job_id uuid,
  p_worker_id text,
  p_outbound_message_id uuid,
  p_provider_message_id text,
  p_resolution jsonb default null,
  p_agent_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor public.whatsapp_messages%rowtype;
  v_outbound public.whatsapp_messages%rowtype;
  v_has_pending boolean;
begin
  if nullif(trim(coalesce(p_provider_message_id, '')), '') is null then
    raise exception 'invalid_whatsapp_provider_message_id';
  end if;

  select message.* into v_anchor
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where job.id = p_job_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
   for update of job;
  if v_anchor.id is null then return false; end if;

  select * into v_outbound
    from public.whatsapp_messages
   where id = p_outbound_message_id
     and connection_id = v_anchor.connection_id
     and direction = 'outbound'
     and delivery_status in ('sending', 'sent', 'delivered', 'read')
   for update;
  if v_outbound.id is null then return false; end if;

  update public.whatsapp_messages
     set provider_message_id = left(trim(p_provider_message_id), 300),
         processing_status = 'responded',
         delivery_status = case
           when delivery_status in ('delivered', 'read') then delivery_status
           else 'sent'
         end,
         metadata = metadata || coalesce(p_agent_metadata, '{}'::jsonb) || jsonb_build_object(
           'sent_at', clock_timestamp()
         )
   where id = v_outbound.id;

  update public.whatsapp_messages message
     set processing_status = 'responded'
    from public.whatsapp_inbound_jobs job
   where job.message_id = message.id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  update public.whatsapp_inbound_jobs job
     set status = 'completed',
         completed_at = clock_timestamp(),
         lease_expires_at = null,
         worker_id = null,
         error_code = null,
         error_message = null
    from public.whatsapp_messages message
   where message.id = job.message_id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  select exists (
    select 1
      from public.whatsapp_inbound_jobs job
      join public.whatsapp_messages message on message.id = job.message_id
     where message.conversation_id = v_anchor.conversation_id
       and job.status in ('pending', 'retry', 'processing')
  ) into v_has_pending;

  update public.whatsapp_conversations
     set status = case when v_has_pending then 'pending' else 'open' end,
         last_message_at = greatest(coalesce(last_message_at, clock_timestamp()), clock_timestamp()),
         metadata = metadata
           || jsonb_build_object(
             'last_agent_resolution', p_resolution,
             'last_agent_message_id', v_outbound.id::text
           )
           || case
             when p_agent_metadata ->> 'ai_disclosure_included' = 'true'
               then jsonb_build_object('ai_disclosure_sent_at', clock_timestamp())
             else '{}'::jsonb
           end
   where id = v_anchor.conversation_id;

  return true;
end;
$$;

create or replace function public.retry_whatsapp_conversation_turn(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text,
  p_retry_delay_seconds integer default 60,
  p_outbound_message_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor public.whatsapp_messages%rowtype;
begin
  select message.* into v_anchor
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where job.id = p_job_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
   for update of job;
  if v_anchor.id is null then return 'invalid'; end if;

  if exists (
    select 1
      from public.whatsapp_inbound_jobs newer_job
      join public.whatsapp_messages newer_message on newer_message.id = newer_job.message_id
     where newer_message.conversation_id = v_anchor.conversation_id
       and newer_job.status in ('pending', 'retry', 'processing')
       and not (
         newer_job.status = 'processing'
         and newer_job.worker_id = trim(p_worker_id)
       )
  ) then
    if p_outbound_message_id is not null then
      update public.whatsapp_messages
         set processing_status = 'failed',
             delivery_status = 'failed',
             metadata = metadata || jsonb_build_object(
               'handoff_reason', 'stale_conversation_turn',
               'send_finished_at', clock_timestamp()
             )
       where id = p_outbound_message_id
         and direction = 'outbound'
         and delivery_status in ('queued', 'sending');
    end if;
    perform public.defer_whatsapp_conversation_turn(p_job_id, p_worker_id, 'newer_inbound_before_retry');
    return 'stale';
  end if;

  if p_outbound_message_id is not null then
    update public.whatsapp_messages
       set delivery_status = 'queued',
           processing_status = 'queued',
           metadata = metadata || jsonb_build_object(
             'last_send_error_code', left(trim(coalesce(p_error_code, '')), 100),
             'last_send_failed_at', clock_timestamp()
           )
     where id = p_outbound_message_id
       and connection_id = v_anchor.connection_id
       and direction = 'outbound'
       and delivery_status = 'sending';
  end if;

  update public.whatsapp_messages message
     set processing_status = 'queued'
    from public.whatsapp_inbound_jobs job
   where job.message_id = message.id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  update public.whatsapp_inbound_jobs job
     set status = 'retry',
         available_at = clock_timestamp() + make_interval(secs => greatest(10, least(coalesce(p_retry_delay_seconds, 60), 3600))),
         lease_expires_at = null,
         worker_id = null,
         error_code = nullif(left(trim(coalesce(p_error_code, '')), 100), ''),
         error_message = nullif(left(trim(coalesce(p_error_message, '')), 500), '')
    from public.whatsapp_messages message
   where message.id = job.message_id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  return 'retry';
end;
$$;

create or replace function public.complete_whatsapp_conversation_turn_handoff(
  p_job_id uuid,
  p_worker_id text,
  p_reason text,
  p_agent_metadata jsonb default '{}'::jsonb,
  p_failed boolean default false,
  p_outbound_message_id uuid default null,
  p_outbound_delivery_status text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor public.whatsapp_messages%rowtype;
  v_delivery_status text := nullif(trim(coalesce(p_outbound_delivery_status, '')), '');
  v_has_pending boolean;
begin
  if v_delivery_status is not null and v_delivery_status not in ('failed', 'unknown') then
    raise exception 'invalid_whatsapp_handoff_delivery_status';
  end if;

  select message.* into v_anchor
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where job.id = p_job_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
   for update of job;
  if v_anchor.id is null then return 'invalid'; end if;

  if p_outbound_message_id is null and exists (
    select 1
      from public.whatsapp_inbound_jobs newer_job
      join public.whatsapp_messages newer_message on newer_message.id = newer_job.message_id
     where newer_message.conversation_id = v_anchor.conversation_id
       and newer_job.status in ('pending', 'retry', 'processing')
       and not (
         newer_job.status = 'processing'
         and newer_job.worker_id = trim(p_worker_id)
       )
  ) then
    perform public.defer_whatsapp_conversation_turn(p_job_id, p_worker_id, 'newer_inbound_before_handoff');
    return 'stale';
  end if;

  if p_outbound_message_id is not null then
    update public.whatsapp_messages
       set processing_status = 'failed',
           delivery_status = coalesce(v_delivery_status, 'failed'),
           metadata = metadata || coalesce(p_agent_metadata, '{}'::jsonb) || jsonb_build_object(
             'handoff_reason', left(trim(coalesce(p_reason, '')), 100),
             'send_finished_at', clock_timestamp()
           )
     where id = p_outbound_message_id
       and connection_id = v_anchor.connection_id
       and direction = 'outbound';
  end if;

  update public.whatsapp_messages message
     set processing_status = 'handoff',
         metadata = message.metadata || jsonb_build_object(
           'handoff_reason', left(trim(coalesce(p_reason, '')), 100)
         )
    from public.whatsapp_inbound_jobs job
   where job.message_id = message.id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  update public.whatsapp_inbound_jobs job
     set status = case when p_failed then 'failed' else 'completed' end,
         completed_at = clock_timestamp(),
         lease_expires_at = null,
         worker_id = null,
         error_code = case when p_failed then nullif(left(trim(coalesce(p_reason, '')), 100), '') else null end,
         error_message = null
    from public.whatsapp_messages message
   where message.id = job.message_id
     and message.conversation_id = v_anchor.conversation_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id);

  select exists (
    select 1
      from public.whatsapp_inbound_jobs job
      join public.whatsapp_messages message on message.id = job.message_id
     where message.conversation_id = v_anchor.conversation_id
       and job.status in ('pending', 'retry', 'processing')
  ) into v_has_pending;

  update public.whatsapp_conversations
     set status = case when v_has_pending then 'pending' else 'handoff' end,
         metadata = metadata || coalesce(p_agent_metadata, '{}'::jsonb) || jsonb_build_object(
           'handoff_reason', left(trim(coalesce(p_reason, '')), 100),
           'handoff_at', clock_timestamp()
         )
   where id = v_anchor.conversation_id;

  return 'handoff';
end;
$$;

revoke all on function public.schedule_whatsapp_conversation_turn() from public, anon, authenticated;
revoke all on function public.defer_whatsapp_conversation_turn(uuid, text, text) from public, anon, authenticated;
revoke all on function public.prepare_whatsapp_conversation_turn(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.start_whatsapp_conversation_turn_send(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_whatsapp_conversation_turn(uuid, text, uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.retry_whatsapp_conversation_turn(uuid, text, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.complete_whatsapp_conversation_turn_handoff(uuid, text, text, jsonb, boolean, uuid, text) from public, anon, authenticated;

grant execute on function public.prepare_whatsapp_conversation_turn(uuid, text, text, jsonb) to service_role;
grant execute on function public.start_whatsapp_conversation_turn_send(uuid, text, uuid) to service_role;
grant execute on function public.complete_whatsapp_conversation_turn(uuid, text, uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.retry_whatsapp_conversation_turn(uuid, text, text, text, integer, uuid) to service_role;
grant execute on function public.complete_whatsapp_conversation_turn_handoff(uuid, text, text, jsonb, boolean, uuid, text) to service_role;

comment on function public.schedule_whatsapp_conversation_turn() is
  'Debounces consecutive WhatsApp inbound jobs with a 2.5 second quiet window and an 8 second maximum wait.';
comment on function public.prepare_whatsapp_conversation_turn(uuid, text, text, jsonb) is
  'Persists one reply for a coalesced WhatsApp turn and defers stale generations before provider effects.';
comment on function public.start_whatsapp_conversation_turn_send(uuid, text, uuid) is
  'Checks conversational freshness immediately before crossing the at-most-once Meta send boundary.';
comment on function public.complete_whatsapp_conversation_turn(uuid, text, uuid, text, jsonb, jsonb) is
  'Completes every inbound message and job in a coalesced turn after one confirmed Meta response.';

notify pgrst, 'reload schema';
