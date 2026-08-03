create or replace function public.apply_chat_message_top_up(
  p_subscription_id uuid,
  p_checkout_session_id text,
  p_messages integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if p_checkout_session_id is null or length(trim(p_checkout_session_id)) = 0 or p_messages <= 0 then
    raise exception 'Invalid message top-up';
  end if;

  update public.tenant_subscriptions
  set
    included_chat_conversations = included_chat_conversations + p_messages,
    metadata = jsonb_set(
      metadata,
      '{message_top_up_checkout_sessions}',
      coalesce(metadata->'message_top_up_checkout_sessions', '[]'::jsonb) || to_jsonb(p_checkout_session_id),
      true
    ),
    updated_at = now()
  where id = p_subscription_id
    and not (coalesce(metadata->'message_top_up_checkout_sessions', '[]'::jsonb) ? p_checkout_session_id);

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.apply_chat_message_top_up(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.apply_chat_message_top_up(uuid, text, integer) to service_role;

notify pgrst, 'reload schema';
