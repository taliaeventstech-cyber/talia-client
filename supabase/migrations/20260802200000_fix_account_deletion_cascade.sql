-- Some production databases created conversation_topics before the canonical
-- migration added its theatre relation. `add column if not exists` preserved
-- that legacy NO ACTION foreign key, so deleting an account failed whenever a
-- venue had topic rows. Recreate the constraint with the intended cascade.
alter table public.conversation_topics
  drop constraint if exists conversation_topics_theatre_id_fkey;

alter table public.conversation_topics
  add constraint conversation_topics_theatre_id_fkey
  foreign key (theatre_id) references public.theatres(id) on delete cascade;
