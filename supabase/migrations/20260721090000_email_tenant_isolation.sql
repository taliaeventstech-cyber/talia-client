-- Gmail-derived data is backend-only. Agora authorizes the caller before using
-- the service role; browser Supabase clients must never receive message bodies,
-- drafts, connection metadata, or encrypted OAuth material directly.
revoke all on table public.email_connections from public, anon, authenticated;
revoke all on table public.email_threads from public, anon, authenticated;
revoke all on table public.email_messages from public, anon, authenticated;
revoke all on table public.email_drafts from public, anon, authenticated;

drop policy if exists "email_connections_select_own_theatre" on public.email_connections;
drop policy if exists "email_threads_select_own_theatre" on public.email_threads;
drop policy if exists "email_messages_select_own_theatre" on public.email_messages;
drop policy if exists "email_drafts_select_own_theatre" on public.email_drafts;

-- Refuse to install the constraints if historical service-role writes created
-- cross-tenant relations. This keeps a bad row visible for remediation instead
-- of silently rewriting or deleting customer data.
do $$
begin
  if exists (
    select 1
    from public.email_threads t
    join public.email_connections c on c.id = t.connection_id
    where t.theatre_id <> c.theatre_id
  ) then
    raise exception 'email_tenant_isolation: cross-tenant thread connection found';
  end if;

  if exists (
    select 1
    from public.email_messages m
    join public.email_threads t on t.id = m.thread_id
    where m.theatre_id <> t.theatre_id
       or m.connection_id <> t.connection_id
  ) then
    raise exception 'email_tenant_isolation: cross-tenant message relation found';
  end if;

  if exists (
    select 1
    from public.email_drafts d
    join public.email_threads t on t.id = d.thread_id
    where d.theatre_id <> t.theatre_id
       or d.connection_id <> t.connection_id
  ) then
    raise exception 'email_tenant_isolation: cross-tenant draft relation found';
  end if;
end;
$$;

alter table public.email_connections
  add constraint email_connections_theatre_id_id_key unique (theatre_id, id);

alter table public.email_threads
  add constraint email_threads_theatre_connection_id_key unique (theatre_id, connection_id, id),
  add constraint email_threads_tenant_connection_fk
    foreign key (theatre_id, connection_id)
    references public.email_connections(theatre_id, id)
    on delete cascade
    not valid;

alter table public.email_messages
  add constraint email_messages_tenant_thread_fk
    foreign key (theatre_id, connection_id, thread_id)
    references public.email_threads(theatre_id, connection_id, id)
    on delete cascade
    not valid;

alter table public.email_drafts
  add constraint email_drafts_tenant_thread_fk
    foreign key (theatre_id, connection_id, thread_id)
    references public.email_threads(theatre_id, connection_id, id)
    on delete cascade
    not valid;

alter table public.email_threads validate constraint email_threads_tenant_connection_fk;
alter table public.email_messages validate constraint email_messages_tenant_thread_fk;
alter table public.email_drafts validate constraint email_drafts_tenant_thread_fk;

comment on table public.email_connections is
  'Backend-only mailbox connections. oauth_metadata may contain encrypted OAuth tokens and must not be exposed through authenticated PostgREST access.';
comment on table public.email_messages is
  'Backend-only Gmail/Outlook message content isolated by tenant, connection, and thread constraints.';
comment on table public.email_drafts is
  'Backend-only supervised email drafts isolated by tenant, connection, and thread constraints.';

notify pgrst, 'reload schema';
