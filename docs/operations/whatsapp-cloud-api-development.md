# WhatsApp Cloud API development

TALIA receives Meta WhatsApp webhook traffic at:

```text
https://<agora-origin>/api/webhooks/meta/whatsapp
```

The route supports Meta's subscription challenge and rejects unsigned or
malformed notifications before any tenant processing occurs.

## Environment

Configure these server-only values in every environment that receives Meta
webhooks:

```text
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=<random environment-specific value>
META_APP_SECRET=<Meta app secret>
```

Generate the verification token with a cryptographically random value, for
example `openssl rand -hex 32`. Enter the same value in Meta's webhook setup.
The verification token is not the App Secret or an access token.

Never expose either value to the browser, commit them, or paste them into issue
trackers and screenshots. Meta's temporary Cloud API access token is separate
and is not required by this inbound webhook boundary.

## Meta development setup

1. Keep the Meta app unpublished.
2. Open the WhatsApp use case and its webhook configuration.
3. Use the HTTPS callback URL above and the environment's verification token.
4. Subscribe to the `messages` field for the test WABA.
5. Send a message from a verified recipient to Meta's test number.

Meta signs POST bodies in `X-Hub-Signature-256` using the app secret. TALIA
validates that signature against the unmodified request body before parsing
JSON. The initial boundary acknowledges valid WhatsApp envelopes but does not
yet persist or process visitor content. Tenant resolution, idempotent ingestion
and message handling are the next implementation slice.
