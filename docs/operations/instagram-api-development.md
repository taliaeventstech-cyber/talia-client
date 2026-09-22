# Instagram API development

## Current boundary

TALIA is preparing Instagram API with Instagram Login for an inbound-DM pilot.
OAuth connection, signed webhook ingestion, the independent worker, the
`instagram_agent` runtime and provider text sending are implemented. New
connections remain rollout-disabled until both services and the worker migration
are deployed and a controlled app-role canary is ready.

The planned callback and webhook URLs are:

```text
https://<agora-origin>/api/instagram/callback
https://<agora-origin>/api/webhooks/meta/instagram
```

The callback validates the Professional account and persists its encrypted
credential atomically. The webhook verifies the raw request signature before
parsing and fails closed unless the provider account resolves to one enabled
venue connection. It never routes through WhatsApp persistence or processing.

## Server environment

Configure separate Instagram values even if WhatsApp belongs to the same Meta
developer app or business portfolio:

```text
META_INSTAGRAM_APP_ID=<Instagram app ID shown by Meta>
META_INSTAGRAM_APP_SECRET=<Instagram app secret shown by Meta>
INSTAGRAM_OAUTH_STATE_SECRET=<dedicated random secret, at least 32 characters>
INSTAGRAM_TOKEN_ENCRYPTION_KEY=<dedicated random secret, at least 32 characters>
META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN=<random environment-specific value>
META_INSTAGRAM_GRAPH_API_VERSION=v26.0
NEXT_PUBLIC_APP_URL=https://<agora-origin>
```

Do not make the app secret, OAuth-state secret, token-encryption key or webhook
verification token public. Generate each secret independently. Do not silently
fall back to the WhatsApp app ID, app secret, verification token or encryption
key: Meta may display related products under one app, but their TALIA connection
lifecycles remain independent.

## Meta dashboard setup

For each environment used in the pilot:

1. In the existing Meta Business app, add the Instagram API use case with
   Instagram Login. If Meta prevents that combination for the current app type,
   create a separate Business app owned by the same verified TALIA business
   rather than switching the integration to Facebook Login.
2. Record the Instagram App ID and App Secret in the server environment.
3. Add the exact HTTPS callback URI shown above to the valid OAuth redirect URIs.
   Add localhost only to a dedicated development configuration if Meta permits it;
   never add wildcard redirect URIs.
4. Request only `instagram_business_basic` and
   `instagram_business_manage_messages` for the DM pilot.
5. After deploying the inbound migration and route, configure the Instagram
   webhook product with `https://<agora-origin>/api/webhooks/meta/instagram` and
   the exact value of `META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN`. Subscribe only to
   the `messages` field for this pilot.
6. Add a dedicated Instagram Business or Creator account as an app-role tester
   and accept the invitation from that account.
7. Keep the app in development mode until the end-to-end test succeeds with app
   roles. Production access for unrelated accounts requires the applicable Meta
   review and business verification.

Take screenshots of the app identity, exact callback URI, enabled scopes and
webhook subscription without exposing secrets or tokens. These become review
evidence; they are not application logs.

## Implemented OAuth preparation

`src/lib/instagram/oauth.ts` provides:

- a direct Instagram authorization URL with the minimum pilot scopes;
- signed, ten-minute OAuth state bound to venue and initiating user;
- server-side authorization-code exchange;
- server-side exchange from a short-lived to a long-lived access token;
- Professional account validation without putting the token in the request URL;
- bounded provider errors that never include Meta response bodies.

The implementation deliberately uses dedicated Instagram environment keys and
does not reuse WhatsApp credentials implicitly.

## Connection persistence

`instagram_connections` stores one independent Instagram Professional account
per venue. Browser database roles cannot query the table or its RPCs. Owners,
administrators and platform operators are authorized server-side; browser-safe
summaries never include provider IDs or credential material.

The long-lived token is stored in a per-connection AES-256-GCM envelope using
`INSTAGRAM_TOKEN_ENCRYPTION_KEY`. An Instagram account cannot be connected to
two venues, and completing OAuth never enables rollout automatically.

## Implemented inbound boundary

`src/app/api/webhooks/meta/instagram/route.ts` provides:

- GET challenge verification with a dedicated Instagram verification token;
- raw-body HMAC verification with the dedicated Instagram app secret before
  JSON parsing;
- an Instagram-specific, bounded parser for inbound one-to-one messages;
- durable, idempotent ingestion through `ingest_instagram_message`;
- retryable 5xx responses when persistence fails.

The inbound migration creates backend-only Instagram contacts, conversations,
messages and jobs. Its rollout gate runs before message content is stored. Only
plain text is queued; unsupported content enters a minimal handoff state. Raw
Meta webhook envelopes and attachment URLs are not persisted.

## Deployment sequence

Before configuring the Meta webhook:

1. Apply the Instagram connection migration in the target environment.
2. Apply `20260922110000_instagram_inbound_foundation.sql`.
3. Apply `20260922130000_instagram_agent_worker.sql`.
4. Deploy `talia-ai` with `/v1/instagram/respond`, then deploy `talia-client`
   with the Instagram webhook wake-up and minute recovery cron.
5. Configure the dedicated server secrets listed above.
6. In Meta, enter the production callback URL and the same webhook verification
   token, then subscribe only to `messages`.
7. Keep `rollout_enabled = false` until both deployments report healthy and the
   exact connected app-role account is selected for the canary.

## Agent and send boundary

The worker sends bounded, channel-local context to
`POST <TALIA_AI_BASE_URL>/v1/instagram/respond`. The AI service never receives
Meta credentials and never sends a provider message. `talia-client` decrypts the
connection token only at the final send boundary and calls:

```text
POST https://graph.instagram.com/<version>/<IG_USER_ID>/messages
```

The outbound reply is stored before this request. Provider or network ambiguity
after the send starts is marked `unknown` and handed off without an automatic
retry. A cron at `/api/cron/instagram/process` recovers only jobs that have not
crossed that boundary.

The Agora Instagram settings surface starts OAuth through
`/api/instagram/connect?tenantId=<VENUE_UUID>` for an authorized owner or
administrator. The callback returns to that surface with a bounded success or
error result.

Do not temporarily write a token to a generic tenant settings field or an
environment variable to bypass this sequence.
