alter table public.conversation_topics
  add column if not exists channel text not null default 'web';

create index if not exists conversation_topics_channel_idx
  on public.conversation_topics(theatre_id, channel);
