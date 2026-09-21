-- Replace the retired public plan identifiers while preserving existing access.
-- The Stripe subscription itself is not modified here; production Price IDs are
-- configured through the new environment variables before a plan is changed.
update public.accounts
set metadata = jsonb_set(
  metadata,
  '{commercial_plan}',
  to_jsonb(
    case metadata ->> 'commercial_plan'
      when 'chatbot_email' then 'premium'
      else 'basic'
    end
  ),
  true
)
where metadata ->> 'commercial_plan' in ('chatbot_web', 'chatbot_email', 'email_agent');
