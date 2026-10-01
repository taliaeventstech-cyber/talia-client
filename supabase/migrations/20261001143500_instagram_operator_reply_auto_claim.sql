create or replace function public.prepare_instagram_operator_reply(
  p_theatre_id uuid,
  p_conversation_id uuid,
  p_actor_user_id uuid,
  p_body_text text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_conversation public.instagram_conversations%rowtype;
  v_connection public.instagram_connections%rowtype;
  v_contact public.instagram_contacts%rowtype;
  v_latest_inbound public.instagram_messages%rowtype;
  v_latest_inbound_at timestamptz;
  v_outbound public.instagram_messages%rowtype;
  v_body text := trim(coalesce(p_body_text, ''));
  v_use_human_agent_tag boolean;
  v_account_id uuid;
begin
  v_profile_id := public.authorize_instagram_manager(p_theatre_id, p_actor_user_id);
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'instagram_operator_reply_invalid';
  end if;

  select * into v_conversation
  from public.instagram_conversations
  where id = p_conversation_id and theatre_id = p_theatre_id
  for update;

  if v_conversation.id is null or v_conversation.status <> 'handoff' then
    return jsonb_build_object('state', 'unavailable');
  end if;

  -- Recover safely when a client-side navigation preserved a reply form from
  -- another conversation. The row lock makes this claim atomic: one operator
  -- wins, while everybody else receives not_assigned below.
  if v_conversation.assigned_profile_id is null then
    update public.instagram_conversations
    set assigned_profile_id = v_profile_id,
        claimed_at = clock_timestamp(),
        metadata = metadata || jsonb_build_object('operator_mode', true)
    where id = p_conversation_id
      and theatre_id = p_theatre_id;

    v_conversation.assigned_profile_id := v_profile_id;
    select account_id into v_account_id
    from public.theatres
    where id = p_theatre_id;

    insert into public.audit_events (
      account_id, theatre_id, actor_profile_id, actor_user_id,
      action, target_type, target_id, metadata
    ) values (
      v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
      'instagram.handoff_claimed', 'instagram_conversation', p_conversation_id,
      jsonb_build_object('claim_source', 'operator_reply')
    );
  elsif v_conversation.assigned_profile_id is distinct from v_profile_id then
    return jsonb_build_object('state', 'not_assigned');
  end if;

  select * into v_outbound
  from public.instagram_messages message
  where message.connection_id = v_conversation.connection_id
    and message.direction = 'outbound'
    and message.metadata ->> 'operator_idempotency_key' = p_idempotency_key::text
  limit 1;

  if v_outbound.id is not null then
    return jsonb_build_object(
      'state', 'existing',
      'outbound_message_id', v_outbound.id,
      'delivery_status', v_outbound.delivery_status
    );
  end if;

  select * into v_connection
  from public.instagram_connections
  where id = v_conversation.connection_id
    and theatre_id = p_theatre_id
    and status = 'connected'
    and rollout_enabled = true;
  if v_connection.id is null then
    return jsonb_build_object('state', 'connection_unavailable');
  end if;

  select * into v_contact
  from public.instagram_contacts
  where id = v_conversation.contact_id
    and theatre_id = p_theatre_id;

  select message.*
    into v_latest_inbound
  from public.instagram_messages message
  where message.conversation_id = p_conversation_id
    and message.theatre_id = p_theatre_id
    and message.direction = 'inbound'
  order by coalesce(message.provider_timestamp, message.created_at) desc, message.id desc
  limit 1;

  v_latest_inbound_at := coalesce(v_latest_inbound.provider_timestamp, v_latest_inbound.created_at);

  if v_contact.id is null or v_latest_inbound.id is null then
    return jsonb_build_object('state', 'conversation_context_missing');
  end if;
  if clock_timestamp() > v_latest_inbound_at + interval '7 days' then
    return jsonb_build_object('state', 'human_agent_window_expired');
  end if;

  v_use_human_agent_tag := clock_timestamp() > v_latest_inbound_at + interval '24 hours';

  insert into public.instagram_messages (
    theatre_id, connection_id, conversation_id, contact_id,
    provider_message_id, direction, message_type, body_text,
    context_provider_message_id, processing_status, delivery_status, metadata
  ) values (
    p_theatre_id, v_conversation.connection_id, p_conversation_id, v_conversation.contact_id,
    'operator-pending:' || p_idempotency_key::text, 'outbound', 'text', v_body,
    v_latest_inbound.provider_message_id, 'queued', 'queued', jsonb_build_object(
      'operator_reply', true,
      'operator_idempotency_key', p_idempotency_key::text,
      'operator_profile_id', v_profile_id,
      'operator_user_id', p_actor_user_id,
      'use_human_agent_tag', v_use_human_agent_tag,
      'latest_inbound_at', v_latest_inbound_at
    )
  ) returning * into v_outbound;

  return jsonb_build_object(
    'state', 'prepared',
    'outbound_message_id', v_outbound.id,
    'instagram_user_id', v_connection.instagram_user_id,
    'recipient_igsid', v_contact.instagram_scoped_user_id,
    'body_text', v_body,
    'use_human_agent_tag', v_use_human_agent_tag
  );
end;
$$;

revoke all on function public.prepare_instagram_operator_reply(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_instagram_operator_reply(uuid, uuid, uuid, text, uuid)
  to service_role;

comment on function public.prepare_instagram_operator_reply(uuid, uuid, uuid, text, uuid) is
  'Atomically claims a free Instagram handoff and persists one idempotent human-authored reply.';

notify pgrst, 'reload schema';
