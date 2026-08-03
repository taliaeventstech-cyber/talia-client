# Managed Web Knowledge Canary

## What Canary Means Here

A canary is a production execution with deliberately limited blast radius. For
managed web knowledge, start with one venue and one source, observe it, and only
then activate more sources. It is not a second environment and it is not a
global on/off variable.

The authoritative control is `knowledge_sources.sync_enabled`. Backstage can
pause or reactivate each managed source. A paused source is excluded from
scheduled claims and queued runs are cancelled. A run that is already executing
is allowed to finish so the worker cannot leave a partial write. Existing
documents and chunks are never deleted by pausing.

## Before Starting

1. Apply the `talia-client` migrations through:
   `20260715030000_knowledge_web_operational_alerts.sql`.
2. Deploy the matching `talia-client` and `talia-ai` revisions.
3. Keep Browserless variables unset for the first canary. The active fallback is
   HTTP followed by the installed widget.
4. Keep the Fly `cron` process at one replica.
5. Choose a venue whose website and expected content you know well.
6. Start with one `url` source. Do not begin with a complete-site crawl.

The sync-control migration pauses managed sources that already exist. Sources
created manually in Knowledge also remain paused until a platform operator
activates them in Backstage. The initial chatbot onboarding is the deliberate
exception: its verified official-website source is activated and queued
automatically after the production canary passed. Before a manual canary,
confirm every source outside that onboarding path except the selected one shows
**Sync pausada**.

Paused sources do not create an initial queued run. Reactivating them makes
`next_sync_at` immediately eligible, and the worker creates and claims the
scheduled run in its next cycle. This keeps “paused” distinct from “queued”.

## First Canary Run

1. In Agora, configure the selected source with manual refresh frequency.
2. In Backstage, open the venue and locate **Fuentes procesadas**.
3. Confirm the source shows **Sync activa**. Use **Reactivar sync** if needed.
4. Press **Actualizar fuente** once.
5. Wait for the next worker interval, currently at most five minutes.
6. Refresh Backstage and inspect the latest run:
   - terminal status;
   - discovered and checked pages;
   - changed and unchanged pages;
   - blocked or failed pages;
   - exact `error_code` when present;
   - document and chunk counts.
7. Ask the deployed chatbot two or three questions whose answer exists only on
   that page. Confirm the response uses the expected source in its trace.

Optional database verification:

```sql
select id, name, sync_enabled, status, last_synced_at, next_sync_at, last_error
from public.knowledge_sources
where id = '<source-id>';

select status, trigger, discovered_count, checked_count, changed_count,
       unchanged_count, failed_count, blocked_count, error_code, created_at,
       finished_at
from public.knowledge_sync_runs
where source_id = '<source-id>'
order by created_at desc
limit 5;
```

## Pass Or Stop

The first run passes when all of these are true:

- the run reaches `succeeded`, or `partial` with every incidence understood;
- discovered and checked counts match the expected scope;
- no private, account, checkout or external-domain URL was captured;
- ready documents have active chunks and ready embeddings;
- unchanged reruns do not replace chunks;
- chatbot answers cite the expected knowledge;
- Backstage has no unexplained critical alert.

Pause the canary immediately when any of these occurs:

- repeated `failed` runs;
- unexpected URLs or an unexpectedly large crawl;
- tenant/source quota reached unexpectedly;
- valid chunks disappear after a failed capture;
- another tenant's source or content appears in the trace;
- load, provider cost or domain traffic is materially above the configured
  bounds.

## Observe And Expand

After the first successful run:

1. Run the same single URL a second time and confirm it is unchanged.
2. Keep only that source active for 24 hours.
3. Change it to daily refresh and verify one scheduled execution.
4. Add one sitemap source with a low page limit.
5. Add one bounded website source only after URL and sitemap behavior is stable.
6. Expand to another venue after 24 hours without critical alerts.

Increase one dimension at a time: source type, page count, venue count or
schedule frequency. Do not increase several dimensions in the same step.

## Rollback

Normal rollback:

1. Press **Pausar sync** in Backstage.
2. Confirm the source shows **Sync pausada**.
3. Confirm queued runs changed to `cancelled` with `operator_paused`.
4. Leave the source and chunks in place while investigating.

If the problem affects every source, scale the Fly `cron` process to zero as an
emergency stop. This is a platform-wide action and should not replace the normal
per-source control. Re-enable the cron only after affected sources are paused or
the defect is fixed.

Do not delete the source as a rollback mechanism: deletion removes its managed
documents and chunks, while pausing preserves the last known-good knowledge.
