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
META_WHATSAPP_ACCESS_TOKEN=<server-only Cloud API token>
META_WHATSAPP_GRAPH_API_VERSION=v26.0
TALIA_AI_BASE_URL=<deployed talia-ai origin>
TALIA_AI_INTERNAL_API_KEY=<shared internal service key>
CRON_SECRET=<Vercel cron bearer secret>
INTERNAL_API_KEY=<manual preview wake-up secret>
```

Generate the verification token with a cryptographically random value, for
example `openssl rand -hex 32`. Enter the same value in Meta's webhook setup.
The verification token is not the App Secret or an access token. The pilot
access token is used only by the server-side outbound worker. Meta dashboard
temporary tokens expire and must be replaced by a managed system-user or
Embedded Signup credential before production.

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
  '<TALIA_TEST_THEATRE_UUID>',
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
values ('<TALIA_TEST_THEATRE_UUID>', 'whatsapp', 'active', now())
on conflict (theatre_id, module_key) do update
set status = excluded.status,
    enabled_at = coalesce(public.tenant_modules.enabled_at, excluded.enabled_at),
    disabled_at = null,
    updated_at = now();

insert into public.tenant_module_entitlements (theatre_id, module_key, enabled)
values ('<TALIA_TEST_THEATRE_UUID>', 'whatsapp', true)
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

Consecutive processable messages in the same venue, connection, contact and
conversation form one conversational turn. Each new message moves the shared
deadline to 2.5 seconds after the latest arrival, with an 8-second maximum from
the first pending message. The messages remain separate durable records, but
the agent receives their text joined in chronological order and produces one
reply linked to the latest provider message.

## Agent worker and outbound safety

`talia-ai` exposes `POST /v1/whatsapp/respond`. It receives bounded history
from only the same WhatsApp conversation, retrieves venue Knowledge with
`channel=whatsapp`, and returns either `respond` or `handoff`. It never receives
the Meta token or calls the provider.

`talia-client` owns the effect boundary:

1. Claim one leased conversation anchor from `whatsapp_inbound_jobs` and attach
   every due sibling job in that conversation to the same worker.
2. Load the venue, coalesced turn and at most six prior messages through a
   service-role-only RPC.
3. Persist one outbound row keyed to the latest inbound message in the turn.
4. Transactionally verify that no newer inbound message exists, then move the
   response from `queued` to `sending` immediately before `POST
   /<PHONE_NUMBER_ID>/messages`.
5. On a confirmed Meta success, replace the pending ID with Meta's `wamid` and
   complete every inbound message and job in the turn atomically.

If a newer message arrives during agent generation, the prepared response is
marked stale before any Meta side effect. The complete turn is requeued and
generated again. The webhook wake-up waits for the quiet window and performs a
bounded follow-up drain for this case; the minute cron remains the durable
recovery path.

The first automated response in each conversation is prefixed with an explicit
disclosure that Talía is an AI agent for the venue. It uses the detected response
language and falls back to the venue language. A duplicate leading greeting in
the generated answer is removed before prefixing the disclosure. The
`ai_disclosure_sent_at` marker is written only after Meta confirms the send, so
failed or stale responses do not suppress the required disclosure later.
This is the channel implementation of the transparency obligation in
[EU AI Act Article 50](https://eur-lex.europa.eu/eli/reg/2024/1689/oj).

A `429`, `5xx`, `408` or `425` response is a confirmed rejection and may retry
without invoking the agent again. A timeout, connection failure or malformed
success response is ambiguous: the outbound row becomes `unknown`, the
conversation enters handoff, and TALIA does not resend automatically.

Signed Meta status callbacks reconcile outbound messages through a
service-role-only RPC. The supported states are `sent`, `delivered`, `read` and
`failed`. Successful states only advance, repeated callbacks are idempotent and
out-of-order callbacks cannot regress a message. A confirmed `failed` state is
terminal and moves the conversation to operator handoff. TALIA stores provider
timestamps, a bounded error code and bounded pricing classifications; recipient
IDs, raw errors and the provider payload are not retained.

The webhook uses Next.js `after()` only as a low-latency wake-up. The durable
recovery path is `GET /api/cron/whatsapp/process`, registered every minute in
`vercel.json`. For a preview canary it can also be invoked manually:

Each invocation claims at most three conversation anchors and processes them sequentially so
the combined agent and provider timeouts remain inside the Vercel function
budget. Subsequent cron invocations drain any remaining backlog.

```bash
curl -X POST \
  -H "x-internal-api-key: $INTERNAL_API_KEY" \
  "https://<preview-origin>/api/cron/whatsapp/process?limit=1"
```

Do not paste either server key or the Meta token into logs, screenshots, SQL
metadata or issue trackers.

## End-to-end canary

1. Deploy the `talia-ai` branch containing `/v1/whatsapp/respond`.
2. Apply `20260816123000_whatsapp_agent_worker.sql` and
   `20260816170000_whatsapp_conversation_turns.sql`, followed by
   `20260817120000_whatsapp_delivery_status_reconciliation.sql`.
3. Deploy `talia-client` with the environment variables above.
4. Send one factual question from the verified recipient to Meta's test number.
5. Confirm one inbound row, one outbound row, one completed job and one reply on
   the handset.
6. Send one unsupported factual question. With the default policy, confirm no
   automatic reply and a conversation in `handoff`.
7. Repeat a webhook delivery and confirm that neither the inbound nor outbound
   message is duplicated.
8. Send three short messages in quick succession. Confirm three inbound rows,
   one agent call, one outbound row, one reply linked to the third message and
   an AI disclosure in the first confirmed response only.
9. Confirm Meta's status callbacks advance that outbound row from `sent` to
   `delivered` and `read` without creating a second message or waking the agent.
