# Data retention operations

TALIA applies a product-level retention policy for operational data that may contain personal data.

## Current retention policy

| Data category | Retention | Enforcement target |
| --- | ---: | --- |
| Chatbot conversations and messages | 90 days after last activity | `conversations`, cascading `messages` |
| Conversation topic extracts | 90 days | `conversation_topics` |
| Synced email threads/messages | 90 days | `email_threads`, cascading `email_messages` |
| Generated email drafts | 90 days | `email_drafts` |
| Usage events | 12 months; chatbot conversation identifiers removed after 90 days | `usage_events` |
| Measured AI usage | 12 months; chatbot conversation identifiers removed after 90 days | `ai_usage_events` |
| Daily aggregate usage | 12 months | `tenant_usage_daily` |
| Audit events | 12 months | `audit_events` |
| OAuth tokens | Until disconnect/revocation/account deletion | `email_connections.oauth_metadata` |
| Billing/accounting data | Statutory legal period | Not deleted by retention job |

## Database function

Migration:

```text
supabase/migrations/20260802170000_chatbot_content_retention_90_days.sql
```

Function:

```sql
select * from public.apply_data_retention(true);
```

`true` means dry run. It returns row counts without deleting data.

To apply deletion:

```sql
select * from public.apply_data_retention(false);
```

## Cron endpoint

Endpoint:

```text
GET /api/cron/data-retention
```

Dry run is the default:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://agora.talia.events/api/cron/data-retention"
```

Real deletion requires `dryRun=false`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://agora.talia.events/api/cron/data-retention?dryRun=false"
```

The endpoint accepts only the dedicated `CRON_SECRET` bearer credential. This
keeps a destructive retention operation isolated from general internal-service
credentials. The endpoint fails closed in local, preview and production
environments when no valid cron secret is configured.

## Production schedule

Vercel Cron invokes the production endpoint daily at **03:00 UTC**:

```json
{
  "path": "/api/cron/data-retention?dryRun=false",
  "schedule": "0 3 * * *"
}
```

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. Cron jobs run
only against production deployments. The schedule becomes active after the
deployment containing `vercel.json` is promoted to production. No n8n workflow
is required for the retention policy.

## Pre-production checklist

- [ ] Apply migration in Supabase.
- [ ] Run dry run in production.
- [ ] Review affected row counts.
- [ ] Run one manual real deletion.
- [ ] Check dashboard pages still load.
- [ ] Confirm the Vercel production deployment registers the daily cron.
- [ ] Capture one sanitized successful execution from Vercel logs.
- [ ] Keep retention wording in the public privacy policy aligned with this document.

## Notes

- Deleting `conversations` cascades to `messages`.
- Venue owners and administrators can manually delete individual Web, WhatsApp and Instagram conversations from Àgora. The automatic 90-day retention job currently covers Web conversation content.
- Manual conversation deletion removes the conversation content and its topic extracts, and immediately removes its identifiers from retained usage records. The usage and billing quantities remain, so deletion never resets consumption already recorded for a billing period.
- After 90 days, session and message identifiers are removed from retained chatbot usage records. Counts, roles, tokens and costs remain available for billing and aggregate reporting.
- Deleting `email_threads` cascades to `email_messages` and remaining `email_drafts`.
- Recent drafts prevent their parent email thread from being deleted until the draft is also outside its retention window.
- Billing, subscriptions, accounts, users, memberships, and invoices are intentionally excluded from this retention job.
