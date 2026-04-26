-- Trigger que incrementa message_count en conversations
-- cada vez que se inserta un mensaje nuevo

create or replace function public.update_conversation_message_count()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set message_count = message_count + 1
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_update_count
  after insert on public.messages
  for each row execute function public.update_conversation_message_count();
