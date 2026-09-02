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
  v_operator_mode boolean := false;
begin
  select message.conversation_id,
         coalesce(conversation.metadata ->> 'operator_mode' = 'true', false)
    into v_conversation_id, v_operator_mode
    from public.whatsapp_messages message
    join public.whatsapp_conversations conversation on conversation.id = message.conversation_id
   where message.id = new.message_id;

  if v_operator_mode then
    update public.whatsapp_inbound_jobs
       set status = 'completed',
           completed_at = clock_timestamp(),
           worker_id = null,
           lease_expires_at = null,
           error_code = null,
           error_message = null
     where id = new.id;

    update public.whatsapp_messages
       set processing_status = 'handoff',
           metadata = metadata || jsonb_build_object('operator_mode_suppressed', true)
     where id = new.message_id;

    return new;
  end if;

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

create or replace function public.take_over_whatsapp_conversation(
  p_theatre_id uuid,
  p_conversation_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_account_id uuid;
  v_conversation public.whatsapp_conversations%rowtype;
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);

  select * into v_conversation
    from public.whatsapp_conversations
   where id = p_conversation_id
     and theatre_id = p_theatre_id
   for update;

  if v_conversation.id is null or v_conversation.status in ('resolved', 'blocked') then
    return 'unavailable';
  end if;
  if v_conversation.assigned_profile_id is not null
     and v_conversation.assigned_profile_id is distinct from v_profile_id then
    return 'already_assigned';
  end if;
  if v_conversation.metadata ->> 'operator_mode' = 'true'
     and v_conversation.assigned_profile_id = v_profile_id then
    return 'already_taken_over';
  end if;

  -- Serialize takeover with the worker's send transition. If the provider send
  -- has already started, we cannot safely promise that TALIA will stay silent.
  perform 1
    from public.whatsapp_inbound_jobs job
    join public.whatsapp_messages message on message.id = job.message_id
   where message.conversation_id = p_conversation_id
     and message.theatre_id = p_theatre_id
     and job.status in ('pending', 'retry', 'processing')
   for update of job;

  if exists (
    select 1
      from public.whatsapp_messages message
     where message.conversation_id = p_conversation_id
       and message.theatre_id = p_theatre_id
       and message.direction = 'outbound'
       and message.metadata ? 'agent_reply_to_message_id'
       and message.delivery_status = 'sending'
  ) then
    return 'send_in_progress';
  end if;

  update public.whatsapp_messages message
     set processing_status = 'handoff',
         metadata = message.metadata || jsonb_build_object('operator_mode_suppressed', true)
   where message.conversation_id = p_conversation_id
     and message.theatre_id = p_theatre_id
     and message.direction = 'inbound'
     and exists (
       select 1
         from public.whatsapp_inbound_jobs job
        where job.message_id = message.id
          and job.status in ('pending', 'retry', 'processing')
     );

  update public.whatsapp_inbound_jobs job
     set status = 'completed',
         completed_at = clock_timestamp(),
         worker_id = null,
         lease_expires_at = null,
         error_code = null,
         error_message = null
    from public.whatsapp_messages message
   where message.id = job.message_id
     and message.conversation_id = p_conversation_id
     and message.theatre_id = p_theatre_id
     and job.status in ('pending', 'retry', 'processing');

  update public.whatsapp_messages message
     set processing_status = 'failed',
         delivery_status = 'failed',
         delivery_status_at = clock_timestamp(),
         metadata = message.metadata || jsonb_build_object(
           'operator_mode_suppressed', true,
           'send_finished_at', clock_timestamp()
         )
   where message.conversation_id = p_conversation_id
     and message.theatre_id = p_theatre_id
     and message.direction = 'outbound'
     and message.metadata ? 'agent_reply_to_message_id'
     and message.delivery_status = 'queued';

  update public.whatsapp_conversations
     set status = 'handoff',
         assigned_profile_id = v_profile_id,
         claimed_at = clock_timestamp(),
         resolved_at = null,
         metadata = metadata || jsonb_build_object(
           'operator_mode', true,
           'handoff_reason', 'operator_takeover',
           'operator_taken_over_at', clock_timestamp()
         )
   where id = p_conversation_id
     and theatre_id = p_theatre_id;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.conversation_taken_over', 'whatsapp_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'taken_over';
end;
$$;

create or replace function public.release_whatsapp_conversation(
  p_theatre_id uuid,
  p_conversation_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_account_id uuid;
  v_conversation public.whatsapp_conversations%rowtype;
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);

  select * into v_conversation
    from public.whatsapp_conversations
   where id = p_conversation_id
     and theatre_id = p_theatre_id
   for update;

  if v_conversation.id is null
     or not coalesce(v_conversation.metadata ->> 'operator_mode' = 'true', false) then
    return 'unavailable';
  end if;
  if v_conversation.assigned_profile_id is distinct from v_profile_id then
    return 'not_assigned';
  end if;
  if exists (
    select 1
      from public.whatsapp_messages message
     where message.conversation_id = p_conversation_id
       and message.theatre_id = p_theatre_id
       and message.direction = 'outbound'
       and message.metadata ->> 'operator_reply' = 'true'
       and message.delivery_status in ('queued', 'sending')
  ) then
    return 'send_in_progress';
  end if;

  update public.whatsapp_conversations
     set status = 'open',
         assigned_profile_id = null,
         claimed_at = null,
         resolved_at = null,
         metadata = (metadata - 'operator_mode' - 'handoff_reason' - 'operator_taken_over_at')
           || jsonb_build_object('operator_released_at', clock_timestamp())
   where id = p_conversation_id
     and theatre_id = p_theatre_id;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.conversation_released_to_ai', 'whatsapp_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'released';
end;
$$;

create or replace function public.get_whatsapp_handoff_detail(
  p_theatre_id uuid,
  p_conversation_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, false);

  select jsonb_build_object(
    'id', conversation.id,
    'status', conversation.status,
    'operator_mode', coalesce(conversation.metadata ->> 'operator_mode' = 'true', false),
    'contact_name', coalesce(nullif(contact.profile_name, ''), 'WhatsApp'),
    'contact_masked', case
      when char_length(contact.wa_id) <= 4 then repeat('•', char_length(contact.wa_id))
      else '•••• ' || right(contact.wa_id, 4)
    end,
    'handoff_reason', conversation.metadata ->> 'handoff_reason',
    'created_at', conversation.created_at,
    'last_message_at', conversation.last_message_at,
    'assigned_profile_id', conversation.assigned_profile_id,
    'assigned_name', assigned.full_name,
    'assigned_email', assigned.email,
    'messages', coalesce(messages.value, '[]'::jsonb)
  ) into v_result
  from public.whatsapp_conversations conversation
  join public.whatsapp_contacts contact on contact.id = conversation.contact_id
  left join public.profiles assigned on assigned.id = conversation.assigned_profile_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', message.id,
      'direction', message.direction,
      'message_type', message.message_type,
      'body_text', message.body_text,
      'created_at', message.created_at,
      'delivery_status', message.delivery_status,
      'processing_status', message.processing_status,
      'is_operator_reply', coalesce(message.metadata ->> 'operator_reply' = 'true', false)
    ) order by message.created_at asc, message.id asc) as value
    from public.whatsapp_messages message
    where message.conversation_id = conversation.id
      and message.theatre_id = p_theatre_id
  ) messages on true
  where conversation.id = p_conversation_id
    and conversation.theatre_id = p_theatre_id;

  return v_result;
end;
$$;

create or replace function public.complete_whatsapp_operator_reply(
  p_theatre_id uuid,
  p_conversation_id uuid,
  p_outbound_message_id uuid,
  p_actor_user_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_account_id uuid;
  v_conversation public.whatsapp_conversations%rowtype;
  v_operator_mode boolean;
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);
  if nullif(trim(coalesce(p_provider_message_id, '')), '') is null then return false; end if;

  select * into v_conversation
    from public.whatsapp_conversations
   where id = p_conversation_id
     and theatre_id = p_theatre_id
   for update;
  if v_conversation.id is null
     or v_conversation.status <> 'handoff'
     or v_conversation.assigned_profile_id is distinct from v_profile_id then
    return false;
  end if;

  v_operator_mode := coalesce(v_conversation.metadata ->> 'operator_mode' = 'true', false);

  update public.whatsapp_messages
     set provider_message_id = p_provider_message_id,
         processing_status = 'responded',
         delivery_status = 'sent',
         delivery_status_at = clock_timestamp(),
         sent_at = clock_timestamp(),
         metadata = metadata || jsonb_build_object('operator_send_state', 'sent')
   where id = p_outbound_message_id
     and conversation_id = p_conversation_id
     and theatre_id = p_theatre_id
     and direction = 'outbound'
     and delivery_status = 'sending'
     and metadata ->> 'operator_profile_id' = v_profile_id::text;

  if not found then return false; end if;

  update public.whatsapp_conversations
     set status = case
           when metadata ->> 'operator_mode' = 'true' then 'handoff'
           else 'resolved'
         end,
         resolved_at = case when v_operator_mode then null else clock_timestamp() end,
         last_message_at = clock_timestamp(),
         metadata = metadata || jsonb_build_object(
           'resolution_reason', case when v_operator_mode then 'operator_mode_reply' else 'operator_replied' end,
           'operator_mode_active', v_operator_mode
         )
   where id = p_conversation_id
     and theatre_id = p_theatre_id
     and status = 'handoff'
     and assigned_profile_id = v_profile_id;

  if not found then return false; end if;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.operator_reply_sent', 'whatsapp_message', p_outbound_message_id,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'handoff_resolved', not v_operator_mode,
      'operator_mode_active', v_operator_mode
    )
  );

  return true;
end;
$$;

comment on function public.take_over_whatsapp_conversation(uuid,uuid,uuid) is
  'Assigns an active WhatsApp conversation to the current operator and suppresses automatic replies.';
comment on function public.release_whatsapp_conversation(uuid,uuid,uuid) is
  'Returns an operator-managed WhatsApp conversation to TALIA automatic handling.';

revoke all on function public.take_over_whatsapp_conversation(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.release_whatsapp_conversation(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.take_over_whatsapp_conversation(uuid,uuid,uuid) to service_role;
grant execute on function public.release_whatsapp_conversation(uuid,uuid,uuid) to service_role;
