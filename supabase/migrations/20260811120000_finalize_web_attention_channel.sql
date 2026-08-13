-- Phase 2 of TAL-60. Run only after the compatibility application release has
-- been deployed and rollback to a legacy `chatbot` writer is no longer needed.

do $$
declare
  v_usage_before jsonb;
  v_usage_after jsonb;
  v_daily_before jsonb;
  v_daily_after jsonb;
begin
  select jsonb_build_object(
    'rows', count(*),
    'quantity', coalesce(sum(quantity), 0),
    'input_tokens', coalesce(sum(input_tokens), 0),
    'output_tokens', coalesce(sum(output_tokens), 0),
    'cost_estimate_cents', coalesce(sum(cost_estimate_cents), 0)
  ) into v_usage_before
  from public.usage_events;

  select jsonb_build_object(
    'conversations', coalesce(sum(conversations), 0),
    'messages', coalesce(sum(messages), 0),
    'ai_calls', coalesce(sum(ai_calls), 0),
    'tool_calls', coalesce(sum(tool_calls), 0),
    'input_tokens', coalesce(sum(input_tokens), 0),
    'output_tokens', coalesce(sum(output_tokens), 0),
    'voice_minutes', coalesce(sum(voice_minutes), 0),
    'resolutions', coalesce(sum(resolutions), 0),
    'fallbacks', coalesce(sum(fallbacks), 0),
    'limit_exceeded_events', coalesce(sum(limit_exceeded_events), 0),
    'estimated_cost_cents', coalesce(sum(estimated_cost_cents), 0)
  ) into v_daily_before
  from public.tenant_usage_daily;

  insert into public.tenant_modules (
    theatre_id,
    module_key,
    status,
    config,
    enabled_at,
    disabled_at,
    created_at,
    updated_at
  )
  select
    theatre_id,
    'web',
    status,
    config,
    enabled_at,
    disabled_at,
    created_at,
    updated_at
  from public.tenant_modules
  where module_key = 'chatbot'
  on conflict (theatre_id, module_key) do update
  set status = case
        when 'active' in (public.tenant_modules.status, excluded.status) then 'active'
        when 'trial' in (public.tenant_modules.status, excluded.status) then 'trial'
        when 'suspended' in (public.tenant_modules.status, excluded.status) then 'suspended'
        else 'disabled'
      end,
      config = excluded.config || public.tenant_modules.config,
      enabled_at = case
        when public.tenant_modules.enabled_at is null then excluded.enabled_at
        when excluded.enabled_at is null then public.tenant_modules.enabled_at
        else least(public.tenant_modules.enabled_at, excluded.enabled_at)
      end,
      disabled_at = case
        when 'active' in (public.tenant_modules.status, excluded.status)
          or 'trial' in (public.tenant_modules.status, excluded.status)
          then null
        else greatest(public.tenant_modules.disabled_at, excluded.disabled_at)
      end,
      created_at = least(public.tenant_modules.created_at, excluded.created_at),
      updated_at = greatest(public.tenant_modules.updated_at, excluded.updated_at);

  delete from public.tenant_modules where module_key = 'chatbot';

  insert into public.tenant_module_entitlements (
    theatre_id,
    module_key,
    enabled,
    limits,
    metadata,
    created_at,
    updated_at
  )
  select
    theatre_id,
    'web',
    enabled,
    limits,
    metadata,
    created_at,
    updated_at
  from public.tenant_module_entitlements
  where module_key = 'chatbot'
  on conflict (theatre_id, module_key) do update
  set enabled = public.tenant_module_entitlements.enabled or excluded.enabled,
      limits = excluded.limits || public.tenant_module_entitlements.limits,
      metadata = excluded.metadata || public.tenant_module_entitlements.metadata,
      created_at = least(public.tenant_module_entitlements.created_at, excluded.created_at),
      updated_at = greatest(public.tenant_module_entitlements.updated_at, excluded.updated_at);

  delete from public.tenant_module_entitlements where module_key = 'chatbot';

  insert into public.tenant_usage_daily (
    theatre_id,
    date,
    module_key,
    channel,
    conversations,
    messages,
    ai_calls,
    tool_calls,
    input_tokens,
    output_tokens,
    voice_minutes,
    resolutions,
    fallbacks,
    limit_exceeded_events,
    estimated_cost_cents,
    created_at,
    updated_at
  )
  select
    theatre_id,
    date,
    case when module_key = 'chatbot' then 'web' else module_key end,
    case when channel = 'chatbot' then 'web' else channel end,
    sum(conversations),
    sum(messages),
    sum(ai_calls),
    sum(tool_calls),
    sum(input_tokens),
    sum(output_tokens),
    sum(voice_minutes),
    sum(resolutions),
    sum(fallbacks),
    sum(limit_exceeded_events),
    sum(estimated_cost_cents),
    min(created_at),
    max(updated_at)
  from public.tenant_usage_daily
  where module_key = 'chatbot' or channel = 'chatbot'
  group by
    theatre_id,
    date,
    case when module_key = 'chatbot' then 'web' else module_key end,
    case when channel = 'chatbot' then 'web' else channel end
  on conflict (theatre_id, date, module_key, channel) do update
  set conversations = public.tenant_usage_daily.conversations + excluded.conversations,
      messages = public.tenant_usage_daily.messages + excluded.messages,
      ai_calls = public.tenant_usage_daily.ai_calls + excluded.ai_calls,
      tool_calls = public.tenant_usage_daily.tool_calls + excluded.tool_calls,
      input_tokens = public.tenant_usage_daily.input_tokens + excluded.input_tokens,
      output_tokens = public.tenant_usage_daily.output_tokens + excluded.output_tokens,
      voice_minutes = public.tenant_usage_daily.voice_minutes + excluded.voice_minutes,
      resolutions = public.tenant_usage_daily.resolutions + excluded.resolutions,
      fallbacks = public.tenant_usage_daily.fallbacks + excluded.fallbacks,
      limit_exceeded_events = public.tenant_usage_daily.limit_exceeded_events + excluded.limit_exceeded_events,
      estimated_cost_cents = public.tenant_usage_daily.estimated_cost_cents + excluded.estimated_cost_cents,
      created_at = least(public.tenant_usage_daily.created_at, excluded.created_at),
      updated_at = greatest(public.tenant_usage_daily.updated_at, excluded.updated_at);

  delete from public.tenant_usage_daily
  where module_key = 'chatbot' or channel = 'chatbot';

  update public.usage_events
  set module_key = case when module_key = 'chatbot' then 'web' else module_key end,
      channel = case when channel = 'chatbot' then 'web' else channel end
  where module_key = 'chatbot' or channel = 'chatbot';

  select jsonb_build_object(
    'rows', count(*),
    'quantity', coalesce(sum(quantity), 0),
    'input_tokens', coalesce(sum(input_tokens), 0),
    'output_tokens', coalesce(sum(output_tokens), 0),
    'cost_estimate_cents', coalesce(sum(cost_estimate_cents), 0)
  ) into v_usage_after
  from public.usage_events;

  select jsonb_build_object(
    'conversations', coalesce(sum(conversations), 0),
    'messages', coalesce(sum(messages), 0),
    'ai_calls', coalesce(sum(ai_calls), 0),
    'tool_calls', coalesce(sum(tool_calls), 0),
    'input_tokens', coalesce(sum(input_tokens), 0),
    'output_tokens', coalesce(sum(output_tokens), 0),
    'voice_minutes', coalesce(sum(voice_minutes), 0),
    'resolutions', coalesce(sum(resolutions), 0),
    'fallbacks', coalesce(sum(fallbacks), 0),
    'limit_exceeded_events', coalesce(sum(limit_exceeded_events), 0),
    'estimated_cost_cents', coalesce(sum(estimated_cost_cents), 0)
  ) into v_daily_after
  from public.tenant_usage_daily;

  if v_usage_before is distinct from v_usage_after then
    raise exception 'Web usage reconciliation failed: before %, after %', v_usage_before, v_usage_after;
  end if;

  if v_daily_before is distinct from v_daily_after then
    raise exception 'Web daily usage reconciliation failed: before %, after %', v_daily_before, v_daily_after;
  end if;
end;
$$;

alter table public.tenant_modules
  drop constraint tenant_modules_module_key_check;
alter table public.tenant_modules
  add constraint tenant_modules_module_key_check check (
    module_key in ('web', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  );

alter table public.tenant_module_entitlements
  drop constraint tenant_module_entitlements_module_key_check;
alter table public.tenant_module_entitlements
  add constraint tenant_module_entitlements_module_key_check check (
    module_key in ('web', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  );

alter table public.usage_events
  drop constraint usage_events_module_key_check;
alter table public.usage_events
  add constraint usage_events_module_key_check check (
    module_key in ('web', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  );
alter table public.usage_events
  drop constraint usage_events_channel_check;
alter table public.usage_events
  add constraint usage_events_channel_check check (
    channel in ('web', 'email', 'voice', 'instagram', 'whatsapp', 'backstage', 'system')
  );

alter table public.tenant_usage_daily
  drop constraint tenant_usage_daily_module_key_check;
alter table public.tenant_usage_daily
  add constraint tenant_usage_daily_module_key_check check (
    module_key in ('web', 'voice', 'email', 'whatsapp', 'instagram', 'data', 'marketing')
  );
alter table public.tenant_usage_daily
  drop constraint tenant_usage_daily_channel_check;
alter table public.tenant_usage_daily
  add constraint tenant_usage_daily_channel_check check (
    channel in ('web', 'email', 'voice', 'instagram', 'whatsapp', 'backstage', 'system')
  );

drop index if exists public.usage_events_web_assistant_idx;
create index usage_events_web_assistant_idx
  on public.usage_events (theatre_id, occurred_at)
  where channel = 'web'
    and event_type = 'message'
    and metadata->>'role' = 'assistant';

-- Rebuild the final retention RPC from the pre-compatibility implementation,
-- replacing its Web-channel vocabulary, then remove both compatibility helpers.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.apply_data_retention_before_web_channel(boolean)'::regprocedure)
  into v_definition;
  v_definition := replace(v_definition, 'apply_data_retention_before_web_channel', 'apply_data_retention');
  v_definition := replace(v_definition, 'chatbot', 'web');
  execute v_definition;
end;
$$;

revoke all on function public.apply_data_retention(boolean) from public, anon, authenticated;
grant execute on function public.apply_data_retention(boolean) to service_role;

drop function public.apply_data_retention_before_web_channel(boolean);
drop function public.anonymize_chatbot_usage_identifiers(uuid, text);

comment on function public.apply_data_retention(boolean) is
  'Applies TALIA retention policy using web as the canonical website Attention channel.';

notify pgrst, 'reload schema';
