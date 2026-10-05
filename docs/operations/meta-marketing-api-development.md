# Meta Marketing API pilot setup

The Marketing connection is independent from TALIA's Instagram Direct and
WhatsApp connections. Use dedicated credentials and secrets for this module.

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

1. Apply the Meta Marketing connection migration to the target Supabase project.
2. Configure the server environment and the matching Meta redirect URI.
3. Connect with an app-role user from Agora and select one Business Portfolio
   and one ad account.
4. Confirm the connection card shows the selected assets and that
   `rollout_enabled` remains `false`.

The connection flow never activates advertising spend. Reconnecting replaces
the venue's selected account and resets rollout to disabled.
