# Managed Web Knowledge Sync

## Ownership

`talia-client` owns the persistence model, tenant configuration, refresh policy,
Agora/Backstage state, and service-role database contract.

`talia-ai` owns the scheduled worker, URL discovery, safe fetching, rendered
capture, extraction, change detection, chunking, and embeddings.

The installed widget remains a first-party capture fallback for public pages
that cannot be read reliably by the worker.

## Source Model

Managed source types:

- `url`: one page;
- `sitemap`: XML sitemap discovery;
- `website`: bounded same-site discovery.

Refresh intervals:

- `manual`;
- `daily`;
- `weekly`;
- `monthly`.

Tables:

- `knowledge_sources`: logical connector and schedule;
- `knowledge_documents`: canonical pages and fetch/change metadata;
- `knowledge_sync_runs`: queue, lease, counters, and terminal result;
- `knowledge_chunks`: RAG fragments, optionally linked to a document.

## Worker Loop

1. Claim a bounded batch with a stable worker identifier:

```sql
select *
from public.claim_due_knowledge_sync_runs(
  'fly-worker-eu-1',
  10,
  300
);
```

2. For each claimed run:

- load the source and tenant-authorized domain;
- discover canonical URLs according to the source type;
- upsert `knowledge_documents` by `(source_id, canonical_url)`;
- fetch with ETag/Last-Modified when available;
- record `capture_method`;
- compare normalized `content_hash`;
- preserve chunks for unchanged documents;
- atomically replace chunks and embeddings only for changed documents;
- mark repeatedly missing documents as removed only after a grace policy.

Long runs must renew their lease before it expires:

```sql
select public.renew_knowledge_sync_run_lease(
  'run-uuid',
  'fly-worker-eu-1',
  300
);
```

3. Finish the run with counters and a bounded error:

```sql
select public.finish_knowledge_sync_run(
  'run-uuid',
  'fly-worker-eu-1',
  'succeeded',
  42,
  42,
  3,
  39,
  0,
  0,
  1,
  null,
  null
);
```

Terminal statuses are `succeeded`, `partial`, `failed`, and `cancelled`.
Repeating a terminal callback returns the existing result, making completion
idempotent.

## Capture Waterfall

1. HTTP with redirect validation, content limits, timeouts, and conditional headers.
2. Rendered browser for public JavaScript-heavy content.
3. Installed-widget or explicit manual browser capture for blocked public pages.
4. CMS/provider API where available.

Do not bypass CAPTCHA, login, paywalls, explicit access controls, robots rules,
or provider terms. Resolve DNS and reject private, loopback, link-local, metadata,
and redirect-to-private targets on every network hop.

## Scheduling And Scale

- Run the scheduler frequently; `next_sync_at` decides eligibility.
- Add jitter in the worker so many daily sources do not hit one domain together.
- Enforce tenant page quotas and per-domain concurrency.
- Use `FOR UPDATE SKIP LOCKED` leases; expired work can be reclaimed.
- Keep errors bounded and do not store page bodies in sync-run metadata.
- A failed page can make the run `partial`; it must not erase previously valid chunks.
- Unchanged content must not consume chunking or embedding work.

Every network attempt must claim a short domain lease through
`claim_knowledge_domain_fetch_lease`. The lease is global across worker replicas,
limits simultaneous requests to one hostname, and enforces a minimum interval
between starts. Workers release it in a `finally` block; abandoned leases expire
automatically so a crashed worker cannot block a domain indefinitely.

Transient network failures, HTTP 408/425/429 and HTTP 5xx responses may be
retried with bounded exponential backoff. `Retry-After` takes precedence when it
fits inside the configured retry window. Authentication failures, CAPTCHA,
robots exclusions and other explicit blocks are never retried or bypassed.

## Universal Tenant Quotas

Managed web ingestion initially uses the same conservative quota for every
plan:

- 10 managed web sources;
- 500 active managed documents per tenant;
- 100 active documents per source;
- 10 manual refresh requests per UTC day.

The database enforces these limits atomically with tenant-scoped advisory locks.
Agora performs the same checks only to provide immediate feedback. Values live
under the `data` module entitlement (`tenant_module_entitlements.limits`), so a
future plan policy can override them without changing the worker contract.

Scheduled refreshes do not consume the manual-refresh allowance. Quota errors
are persisted in `knowledge_sync_runs.error_code` and remain visible in
Backstage; previously valid chunks are not deleted.

## Operational Alerts

Backstage derives active alerts from source state, terminal sync runs and quota
usage through `get_knowledge_web_operational_alerts`. The aggregation runs in
Postgres so the UI does not load unbounded sync history or calculate tenant
health in application memory.

Initial thresholds:

- warning after 2 consecutive `partial` or `failed` runs;
- critical after 3 consecutive runs when the latest run is `failed`;
- warning when a scheduled source is at least 6 hours overdue and has no queued
  or running sync;
- critical when that delay reaches 24 hours;
- warning at 80% of the tenant source, per-source page, tenant document or
  daily manual-sync quota;
- critical at 100% of a quota.

A `succeeded` or `cancelled` terminal run closes the previous incident streak.
Alerts are derived rather than persisted: they disappear automatically when a
healthy run completes, the source catches up or UTC daily usage resets. The
global Backstage view links to the affected venue and, for source incidents, to
the exact source row. External notifications and acknowledgement history are
not part of this cut.

## Canary And Rollback

Managed sources have an authoritative `sync_enabled` control. Backstage can
pause or reactivate one source without changing every tenant. Pausing cancels
queued runs, prevents future claims and preserves current documents and chunks;
an already-running job is allowed to finish safely.

Follow the UI-first procedure, pass criteria and rollback steps in
[knowledge-web-canary.md](knowledge-web-canary.md). Browserless remains disabled
for the initial HTTP plus installed-widget canary.

## Deployment Order

1. Apply the database migrations before deploying the Agora or Backstage UI.
2. Deploy `talia-ai` support for claim/finish and single-URL capture.
3. Enable sitemap discovery.
4. Add bounded website crawling and rendered-browser fallback.
5. Run the single-source canary before expanding source types or venues.
