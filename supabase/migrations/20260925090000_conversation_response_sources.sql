-- Customer conversation views may show the Knowledge source names behind a
-- TALIA reply. Return only the persisted source references needed to name them,
-- never the complete operational metadata for a message.

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
      'is_operator_reply', coalesce(message.metadata ->> 'operator_reply' = 'true', false),
      'metadata', jsonb_strip_nulls(jsonb_build_object(
        'agent_sources', case when jsonb_typeof(message.metadata -> 'agent_sources') = 'array' then (
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', source -> 'id',
            'source_id', source -> 'source_id',
            'source_type', source -> 'source_type'
          )))
          from jsonb_array_elements(message.metadata -> 'agent_sources') source
        ) else null end,
        'knowledge_item_id', message.metadata -> 'knowledge_item_id',
        'knowledge_source_id', message.metadata -> 'knowledge_source_id',
        'knowledge_source_type', message.metadata -> 'knowledge_source_type'
      ))
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

create or replace function public.get_instagram_conversation_detail(
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
  perform public.authorize_instagram_operator(p_theatre_id, p_actor_user_id);

  select jsonb_build_object(
    'id', conversation.id,
    'status', conversation.status,
    'operator_mode', coalesce(conversation.metadata ->> 'operator_mode' = 'true', false),
    'contact_masked', case
      when char_length(contact.instagram_scoped_user_id) <= 4
        then repeat('•', char_length(contact.instagram_scoped_user_id))
      else '•••• ' || right(contact.instagram_scoped_user_id, 4)
    end,
    'handoff_reason', conversation.metadata ->> 'handoff_reason',
    'created_at', conversation.created_at,
    'last_message_at', conversation.last_message_at,
    'assigned_profile_id', conversation.assigned_profile_id,
    'assigned_name', assigned.full_name,
    'assigned_email', assigned.email,
    'human_agent_eligible_until', latest_inbound.sent_at + interval '7 days',
    'human_agent_window_expired', latest_inbound.sent_at is null
      or clock_timestamp() > latest_inbound.sent_at + interval '7 days',
    'messages', coalesce(messages.value, '[]'::jsonb)
  )
    into v_result
  from public.instagram_conversations conversation
  join public.instagram_contacts contact on contact.id = conversation.contact_id
  left join public.profiles assigned on assigned.id = conversation.assigned_profile_id
  left join lateral (
    select coalesce(message.provider_timestamp, message.created_at) as sent_at
    from public.instagram_messages message
    where message.conversation_id = conversation.id
      and message.theatre_id = p_theatre_id
      and message.direction = 'inbound'
    order by coalesce(message.provider_timestamp, message.created_at) desc, message.id desc
    limit 1
  ) latest_inbound on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', message.id,
      'direction', message.direction,
      'message_type', message.message_type,
      'body_text', message.body_text,
      'created_at', message.created_at,
      'delivery_status', message.delivery_status,
      'processing_status', message.processing_status,
      'is_operator_reply', coalesce(message.metadata ->> 'operator_reply' = 'true', false),
      'metadata', jsonb_strip_nulls(jsonb_build_object(
        'agent_sources', case when jsonb_typeof(message.metadata -> 'agent_sources') = 'array' then (
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', source -> 'id',
            'source_id', source -> 'source_id',
            'source_type', source -> 'source_type'
          )))
          from jsonb_array_elements(message.metadata -> 'agent_sources') source
        ) else null end,
        'knowledge_item_id', message.metadata -> 'knowledge_item_id',
        'knowledge_source_id', message.metadata -> 'knowledge_source_id',
        'knowledge_source_type', message.metadata -> 'knowledge_source_type'
      ))
    ) order by message.created_at asc, message.id asc) as value
    from public.instagram_messages message
    where message.conversation_id = conversation.id
      and message.theatre_id = p_theatre_id
  ) messages on true
  where conversation.id = p_conversation_id
    and conversation.theatre_id = p_theatre_id;

  return v_result;
end;
$$;

comment on function public.get_whatsapp_handoff_detail(uuid, uuid, uuid) is
  'Returns one tenant-scoped WhatsApp conversation, including only the source references required to name TALIA response sources.';
comment on function public.get_instagram_conversation_detail(uuid, uuid, uuid) is
  'Returns one tenant-scoped Instagram conversation, including only the source references required to name TALIA response sources.';
