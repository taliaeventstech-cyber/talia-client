# Marketing module

Last updated: October 10, 2026

This is the engineering onboarding document for TALIA Marketing. Read it before
changing the Marketing product surface, Meta integration, data model or
reporting semantics. Provider setup and production troubleshooting live in
[`../operations/meta-marketing-api-development.md`](../operations/meta-marketing-api-development.md).

## Product purpose

Marketing turns advertising data into a clear operational reading for a cultural
venue. The first version should answer three questions without requiring the
operator to understand Meta Ads Manager:

1. **What happened?** Account-level spend, delivery and response.
2. **What works?** Which campaign currently produces the strongest useful
   signal.
3. **What should be reviewed?** Basic warnings such as spend without link
   clicks or high frequency.

The module is not part of the Attention channel system. Its Meta credentials,
permissions, provider data and lifecycle remain separate from Instagram Direct
and WhatsApp.

## MVP boundaries

Implemented:

- venue-scoped Meta OAuth connection;
- supervised Business Portfolio and ad-account selection;
- manual, read-only synchronization;
- account totals for Meta's `last_7d`, `last_30d` and `last_90d` periods;
- daily account-level time series using `time_increment=1`;
- campaign status and aggregate performance for the same period;
- a compact daily chart for spend, link clicks and CTR;
- plain-language interpretation and explicit empty/error states;
- supervised creation of a top-level campaign container for traffic,
  engagement or awareness, always in `PAUSED`;
- supervised traffic ad-set creation with daily budget, UTC schedule and basic
  country/age targeting, always in `PAUSED`.

Not implemented:

- scheduled synchronization;
- custom date ranges;
- engagement/awareness ad sets, creative or ad creation;
- lifetime budgets, manual placements, detailed audience interests, destination
  or special-ad-category flows;
- conversion attribution, purchases, revenue or ROAS;
- automated recommendations or automatic budget changes;
- cross-venue or account-level aggregation.

Hard guardrail: every object created through TALIA starts in `PAUSED`. Current
writes call `/{act_id}/campaigns` and `/{act_id}/adsets`; status, billing event,
optimization goal and bid strategy are server-owned. No current path creates an
ad, publishes an object, changes status to `ACTIVE` or activates spend.

## Access and tenancy

- Product key: `marketing`.
- Required capability: `manage_marketing`.
- Current UI route: `/(dashboard)/[tenantId]/marketing`.
- A connection belongs to exactly one venue (`theatre_id`).
- One selected Meta ad account is active per venue connection.
- Server actions and RPCs authorize the acting user again; rendering the route
  is not treated as sufficient authorization.
- Provider tokens and raw provider identifiers that are not required by the UI
  stay server-side.

## End-to-end flow

```text
Agora operator
  -> signed OAuth state
  -> Meta authorization
  -> encrypted, short-lived asset-selection session
  -> Business Portfolio + ad-account confirmation
  -> encrypted venue connection
  -> manual "Refresh from Meta"
  -> server-side Marketing API reads
  -> validation and atomic snapshot replacement
  -> server-rendered dashboard
  -> isolated client chart

Supervised creation
  -> operator enters name + supported objective
  -> explicit declaration that no special ad category applies
  -> authorized, rollout-gated idempotency claim
  -> server-side Meta campaign POST forced to PAUSED
  -> durable completion + audit event
  -> operator reviews the object in Ads Manager

Traffic ad-set creation
  -> select an authorized OUTCOME_TRAFFIC campaign
  -> enter account-currency daily budget + local schedule + countries/age
  -> convert schedule to UTC and budget to the currency's minor unit
  -> authorized, rollout-gated idempotency claim
  -> server derives LINK_CLICKS / IMPRESSIONS / LOWEST_COST_WITHOUT_CAP
  -> Meta ad-set POST forced to PAUSED with automatic placements
  -> durable completion + audit event
```

OAuth state is short-lived and signed. The asset-selection session is encrypted.
Stored access tokens are encrypted with AES-256-GCM metadata and are decrypted
only immediately before a server-side provider request.

## Provider reads

One manual synchronization requests four logical datasets from the selected ad
account for one validated period (`last_7d`, `last_30d` or `last_90d`):

| Dataset | Meta edge | Level | Period/granularity | Purpose |
| --- | --- | --- | --- | --- |
| Campaign catalogue | `/{act_id}/campaigns` | campaign | current objects | Names, status and lifecycle |
| Account totals | `/{act_id}/insights` | account | selected preset | Canonical KPI cards |
| Daily account trend | `/{act_id}/insights` | account | selected preset, `time_increment=1` | Time-series chart |
| Campaign performance | `/{act_id}/insights` | campaign | selected preset | Campaign comparison table |

Requests use the `Authorization: Bearer` header. Tokens are removed from Meta
pagination URLs before they are followed. Fetches use `cache: no-store`, a
bounded timeout, a five-page ceiling and a 500-campaign ceiling.

## Metrics and semantic rules

| UI metric | Meta field | Interpretation |
| --- | --- | --- |
| Spend | `spend` | Amount spent in the ad account currency |
| Reach | `reach` | Unique people/accounts reached for the requested level and period |
| Impressions | `impressions` | Number of ad deliveries |
| Link clicks | `inline_link_clicks` | Link-click response used by this MVP |
| CTR | `ctr` | Meta-provided percentage; stored and displayed as a percentage value |
| CPC | `cpc` | Meta-provided cost per click; nullable when no valid denominator exists |
| Frequency | `frequency` | Average impressions per reached person/account |

Account totals are fetched directly from Meta and are not calculated by summing
campaign rows. Reach is non-additive across campaigns, and therefore derived
frequency would also be wrong. Daily rows are likewise fetched at account level;
they are for trend visualization, not a replacement for the canonical account
total for the selected period. When Meta omits an inactive date between the
reported period bounds, TALIA inserts a zero-valued daily point so the category
axis preserves calendar spacing instead of visually compressing inactive days.

ROAS, sales and conversions must remain absent until TALIA has a documented,
validated attribution source. Do not infer revenue from clicks.

## Persistence model

The foundational connection is stored in `meta_marketing_connections`.
Read-only reporting adds two backend-only snapshot tables:

- `meta_marketing_campaign_snapshots`: current campaign catalogue joined with
  aggregate campaign Insights, keyed by connection and period;
- `meta_marketing_daily_insights`: account-level daily rows for the current
  snapshot, keyed by connection and period.

Canonical account totals and synchronization state live under
`meta_marketing_connections.metadata.marketing_sync_periods.<period>`. This
retains independent 7-, 30- and 90-day snapshots and avoids pretending that
additive campaign values produce valid account reach or frequency. The period
migration moves the pre-existing `marketing_sync` payload to
`marketing_sync_periods.last_30d`.

The replacement RPC validates all three payloads and replaces campaign and daily
rows in one database transaction. A failed provider read or invalid payload
does not partially replace the previous successful snapshot. When the selected
ad account changes, the previous snapshot and sync metadata are cleared.

Both snapshot tables have RLS enabled and no direct grants for `anon` or
`authenticated`. Only service-role RPC paths may read or mutate them after
authorization. Successful refreshes emit `marketing.meta_snapshot_synced` audit
events without credentials or campaign contents.

Campaign creation uses the backend-only
`meta_marketing_campaign_creation_requests` table. A client-generated UUID is
claimed before the provider call. Replaying a completed UUID returns the saved
provider campaign ID without another Meta request; a processing UUID is never
replayed. Provider failures retain only a bounded error code. If Meta accepts a
campaign but local completion fails, the request deliberately remains
`processing` so an automatic retry cannot duplicate the provider object.
Successful and failed attempts emit `marketing.meta_campaign_created` and
`marketing.meta_campaign_create_failed` audit events without tokens or raw
provider responses.

Traffic ad sets follow the same pattern through
`meta_marketing_ad_set_creation_requests`. Eligibility is re-derived in the
claim RPC from the current connection's campaign snapshot or a completed TALIA
campaign request; a client-supplied campaign ID alone is never authoritative.
The connection currency is rechecked during the claim to prevent an account
change from reinterpreting the submitted budget. Only countries and age range
are accepted as targeting; no PII, customer lists, interests or manual
placements enter this slice.

Migrations, in deployment order:

- `supabase/migrations/20261006100000_meta_marketing_campaign_insights.sql`
- `supabase/migrations/20261006110000_meta_marketing_daily_insights.sql`
- `supabase/migrations/20261007150000_meta_marketing_period_snapshots.sql`
- `supabase/migrations/20261007193000_meta_marketing_paused_campaign_creation.sql`
- `supabase/migrations/20261010120000_meta_marketing_paused_traffic_ad_sets.sql`

Migration files are append-only after they reach any shared environment. Do not
extend an already-recorded timestamp with new tables or RPC signatures: create
a later migration and keep the historical file aligned with what was actually
applied. The dashboard schema accepts a missing `daily_insights` key as an empty
series during a rolling deployment, while the newer migration upgrades the
write RPC and persistence contract atomically.

## UI composition

The page remains a Server Component. It loads the authorized connection and
snapshot, formats the plain-language reading and passes serializable daily and
campaign rows to narrow Client Components that own Recharts and their filters.

Main source map:

| Responsibility | File |
| --- | --- |
| Marketing page and semantic reading | `src/app/(dashboard)/[tenantId]/marketing/page.tsx` |
| Reporting period selector | `src/app/(dashboard)/[tenantId]/marketing/marketing-period-selector.tsx` |
| Interactive daily chart | `src/app/(dashboard)/[tenantId]/marketing/marketing-trend-chart.tsx` |
| Campaign comparison, status filter and exact table | `src/app/(dashboard)/[tenantId]/marketing/marketing-campaign-comparison.tsx` |
| Manual refresh action | `src/app/(dashboard)/[tenantId]/marketing/sync-actions.ts` |
| Supervised campaign form/action | `src/app/(dashboard)/[tenantId]/marketing/marketing-campaign-create-form.tsx` and `campaign-create-actions.ts` |
| Campaign write orchestration and Meta POST | `src/lib/marketing/campaign-creation-service.ts` |
| Traffic ad-set form/action | `src/app/(dashboard)/[tenantId]/marketing/marketing-ad-set-create-form.tsx` and `ad-set-create-actions.ts` |
| Traffic ad-set orchestration and Meta POST | `src/lib/marketing/ad-set-creation-service.ts` |
| Meta provider reads and validation | `src/lib/marketing/insights-service.ts` |
| Sync orchestration and error classification | `src/lib/marketing/sync-service.ts` |
| Authorized persistence RPC adapter | `src/lib/marketing/connection-service.ts` |
| Shared runtime schemas | `src/types/marketing.ts` |
| Localized product copy | `src/lib/i18n/marketing-copy.ts` |
| Marketing presentation styles | `src/app/globals.css` |

The chart intentionally exposes one metric at a time. Spend, link clicks and CTR
have different units, so overlaying them or using an unlabeled dual axis would
make comparisons harder. KPI cards remain the source for exact period totals;
the chart shows shape and timing. A screen-reader-only table exposes the same
daily values without relying on SVG interpretation.

When Meta returns no daily rows, keep the chart card visible with an explicit
empty state. Hiding the whole visualization makes a healthy empty account look
like an incomplete implementation.

Campaign comparison also exposes one metric at a time: link clicks, spend or
CTR. The graph ranks at most eight campaigns for legibility, while the adjacent
table preserves every campaign matching the active status filter and remains
the exact-value surface. Status filtering is local to the current snapshot and
does not trigger a provider read.

The global period selector changes account totals, daily points and campaign
Insights together. Each period has an independent persisted snapshot. A period
that has never been refreshed shows its own empty state; TALIA never presents a
snapshot from another period as an equivalent fallback. Custom dates remain out
of scope until their timezone, maximum-span and retention semantics are defined.

### Development-only dashboard fixture

Append `?marketing_demo=1` to the Marketing route in a non-production
environment to render a deterministic, schema-valid reporting fixture. This is
intended for visual QA of KPI cards, the daily chart, interpretations and the
campaign table when the developer does not have an ad account with delivery.

The fixture is rejected whenever `NODE_ENV=production`, is clearly labelled in
the UI and disables the Meta refresh action. Never persist it or use it to
populate production snapshots.

## Dashboard states

The product must distinguish these states explicitly:

- **Disconnected:** explain prerequisites and offer Meta connection.
- **Connected, never synchronized:** offer the first read.
- **Successful synchronization with no campaigns:** confirm that the connection
  works and explain that data will appear when campaigns exist.
- **Successful synchronization with activity:** show KPIs, daily trend,
  interpretation and campaign table.
- **Refresh failure with prior data:** keep the previous snapshot visible and
  label it as stale.
- **Refresh failure without prior data:** show a retryable first-sync error.
- **Expired/revoked Meta authorization:** direct the operator to reconnect.
- **Creation locked:** retain read-only reporting and explain that connected
  status, `ads_management` and venue rollout are all required.
- **Campaign created:** confirm `PAUSED` and link to the selected account in Ads
  Manager; do not imply that an ad, audience or budget already exists.

Never treat an empty Meta account as a broken connection.

## Error boundaries and observability

Provider and sync errors are converted into bounded internal codes. User-facing
copy must not expose Meta responses, tokens or database details. The current
manual flow records the latest attempt and error code in connection metadata;
the UI preserves the last successful data when a later refresh fails.

When diagnosing a refresh:

1. Confirm the venue connection and selected ad account.
2. Check whether the token has expired or Meta returned 401/403.
3. Verify the four provider reads independently.
4. Validate whether the failure occurred before or during the atomic RPC.
5. Never print access tokens, app secrets or encrypted credential payloads.

## Development and verification

The focused test suite is:

```bash
npx vitest run \
  src/lib/marketing/connection-foundation-migration.test.ts \
  src/lib/marketing/campaign-insights-migration.test.ts \
  src/lib/marketing/campaign-creation-migration.test.ts \
  src/lib/marketing/campaign-creation-service.test.ts \
  src/lib/marketing/ad-set-creation-migration.test.ts \
  src/lib/marketing/ad-set-creation-service.test.ts \
  src/lib/marketing/connection-service.test.ts \
  src/lib/marketing/demo-data.test.ts \
  src/lib/marketing/insights-service.test.ts \
  src/lib/marketing/oauth-session.test.ts \
  src/lib/marketing/oauth.test.ts \
  src/lib/marketing/periods.test.ts \
  src/lib/marketing/sync-service.test.ts \
  'src/app/(dashboard)/[tenantId]/marketing/marketing-period-selector.test.tsx' \
  'src/app/(dashboard)/[tenantId]/marketing/marketing-trend-chart.test.tsx' \
  'src/app/(dashboard)/[tenantId]/marketing/marketing-campaign-comparison.test.tsx'
```

Before handoff, also run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Tests should cover provider validation, pagination-token stripping, empty
accounts, daily granularity, snapshot bounds, tenant consistency and expired
authorization. Visual changes should be checked in light and dark themes and at
mobile and desktop widths.

## Change checklist

When extending Marketing:

1. Confirm the metric's source, level, attribution window and unit.
2. Decide whether the value is additive before aggregating it.
3. Update the Zod provider schema and normalized domain schema.
4. Update the transactional persistence contract and generated database types.
5. Add all four supported locales: Spanish, Catalan, English and Brazilian
   Portuguese.
6. Preserve empty, stale and reauthorization states.
7. Add or update focused tests.
8. Update this document, the operational runbook and `docs/current-state.md`.
9. Reconfirm that no write path can activate spend.

## Next likely slices

1. Supervised creative and ad creation in `PAUSED`, including destination and
   media validation.
2. Page/promoted-object selection for engagement and awareness ad sets.
3. A scheduler with freshness policy, rate-limit handling and retry controls.
4. App Review, advanced access and Business Verification for customer pilots.

Each slice should remain independently deployable and retain the read-only
dashboard when later write capabilities are unavailable.
