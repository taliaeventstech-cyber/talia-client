-- Evita recursión RLS al resolver el teatro del usuario actual.
create or replace function public.current_user_theatre_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select theatre_id
  from public.users
  where id = auth.uid()
  limit 1
$$;

drop policy if exists "theatre_members_select" on public.theatres;
drop policy if exists "users_select_own_theatre" on public.users;
drop policy if exists "conversations_select_own_theatre" on public.conversations;
drop policy if exists "messages_select_own_theatre" on public.messages;
drop policy if exists "analytics_daily_select_own_theatre" on public.analytics_daily;

create policy "theatre_members_select" on public.theatres
  for select using (
    id = public.current_user_theatre_id()
  );

create policy "users_select_own_theatre" on public.users
  for select using (
    theatre_id = public.current_user_theatre_id()
  );

create policy "conversations_select_own_theatre" on public.conversations
  for select using (
    theatre_id = public.current_user_theatre_id()
  );

create policy "messages_select_own_theatre" on public.messages
  for select using (
    theatre_id = public.current_user_theatre_id()
  );

create policy "analytics_daily_select_own_theatre" on public.analytics_daily
  for select using (
    theatre_id = public.current_user_theatre_id()
  );
