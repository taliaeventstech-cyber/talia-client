alter table public.voice_conversations
  add column if not exists status text,
  add column if not exists summary text;

update public.voice_conversations
set summary = topic
where summary is null
  and topic is not null
  and topic not in (
    'agenda',
    'precios',
    'horarios',
    'ubicacion',
    'visita',
    'entradas',
    'accesibilidad',
    'otro'
  );

update public.voice_conversations
set topic = 'otro'
where topic is null
  or topic not in (
    'agenda',
    'precios',
    'horarios',
    'ubicacion',
    'visita',
    'entradas',
    'accesibilidad',
    'otro'
  );

create unique index if not exists idx_voice_conv_call_sid_unique
  on public.voice_conversations(call_sid);

create index if not exists idx_voice_conv_topic
  on public.voice_conversations(theatre_id, topic);
