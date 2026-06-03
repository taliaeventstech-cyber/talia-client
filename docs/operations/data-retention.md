# Data retention operations

TALIA applies a product-level retention policy for operational data that may contain personal data.

## Current retention policy

| Data category | Retention | Enforcement target |
| --- | ---: | --- |
| Chatbot conversations and messages | 12 months | `conversations`, cascading `messages` |
| Conversation topic extracts | 12 months | `conversation_topics` |
| Synced email threads/messages | 90 days | `email_threads`, cascading `email_messages` |
| Generated email drafts | 90 days | `email_drafts` |
| Usage events | 12 months | `usage_events` |
| Audit events | 12 months | `audit_events` |
| OAuth tokens | Until disconnect/revocation/account deletion | `email_connections.oauth_metadata` |
| Billing/accounting data | Statutory legal period | Not deleted by retention job |

## Database function

Migration:

```text
supabase/migrations/20260602000000_data_retention.sql
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

The endpoint also accepts `INTERNAL_API_KEY` through:

- `Authorization: Bearer $INTERNAL_API_KEY`
- `x-talia-internal-key: $INTERNAL_API_KEY`

## Recommended schedule

Run daily, outside peak hours.

Recommended n8n setup:

1. Schedule Trigger: daily at 03:00 Europe/Madrid.
2. HTTP Request:
   - Method: `GET`
   - URL: `https://agora.talia.events/api/cron/data-retention?dryRun=false`
   - Header: `Authorization: Bearer {{ CRON_SECRET }}`
3. Optional notification step if `affectedRows` is unusually high.

## Pre-production checklist

- [ ] Apply migration in Supabase.
- [ ] Run dry run in production.
- [ ] Review affected row counts.
- [ ] Run one manual real deletion.
- [ ] Check dashboard pages still load.
- [ ] Configure n8n daily schedule.
- [ ] Keep retention wording in the public privacy policy aligned with this document.

## Notes

- Deleting `conversations` cascades to `messages`.
- Deleting `email_threads` cascades to `email_messages` and remaining `email_drafts`.
- Recent drafts prevent their parent email thread from being deleted until the draft is also outside its retention window.
- Billing, subscriptions, accounts, users, memberships, and invoices are intentionally excluded from this retention job.
