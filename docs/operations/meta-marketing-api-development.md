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
- `ads_management` to prepare campaign objects in `PAUSED` in a later slice;
- `business_management` to list the operator's Business Portfolios and ad
  accounts.

External customer access remains blocked until the app has the appropriate
advanced access, App Review and Business Verification in Meta.

## Safe rollout sequence

1. Apply the Meta Marketing migrations to the target Supabase project in order:
   `20261006100000_meta_marketing_campaign_insights.sql`, followed by
   `20261006110000_meta_marketing_daily_insights.sql`. The second migration must
   be present before enabling refreshes that send `daily_insights`.
2. Configure the server environment and the matching Meta redirect URI.
3. Connect with an app-role user from Agora and select one Business Portfolio
   and one ad account.
4. Confirm the connection card shows the selected assets and that
   `rollout_enabled` remains `false`.

The connection flow never activates advertising spend. Reconnecting replaces
the venue's selected account and resets rollout to disabled.

The Agora dashboard refresh is manual in this MVP. It reads account totals and
account-level daily Insights (`time_increment=1`) plus campaign-level Insights
for Meta's `last_30d` period, then atomically replaces the backend-only
snapshot. It does not call any campaign creation or update edge in the
Marketing API.

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
