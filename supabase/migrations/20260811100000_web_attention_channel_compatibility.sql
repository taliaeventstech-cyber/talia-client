-- Phase 1 of the Web Attention channel-key migration.
-- Keep the legacy `chatbot` values readable while new application versions
-- persist the canonical `web` module and channel. Historical rows are migrated
-- only after the compatibility deployment has completed its rollback window.

alter table public.tenant_modules
  drop constraint if exists tenant_modules_module_key_check;
alter table public.tenant_modules
  add constraint tenant_modules_module_key_check check (
    module_key in ('web', 'chatbot', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  );

alter table public.tenant_module_entitlements
  drop constraint if exists tenant_module_entitlements_module_key_check;
alter table public.tenant_module_entitlements
  add constraint tenant_module_entitlements_module_key_check check (
    module_key in ('web', 'chatbot', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  );

alter table public.usage_events
  drop constraint if exists usage_events_module_key_check;
alter table public.usage_events
  add constraint usage_events_module_key_check check (
    module_key in ('web', 'chatbot', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  );
alter table public.usage_events
  drop constraint if exists usage_events_channel_check;
alter table public.usage_events
  add constraint usage_events_channel_check check (
    channel in ('web', 'chatbot', 'email', 'voice', 'instagram', 'whatsapp', 'backstage', 'system')
  );

alter table public.tenant_usage_daily
  drop constraint if exists tenant_usage_daily_module_key_check;
alter table public.tenant_usage_daily
  add constraint tenant_usage_daily_module_key_check check (
    module_key in ('web', 'chatbot', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  );
alter table public.tenant_usage_daily
  drop constraint if exists tenant_usage_daily_channel_check;
alter table public.tenant_usage_daily
  add constraint tenant_usage_daily_channel_check check (
    channel in ('web', 'chatbot', 'email', 'voice', 'instagram', 'whatsapp', 'backstage', 'system')
  );

drop index if exists public.usage_events_chatbot_assistant_idx;
create index usage_events_web_assistant_idx
  on public.usage_events (theatre_id, occurred_at)
  where channel in ('web', 'chatbot')
    and event_type = 'message'
    and metadata->>'role' = 'assistant';

create or replace function public.anonymize_web_usage_identifiers(
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
      and channel in ('web', 'chatbot')
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

revoke all on function public.anonymize_web_usage_identifiers(uuid, text) from public, anon, authenticated;
grant execute on function public.anonymize_web_usage_identifiers(uuid, text) to service_role;

create or replace function public.anonymize_chatbot_usage_identifiers(
  p_theatre_id uuid,
  p_session_id text
)
returns table(category text, affected_rows bigint)
language sql
security definer
set search_path = public
as $$
  select * from public.anonymize_web_usage_identifiers(p_theatre_id, p_session_id);
$$;

revoke all on function public.anonymize_chatbot_usage_identifiers(uuid, text) from public, anon, authenticated;
grant execute on function public.anonymize_chatbot_usage_identifiers(uuid, text) to service_role;

alter function public.apply_data_retention(boolean)
  rename to apply_data_retention_before_web_channel;
revoke all on function public.apply_data_retention_before_web_channel(boolean) from public, anon, authenticated;

create function public.apply_data_retention(p_dry_run boolean default true)
returns table(category text, cutoff timestamptz, affected_rows bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_web_content_cutoff timestamptz := now() - interval '90 days';
  v_count bigint;
begin
  return query
    select * from public.apply_data_retention_before_web_channel(p_dry_run);

  if p_dry_run then
    select count(*) into v_count
    from public.usage_events
    where channel = 'web'
      and occurred_at < v_web_content_cutoff
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
      where channel = 'web'
        and occurred_at < v_web_content_cutoff
        and (
          metadata ? 'session_id'
          or metadata ? 'assistant_message_id'
          or (idempotency_key is not null and idempotency_key not like 'retained:%')
        )
      returning 1
    )
    select count(*) into v_count from anonymized;
  end if;

  category := 'web_usage_identifiers_anonymized';
  cutoff := v_web_content_cutoff;
  affected_rows := v_count;
  return next;
end;
$$;

revoke all on function public.apply_data_retention(boolean) from public, anon, authenticated;
grant execute on function public.apply_data_retention(boolean) to service_role;

comment on function public.anonymize_web_usage_identifiers(uuid, text) is
  'Removes conversation and message identifiers from retained Web Attention usage while preserving billable quantities and costs.';
comment on function public.anonymize_chatbot_usage_identifiers(uuid, text) is
  'Compatibility alias for anonymize_web_usage_identifiers during the Web channel-key migration.';
comment on function public.apply_data_retention(boolean) is
  'Applies TALIA retention policy, including both canonical web and legacy chatbot usage during migration.';

notify pgrst, 'reload schema';
