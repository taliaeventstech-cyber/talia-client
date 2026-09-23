alter table public.instagram_conversations
  add column if not exists assigned_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists resolved_at timestamptz;

create index if not exists instagram_conversations_handoff_queue_idx
  on public.instagram_conversations(theatre_id, last_message_at desc)
  where status = 'handoff';

create unique index if not exists instagram_messages_operator_idempotency_idx
  on public.instagram_messages(connection_id, (metadata ->> 'operator_idempotency_key'))
  where direction = 'outbound'
    and metadata ? 'operator_idempotency_key';

update public.instagram_conversations
set metadata = metadata || jsonb_build_object('operator_mode', true)
where status = 'handoff'
  and not coalesce(metadata ->> 'operator_mode' = 'true', false);

create or replace function public.authorize_instagram_manager(
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
          and membership.role in ('owner', 'admin', 'operator')
      )
      or exists (
        select 1
        from public.theatres theatre
        join public.account_memberships membership
          on membership.account_id = theatre.account_id
        where theatre.id = p_theatre_id
          and membership.profile_id = profile.id
          and membership.revoked_at is null
          and membership.role in ('owner', 'admin')
      )
    );

  if v_profile_id is null then
    raise exception 'instagram_operator_access_denied';
  end if;

  return v_profile_id;
end;
$$;

create or replace function public.suppress_instagram_job_during_operator_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_operator_mode boolean := false;
begin
  select message.conversation_id,
         coalesce(conversation.metadata ->> 'operator_mode' = 'true', false)
    into v_conversation_id, v_operator_mode
  from public.instagram_messages message
  join public.instagram_conversations conversation on conversation.id = message.conversation_id
  where message.id = new.message_id;

  if not v_operator_mode then
    return new;
  end if;

  update public.instagram_messages
  set processing_status = 'handoff',
      metadata = metadata || jsonb_build_object('operator_mode_suppressed', true)
  where id = new.message_id;

  update public.instagram_conversations
  set status = 'handoff',
      metadata = metadata || jsonb_build_object('handoff_reason', 'operator_active')
  where id = v_conversation_id;

  return null;
end;
$$;

create or replace function public.activate_instagram_operator_mode_on_handoff()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'handoff' then
    new.metadata := new.metadata || jsonb_build_object('operator_mode', true);
  end if;
  return new;
end;
$$;

drop trigger if exists instagram_conversations_activate_operator_mode on public.instagram_conversations;
create trigger instagram_conversations_activate_operator_mode
  before insert or update of status on public.instagram_conversations
  for each row execute function public.activate_instagram_operator_mode_on_handoff();

drop trigger if exists instagram_inbound_jobs_operator_mode on public.instagram_inbound_jobs;
create trigger instagram_inbound_jobs_operator_mode
  before insert on public.instagram_inbound_jobs
  for each row execute function public.suppress_instagram_job_during_operator_mode();

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
      'is_operator_reply', coalesce(message.metadata ->> 'operator_reply' = 'true', false)
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

create or replace function public.claim_instagram_handoff(
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
  v_conversation public.instagram_conversations%rowtype;
  v_account_id uuid;
begin
  v_profile_id := public.authorize_instagram_manager(p_theatre_id, p_actor_user_id);

  -- Use the same lock order as the worker (job before conversation). If a
  -- provider send has already started, this waits for its definitive state
  -- instead of racing a human reply against TALIA.
  perform 1
  from public.instagram_inbound_jobs job
  join public.instagram_messages message on message.id = job.message_id
  where message.conversation_id = p_conversation_id
    and message.theatre_id = p_theatre_id
    and job.status in ('pending', 'retry', 'processing')
  for update of job;

  select * into v_conversation
  from public.instagram_conversations
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

  update public.instagram_conversations
  set assigned_profile_id = v_profile_id,
      claimed_at = clock_timestamp(),
      metadata = metadata || jsonb_build_object('operator_mode', true)
  where id = p_conversation_id;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'instagram.handoff_claimed', 'instagram_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'claimed';
end;
$$;

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
  if v_conversation.assigned_profile_id is distinct from v_profile_id then
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

create or replace function public.start_instagram_operator_reply_send(
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
  v_conversation public.instagram_conversations%rowtype;
begin
  v_profile_id := public.authorize_instagram_manager(p_theatre_id, p_actor_user_id);

  select * into v_conversation
  from public.instagram_conversations
  where id = p_conversation_id and theatre_id = p_theatre_id
  for update;
  if v_conversation.id is null
     or v_conversation.status <> 'handoff'
     or v_conversation.assigned_profile_id is distinct from v_profile_id then
    return 'unavailable';
  end if;

  update public.instagram_messages
  set processing_status = 'processing',
      delivery_status = 'sending',
      metadata = metadata || jsonb_build_object('operator_send_started_at', clock_timestamp())
  where id = p_outbound_message_id
    and conversation_id = p_conversation_id
    and theatre_id = p_theatre_id
    and direction = 'outbound'
    and delivery_status = 'queued'
    and metadata ->> 'operator_profile_id' = v_profile_id::text;

  if found then return 'started'; end if;
  if exists (
    select 1 from public.instagram_messages
    where id = p_outbound_message_id
      and theatre_id = p_theatre_id
      and delivery_status in ('sending', 'sent', 'delivered', 'read')
  ) then return 'already_started'; end if;
  return 'unavailable';
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
begin
  v_profile_id := public.authorize_instagram_manager(p_theatre_id, p_actor_user_id);
  if nullif(trim(coalesce(p_provider_message_id, '')), '') is null then return false; end if;

  update public.instagram_messages message
  set provider_message_id = left(trim(p_provider_message_id), 1000),
      processing_status = 'responded',
      delivery_status = 'sent',
      metadata = message.metadata || jsonb_build_object(
        'operator_send_state', 'sent',
        'operator_sent_at', clock_timestamp()
      )
  from public.instagram_conversations conversation
  where message.id = p_outbound_message_id
    and message.conversation_id = p_conversation_id
    and message.theatre_id = p_theatre_id
    and conversation.id = message.conversation_id
    and conversation.theatre_id = p_theatre_id
    and conversation.status = 'handoff'
    and conversation.assigned_profile_id = v_profile_id
    and message.delivery_status = 'sending';

  if not found then return false; end if;

  update public.instagram_conversations
  set status = 'resolved',
      last_message_at = clock_timestamp(),
      resolved_at = clock_timestamp(),
      metadata = (metadata - 'operator_mode') || jsonb_build_object(
        'resolution_reason', 'operator_replied'
      )
  where id = p_conversation_id and theatre_id = p_theatre_id;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'instagram.operator_reply_sent', 'instagram_message', p_outbound_message_id,
    jsonb_build_object('conversation_id', p_conversation_id)
  );

  return true;
end;
$$;

create or replace function public.fail_instagram_operator_reply(
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
  v_profile_id := public.authorize_instagram_manager(p_theatre_id, p_actor_user_id);

  update public.instagram_messages message
  set processing_status = 'failed',
      delivery_status = v_status,
      metadata = message.metadata || jsonb_build_object(
        'operator_send_state', v_status,
        'operator_send_error_code', left(coalesce(p_error_code, 'unknown'), 120),
        'operator_send_finished_at', clock_timestamp()
      )
  from public.instagram_conversations conversation
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
    'instagram.operator_reply_failed', 'instagram_message', p_outbound_message_id,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'delivery_status', v_status,
      'error_code', left(coalesce(p_error_code, 'unknown'), 120)
    )
  );

  return true;
end;
$$;

create or replace function public.ignore_instagram_handoff(
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
    from public.instagram_messages message
    where message.conversation_id = p_conversation_id
      and message.theatre_id = p_theatre_id
      and message.direction = 'outbound'
      and message.metadata ->> 'operator_reply' = 'true'
      and message.delivery_status in ('queued', 'sending')
  ) then return 'send_in_progress'; end if;

  update public.instagram_conversations
  set status = 'resolved',
      assigned_profile_id = coalesce(assigned_profile_id, v_profile_id),
      claimed_at = coalesce(claimed_at, clock_timestamp()),
      resolved_at = clock_timestamp(),
      metadata = (metadata - 'operator_mode') || jsonb_build_object(
        'resolution_reason', 'operator_ignored'
      )
  where id = p_conversation_id;

  select account_id into v_account_id from public.theatres where id = p_theatre_id;
  insert into public.audit_events (
    account_id, theatre_id, actor_profile_id, actor_user_id,
    action, target_type, target_id, metadata
  ) values (
    v_account_id, p_theatre_id, v_profile_id, p_actor_user_id,
    'instagram.handoff_ignored', 'instagram_conversation', p_conversation_id, '{}'::jsonb
  );

  return 'ignored';
end;
$$;

revoke all on function public.authorize_instagram_manager(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_instagram_handoff(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.prepare_instagram_operator_reply(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.start_instagram_operator_reply_send(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_instagram_operator_reply(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.fail_instagram_operator_reply(uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.ignore_instagram_handoff(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.authorize_instagram_manager(uuid, uuid) to service_role;
grant execute on function public.claim_instagram_handoff(uuid, uuid, uuid) to service_role;
grant execute on function public.prepare_instagram_operator_reply(uuid, uuid, uuid, text, uuid) to service_role;
grant execute on function public.start_instagram_operator_reply_send(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.complete_instagram_operator_reply(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.fail_instagram_operator_reply(uuid, uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.ignore_instagram_handoff(uuid, uuid, uuid) to service_role;

comment on function public.prepare_instagram_operator_reply(uuid, uuid, uuid, text, uuid) is
  'Persists one idempotent human-authored reply and selects RESPONSE or HUMAN_AGENT from the latest inbound timestamp.';

notify pgrst, 'reload schema';
