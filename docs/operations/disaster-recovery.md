# Backup and disaster recovery

Owner: TALIA engineering and security  
Exercise cadence: quarterly for database restore; semiannual full service drill

## Recovery boundary

| Component | State | Recovery mechanism | Verification required |
| --- | --- | --- | --- |
| `talia-client` / Vercel | Stateless application build and environment configuration | Roll back to an immutable known-good deployment or rebuild from Git | Verify plan supports required rollback history and export an environment-variable inventory without values |
| `talia-ai` / Fly.io | Stateless application image; no Fly volume is configured | Deploy the last known-good image/commit from Git | Record image digest, region and health-check result |
| Supabase Postgres/Auth | Primary customer, conversation, knowledge and encrypted OAuth state | Supabase daily backup or PITR, depending on contracted plan | Verify plan, retention window, latest restore point and restore permissions |
| Supabase Storage | Uploaded objects; not included in database backups | Separate object inventory/export and controlled re-ingestion | Verify which buckets contain irreplaceable objects and implement off-site copy if required |
| Gmail | Authoritative source for mailbox messages and provider drafts | Reconnect and resynchronize within granted scope | Never treat Gmail as a backup of TALIA metadata or audit history |
| Secrets/configuration | Vercel/Fly/Supabase/Google settings | Recreate from restricted inventory and rotate after compromise | Never export secret values into evidence |

## Recovery objectives

Until a measured restore exercise supersedes them, launch targets are:

- application RTO: 4 hours for Agora/widget and 8 hours for supervised Email;
- database RPO: 24 hours with verified daily backups;
- database RPO with enabled PITR: use the latest recovery point shown by
  Supabase and record the measured value;
- configuration RPO: every production change must be reflected immediately in
  the restricted inventory or source-controlled non-secret configuration.

These are internal targets, not contractual guarantees. If the active Supabase
plan does not provide daily backups, production launch is blocked until an
equivalent encrypted off-site backup is scheduled and tested.

## Preflight verification

1. In Supabase `Database > Backups`, record the plan, backup type, retention
   window, latest successful recovery point and users authorized to restore.
2. Confirm whether PITR is enabled. Do not claim PITR based only on plan
   eligibility.
3. Inventory Supabase Storage buckets and classify each object as reproducible
   or requiring separate backup.
4. Confirm Vercel rollback eligibility and identify the last known-good
   production deployment.
5. Record the current `talia-ai` Fly image digest and verify `/health`.
6. Confirm that at least two founders can access the required provider consoles
   with individual accounts and MFA.

## Quarterly database restore exercise

Never overwrite production merely to prove restoration.

1. Select a backup before a controlled marker record.
2. Restore or duplicate it into an isolated recovery project approved for the
   exercise.
3. Reapply missing secret/role configuration documented by Supabase; daily
   backups may not contain custom-role passwords.
4. Validate schema migrations, row counts, tenant isolation, Auth linkage,
   encrypted OAuth metadata shape and retention functions without using the
   restored OAuth tokens against Google.
5. Verify Storage objects separately because database restore covers metadata,
   not deleted Storage objects.
6. Destroy the recovery project and all temporary exports after evidence has
   been sanitized and approved.
7. Record measured RPO, RTO, failures, owners and corrective deadlines.

## Production recovery sequence

1. Incident Commander declares recovery mode and freezes writes/deployments.
2. Determine whether the failure is application-only, database corruption,
   credential compromise or provider outage.
3. For application-only failure, roll back Vercel/Fly without restoring data.
4. For database corruption, select the closest known-good recovery point and
   communicate expected downtime/data loss before restore.
5. Rotate credentials if confidentiality, not only availability, was affected.
6. After restore, verify migrations, RLS, tenant constraints, schedulers,
   retention, login, widget chat and a controlled Email flow.
7. Re-enable writes and schedulers gradually, then monitor for 24 hours.

## Evidence checklist

- [ ] Supabase plan and backup/PITR screenshot, with project identifiers but no secrets.
- [ ] Storage bucket inventory and independent-backup decision.
- [ ] Vercel rollback test and deployment IDs.
- [ ] Fly redeploy test, image digest and `/health` result.
- [ ] Isolated database restore timestamps and measured RPO/RTO.
- [ ] Tenant-isolation and application smoke-test results after restore.
- [ ] Corrective actions closed or tracked with owners and dates.

## Provider references

- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Vercel rollback: https://vercel.com/docs/deployments/rollback-production-deployment
- Fly.io availability and recovery: https://fly.io/docs/apps/app-availability/
