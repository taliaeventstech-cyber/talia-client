create or replace function public.take_over_instagram_conversation(
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
  v_conversation public.instagram_conversations%rowtype;
begin
  v_profile_id := public.authorize_instagram_manager(p_theatre_id, p_actor_user_id);

  -- Keep the worker lock order: jobs first, conversation second. Once this
  -- transaction owns the jobs, no agent send can cross the provider boundary.
  perform 1
    from public.instagram_inbound_jobs job
    join public.instagram_messages message on message.id = job.message_id
   where message.conversation_id = p_conversation_id
     and message.theatre_id = p_theatre_id
     and job.status in ('pending', 'retry', 'processing')
   for update of job;

  select * into v_conversation
    from public.instagram_conversations
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
  if v_conversation.metadata ->> 'operator_mode_source' = 'proactive'
     and v_conversation.assigned_profile_id = v_profile_id then
    return 'already_taken_over';
  end if;

  if exists (
    select 1
      from public.instagram_messages message
     where message.conversation_id = p_conversation_id
       and message.theatre_id = p_theatre_id
       and message.direction = 'outbound'
       and message.metadata ? 'agent_reply_to_message_id'
       and message.delivery_status = 'sending'
  ) then
    return 'send_in_progress';
  end if;

  update public.instagram_messages message
     set processing_status = 'handoff',
         metadata = message.metadata || jsonb_build_object('operator_mode_suppressed', true)
   where message.conversation_id = p_conversation_id
     and message.theatre_id = p_theatre_id
     and message.direction = 'inbound'
     and exists (
       select 1
         from public.instagram_inbound_jobs job
        where job.message_id = message.id
          and job.status in ('pending', 'retry', 'processing')
     );

  update public.instagram_inbound_jobs job
     set status = 'completed',
         completed_at = clock_timestamp(),
         worker_id = null,
         lease_expires_at = null,
         error_code = null,
         error_message = null
    from public.instagram_messages message
   where message.id = job.message_id
     and message.conversation_id = p_conversation_id
     and message.theatre_id = p_theatre_id
     and job.status in ('pending', 'retry', 'processing');

  update public.instagram_messages message
     set processing_status = 'failed',
         delivery_status = 'failed',
         metadata = message.metadata || jsonb_build_object(
           'operator_mode_suppressed', true,
           'send_finished_at', clock_timestamp()
         )
   where message.conversation_id = p_conversation_id
     and message.theatre_id = p_theatre_id
     and message.direction = 'outbound'
     and message.metadata ? 'agent_reply_to_message_id'
     and message.delivery_status = 'queued';

  update public.instagram_conversations
     set status = 'handoff',
         assigned_profile_id = v_profile_id,
         claimed_at = clock_timestamp(),
         resolved_at = null,
         metadata = metadata || jsonb_build_object(
           'operator_mode', true,
           'operator_mode_source', 'proactive',
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
    'instagram.conversation_taken_over', 'instagram_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'taken_over';
end;
$$;

create or replace function public.release_instagram_conversation(
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
  v_conversation public.instagram_conversations%rowtype;
begin
  v_profile_id := public.authorize_instagram_manager(p_theatre_id, p_actor_user_id);

  select * into v_conversation
    from public.instagram_conversations
   where id = p_conversation_id
     and theatre_id = p_theatre_id
   for update;

  if v_conversation.id is null
     or not coalesce(v_conversation.metadata ->> 'operator_mode' = 'true', false)
     or v_conversation.metadata ->> 'operator_mode_source' <> 'proactive' then
    return 'unavailable';
  end if;
  if v_conversation.assigned_profile_id is distinct from v_profile_id then
    return 'not_assigned';
  end if;
  if exists (
    select 1
      from public.instagram_messages message
     where message.conversation_id = p_conversation_id
       and message.theatre_id = p_theatre_id
       and message.direction = 'outbound'
       and message.metadata ->> 'operator_reply' = 'true'
       and message.delivery_status in ('queued', 'sending')
  ) then
    return 'send_in_progress';
  end if;

  update public.instagram_conversations
     set status = 'open',
         assigned_profile_id = null,
         claimed_at = null,
         resolved_at = null,
         metadata = (
           metadata
           - 'operator_mode'
           - 'operator_mode_source'
           - 'handoff_reason'
           - 'operator_taken_over_at'
         ) || jsonb_build_object('operator_released_at', clock_timestamp())
   where id = p_conversation_id
     and theatre_id = p_theatre_id;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'instagram.conversation_released_to_ai', 'instagram_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'released';
end;
$$;

create or replace function public.complete_instagram_operator_reply(
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
  v_conversation public.instagram_conversations%rowtype;
  v_operator_mode_source text;
  v_proactive_mode boolean;
begin
  v_profile_id := public.authorize_instagram_manager(p_theatre_id, p_actor_user_id);
  if nullif(trim(coalesce(p_provider_message_id, '')), '') is null then return false; end if;

  select * into v_conversation
    from public.instagram_conversations
   where id = p_conversation_id
     and theatre_id = p_theatre_id
   for update;
  if v_conversation.id is null
     or v_conversation.status <> 'handoff'
     or v_conversation.assigned_profile_id is distinct from v_profile_id then
    return false;
  end if;

  v_operator_mode_source := v_conversation.metadata ->> 'operator_mode_source';
  v_proactive_mode := v_operator_mode_source = 'proactive';

  update public.instagram_messages
     set provider_message_id = left(trim(p_provider_message_id), 1000),
         processing_status = 'responded',
         delivery_status = 'sent',
         metadata = metadata || jsonb_build_object(
           'operator_send_state', 'sent',
           'operator_sent_at', clock_timestamp()
         )
   where id = p_outbound_message_id
     and conversation_id = p_conversation_id
     and theatre_id = p_theatre_id
     and direction = 'outbound'
     and delivery_status = 'sending'
     and metadata ->> 'operator_profile_id' = v_profile_id::text;

  if not found then return false; end if;

  update public.instagram_conversations
     set status = case when v_proactive_mode then 'handoff' else 'resolved' end,
         last_message_at = clock_timestamp(),
         resolved_at = case when v_proactive_mode then null else clock_timestamp() end,
         metadata = case
           when v_proactive_mode then metadata || jsonb_build_object(
             'resolution_reason', 'operator_mode_reply',
             'operator_mode_active', true
           )
           else (metadata - 'operator_mode' - 'operator_mode_source') || jsonb_build_object(
             'resolution_reason', 'operator_replied',
             'operator_mode_active', false
           )
         end
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
    'instagram.operator_reply_sent', 'instagram_message', p_outbound_message_id,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'handoff_resolved', not v_proactive_mode,
      'operator_mode_active', v_proactive_mode
    )
  );

  return true;
end;
$$;

revoke all on function public.take_over_instagram_conversation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_instagram_conversation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.take_over_instagram_conversation(uuid, uuid, uuid) to service_role;
grant execute on function public.release_instagram_conversation(uuid, uuid, uuid) to service_role;

comment on function public.take_over_instagram_conversation(uuid, uuid, uuid) is
  'Pauses the Instagram agent and assigns an active conversation to an authorized operator.';
comment on function public.release_instagram_conversation(uuid, uuid, uuid) is
  'Returns a proactively claimed Instagram conversation to automated handling.';

notify pgrst, 'reload schema';
