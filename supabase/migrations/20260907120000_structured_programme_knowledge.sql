alter table public.knowledge_documents
  add constraint knowledge_documents_id_source_theatre_key
  unique (id, source_id, theatre_id);

create table if not exists public.programme_events (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  source_id uuid not null,
  document_id uuid not null,
  event_key text not null,
  title text not null,
  description text,
  participants jsonb not null default '[]'::jsonb,
  event_language text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  location jsonb,
  occurrences jsonb not null default '[]'::jsonb,
  offers jsonb not null default '[]'::jsonb,
  source_language text not null default 'es',
  source_url text not null,
  valid_from date,
  valid_until date,
  rendered_text text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  active boolean not null default true,
  extracted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_events_source_theatre_fkey
    foreign key (source_id, theatre_id)
    references public.knowledge_sources(id, theatre_id)
    on delete cascade,
  constraint programme_events_document_source_theatre_fkey
    foreign key (document_id, source_id, theatre_id)
    references public.knowledge_documents(id, source_id, theatre_id)
    on delete cascade,
  constraint programme_events_document_key unique (document_id, event_key),
  constraint programme_events_valid_range_check
    check (valid_from is null or valid_until is null or valid_until >= valid_from),
  constraint programme_events_participants_array_check
    check (jsonb_typeof(participants) = 'array'),
  constraint programme_events_occurrences_array_check
    check (jsonb_typeof(occurrences) = 'array'),
  constraint programme_events_offers_array_check
    check (jsonb_typeof(offers) = 'array'),
  constraint programme_events_evidence_array_check
    check (jsonb_typeof(evidence) = 'array')
);

alter table public.programme_events enable row level security;

drop policy if exists "programme_events_select_own_theatre" on public.programme_events;
create policy "programme_events_select_own_theatre" on public.programme_events
  for select using (theatre_id in (select public.current_theatre_ids()));

create index if not exists programme_events_theatre_validity_idx
  on public.programme_events(theatre_id, active, valid_until, valid_from);

create index if not exists programme_events_source_document_idx
  on public.programme_events(source_id, document_id);

create index if not exists programme_events_full_text_idx
  on public.programme_events
  using gin (to_tsvector('simple'::regconfig, rendered_text))
  where active = true;

drop trigger if exists programme_events_updated_at on public.programme_events;
create trigger programme_events_updated_at
  before update on public.programme_events
  for each row execute function public.set_updated_at();

create or replace function public.replace_programme_events(
  p_theatre_id uuid,
  p_source_id uuid,
  p_document_id uuid,
  p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'programme_events_must_be_array';
  end if;

  if jsonb_array_length(p_events) > 100 then
    raise exception 'too_many_programme_events';
  end if;

  if not exists (
    select 1
    from public.knowledge_documents as document
    where document.id = p_document_id
      and document.source_id = p_source_id
      and document.theatre_id = p_theatre_id
  ) then
    raise exception 'knowledge_document_not_found';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_events) as event(
      event_key text,
      title text,
      source_url text,
      rendered_text text,
      confidence double precision,
      participants jsonb,
      occurrences jsonb,
      offers jsonb,
      evidence jsonb
    )
    where nullif(trim(event.event_key), '') is null
       or nullif(trim(event.title), '') is null
       or nullif(trim(event.source_url), '') is null
       or nullif(trim(event.rendered_text), '') is null
       or event.confidence < 0
       or event.confidence > 1
       or jsonb_typeof(coalesce(event.participants, '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(event.occurrences, '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(event.offers, '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(event.evidence, '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'invalid_programme_event_payload';
  end if;

  if exists (
    select event.event_key
    from jsonb_to_recordset(p_events) as event(event_key text)
    group by event.event_key
    having count(*) > 1
  ) then
    raise exception 'duplicate_programme_event_key';
  end if;

  delete from public.programme_events as event
  where event.theatre_id = p_theatre_id
    and event.source_id = p_source_id
    and event.document_id = p_document_id;

  insert into public.programme_events (
    theatre_id,
    source_id,
    document_id,
    event_key,
    title,
    description,
    participants,
    event_language,
    duration_minutes,
    location,
    occurrences,
    offers,
    source_language,
    source_url,
    valid_from,
    valid_until,
    rendered_text,
    evidence,
    confidence,
    active,
    extracted_at
  )
  select
    p_theatre_id,
    p_source_id,
    p_document_id,
    event.event_key,
    event.title,
    event.description,
    coalesce(event.participants, '[]'::jsonb),
    event.event_language,
    event.duration_minutes,
    event.location,
    coalesce(event.occurrences, '[]'::jsonb),
    coalesce(event.offers, '[]'::jsonb),
    coalesce(nullif(trim(event.source_language), ''), 'es'),
    event.source_url,
    event.valid_from,
    event.valid_until,
    event.rendered_text,
    coalesce(event.evidence, '[]'::jsonb),
    event.confidence,
    true,
    now()
  from jsonb_to_recordset(p_events) as event(
    event_key text,
    title text,
    description text,
    participants jsonb,
    event_language text,
    duration_minutes integer,
    location jsonb,
    occurrences jsonb,
    offers jsonb,
    source_language text,
    source_url text,
    valid_from date,
    valid_until date,
    rendered_text text,
    evidence jsonb,
    confidence double precision
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_programme_events(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.replace_programme_events(uuid, uuid, uuid, jsonb) to service_role;

create or replace function public.search_programme_events(
  p_theatre_id uuid,
  p_query text,
  p_match_count integer default 20,
  p_reference_date date default current_date,
  p_include_expired boolean default false
)
returns table (
  record_type text,
  id uuid,
  source_id uuid,
  chunk_index integer,
  question text,
  answer text,
  category text,
  language text,
  priority integer,
  metadata jsonb,
  rank double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with tokens as (
    select distinct token
    from regexp_split_to_table(lower(p_query), '[^[:alnum:]]+') as token
    where char_length(token) >= 2
    limit 96
  ),
  search_query as (
    select to_tsquery('simple'::regconfig, string_agg(quote_literal(token), ' | ')) as value
    from tokens
  )
  select
    'programme_event'::text,
    event.id,
    event.source_id,
    null::integer,
    event.title,
    event.rendered_text,
    'programación'::text,
    event.source_language,
    90,
    jsonb_build_object(
      'source_type', 'programme_event',
      'source_url', event.source_url,
      'programme_event_key', event.event_key,
      'valid_from', event.valid_from,
      'valid_until', event.valid_until,
      'action_urls', coalesce((
        select jsonb_agg(offer->>'purchase_url')
        from jsonb_array_elements(event.offers) as offer
        where nullif(offer->>'purchase_url', '') is not null
      ), '[]'::jsonb)
    ),
    (
      ts_rank_cd(to_tsvector('simple'::regconfig, event.rendered_text), search_query.value, 32)
      + case when lower(event.title) = lower(trim(p_query)) then 1 else 0 end
    )::double precision as rank
  from public.programme_events as event
  join public.knowledge_documents as document
    on document.id = event.document_id
   and document.source_id = event.source_id
   and document.theatre_id = event.theatre_id
  join public.knowledge_sources as source
    on source.id = event.source_id
   and source.theatre_id = event.theatre_id
  cross join search_query
  where event.theatre_id = p_theatre_id
    and event.active = true
    and document.status = 'ready'
    and source.config->'programme_extraction_enabled' = 'true'::jsonb
    and (p_include_expired or event.valid_until is null or event.valid_until >= p_reference_date)
    and to_tsvector('simple'::regconfig, event.rendered_text) @@ search_query.value
  order by rank desc, event.valid_from asc nulls last, event.id
  limit greatest(1, least(p_match_count, 100));
$$;

revoke all on function public.search_programme_events(uuid, text, integer, date, boolean) from public;
grant execute on function public.search_programme_events(uuid, text, integer, date, boolean) to service_role;

create or replace view public.programme_knowledge_lifecycle_candidates
with (security_invoker = false)
as
  with ranked as (
    select
      event.*,
      document.status as document_status,
      document.removed_at,
      row_number() over (
        partition by event.theatre_id, event.event_key
        order by event.confidence desc, event.extracted_at desc, event.id
      ) as duplicate_rank
    from public.programme_events as event
    join public.knowledge_documents as document
      on document.id = event.document_id
     and document.source_id = event.source_id
     and document.theatre_id = event.theatre_id
  )
  select
    ranked.theatre_id,
    ranked.id as event_id,
    ranked.source_id,
    ranked.document_id,
    ranked.title,
    ranked.valid_until,
    case
      when ranked.document_status = 'removed' then 'source_removed'
      when ranked.duplicate_rank > 1 then 'duplicate'
      when ranked.valid_until < current_date then 'expired'
      else 'review'
    end as reason,
    case
      when ranked.document_status = 'removed' then 'remove'
      when ranked.duplicate_rank > 1 then 'merge'
      when ranked.valid_until < current_date then 'exclude_from_current_queries'
      else 'review'
    end as recommended_action,
    ranked.confidence,
    ranked.extracted_at
  from ranked
  where ranked.document_status = 'removed'
     or ranked.duplicate_rank > 1
     or ranked.valid_until < current_date;

revoke all on public.programme_knowledge_lifecycle_candidates from public;
grant select on public.programme_knowledge_lifecycle_candidates to service_role;
