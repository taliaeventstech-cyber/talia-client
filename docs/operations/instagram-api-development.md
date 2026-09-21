# Instagram API development

## Current boundary

TALIA is preparing Instagram API with Instagram Login for an inbound-DM pilot.
The code creates and validates the OAuth flow and provides a backend-only
`instagram_connections` foundation. It does not activate message processing;
new connections remain rollout-disabled until the complete adapter passes its
canary.

The planned callback and webhook URLs are:

```text
https://<agora-origin>/api/instagram/callback
https://<agora-origin>/api/webhooks/meta/instagram
```

The callback validates the Professional account and persists its encrypted
credential atomically. The webhook route must fail closed until an active
Instagram connection can resolve its account to one venue.

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
5. Configure the Instagram webhook product with the HTTPS callback, a dedicated
   verification token and the message-related subscription required by the
   pilot.
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

## Next implementation phase

Before running the browser OAuth flow against a real test account:

1. Apply the Instagram connection migration in the target environment.
2. Configure the Meta dashboard values and server environment described above.
3. Start the connection through
   `/api/instagram/connect?tenantId=<VENUE_UUID>` using an authorized owner or
   administrator. Until the Agora settings surface is built, the callback returns
   to the venue overview with a bounded success or error query parameter.
4. Add provider-side revocation to the local disconnect foundation before
   enabling any external venue.

Do not temporarily write a token to a generic tenant settings field or an
environment variable to bypass this sequence.
