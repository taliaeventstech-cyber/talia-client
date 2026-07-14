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

## Deployment Order

1. Apply the database migrations before deploying the Agora UI.
2. Deploy `talia-ai` support for claim/finish and single-URL capture.
3. Enable sitemap discovery.
4. Add bounded website crawling and rendered-browser fallback.
5. Add Backstage retry/inspection and production alerts.
