create or replace function public.apply_data_retention(p_dry_run boolean default true)
returns table(category text, cutoff timestamptz, affected_rows bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chatbot_cutoff timestamptz := now() - interval '12 months';
  v_email_cutoff timestamptz := now() - interval '90 days';
  v_draft_cutoff timestamptz := now() - interval '90 days';
  v_log_cutoff timestamptz := now() - interval '12 months';
  v_count bigint;
begin
  if p_dry_run then
    select count(*) into v_count
    from public.email_drafts
    where created_at < v_draft_cutoff;
  else
    with deleted as (
      delete from public.email_drafts
      where created_at < v_draft_cutoff
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'email_drafts';
  cutoff := v_draft_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.email_threads et
    where coalesce(et.last_message_at, et.updated_at, et.created_at) < v_email_cutoff
      and not exists (
        select 1
        from public.email_drafts ed
        where ed.thread_id = et.id
          and coalesce(ed.updated_at, ed.created_at) >= v_draft_cutoff
      );
  else
    with deleted as (
      delete from public.email_threads et
      where coalesce(et.last_message_at, et.updated_at, et.created_at) < v_email_cutoff
        and not exists (
          select 1
          from public.email_drafts ed
          where ed.thread_id = et.id
            and coalesce(ed.updated_at, ed.created_at) >= v_draft_cutoff
        )
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'email_threads';
  cutoff := v_email_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.conversation_topics ct
    where ct.session_id in (
      select c.session_id
      from public.conversations c
      where c.started_at < v_chatbot_cutoff
    );
  else
    with deleted as (
      delete from public.conversation_topics ct
      where ct.session_id in (
        select c.session_id
        from public.conversations c
        where c.started_at < v_chatbot_cutoff
      )
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'conversation_topics_linked';
  cutoff := v_chatbot_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.conversation_topics ct
    where ct.created_at < v_chatbot_cutoff
      and (
        ct.session_id is null
        or not exists (
          select 1
          from public.conversations c
          where c.session_id = ct.session_id
            and c.started_at < v_chatbot_cutoff
        )
      );
  else
    with deleted as (
      delete from public.conversation_topics ct
      where ct.created_at < v_chatbot_cutoff
        and (
          ct.session_id is null
          or not exists (
            select 1
            from public.conversations c
            where c.session_id = ct.session_id
              and c.started_at < v_chatbot_cutoff
          )
        )
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'conversation_topics_old';
  cutoff := v_chatbot_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.conversations
    where started_at < v_chatbot_cutoff;
  else
    with deleted as (
      delete from public.conversations
      where started_at < v_chatbot_cutoff
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'conversations';
  cutoff := v_chatbot_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.usage_events
    where occurred_at < v_log_cutoff;
  else
    with deleted as (
      delete from public.usage_events
      where occurred_at < v_log_cutoff
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'usage_events';
  cutoff := v_log_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.audit_events
    where created_at < v_log_cutoff;
  else
    with deleted as (
      delete from public.audit_events
      where created_at < v_log_cutoff
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'audit_events';
  cutoff := v_log_cutoff;
  affected_rows := v_count;
  return next;
end;
$$;

comment on function public.apply_data_retention(boolean) is
  'Applies TALIA retention policy. dry_run=true returns affected row counts without deleting. Retention: chatbot conversations 12 months; synced emails and drafts 90 days; usage/audit events 12 months.';

notify pgrst, 'reload schema';
