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
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);
  if nullif(trim(coalesce(p_provider_message_id, '')), '') is null then return false; end if;

  select * into v_conversation
  from public.whatsapp_conversations
  where id = p_conversation_id and theatre_id = p_theatre_id
  for update;
  if v_conversation.id is null
     or v_conversation.status <> 'handoff'
     or v_conversation.assigned_profile_id is distinct from v_profile_id then
    return false;
  end if;

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
  set status = 'resolved',
      resolved_at = clock_timestamp(),
      last_message_at = clock_timestamp(),
      metadata = metadata || jsonb_build_object('resolution_reason', 'operator_replied')
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
      'handoff_resolved', true
    )
  );

  return true;
end;
$$;

create or replace function public.ignore_whatsapp_handoff(
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
  where id = p_conversation_id and theatre_id = p_theatre_id
  for update;

  if v_conversation.id is null or v_conversation.status <> 'handoff' then
    return 'unavailable';
  end if;
  if v_conversation.assigned_profile_id is not null
     and v_conversation.assigned_profile_id is distinct from v_profile_id then
    return 'already_assigned';
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
  set status = 'resolved',
      resolved_at = clock_timestamp(),
      assigned_profile_id = coalesce(assigned_profile_id, v_profile_id),
      claimed_at = coalesce(claimed_at, clock_timestamp()),
      metadata = metadata || jsonb_build_object('resolution_reason', 'operator_ignored')
  where id = p_conversation_id
    and theatre_id = p_theatre_id
    and status = 'handoff';

  if not found then return 'unavailable'; end if;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.handoff_ignored', 'whatsapp_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'ignored';
end;
$$;

comment on function public.ignore_whatsapp_handoff(uuid,uuid,uuid) is
  'Resolves an active WhatsApp handoff without sending a reply and records the operator decision.';

revoke all on function public.ignore_whatsapp_handoff(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.ignore_whatsapp_handoff(uuid,uuid,uuid) to service_role;
