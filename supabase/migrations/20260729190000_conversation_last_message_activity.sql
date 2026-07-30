-- Keep conversation activity aligned with the messages it contains so Agora
-- can paginate conversations by real recent activity instead of creation time.

update public.conversations as conversation
set last_message_at = latest.last_message_at
from (
  select conversation_id, max(created_at) as last_message_at
  from public.messages
  group by conversation_id
) as latest
where conversation.id = latest.conversation_id
  and conversation.last_message_at is distinct from latest.last_message_at;

update public.conversations
set last_message_at = started_at
where last_message_at is null;

create or replace function public.update_conversation_message_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations
  set message_count = message_count + 1,
      last_message_at = greatest(
        coalesce(last_message_at, new.created_at),
        new.created_at
      )
  where id = new.conversation_id;

  return new;
end;
$$;

create index if not exists conversations_theatre_last_message_idx
  on public.conversations(theatre_id, last_message_at desc);
