alter table public.whatsapp_conversations
  add column if not exists assigned_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists resolved_at timestamptz;

create index if not exists whatsapp_conversations_handoff_queue_idx
  on public.whatsapp_conversations(theatre_id, last_message_at desc)
  where status = 'handoff';

create unique index if not exists whatsapp_messages_operator_idempotency_idx
  on public.whatsapp_messages(connection_id, (metadata ->> 'operator_idempotency_key'))
  where direction = 'outbound'
    and metadata ? 'operator_idempotency_key';

create or replace function public.authorize_whatsapp_operator(
  p_theatre_id uuid,
  p_actor_user_id uuid,
  p_manage boolean default false
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
          and (
            not p_manage
            or membership.role in ('owner', 'admin', 'operator')
          )
      )
      or exists (
        select 1
        from public.theatres theatre
        join public.account_memberships membership
          on membership.account_id = theatre.account_id
        where theatre.id = p_theatre_id
          and membership.profile_id = profile.id
          and membership.revoked_at is null
          and (
            not p_manage
            or membership.role in ('owner', 'admin')
          )
      )
    );

  if v_profile_id is null then
    raise exception 'whatsapp_operator_access_denied';
  end if;

  return v_profile_id;
end;
$$;

create or replace function public.get_whatsapp_handoff_queue(
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
begin
  perform public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, false);

  select coalesce(jsonb_agg(to_jsonb(queue_row) order by queue_row.last_message_at desc), '[]'::jsonb)
    into v_items
  from (
    select
      conversation.id,
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
      and conversation.status = 'handoff'
    order by conversation.last_message_at desc nulls last, conversation.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ) queue_row;

  return jsonb_build_object('items', v_items, 'count', jsonb_array_length(v_items));
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
  )
    into v_result
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

create or replace function public.claim_whatsapp_handoff(
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
  v_conversation public.whatsapp_conversations%rowtype;
  v_account_id uuid;
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);

  select * into v_conversation
  from public.whatsapp_conversations
  where id = p_conversation_id and theatre_id = p_theatre_id
  for update;

  if v_conversation.id is null or v_conversation.status <> 'handoff' then
    return 'unavailable';
  end if;
  if v_conversation.assigned_profile_id = v_profile_id then
    return 'already_claimed';
  end if;
  if v_conversation.assigned_profile_id is not null then
    return 'already_assigned';
  end if;

  update public.whatsapp_conversations
  set assigned_profile_id = v_profile_id,
      claimed_at = clock_timestamp()
  where id = p_conversation_id;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.handoff_claimed', 'whatsapp_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'claimed';
end;
$$;

create or replace function public.prepare_whatsapp_operator_reply(
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
  v_conversation public.whatsapp_conversations%rowtype;
  v_connection public.whatsapp_connections%rowtype;
  v_contact public.whatsapp_contacts%rowtype;
  v_reply_to_provider_message_id text;
  v_outbound public.whatsapp_messages%rowtype;
  v_body text := trim(coalesce(p_body_text, ''));
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);
  if char_length(v_body) < 1 or char_length(v_body) > 4096 then
    raise exception 'whatsapp_operator_reply_invalid';
  end if;

  select * into v_conversation
  from public.whatsapp_conversations
  where id = p_conversation_id and theatre_id = p_theatre_id
  for update;

  if v_conversation.id is null or v_conversation.status <> 'handoff' then
    return jsonb_build_object('state', 'unavailable');
  end if;
  if v_conversation.assigned_profile_id is distinct from v_profile_id then
    return jsonb_build_object('state', 'not_assigned');
  end if;

  select * into v_outbound
  from public.whatsapp_messages message
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
  from public.whatsapp_connections
  where id = v_conversation.connection_id
    and theatre_id = p_theatre_id
    and status = 'connected'
    and rollout_enabled = true;
  if v_connection.id is null then
    return jsonb_build_object('state', 'connection_unavailable');
  end if;

  select * into v_contact
  from public.whatsapp_contacts
  where id = v_conversation.contact_id
    and theatre_id = p_theatre_id;

  select message.provider_message_id into v_reply_to_provider_message_id
  from public.whatsapp_messages message
  where message.conversation_id = p_conversation_id
    and message.theatre_id = p_theatre_id
    and message.direction = 'inbound'
  order by message.created_at desc, message.id desc
  limit 1;

  if v_contact.id is null or v_reply_to_provider_message_id is null then
    return jsonb_build_object('state', 'conversation_context_missing');
  end if;

  insert into public.whatsapp_messages (
    theatre_id, connection_id, conversation_id, contact_id,
    provider_message_id, direction, message_type, body_text,
    context_provider_message_id, processing_status, delivery_status, metadata
  ) values (
    p_theatre_id, v_conversation.connection_id, p_conversation_id, v_conversation.contact_id,
    'operator-pending:' || p_idempotency_key::text, 'outbound', 'text', v_body,
    v_reply_to_provider_message_id, 'queued', 'queued', jsonb_build_object(
      'operator_reply', true,
      'operator_idempotency_key', p_idempotency_key::text,
      'operator_profile_id', v_profile_id,
      'operator_user_id', p_actor_user_id
    )
  ) returning * into v_outbound;

  return jsonb_build_object(
    'state', 'prepared',
    'outbound_message_id', v_outbound.id,
    'phone_number_id', v_connection.phone_number_id,
    'recipient_wa_id', v_contact.wa_id,
    'reply_to_provider_message_id', v_reply_to_provider_message_id,
    'body_text', v_body
  );
end;
$$;

create or replace function public.start_whatsapp_operator_reply_send(
  p_theatre_id uuid,
  p_conversation_id uuid,
  p_outbound_message_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_conversation public.whatsapp_conversations%rowtype;
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);

  select * into v_conversation
  from public.whatsapp_conversations
  where id = p_conversation_id and theatre_id = p_theatre_id
  for update;
  if v_conversation.id is null
     or v_conversation.status <> 'handoff'
     or v_conversation.assigned_profile_id is distinct from v_profile_id then
    return 'unavailable';
  end if;

  update public.whatsapp_messages message
  set processing_status = 'processing',
      delivery_status = 'sending'
  from public.whatsapp_conversations conversation
  where message.id = p_outbound_message_id
    and message.conversation_id = p_conversation_id
    and message.theatre_id = p_theatre_id
    and conversation.id = message.conversation_id
    and conversation.theatre_id = p_theatre_id
    and conversation.status = 'handoff'
    and conversation.assigned_profile_id = v_profile_id
    and message.direction = 'outbound'
    and message.delivery_status = 'queued'
    and message.metadata ->> 'operator_profile_id' = v_profile_id::text;

  if found then return 'started'; end if;

  if exists (
    select 1 from public.whatsapp_messages
    where id = p_outbound_message_id
      and theatre_id = p_theatre_id
      and delivery_status in ('sending', 'sent', 'delivered', 'read')
  ) then
    return 'already_started';
  end if;

  return 'unavailable';
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
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);
  if nullif(trim(coalesce(p_provider_message_id, '')), '') is null then return false; end if;

  update public.whatsapp_messages message
  set provider_message_id = p_provider_message_id,
      processing_status = 'responded',
      delivery_status = 'sent',
      delivery_status_at = clock_timestamp(),
      sent_at = clock_timestamp(),
      metadata = message.metadata || jsonb_build_object('operator_send_state', 'sent')
  from public.whatsapp_conversations conversation
  where message.id = p_outbound_message_id
    and message.conversation_id = p_conversation_id
    and message.theatre_id = p_theatre_id
    and conversation.id = message.conversation_id
    and conversation.theatre_id = p_theatre_id
    and conversation.status = 'handoff'
    and conversation.assigned_profile_id = v_profile_id
    and message.delivery_status = 'sending';

  if not found then return false; end if;

  update public.whatsapp_conversations
  set last_message_at = clock_timestamp()
  where id = p_conversation_id and theatre_id = p_theatre_id;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.operator_reply_sent', 'whatsapp_message', p_outbound_message_id,
    jsonb_build_object('conversation_id', p_conversation_id)
  );

  return true;
end;
$$;

create or replace function public.fail_whatsapp_operator_reply(
  p_theatre_id uuid,
  p_conversation_id uuid,
  p_outbound_message_id uuid,
  p_actor_user_id uuid,
  p_delivery_status text,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_status text := case when p_delivery_status = 'unknown' then 'unknown' else 'failed' end;
  v_account_id uuid;
begin
  v_profile_id := public.authorize_whatsapp_operator(p_theatre_id, p_actor_user_id, true);

  update public.whatsapp_messages message
  set processing_status = 'failed',
      delivery_status = v_status,
      delivery_status_at = clock_timestamp(),
      failed_at = case when v_status = 'failed' then clock_timestamp() else message.failed_at end,
      metadata = message.metadata || jsonb_build_object(
        'operator_send_state', v_status,
        'operator_send_error_code', left(coalesce(p_error_code, 'unknown'), 120)
      )
  from public.whatsapp_conversations conversation
  where message.id = p_outbound_message_id
    and message.conversation_id = p_conversation_id
    and message.theatre_id = p_theatre_id
    and conversation.id = message.conversation_id
    and conversation.theatre_id = p_theatre_id
    and conversation.status = 'handoff'
    and conversation.assigned_profile_id = v_profile_id
    and message.delivery_status = 'sending';

  if not found then return false; end if;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.operator_reply_failed', 'whatsapp_message', p_outbound_message_id,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'delivery_status', v_status,
      'error_code', left(coalesce(p_error_code, 'unknown'), 120)
    )
  );

  return true;
end;
$$;

create or replace function public.resolve_whatsapp_handoff(
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
  if v_conversation.id is null
     or v_conversation.status <> 'handoff'
     or v_conversation.assigned_profile_id is distinct from v_profile_id then
    return 'unavailable';
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
      metadata = metadata || jsonb_build_object('resolution_reason', 'operator_resolved')
  where id = p_conversation_id
    and theatre_id = p_theatre_id
    and status = 'handoff'
    and assigned_profile_id = v_profile_id;

  if not found then return 'unavailable'; end if;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'whatsapp.handoff_resolved', 'whatsapp_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'resolved';
end;
$$;

comment on function public.get_whatsapp_handoff_queue(uuid,uuid,integer) is
  'Returns a tenant-scoped operator queue without exposing WhatsApp identifiers.';
comment on function public.prepare_whatsapp_operator_reply(uuid,uuid,uuid,text,uuid) is
  'Persists an idempotent manual reply before returning private Meta send context to the server.';

revoke all on function public.authorize_whatsapp_operator(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.get_whatsapp_handoff_queue(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.get_whatsapp_handoff_detail(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.claim_whatsapp_handoff(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.prepare_whatsapp_operator_reply(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.start_whatsapp_operator_reply_send(uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.complete_whatsapp_operator_reply(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.fail_whatsapp_operator_reply(uuid,uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.resolve_whatsapp_handoff(uuid,uuid,uuid) from public, anon, authenticated;

grant execute on function public.authorize_whatsapp_operator(uuid,uuid,boolean) to service_role;
grant execute on function public.get_whatsapp_handoff_queue(uuid,uuid,integer) to service_role;
grant execute on function public.get_whatsapp_handoff_detail(uuid,uuid,uuid) to service_role;
grant execute on function public.claim_whatsapp_handoff(uuid,uuid,uuid) to service_role;
grant execute on function public.prepare_whatsapp_operator_reply(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.start_whatsapp_operator_reply_send(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.complete_whatsapp_operator_reply(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.fail_whatsapp_operator_reply(uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.resolve_whatsapp_handoff(uuid,uuid,uuid) to service_role;
