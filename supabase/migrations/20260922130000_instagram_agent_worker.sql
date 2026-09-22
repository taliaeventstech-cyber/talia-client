create unique index instagram_messages_one_agent_reply_idx
  on public.instagram_messages(connection_id, (metadata ->> 'agent_reply_to_message_id'))
  where direction = 'outbound'
    and metadata ? 'agent_reply_to_message_id';

create or replace function public.claim_instagram_inbound_jobs(
  p_worker_id text,
  p_limit integer default 3,
  p_lease_seconds integer default 180
)
returns table(job_id uuid, attempt_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(p_worker_id, '')), '') is null then
    raise exception 'invalid_instagram_worker_id';
  end if;

  return query
  with candidates as (
    select job.id
      from public.instagram_inbound_jobs job
      join public.instagram_messages inbound
        on inbound.id = job.message_id
       and inbound.theatre_id = job.theatre_id
       and inbound.connection_id = job.connection_id
      join public.instagram_connections connection
        on connection.id = job.connection_id
       and connection.theatre_id = job.theatre_id
     where (
       (job.status in ('pending', 'retry') and job.available_at <= clock_timestamp())
       or (job.status = 'processing' and job.lease_expires_at <= clock_timestamp())
     )
       and connection.status = 'connected'
       and connection.rollout_enabled
       and not exists (
         select 1
           from public.instagram_inbound_jobs earlier_job
           join public.instagram_messages earlier_message
             on earlier_message.id = earlier_job.message_id
            and earlier_message.conversation_id = inbound.conversation_id
          where earlier_job.id <> job.id
            and earlier_job.status in ('pending', 'retry', 'processing')
            and (earlier_job.created_at, earlier_job.id) < (job.created_at, job.id)
       )
     order by job.available_at, job.created_at
     limit greatest(1, least(coalesce(p_limit, 3), 10))
     for update of job skip locked
  ), claimed as (
    update public.instagram_inbound_jobs job
       set status = 'processing',
           attempt_count = job.attempt_count + 1,
           worker_id = left(trim(p_worker_id), 200),
           lease_expires_at = clock_timestamp()
             + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 180), 900))),
           error_code = null,
           error_message = null
      from candidates
     where job.id = candidates.id
    returning job.id, job.attempt_count
  )
  select claimed.id, claimed.attempt_count from claimed;
end;
$$;

create or replace function public.get_instagram_inbound_job_context(
  p_job_id uuid,
  p_worker_id text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'job', jsonb_build_object(
      'id', job.id,
      'attempt_count', job.attempt_count
    ),
    'connection', jsonb_build_object(
      'id', connection.id,
      'instagram_user_id', connection.instagram_user_id,
      'status', connection.status,
      'rollout_enabled', connection.rollout_enabled,
      'metadata', connection.metadata
    ),
    'tenant', jsonb_build_object(
      'id', theatre.id,
      'name', theatre.name,
      'fallback_language', theatre.primary_language,
      'fallback_email', theatre.fallback_email,
      'fallback_phone', theatre.fallback_phone
    ),
    'contact', jsonb_build_object(
      'id', contact.id,
      'instagram_scoped_user_id', contact.instagram_scoped_user_id
    ),
    'conversation', jsonb_build_object(
      'id', conversation.id,
      'status', conversation.status,
      'metadata', conversation.metadata
    ),
    'message', jsonb_build_object(
      'id', inbound.id,
      'provider_message_id', inbound.provider_message_id,
      'body_text', inbound.body_text,
      'created_at', inbound.created_at
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
            from public.instagram_messages previous
           where previous.conversation_id = conversation.id
             and previous.id <> inbound.id
             and previous.body_text is not null
             and previous.processing_status not in ('ignored', 'failed')
           order by previous.created_at desc, previous.id desc
           limit 6
        ) history
    ), '[]'::jsonb),
    'ai_disclosure_required', not exists (
      select 1
        from public.instagram_messages disclosed
       where disclosed.conversation_id = conversation.id
         and disclosed.direction = 'outbound'
         and disclosed.metadata ->> 'ai_disclosure_included' = 'true'
    ),
    'outbound', (
      select jsonb_build_object(
        'id', outbound.id,
        'body_text', outbound.body_text,
        'provider_message_id', outbound.provider_message_id,
        'delivery_status', outbound.delivery_status,
        'metadata', outbound.metadata
      )
        from public.instagram_messages outbound
       where outbound.connection_id = connection.id
         and outbound.direction = 'outbound'
         and outbound.metadata ->> 'agent_reply_to_message_id' = inbound.id::text
       limit 1
    )
  )
    from public.instagram_inbound_jobs job
    join public.instagram_messages inbound
      on inbound.id = job.message_id
     and inbound.theatre_id = job.theatre_id
     and inbound.connection_id = job.connection_id
    join public.instagram_connections connection
      on connection.id = job.connection_id
     and connection.theatre_id = job.theatre_id
    join public.theatres theatre on theatre.id = job.theatre_id
    join public.instagram_contacts contact
      on contact.id = inbound.contact_id
     and contact.connection_id = job.connection_id
     and contact.theatre_id = job.theatre_id
    join public.instagram_conversations conversation
      on conversation.id = inbound.conversation_id
     and conversation.connection_id = job.connection_id
     and conversation.theatre_id = job.theatre_id
   where job.id = p_job_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
     and connection.status = 'connected'
     and connection.rollout_enabled;
$$;

create or replace function public.prepare_instagram_agent_reply(
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
  v_job public.instagram_inbound_jobs%rowtype;
  v_inbound public.instagram_messages%rowtype;
  v_outbound public.instagram_messages%rowtype;
  v_reply text := trim(coalesce(p_reply, ''));
begin
  if v_reply = '' or char_length(v_reply) > 1000 then
    raise exception 'invalid_instagram_agent_reply';
  end if;

  select * into v_job
    from public.instagram_inbound_jobs
   where id = p_job_id
     and status = 'processing'
     and worker_id = trim(p_worker_id)
   for update;

  if v_job.id is null then
    return jsonb_build_object('state', 'stale');
  end if;

  select * into v_inbound
    from public.instagram_messages
   where id = v_job.message_id
     and direction = 'inbound'
   for update;

  select * into v_outbound
    from public.instagram_messages
   where connection_id = v_job.connection_id
     and direction = 'outbound'
     and metadata ->> 'agent_reply_to_message_id' = v_inbound.id::text
   limit 1
   for update;

  if v_outbound.id is null then
    insert into public.instagram_messages (
      theatre_id, connection_id, conversation_id, contact_id,
      provider_message_id, direction, message_type, body_text,
      context_provider_message_id, processing_status, delivery_status, metadata
    ) values (
      v_inbound.theatre_id, v_inbound.connection_id, v_inbound.conversation_id,
      v_inbound.contact_id, 'agent-pending:' || v_inbound.id::text, 'outbound',
      'text', v_reply, v_inbound.provider_message_id, 'queued', 'queued',
      coalesce(p_agent_metadata, '{}'::jsonb) || jsonb_build_object(
        'agent_reply_to_message_id', v_inbound.id::text,
        'prepared_at', clock_timestamp()
      )
    )
    returning * into v_outbound;
  end if;

  update public.instagram_messages
     set processing_status = 'processing'
   where id = v_inbound.id;

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

create or replace function public.start_instagram_agent_send(
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
  v_updated_count integer;
begin
  update public.instagram_messages outbound
     set delivery_status = 'sending',
         metadata = outbound.metadata || jsonb_build_object('send_started_at', clock_timestamp())
    from public.instagram_inbound_jobs job
   where job.id = p_job_id
     and job.status = 'processing'
     and job.worker_id = trim(p_worker_id)
     and outbound.id = p_outbound_message_id
     and outbound.connection_id = job.connection_id
     and outbound.direction = 'outbound'
     and outbound.delivery_status = 'queued';

  get diagnostics v_updated_count = row_count;
  if v_updated_count > 0 then return 'started'; end if;
  if not exists (
    select 1 from public.instagram_inbound_jobs
     where id = p_job_id and status = 'processing' and worker_id = trim(p_worker_id)
  ) then return 'stale'; end if;
  return 'invalid';
end;
$$;

create or replace function public.complete_instagram_agent_reply(
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
  v_job public.instagram_inbound_jobs%rowtype;
  v_inbound public.instagram_messages%rowtype;
  v_outbound public.instagram_messages%rowtype;
begin
  if nullif(trim(coalesce(p_provider_message_id, '')), '') is null then
    raise exception 'invalid_instagram_provider_message_id';
  end if;

  select * into v_job from public.instagram_inbound_jobs
   where id = p_job_id and status = 'processing' and worker_id = trim(p_worker_id)
   for update;
  if v_job.id is null then return false; end if;

  select * into v_inbound from public.instagram_messages where id = v_job.message_id for update;
  select * into v_outbound from public.instagram_messages
   where id = p_outbound_message_id
     and connection_id = v_job.connection_id
     and direction = 'outbound'
     and delivery_status in ('sending', 'sent', 'delivered', 'read')
   for update;
  if v_outbound.id is null then return false; end if;

  update public.instagram_messages
     set provider_message_id = left(trim(p_provider_message_id), 1000),
         processing_status = 'responded',
         delivery_status = case when delivery_status in ('delivered', 'read') then delivery_status else 'sent' end,
         metadata = metadata || coalesce(p_agent_metadata, '{}'::jsonb)
           || jsonb_build_object('sent_at', clock_timestamp())
   where id = v_outbound.id;

  update public.instagram_messages set processing_status = 'responded' where id = v_inbound.id;
  update public.instagram_conversations
     set status = 'open',
         last_message_at = clock_timestamp(),
         metadata = metadata || jsonb_build_object(
           'last_agent_resolution', p_resolution,
           'last_agent_message_id', v_outbound.id::text
         )
   where id = v_inbound.conversation_id;
  update public.instagram_inbound_jobs
     set status = 'completed', completed_at = clock_timestamp(),
         lease_expires_at = null, worker_id = null, error_code = null, error_message = null
   where id = v_job.id;
  return true;
end;
$$;

create or replace function public.retry_instagram_agent_reply(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text,
  p_retry_delay_seconds integer default 60
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.instagram_inbound_jobs%rowtype;
begin
  select * into v_job from public.instagram_inbound_jobs
   where id = p_job_id and status = 'processing' and worker_id = trim(p_worker_id)
   for update;
  if v_job.id is null then return 'stale'; end if;

  if exists (
    select 1 from public.instagram_messages outbound
     where outbound.connection_id = v_job.connection_id
       and outbound.metadata ->> 'agent_reply_to_message_id' = v_job.message_id::text
       and outbound.delivery_status = 'sending'
  ) then return 'send_started'; end if;

  update public.instagram_messages set processing_status = 'queued' where id = v_job.message_id;
  update public.instagram_inbound_jobs
     set status = 'retry',
         available_at = clock_timestamp()
           + make_interval(secs => greatest(10, least(coalesce(p_retry_delay_seconds, 60), 3600))),
         lease_expires_at = null,
         worker_id = null,
         error_code = nullif(left(trim(coalesce(p_error_code, '')), 100), ''),
         error_message = nullif(left(trim(coalesce(p_error_message, '')), 500), '')
   where id = v_job.id;
  return 'retry';
end;
$$;

create or replace function public.complete_instagram_agent_handoff(
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
  v_job public.instagram_inbound_jobs%rowtype;
  v_inbound public.instagram_messages%rowtype;
  v_delivery_status text := nullif(trim(coalesce(p_outbound_delivery_status, '')), '');
begin
  if v_delivery_status is not null and v_delivery_status not in ('failed', 'unknown') then
    raise exception 'invalid_instagram_handoff_delivery_status';
  end if;

  select * into v_job from public.instagram_inbound_jobs
   where id = p_job_id and status = 'processing' and worker_id = trim(p_worker_id)
   for update;
  if v_job.id is null then return 'stale'; end if;

  select * into v_inbound from public.instagram_messages where id = v_job.message_id for update;
  if p_outbound_message_id is not null then
    update public.instagram_messages
       set processing_status = 'failed',
           delivery_status = coalesce(v_delivery_status, 'failed'),
           metadata = metadata || coalesce(p_agent_metadata, '{}'::jsonb)
             || jsonb_build_object(
               'handoff_reason', left(trim(coalesce(p_reason, '')), 100),
               'send_finished_at', clock_timestamp()
             )
     where id = p_outbound_message_id
       and connection_id = v_job.connection_id
       and direction = 'outbound';
  end if;

  update public.instagram_messages
     set processing_status = 'handoff',
         metadata = metadata || jsonb_build_object(
           'handoff_reason', left(trim(coalesce(p_reason, '')), 100)
         )
   where id = v_inbound.id;
  update public.instagram_conversations
     set status = 'handoff',
         metadata = metadata || coalesce(p_agent_metadata, '{}'::jsonb)
           || jsonb_build_object(
             'handoff_reason', left(trim(coalesce(p_reason, '')), 100),
             'handoff_at', clock_timestamp()
           )
   where id = v_inbound.conversation_id;
  update public.instagram_inbound_jobs
     set status = case when p_failed then 'failed' else 'completed' end,
         completed_at = clock_timestamp(), lease_expires_at = null, worker_id = null,
         error_code = case when p_failed then nullif(left(trim(coalesce(p_reason, '')), 100), '') else null end,
         error_message = null
   where id = v_job.id;
  return 'handoff';
end;
$$;

revoke all on function public.claim_instagram_inbound_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_instagram_inbound_job_context(uuid, text) from public, anon, authenticated;
revoke all on function public.prepare_instagram_agent_reply(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.start_instagram_agent_send(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_instagram_agent_reply(uuid, text, uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.retry_instagram_agent_reply(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_instagram_agent_handoff(uuid, text, text, jsonb, boolean, uuid, text) from public, anon, authenticated;

grant execute on function public.claim_instagram_inbound_jobs(text, integer, integer) to service_role;
grant execute on function public.get_instagram_inbound_job_context(uuid, text) to service_role;
grant execute on function public.prepare_instagram_agent_reply(uuid, text, text, jsonb) to service_role;
grant execute on function public.start_instagram_agent_send(uuid, text, uuid) to service_role;
grant execute on function public.complete_instagram_agent_reply(uuid, text, uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.retry_instagram_agent_reply(uuid, text, text, text, integer) to service_role;
grant execute on function public.complete_instagram_agent_handoff(uuid, text, text, jsonb, boolean, uuid, text) to service_role;

comment on function public.claim_instagram_inbound_jobs(text, integer, integer) is
  'Leases independent Instagram jobs in conversation order without reading any other channel queue.';
comment on function public.get_instagram_inbound_job_context(uuid, text) is
  'Returns bounded Instagram-only history to the worker that owns the lease.';
comment on function public.start_instagram_agent_send(uuid, text, uuid) is
  'Moves one durable Instagram reply to the at-most-once provider-send boundary.';

notify pgrst, 'reload schema';
