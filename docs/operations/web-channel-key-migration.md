# Web Attention channel-key migration

TAL-60 replaces the legacy persisted module and channel value `chatbot` with
the canonical Attention value `web`. The commercial plan identifier
`chatbot_web`, chatbot UI terminology, routes, permissions and widget names are
not persistence keys and remain unchanged.

## Phase 1: compatibility deployment

Migration `20260811100000_web_attention_channel_compatibility.sql` allows both
values in database constraints. The corresponding application deployment:

- writes `web` for new module, entitlement and usage records;
- reads both `web` and `chatbot` for billing and operational aggregates;
- normalizes legacy tenant-module rows to `web` at the authorization boundary;
- keeps legacy retention RPC behavior available for rollback compatibility.

Apply the database migration before deploying the application. An older
application remains able to write `chatbot`, while the new application can write
`web`, so either version is safe during a rollback.

## Production checks

After deploying, verify:

```sql
select channel, module_key, count(*)
from public.usage_events
where occurred_at >= now() - interval '1 hour'
group by channel, module_key
order by channel, module_key;

select module_key, status, count(*)
from public.tenant_modules
group by module_key, status
order by module_key, status;

select * from public.apply_data_retention(true);
```

Confirm that new website interactions create `web`/`web` usage, billing totals
include legacy and canonical rows, venue access still works for tenants with only
a `chatbot` row, and the retention dry run reports
`web_usage_identifiers_anonymized`.

## Phase 2: cleanup after the rollback window

Do not ship cleanup in the compatibility deployment. Once the production
version is stable and rollback to a legacy writer is no longer required:

1. Merge duplicate `tenant_modules` and `tenant_module_entitlements` rows,
   preserving the effective status, configuration, limits and metadata.
2. Merge colliding `tenant_usage_daily` rows before changing their keys because
   `(theatre_id, date, module_key, channel)` is unique.
3. Update historical `usage_events` and remaining module rows from `chatbot` to
   `web`.
4. Remove `chatbot` from database constraints, application dual reads and the
   compatibility retention RPC.
5. Re-run billing, access and retention checks before closing TAL-60.
