alter table public.whatsapp_messages
  add column if not exists delivery_status_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists failed_at timestamptz;

create or replace function public.reconcile_whatsapp_delivery_status(
  p_waba_id text,
  p_phone_number_id text,
  p_provider_message_id text,
  p_delivery_status text,
  p_provider_timestamp timestamptz,
  p_error_code text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  outcome text,
  outbound_message_id uuid,
  resolved_theatre_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.whatsapp_connections%rowtype;
  v_message public.whatsapp_messages%rowtype;
  v_status text := lower(trim(coalesce(p_delivery_status, '')));
  v_event_at timestamptz := coalesce(p_provider_timestamp, clock_timestamp());
  v_current_rank integer;
  v_incoming_rank integer;
  v_safe_metadata jsonb;
begin
  if nullif(trim(coalesce(p_waba_id, '')), '') is null
     or nullif(trim(coalesce(p_phone_number_id, '')), '') is null
     or nullif(trim(coalesce(p_provider_message_id, '')), '') is null then
    raise exception 'invalid_whatsapp_delivery_identity';
  end if;

  if v_status not in ('sent', 'delivered', 'read', 'failed') then
    raise exception 'invalid_whatsapp_delivery_status';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_whatsapp_delivery_metadata';
  end if;

  select * into v_connection
    from public.whatsapp_connections
   where waba_id = trim(p_waba_id)
     and phone_number_id = trim(p_phone_number_id);

  if v_connection.id is null then
    return query select 'unmatched_connection'::text, null::uuid, null::uuid;
    return;
  end if;

  select * into v_message
    from public.whatsapp_messages
   where connection_id = v_connection.id
     and provider_message_id = trim(p_provider_message_id)
     and direction = 'outbound'
   for update;

  if v_message.id is null then
    return query select 'unmatched_message'::text, null::uuid, v_connection.theatre_id;
    return;
  end if;

  if v_message.delivery_status = v_status and v_message.delivery_status_at is not null then
    return query select 'duplicate'::text, v_message.id, v_connection.theatre_id;
    return;
  end if;

  v_current_rank := case v_message.delivery_status
    when 'sent' then 1
    when 'delivered' then 2
    when 'read' then 3
    else 0
  end;
  v_incoming_rank := case v_status
    when 'sent' then 1
    when 'delivered' then 2
    when 'read' then 3
    else 0
  end;

  if v_status = 'failed' then
    if v_message.delivery_status in ('delivered', 'read')
       or (
         v_message.delivery_status_at is not null
         and v_event_at < v_message.delivery_status_at
       ) then
      return query select 'stale'::text, v_message.id, v_connection.theatre_id;
      return;
    end if;
  elsif v_message.delivery_status = 'failed' then
    return query select 'stale'::text, v_message.id, v_connection.theatre_id;
    return;
  elsif v_incoming_rank < v_current_rank then
    return query select 'stale'::text, v_message.id, v_connection.theatre_id;
    return;
  end if;

  v_safe_metadata := jsonb_strip_nulls(jsonb_build_object(
    'delivery_status_timestamp', v_event_at,
    'delivery_status_received_at', clock_timestamp(),
    'delivery_error_code', case
      when v_status = 'failed'
        then nullif(left(trim(coalesce(p_error_code, '')), 100), '')
      else null
    end,
    'meta_billable', case
      when jsonb_typeof(p_metadata -> 'billable') = 'boolean'
        then p_metadata -> 'billable'
      else null
    end,
    'meta_conversation_origin_type', nullif(left(trim(coalesce(p_metadata ->> 'conversationOriginType', '')), 100), ''),
    'meta_pricing_category', nullif(left(trim(coalesce(p_metadata ->> 'pricingCategory', '')), 100), ''),
    'meta_pricing_model', nullif(left(trim(coalesce(p_metadata ->> 'pricingModel', '')), 100), ''),
    'meta_pricing_type', nullif(left(trim(coalesce(p_metadata ->> 'pricingType', '')), 100), '')
  ));

  update public.whatsapp_messages
     set delivery_status = v_status,
         delivery_status_at = v_event_at,
         sent_at = case
           when v_status in ('sent', 'delivered', 'read') then coalesce(sent_at, v_event_at)
           else sent_at
         end,
         delivered_at = case
           when v_status in ('delivered', 'read') then coalesce(delivered_at, v_event_at)
           else delivered_at
         end,
         read_at = case when v_status = 'read' then coalesce(read_at, v_event_at) else read_at end,
         failed_at = case when v_status = 'failed' then coalesce(failed_at, v_event_at) else failed_at end,
         processing_status = case when v_status = 'failed' then 'failed' else processing_status end,
         metadata = case
           when v_status = 'failed' then metadata || v_safe_metadata
           else (metadata - 'delivery_error_code') || v_safe_metadata
         end,
         updated_at = clock_timestamp()
   where id = v_message.id;

  if v_status = 'failed' then
    update public.whatsapp_conversations
       set status = 'handoff',
           metadata = metadata || jsonb_build_object(
             'handoff_reason', 'provider_delivery_failed',
             'handoff_at', clock_timestamp(),
             'failed_outbound_message_id', v_message.id::text
           ),
           updated_at = clock_timestamp()
     where id = v_message.conversation_id;
  end if;

  return query select 'updated'::text, v_message.id, v_connection.theatre_id;
end;
$$;

revoke all on function public.reconcile_whatsapp_delivery_status(text, text, text, text, timestamptz, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.reconcile_whatsapp_delivery_status(text, text, text, text, timestamptz, text, jsonb)
  to service_role;

comment on function public.reconcile_whatsapp_delivery_status(text, text, text, text, timestamptz, text, jsonb) is
  'Reconciles signed Meta delivery webhooks monotonically without retaining recipient IDs or raw provider errors.';
