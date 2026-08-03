-- Align existing TALIA trials created under the previous 14-day policy with
-- the current 15-day commercial offer. Explicitly customized trials are not
-- changed: only metadata generated with trial_days = 14 is migrated.
update public.accounts
set
  metadata = jsonb_set(
    jsonb_set(metadata, '{trial_days}', '15'::jsonb, true),
    '{trial_ends_at}',
    to_jsonb(
      case
        when coalesce(metadata ->> 'trial_ends_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
          then (metadata ->> 'trial_ends_at')::timestamptz + interval '1 day'
        else created_at + interval '15 days'
      end
    ),
    true
  ),
  updated_at = now()
where status = 'trialing'
  and metadata ->> 'trial_days' = '14';
