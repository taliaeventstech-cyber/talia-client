alter table public.conversation_topics
  add column if not exists message_id uuid references public.messages(id) on delete cascade,
  add column if not exists intent text,
  add column if not exists confidence double precision,
  add column if not exists taxonomy_version text,
  add column if not exists classification_source text;

alter table public.conversation_topics
  drop constraint if exists conversation_topics_confidence_check;

alter table public.conversation_topics
  add constraint conversation_topics_confidence_check
  check (confidence is null or (confidence >= 0 and confidence <= 1));

alter table public.conversation_topics
  drop constraint if exists conversation_topics_message_id_key;

alter table public.conversation_topics
  add constraint conversation_topics_message_id_key unique (message_id);

create index if not exists conversation_topics_theatre_intent_idx
  on public.conversation_topics(theatre_id, intent);

with assistant_turns as (
  select
    message.id as message_id,
    message.theatre_id,
    conversation.session_id,
    message.created_at,
    coalesce(
      nullif(message.metadata ->> 'user_message', ''),
      previous_user.content,
      ''
    ) as user_message
  from public.messages as message
  join public.conversations as conversation
    on conversation.id = message.conversation_id
  left join lateral (
    select candidate.content
    from public.messages as candidate
    where candidate.conversation_id = message.conversation_id
      and candidate.role = 'user'
      and candidate.created_at <= message.created_at
    order by candidate.created_at desc, candidate.id desc
    limit 1
  ) as previous_user on true
  where message.role = 'assistant'
    and not exists (
      select 1
      from public.conversation_topics as existing
      where existing.message_id = message.id
        or (
          existing.message_id is null
          and existing.theatre_id = message.theatre_id
          and existing.session_id = conversation.session_id
          and abs(extract(epoch from (existing.created_at - message.created_at))) <= 30
        )
    )
),
classified as (
  select
    *,
    case
      when lower(user_message) ~ '(accesib|adaptad|silla de ruedas|cadira de rodes|wheelchair)' then 'accesibilidad'
      when lower(user_message) ~ '(entrada|entrades|ticket|comprar|reserv|booking)' then 'entradas'
      when lower(user_message) ~ '(precio|preu|tarifa|descuent|descompt|cuesta|price)' then 'precios'
      when lower(user_message) ~ '(horario|horari|abiert|obert|opening|taquilla)' then 'horarios'
      when lower(user_message) ~ '(donde|on és|on es|ubicaci|direcci|adreça|adreca|llegar|arribar|metro|parking|location|mapa)' then 'ubicacion'
      when lower(user_message) ~ '(agenda|programaci|cartelera|espectácul|espectacul|espectacle|obra|exposici|evento|events)' then 'agenda'
      when lower(user_message) ~ '(visita|duraci|durada|recorrido|experiencia|grupo escolar)' then 'visita'
      else 'otro'
    end as inferred_topic
  from assistant_turns
)
insert into public.conversation_topics (
  theatre_id,
  session_id,
  message_id,
  topic,
  intent,
  confidence,
  taxonomy_version,
  classification_source,
  user_message,
  channel,
  created_at
)
select
  theatre_id,
  session_id,
  message_id,
  inferred_topic,
  case
    when lower(user_message) ~ '(queja|reclamaci|devoluci|problema|refund|complaint|contactar|contact)' then 'support'
    when lower(user_message) ~ '(comprar|reserv|booking|book|purchase)' then 'transaction'
    when inferred_topic = 'ubicacion' then 'navigation'
    when inferred_topic in ('agenda', 'horarios', 'visita', 'accesibilidad') then 'planning'
    when inferred_topic <> 'otro' then 'information'
    else 'other'
  end,
  case when inferred_topic = 'otro' then 0.25 else 0.55 end,
  'chat-v1-backfill',
  'backfill',
  user_message,
  'web',
  created_at
from classified
on conflict (message_id) do nothing;
