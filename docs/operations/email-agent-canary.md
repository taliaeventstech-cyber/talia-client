# Email Agent Operations

This runbook validates and operates the Gmail email agent after classification,
drafting and scheduling have moved away from n8n.

## Preconditions

- `TALIA_AI_BASE_URL` and `TALIA_AI_INTERNAL_API_KEY` are configured in Vercel.
- `CRON_SECRET` is configured in Vercel and is at least 32 random characters.
- `INTERNAL_API_KEY` is configured anywhere internal email endpoints are used and
  is at least 32 random characters. Internal and cron routes fail closed in
  every environment, including local development and previews.
- Migration `20260718090000_email_sync_scheduler.sql` has been applied.
- The production Vercel plan permits cron jobs every 15 minutes.
- The mailbox is connected and uses supervised drafts. TALIA never sends email
  automatically.

## Managed schedule

`vercel.json` registers `GET /api/cron/email/sync` every 15 minutes. Vercel adds
`Authorization: Bearer <CRON_SECRET>` automatically. The route rejects requests
without a valid server credential.

Each invocation:

1. claims a global Postgres lease;
2. identifies due polling connections;
3. synchronizes new provider message IDs idempotently;
4. classifies eligible messages and optionally creates supervised drafts;
5. completes a durable `email_sync_runs` record;
6. emits structured logs without bodies, senders, OAuth tokens or secrets.

Vercel can deliver the same cron event more than once and does not retry failed
invocations. The database lease prevents overlap. Message and thread unique
constraints make repeated provider reads idempotent. A failed mailbox remains
eligible for two more runs; after three consecutive failures it stays in
`email_connections.status = error` for manual intervention.

## Verification

After deployment:

1. Open the Vercel project, then `Settings > Cron Jobs`.
2. Confirm `/api/cron/email/sync` is enabled with schedule `*/15 * * * *`.
3. Open runtime logs filtered by `requestPath:/api/cron/email/sync`.
4. Confirm `email_sync_started` and `email_sync_completed` share a `run_id`.
5. Query recent durable runs:

```sql
select
  id,
  status,
  started_at,
  completed_at,
  checked_count,
  synced_count,
  failed_count,
  imported_count,
  processed_count,
  error_code
from public.email_sync_runs
order by created_at desc
limit 25;
```

6. Verify an actionable inbound email produces classifier and drafter traces
   with provider `talia-ai` and creates only a draft.
7. Verify no email request reaches an n8n webhook.

## Pause and resume

- Pause all scheduled invocations from `Settings > Cron Jobs > Disable Cron
  Jobs` in Vercel.
- Pause one mailbox by disabling automatic sync in Backstage, which writes
  `cron_enabled = false` to its connection metadata.
- Resume by reversing the relevant setting. Do not invoke the route repeatedly
  while a run is active; the lease will reject the overlap with `202`.

## Recovery

- `401`: verify `CRON_SECRET` exists in the Production environment and redeploy.
- `email_sync_claim_failed`: apply the migration and verify PostgREST has
  reloaded the schema.
- `run_already_active`: inspect the latest `running` row. It expires after ten
  minutes and the next claim marks it failed with `lease_expired`.
- Connection in `error`: inspect its sanitized `error_message`, repair OAuth or
  provider access, and reconnect or set it back to a connected state.
- TALIA AI error: inspect the classifier/drafter trace and the `talia-ai` Fly
  logs. There is no n8n fallback.

## Final n8n shutdown

Code adapters, provider selectors, webhook metadata and repository blueprints
are removed by TAL-34. After observing at least one complete operating window:

1. disable the external n8n email workflows without deleting them;
2. verify scheduled sync, classification and drafting continue normally;
3. export the workflow names, disable time and verification evidence for audit;
4. revoke email workflow credentials and webhook secrets in n8n;
5. delete the external email workflows;
6. record the evidence in TAL-34 before closing it.

Microsoft/Outlook validation remains outside this cut.
