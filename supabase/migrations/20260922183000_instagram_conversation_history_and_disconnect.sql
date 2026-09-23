create or replace function public.authorize_instagram_operator(
  p_theatre_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  select profile.id
    into v_profile_id
  from public.profiles profile
  where profile.auth_user_id = p_actor_user_id
    and profile.status = 'active'
    and (
      exists (
        select 1
        from public.platform_admins platform_admin
        where platform_admin.user_id = p_actor_user_id
      )
      or exists (
        select 1
        from public.venue_memberships membership
        where membership.theatre_id = p_theatre_id
          and membership.profile_id = profile.id
          and membership.revoked_at is null
      )
      or exists (
        select 1
        from public.theatres theatre
        join public.account_memberships membership
          on membership.account_id = theatre.account_id
        where theatre.id = p_theatre_id
          and membership.profile_id = profile.id
          and membership.revoked_at is null
      )
    );

  if v_profile_id is null then
    raise exception 'instagram_operator_access_denied';
  end if;

  return v_profile_id;
end;
$$;

create or replace function public.get_instagram_conversation_history(
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
  perform public.authorize_instagram_operator(p_theatre_id, p_actor_user_id);

  select count(*)::integer
    into v_count
  from public.instagram_conversations conversation
  where conversation.theatre_id = p_theatre_id;

  select coalesce(
    jsonb_agg(to_jsonb(history_row) order by history_row.last_message_at desc nulls last),
    '[]'::jsonb
  )
    into v_items
  from (
    select
      conversation.id,
      conversation.status,
      case
        when char_length(contact.instagram_scoped_user_id) <= 4
          then repeat('•', char_length(contact.instagram_scoped_user_id))
        else '•••• ' || right(contact.instagram_scoped_user_id, 4)
      end as contact_masked,
      conversation.last_message_at,
      conversation.created_at,
      conversation.metadata ->> 'handoff_reason' as handoff_reason,
      coalesce(message_count.value, 0)::integer as message_count,
      latest.body_text as latest_message,
      latest.direction as latest_direction
    from public.instagram_conversations conversation
    join public.instagram_contacts contact on contact.id = conversation.contact_id
    left join lateral (
      select count(*) as value
      from public.instagram_messages message
      where message.conversation_id = conversation.id
        and message.theatre_id = p_theatre_id
    ) message_count on true
    left join lateral (
      select
        left(coalesce(message.body_text, '[' || message.message_type || ']'), 180) as body_text,
        message.direction
      from public.instagram_messages message
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
    'contact_masked', case
      when char_length(contact.instagram_scoped_user_id) <= 4
        then repeat('•', char_length(contact.instagram_scoped_user_id))
      else '•••• ' || right(contact.instagram_scoped_user_id, 4)
    end,
    'handoff_reason', conversation.metadata ->> 'handoff_reason',
    'created_at', conversation.created_at,
    'last_message_at', conversation.last_message_at,
    'messages', coalesce(messages.value, '[]'::jsonb)
  )
    into v_result
  from public.instagram_conversations conversation
  join public.instagram_contacts contact on contact.id = conversation.contact_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', message.id,
      'direction', message.direction,
      'message_type', message.message_type,
      'body_text', message.body_text,
      'created_at', message.created_at,
      'delivery_status', message.delivery_status,
      'processing_status', message.processing_status
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

create or replace function public.get_instagram_connection_disconnect_context(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_connection_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.instagram_connections%rowtype;
begin
  perform public.authorize_instagram_connection_admin(p_theatre_id, p_actor_user_id);

  select *
    into v_connection
  from public.instagram_connections
  where id = p_connection_id
    and theatre_id = p_theatre_id
    and status = 'connected'
  limit 1;

  if v_connection.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_connection.id,
    'credential_metadata', v_connection.credential_metadata
  );
end;
$$;

revoke all on function public.authorize_instagram_operator(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_instagram_conversation_history(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.get_instagram_conversation_detail(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_instagram_connection_disconnect_context(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.authorize_instagram_operator(uuid, uuid)
  to service_role;
grant execute on function public.get_instagram_conversation_history(uuid, uuid, integer)
  to service_role;
grant execute on function public.get_instagram_conversation_detail(uuid, uuid, uuid)
  to service_role;
grant execute on function public.get_instagram_connection_disconnect_context(uuid, uuid, uuid)
  to service_role;

comment on function public.get_instagram_conversation_history(uuid, uuid, integer) is
  'Returns tenant-scoped Instagram conversation history with masked contact identifiers.';
comment on function public.get_instagram_conversation_detail(uuid, uuid, uuid) is
  'Returns one tenant-scoped Instagram conversation and its ordered messages.';
comment on function public.get_instagram_connection_disconnect_context(uuid, uuid, uuid) is
  'Returns the encrypted provider context needed to disconnect one authorized Instagram connection.';
