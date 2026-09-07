create index if not exists email_drafts_theatre_created_idx
  on public.email_drafts(theatre_id, created_at desc);

create index if not exists whatsapp_messages_theatre_outbound_created_idx
  on public.whatsapp_messages(theatre_id, created_at desc)
  where direction = 'outbound';

create or replace function public.get_backstage_response_traces(
  p_theatre_id uuid,
  p_channel text default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_channel text := nullif(lower(trim(coalesce(p_channel, ''))), '');
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_response_trace_limit';
  end if;

  if p_offset < 0 then
    raise exception 'invalid_response_trace_offset';
  end if;

  if v_channel is not null and v_channel not in ('web', 'email', 'whatsapp') then
    raise exception 'invalid_response_trace_channel';
  end if;

  return (
    with unified_traces as materialized (
      select
        message.id,
        'web'::text as channel,
        message.conversation_id,
        message.content,
        message.created_at,
        coalesce(message.metadata, '{}'::jsonb) as metadata,
        coalesce(conversation.metadata, '{}'::jsonb) as conversation_metadata,
        conversation.session_id as conversation_label,
        null::text as status,
        nullif(message.metadata ->> 'user_message', '') as question
      from public.messages message
      join public.conversations conversation
        on conversation.id = message.conversation_id
       and conversation.theatre_id = message.theatre_id
      where message.theatre_id = p_theatre_id
        and message.role = 'assistant'

      union all

      select
        draft.id,
        'email'::text as channel,
        draft.thread_id as conversation_id,
        coalesce(
          nullif(trim(draft.generated_body_text), ''),
          nullif(trim(regexp_replace(coalesce(draft.generated_body_html, ''), '<[^>]*>', ' ', 'g')), '')
        ) as content,
        draft.created_at,
        coalesce(draft.metadata, '{}'::jsonb) as metadata,
        coalesce(thread.metadata, '{}'::jsonb) as conversation_metadata,
        coalesce(nullif(thread.subject, ''), nullif(thread.sender_email, ''), thread.id::text) as conversation_label,
        draft.status,
        inbound.body_text as question
      from public.email_drafts draft
      join public.email_threads thread
        on thread.id = draft.thread_id
       and thread.theatre_id = draft.theatre_id
      left join lateral (
        select coalesce(
          nullif(trim(email_message.body_text), ''),
          nullif(trim(regexp_replace(coalesce(email_message.body_html, ''), '<[^>]*>', ' ', 'g')), '')
        ) as body_text
        from public.email_messages email_message
        where email_message.thread_id = draft.thread_id
          and email_message.theatre_id = draft.theatre_id
          and email_message.direction = 'inbound'
          and email_message.created_at <= draft.created_at
        order by email_message.created_at desc
        limit 1
      ) inbound on true
      where draft.theatre_id = p_theatre_id
        and draft.metadata ->> 'source' = 'email_agent'
        and coalesce(
          nullif(trim(draft.generated_body_text), ''),
          nullif(trim(draft.generated_body_html), '')
        ) is not null

      union all

      select
        outbound.id,
        'whatsapp'::text as channel,
        outbound.conversation_id,
        outbound.body_text as content,
        outbound.created_at,
        coalesce(outbound.metadata, '{}'::jsonb) as metadata,
        coalesce(conversation.metadata, '{}'::jsonb) as conversation_metadata,
        coalesce(nullif(contact.profile_name, ''), nullif(contact.wa_id, ''), conversation.id::text) as conversation_label,
        coalesce(outbound.delivery_status, outbound.processing_status) as status,
        inbound.body_text as question
      from public.whatsapp_messages outbound
      join public.whatsapp_conversations conversation
        on conversation.id = outbound.conversation_id
       and conversation.theatre_id = outbound.theatre_id
      join public.whatsapp_contacts contact
        on contact.id = conversation.contact_id
       and contact.theatre_id = conversation.theatre_id
      left join public.whatsapp_messages inbound
        on inbound.id::text = outbound.metadata ->> 'agent_reply_to_message_id'
       and inbound.theatre_id = outbound.theatre_id
       and inbound.direction = 'inbound'
      where outbound.theatre_id = p_theatre_id
        and outbound.direction = 'outbound'
        and nullif(trim(coalesce(outbound.body_text, '')), '') is not null
        and coalesce(outbound.metadata ->> 'operator_reply', 'false') <> 'true'
        and (
          outbound.metadata ->> 'agent' = 'whatsapp_agent'
          or outbound.metadata ? 'agent_reply_to_message_id'
        )
    ),
    filtered_traces as materialized (
      select *
      from unified_traces
      where v_channel is null or channel = v_channel
    ),
    paginated_traces as (
      select *
      from filtered_traces
      order by created_at desc, id desc
      limit p_limit
      offset p_offset
    ),
    trace_metrics as (
      select
        count(*) filter (
          where (
            jsonb_typeof(metadata -> 'agent_sources') = 'array'
            and jsonb_array_length(metadata -> 'agent_sources') > 0
          ) or (
            jsonb_typeof(metadata -> 'source_ids') = 'array'
            and jsonb_array_length(metadata -> 'source_ids') > 0
          ) or coalesce((metadata ->> 'knowledge_match_count') ~ '^[1-9][0-9]*$', false)
            or metadata ->> 'retrieval_status' in ('sources_used', 'direct_match')
        ) as with_sources,
        count(*) filter (
          where metadata ->> 'retrieval_status' in ('delegated_no_sources', 'filtered_no_sources', 'no_sources')
            or coalesce(metadata ->> 'knowledge_match_count', '') = '0'
            or (
              jsonb_typeof(metadata -> 'source_ids') = 'array'
              and jsonb_array_length(metadata -> 'source_ids') = 0
            )
        ) as without_sources,
        count(*) filter (where metadata -> 'low_confidence' = 'true'::jsonb) as low_confidence,
        count(*) filter (
          where jsonb_typeof(metadata -> 'fallback_reason') = 'string'
             or jsonb_typeof(metadata -> 'escalation_reason') = 'string'
             or metadata ->> 'response_kind' = 'fallback'
        ) as fallbacks,
        count(*) filter (where metadata #>> '{feedback,rating}' = 'positive') as response_positive,
        count(*) filter (where metadata #>> '{feedback,rating}' = 'negative') as response_negative,
        count(distinct conversation_id) filter (
          where conversation_metadata #>> '{session_feedback,resolved}' = 'true'
        ) as session_resolved,
        count(distinct conversation_id) filter (
          where conversation_metadata #>> '{session_feedback,resolved}' = 'false'
        ) as session_unresolved
      from filtered_traces
    )
    select jsonb_build_object(
      'items', coalesce(
        (select jsonb_agg(to_jsonb(item) order by item.created_at desc, item.id desc) from paginated_traces item),
        '[]'::jsonb
      ),
      'count', (select count(*) from filtered_traces),
      'channel_counts', jsonb_build_object(
        'web', (select count(*) from unified_traces where channel = 'web'),
        'email', (select count(*) from unified_traces where channel = 'email'),
        'whatsapp', (select count(*) from unified_traces where channel = 'whatsapp')
      ),
      'metrics', coalesce(
        (select to_jsonb(metrics) from trace_metrics metrics),
        jsonb_build_object(
          'with_sources', 0,
          'without_sources', 0,
          'low_confidence', 0,
          'fallbacks', 0,
          'response_positive', 0,
          'response_negative', 0,
          'session_resolved', 0,
          'session_unresolved', 0
        )
      )
    )
  );
end;
$$;

revoke all on function public.get_backstage_response_traces(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_backstage_response_traces(uuid, text, integer, integer) to service_role;

comment on function public.get_backstage_response_traces(uuid, text, integer, integer) is
  'Returns one chronological, paginated response trace across Web, Email and WhatsApp for Backstage. Operator-authored WhatsApp replies are excluded.';
