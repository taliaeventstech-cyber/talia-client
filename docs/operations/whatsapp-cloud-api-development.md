# WhatsApp Cloud API development

TALIA receives Meta WhatsApp webhook traffic at:

```text
https://<agora-origin>/api/webhooks/meta/whatsapp
```

The route supports Meta's subscription challenge and rejects unsigned or
malformed notifications before any tenant processing occurs. Signed inbound
messages are resolved to a venue, persisted idempotently and placed in a durable
processing queue.

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
5. Subscribe the TALIA app to the test WABA through
   `POST /<WABA_ID>/subscribed_apps`.
6. Send a message from a verified recipient to Meta's test number.

Meta signs POST bodies in `X-Hub-Signature-256` using the app secret. TALIA
validates that signature against the unmodified request body before parsing
JSON.

## Pilot venue mapping

Before testing durable ingestion, create one backend-only connection that maps
the test WABA and phone-number ID to the pilot venue. Replace every placeholder;
never paste the Meta access token into this table.

```sql
insert into public.whatsapp_connections (
  theatre_id,
  waba_id,
  phone_number_id,
  display_phone_number,
  verified_name,
  status,
  rollout_enabled,
  credential_source
) values (
  '<SALA_FENIX_THEATRE_UUID>',
  '<TEST_WABA_ID>',
  '<TEST_PHONE_NUMBER_ID>',
  '<TEST_DISPLAY_NUMBER>',
  'TALIA',
  'connected',
  true,
  'environment'
)
on conflict (waba_id, phone_number_id) do update
set theatre_id = excluded.theatre_id,
    status = excluded.status,
    rollout_enabled = excluded.rollout_enabled,
    updated_at = now();
```

The venue must also have both WhatsApp activation controls enabled:

```sql
insert into public.tenant_modules (theatre_id, module_key, status, enabled_at)
values ('<SALA_FENIX_THEATRE_UUID>', 'whatsapp', 'active', now())
on conflict (theatre_id, module_key) do update
set status = excluded.status,
    enabled_at = coalesce(public.tenant_modules.enabled_at, excluded.enabled_at),
    disabled_at = null,
    updated_at = now();

insert into public.tenant_module_entitlements (theatre_id, module_key, enabled)
values ('<SALA_FENIX_THEATRE_UUID>', 'whatsapp', true)
on conflict (theatre_id, module_key) do update
set enabled = excluded.enabled,
    updated_at = now();
```

`waba_id` and `phone_number_id` are provider identifiers, not telephone numbers.
The route fails closed when no active connection matches both values. It emits
only a bounded unmatched count to logs; it never logs the sender, message body
or raw provider payload.

## Durable inbound behavior

- Meta retries are deduplicated by `connection_id + provider_message_id`.
- Identities and conversations are scoped to venue + WhatsApp connection.
- Text messages for an enabled pilot are queued in `whatsapp_inbound_jobs`.
- Unsupported message types are retained as a human handoff without storing
  their raw provider payload.
- Messages received while rollout or entitlement is disabled are retained but
  are not sent to an agent.
- WhatsApp messages, channel-local identities and empty conversations are
  removed by the existing retention job after 90 days.

The queue deliberately separates receipt from response generation. A later
worker can retry agent and Cloud API failures without making Meta redeliver the
visitor's inbound webhook.
