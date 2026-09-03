create or replace function public.get_whatsapp_conversation_history(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_count integer;
begin
  perform public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, false);

  select count(*)::integer
    into v_count
  from public.whatsapp_conversations conversation
  where conversation.theatre_id = p_theatre_id;

  select coalesce(jsonb_agg(to_jsonb(history_row) order by history_row.last_message_at desc nulls last), '[]'::jsonb)
    into v_items
  from (
    select
      conversation.id,
      conversation.status,
      coalesce(nullif(contact.profile_name, ''), 'WhatsApp') as contact_name,
      case
        when char_length(contact.wa_id) <= 4 then repeat('•', char_length(contact.wa_id))
        else '•••• ' || right(contact.wa_id, 4)
      end as contact_masked,
      conversation.last_message_at,
      conversation.created_at,
      conversation.metadata ->> 'handoff_reason' as handoff_reason,
      conversation.assigned_profile_id,
      assigned.full_name as assigned_name,
      assigned.email as assigned_email,
      coalesce(message_count.value, 0)::integer as message_count,
      latest.body_text as latest_message,
      latest.direction as latest_direction
    from public.whatsapp_conversations conversation
    join public.whatsapp_contacts contact on contact.id = conversation.contact_id
    left join public.profiles assigned on assigned.id = conversation.assigned_profile_id
    left join lateral (
      select count(*) as value
      from public.whatsapp_messages message
      where message.conversation_id = conversation.id
        and message.theatre_id = p_theatre_id
    ) message_count on true
    left join lateral (
      select
        left(coalesce(message.body_text, '[' || message.message_type || ']'), 180) as body_text,
        message.direction
      from public.whatsapp_messages message
      where message.conversation_id = conversation.id
        and message.theatre_id = p_theatre_id
      order by message.created_at desc, message.id desc
      limit 1
    ) latest on true
    where conversation.theatre_id = p_theatre_id
    order by conversation.last_message_at desc nulls last, conversation.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ) history_row;

  return jsonb_build_object('items', v_items, 'count', v_count);
end;
$$;

comment on function public.get_whatsapp_conversation_history(uuid,uuid,integer) is
  'Returns tenant-scoped WhatsApp conversation history with masked contact identifiers.';

revoke all on function public.get_whatsapp_conversation_history(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.get_whatsapp_conversation_history(uuid,uuid,integer) to service_role;
