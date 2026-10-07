# Meta Marketing API pilot setup

The Marketing connection is independent from TALIA's Instagram Direct and
WhatsApp connections. Use dedicated credentials and secrets for this module.

## Meta app preparation

Use a Business-type Meta app dedicated to Marketing. Do not reuse the WhatsApp
or Instagram messaging credential lifecycle even when the same Meta Business
Portfolio owns all three apps.

Current setup sequence in Meta for Developers:

1. Create or open the dedicated Marketing app.
2. Add **Create & manage ads with Marketing API** as its use case.
3. Associate the app with the TALIA Business Portfolio when Meta requests a
   Business.
4. In **App settings > Basic**, complete the app icon, privacy policy, terms and
   data-deletion information required for review.
5. Add each deployed Agora host to **App Domains** as a bare hostname, without
   `https://` or a path.
6. Register the exact OAuth redirect URI described below.
7. In **App Review > Permissions and Features**, prepare the Marketing API
   access tier and the three permissions used by TALIA.

Meta can automatically list additional permissions such as `pages_show_list`,
`pages_read_engagement` or `public_profile` as part of a configured use case.
Their presence does not mean the current TALIA Marketing code requires them.

While the app is in development mode, only app-role users and explicitly
available test assets should be used. Customer access requires advanced access,
App Review and Business Verification.

## Server environment

Configure these server-side values in each environment:

```text
META_MARKETING_APP_ID=<Meta app ID>
META_MARKETING_APP_SECRET=<Meta app secret>
META_MARKETING_OAUTH_STATE_SECRET=<random secret with at least 32 characters>
META_MARKETING_TOKEN_ENCRYPTION_KEY=<random secret with at least 32 characters>
NEXT_PUBLIC_APP_URL=https://<agora-origin>
```

`META_MARKETING_GRAPH_API_VERSION` is optional and defaults to `v26.0`.
Neither `META_MARKETING_APP_SECRET` nor the two generated secrets may be exposed
to browser code or committed to the repository.

Credential sources:

| Variable | Source |
| --- | --- |
| `META_MARKETING_APP_ID` | App ID in Meta **App settings > Basic** |
| `META_MARKETING_APP_SECRET` | App secret in the same Meta screen; server only |
| `META_MARKETING_OAUTH_STATE_SECRET` | Independently generated TALIA secret; not supplied by Meta |
| `META_MARKETING_TOKEN_ENCRYPTION_KEY` | Independently generated TALIA secret; not supplied by Meta |
| `NEXT_PUBLIC_APP_URL` | Public Agora origin for the deployed environment |

The state and encryption secrets must be different values. Rotate a leaked
secret and any provider token or credential encrypted with it; never copy secret
values into tickets, screenshots, logs or this runbook.

## Meta configuration

Register this exact valid OAuth redirect URI in the Meta app:

```text
${NEXT_PUBLIC_APP_URL}/api/marketing/meta/callback
```

The MVP requests:

- `ads_read` to read campaigns and Insights;
- `ads_management` to prepare campaign objects in `PAUSED`;
- `business_management` to list the operator's Business Portfolios and ad
  accounts.

External customer access remains blocked until the app has the appropriate
advanced access, App Review and Business Verification in Meta.

## Safe rollout sequence

1. Apply the Meta Marketing migrations to the target Supabase project in order:
   `20261006100000_meta_marketing_campaign_insights.sql`, followed by
   `20261006110000_meta_marketing_daily_insights.sql`,
   `20261007150000_meta_marketing_period_snapshots.sql` and
   `20261007193000_meta_marketing_paused_campaign_creation.sql`.
2. Configure the server environment and the matching Meta redirect URI.
3. Connect with an app-role user from Agora and select one Business Portfolio
   and one ad account.
4. Confirm the connection card shows the selected assets and that
   `rollout_enabled` remains `false`.
5. Complete a read-only refresh and verify the selected ad account before
   enabling campaign creation for that venue.
6. Enable `rollout_enabled` only for the approved canary connection through an
   audited operator procedure. Reconnecting resets it to `false`, so repeat the
   verification after every account change.

The connection flow never activates advertising spend. Reconnecting replaces
the venue's selected account and resets rollout to disabled.

The Agora dashboard refresh is manual in this MVP. It reads account totals and
account-level daily Insights (`time_increment=1`) plus campaign-level Insights
for the selected `last_7d`, `last_30d` or `last_90d` preset, then atomically
replaces only that backend-only period snapshot.

When rollout is enabled, the supervised creation form calls only the selected
ad account's `/campaigns` edge. The server—not the browser—forces
`status=PAUSED` and `special_ad_categories=[]`. This creates only the top-level
campaign container: it does not create an ad set, budget, audience, creative or
ad, and therefore cannot deliver or spend. Never add an `ACTIVE` option to the
form or accept status from client input.

Every submission has a UUID idempotency key recorded before Meta is called.
Do not manually retry a request whose local state remains `processing`: Meta may
have accepted it even if TALIA could not persist completion. Reconcile the
campaign in Ads Manager first. Logs and tickets may contain the bounded internal
error code and request UUID, but never the token or raw Meta response.

Account totals are canonical. Do not calculate account reach or frequency by
summing campaign or daily rows because those values are not additive across
audiences or time buckets.

## Expected first-run states

- A newly created ad account can connect successfully while returning no
  campaigns and no daily series. Agora should present this as a valid empty
  account, not an integration failure.
- An account with campaigns but no delivery can return zero-valued metrics.
- Daily chart data appears only after a successful refresh returns daily
  account-level Insights.
- A failed refresh preserves the last successful snapshot and marks it stale.
- A newly selected period remains pending until its first manual refresh; data
  from another period is never shown as a substitute.

## Troubleshooting

### Meta says "Can't load URL"

In **App settings > Basic**, add the bare host to App Domains, without protocol
or path, for example `agora.talia.events`. In the Facebook Login/Marketing API
OAuth settings, register the full redirect URI exactly:

```text
https://agora.talia.events/api/marketing/meta/callback
```

Scheme, host, path and trailing slash must match the URL generated by TALIA.

### OAuth returns `meta_marketing_oauth`

The signed OAuth attempt lasts 30 minutes. Restart the connection from Agora if
the operator spent longer than that configuring or selecting Meta assets. Also
verify the app ID/secret pair and exact redirect URI for the deployed
environment.

### A Business Portfolio has no ad accounts

Confirm in Meta Business Settings that the same Facebook user has access to the
ad account and that the account is assigned to the selected Business Portfolio.
Having access to the Business alone does not guarantee access to its ad
accounts.

### Refresh requests reauthorization

Treat Meta 401/403 responses or an expired stored token as a reconnect event.
Do not log or paste the token while diagnosing it. Reconnecting may change the
selected ad account; TALIA clears the old snapshot when that happens.

### Production reports React error 441 on the Marketing page

React 441 means a Server Component failed while rendering and production hid
the underlying server message. Check server logs and compare the deployed code
with the target project's Supabase migration history. In particular, a project
with `20261006100000` applied but without `20261006110000` still has the
campaign-only RPC response and no `meta_marketing_daily_insights` table.

Never add SQL to a migration version already recorded by Supabase. Applied
migrations are append-only: restore the historical file to the SQL that was
actually deployed and introduce every later schema or RPC change in a new,
higher-numbered migration.

## Developer reference

The canonical architecture, metric semantics, source map, test commands and
extension checklist are documented in
[`../architecture/marketing-module.md`](../architecture/marketing-module.md).
