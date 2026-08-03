create or replace function public.anonymize_chatbot_usage_identifiers(
  p_theatre_id uuid,
  p_session_id text
)
returns table(category text, affected_rows bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  with anonymized as (
    update public.usage_events
    set metadata = metadata - 'session_id' - 'assistant_message_id',
        idempotency_key = case
          when idempotency_key is not null then 'retained:' || id::text
          else idempotency_key
        end
    where theatre_id = p_theatre_id
      and channel = 'chatbot'
      and metadata ->> 'session_id' = p_session_id
    returning 1
  )
  select count(*) into v_count from anonymized;
  category := 'usage_events';
  affected_rows := v_count;
  return next;

  with anonymized as (
    update public.ai_usage_events
    set session_id = null,
        metadata = metadata - 'assistant_message_id',
        idempotency_key = 'retained:' || id::text
    where theatre_id = p_theatre_id
      and session_id = p_session_id
    returning 1
  )
  select count(*) into v_count from anonymized;
  category := 'ai_usage_events';
  affected_rows := v_count;
  return next;
end;
$$;

revoke all on function public.anonymize_chatbot_usage_identifiers(uuid, text) from public, anon, authenticated;
grant execute on function public.anonymize_chatbot_usage_identifiers(uuid, text) to service_role;

comment on function public.anonymize_chatbot_usage_identifiers(uuid, text) is
  'Removes conversation and message identifiers from retained chatbot usage while preserving billable quantities and costs.';

create or replace function public.apply_data_retention(p_dry_run boolean default true)
returns table(category text, cutoff timestamptz, affected_rows bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chatbot_content_cutoff timestamptz := now() - interval '90 days';
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
      where coalesce(c.last_message_at, c.started_at) < v_chatbot_content_cutoff
    );
  else
    with deleted as (
      delete from public.conversation_topics ct
      where ct.session_id in (
        select c.session_id
        from public.conversations c
        where coalesce(c.last_message_at, c.started_at) < v_chatbot_content_cutoff
      )
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'conversation_topics_linked';
  cutoff := v_chatbot_content_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.conversation_topics ct
    where ct.created_at < v_chatbot_content_cutoff
      and (
        ct.session_id is null
        or not exists (
          select 1
          from public.conversations c
          where c.session_id = ct.session_id
        )
      );
  else
    with deleted as (
      delete from public.conversation_topics ct
      where ct.created_at < v_chatbot_content_cutoff
        and (
          ct.session_id is null
          or not exists (
            select 1
            from public.conversations c
            where c.session_id = ct.session_id
          )
        )
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'conversation_topics_old';
  cutoff := v_chatbot_content_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.conversations
    where coalesce(last_message_at, started_at) < v_chatbot_content_cutoff;
  else
    with deleted as (
      delete from public.conversations
      where coalesce(last_message_at, started_at) < v_chatbot_content_cutoff
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'conversations';
  cutoff := v_chatbot_content_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.usage_events
    where channel = 'chatbot'
      and occurred_at < v_chatbot_content_cutoff
      and (
        metadata ? 'session_id'
        or metadata ? 'assistant_message_id'
        or (idempotency_key is not null and idempotency_key not like 'retained:%')
      );
  else
    with anonymized as (
      update public.usage_events
      set metadata = metadata - 'session_id' - 'assistant_message_id',
          idempotency_key = case
            when idempotency_key is not null then 'retained:' || id::text
            else idempotency_key
          end
      where channel = 'chatbot'
        and occurred_at < v_chatbot_content_cutoff
        and (
          metadata ? 'session_id'
          or metadata ? 'assistant_message_id'
          or (idempotency_key is not null and idempotency_key not like 'retained:%')
        )
      returning 1
    )
    select count(*) into v_count from anonymized;
  end if;
  category := 'chatbot_usage_identifiers_anonymized';
  cutoff := v_chatbot_content_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.ai_usage_events
    where occurred_at < v_chatbot_content_cutoff
      and (session_id is not null or metadata ? 'assistant_message_id');
  else
    with anonymized as (
      update public.ai_usage_events
      set session_id = null,
          metadata = metadata - 'assistant_message_id',
          idempotency_key = 'retained:' || id::text
      where occurred_at < v_chatbot_content_cutoff
        and (session_id is not null or metadata ? 'assistant_message_id')
      returning 1
    )
    select count(*) into v_count from anonymized;
  end if;
  category := 'chatbot_ai_usage_identifiers_anonymized';
  cutoff := v_chatbot_content_cutoff;
  affected_rows := v_count;
  return next;

  if p_dry_run then
    select count(*) into v_count
    from public.ai_usage_events
    where occurred_at < v_log_cutoff;
  else
    with deleted as (
      delete from public.ai_usage_events
      where occurred_at < v_log_cutoff
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'ai_usage_events';
  cutoff := v_log_cutoff;
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
    from public.tenant_usage_daily
    where date < v_log_cutoff::date;
  else
    with deleted as (
      delete from public.tenant_usage_daily
      where date < v_log_cutoff::date
      returning 1
    )
    select count(*) into v_count from deleted;
  end if;
  category := 'tenant_usage_daily';
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
  'Applies TALIA retention policy. dry_run=true reports affected rows. Retention: chatbot content 90 days; synced emails and drafts 90 days; anonymized usage and audit events 12 months.';

notify pgrst, 'reload schema';
