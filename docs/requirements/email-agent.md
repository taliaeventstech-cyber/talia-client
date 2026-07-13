# Requirements: Email Agent

## Objective

Allow TALIA to help respond to support emails without forcing the client to abandon their mailbox.

The client must be able to work from Gmail/Outlook and see drafts prepared by TALIA. The pattern is **mailbox-first**: Gmail/Outlook remain the daily working tool, and TALIA generates drafts, classifies, audits and measures the service.

## Product Principle

Recommended MVP: **draft-first**.

TALIA does not send emails automatically at first. It generates drafts, leaves them in the client's mailbox, and a human reviews/sends them. Auto-send is only activated later, for safe categories and when the client explicitly enables it (see Phase 3 below).

The product's source of truth lives in TALIA: connections, threads, messages, drafts, states, auditing, limits and metrics. Gmail and Microsoft have different APIs; TALIA normalizes everything into `email_threads`, `email_messages`, `email_drafts`.

## Architecture

```
Gmail / Outlook
      │ OAuth + sync
      ▼
┌───────────────────────┐
│ TALIA Email Connector  │
│ Gmail / Microsoft      │
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│ TALIA sync             │  saves email_threads + email_messages
└──────────┬────────────┘
           ▼
POST /api/internal/email/process
           │
           ▼
┌───────────────────────┐      ┌──────────────────────┐
│ Email classifier agent │ ──▶ │ Email drafter agent   │  (only if applicable)
└──────────┬────────────┘      └──────────┬───────────┘
           ▼                              ▼
┌────────────────────────────────────────────────────┐
│ Supabase: email_drafts + real Gmail/Outlook draft   │
│           + usage_events                            │
└────────────────────────────────────────────────────┘
```

Orchestration lives in TALIA, not inside n8n. This allows classifying without drafting, retrying drafts without reclassifying and measuring costs separately. `TaliaAiEmailClassifierProvider` and `TaliaAiEmailDrafterProvider` are now selectable. n8n remains only as an explicitly selected legacy provider for mailboxes not yet migrated and is not an automatic fallback.

## MVP Flow

1. Client connects mailbox from Àgora, or TALIA configures it from Backstage.
2. TALIA reads authorized incoming emails.
3. TALIA applies local eligibility rules to ignore newsletters, bounces, no-reply or blocked senders without calling the agent.
4. TALIA calls the AI workflow/agent to classify candidate cases and generate a response if applicable.
5. TALIA queries the venue's knowledge base.
6. TALIA generates a response.
7. TALIA creates a draft in Gmail/Outlook.
8. Human reviews and sends from their mailbox.
9. TALIA logs status, topic, intent, classification reason and usage.

Manual processing in Àgora is explicit: the user selects one or more threads and clicks `Process selected`. The `Delete selected` action removes the local threads and their messages/drafts in TALIA, but does not delete emails from the Gmail/Outlook mailbox.

Drafts have two actions:

- `Delete in Àgora`: removes only the local `email_drafts` record.
- `Delete in Gmail`: deletes the real draft from the provider (`users.drafts.delete`, scope `gmail.compose`) and then removes the local record.

### Phase 2 — Outlook/Microsoft 365

The pattern is replicated with Microsoft Graph: OAuth, delta queries, drafts, sent messages, webhooks/subscriptions if applicable. Currently hidden in the product until verification is complete (see `docs/current-state.md`).

### Phase 3 — Controlled auto-send (not yet implemented)

Only for safe categories: hours, location, basic accessibility, purchase information, exact FAQs.

Never auto-send for: complaints, payments, sensitive personal data, press, contracts, conflicts, minors, serious incidents, unverified availability/prices.

## Technical Workflow MVP

Rules:

- The browser and the client never call n8n directly.
- n8n does not write directly to Supabase.
- n8n does not create drafts directly in Gmail.
- TALIA persists threads, messages, drafts and usage.
- TALIA creates the real draft in Gmail/Outlook when `draft_mode = provider_drafts`.
- The classifier must return a simple contract: `should_process`, `should_generate_draft`, `needs_human_review`, `classification_reason`, `topic`, `priority`, `confidence`.
- `should_process` means the email is a valid candidate for the agent. If it is `false`, TALIA ignores it as a newsletter, spam, bounce, no-reply, automated message, blocked sender or non-actionable message.
- `should_generate_draft` means TALIA must call the drafter to prepare a supervised draft. It does not imply sending the email.
- The drafter must return `should_generate_draft`, `subject`, `body_text/body_html`, `topic`, `priority`, `confidence`.

Payload TALIA -> n8n:

```json
{
  "agent_type": "email",
  "tenant_id": "uuid",
  "connection_id": "uuid",
  "thread_id": "uuid",
  "message_id": "uuid",
  "mailbox_email": "info@cliente.com",
  "subject": "Question about tickets",
  "sender_email": "persona@example.com",
  "sender_name": "Persona",
  "body_text": "Hi, I wanted to know the schedule...",
  "fallback_email": "info@cliente.com",
  "fallback_phone": "933000000",
  "relevant_knowledge": []
}
```

Response n8n -> TALIA:

```json
{
  "should_process": true,
  "should_generate_draft": true,
  "classification_reason": "visitor_question",
  "subject": "Re: Question about tickets",
  "body_text": "Hi...",
  "body_html": "<p>Hi...</p>",
  "topic": "entradas",
  "priority": "normal",
  "confidence": 0.86,
  "escalation_reason": null
}
```

Internal endpoints:

- `GET /api/internal/tenants/:tenantId/email-config`: stable context for workflows.
- `POST /api/internal/email/sync`: syncs Gmail via polling and saves `email_threads` + `email_messages`.
- `POST /api/internal/email/process`: processes the latest inbound message or a specific one via `thread_id`/`message_id`.

Expected result:

- If it should not respond: thread `ignored`.
- If generated only for internal review: draft `generated`.
- If created in the client's mailbox: draft `created_in_provider` with `provider_draft_id`.
- If Gmail/Outlook fails: draft `error` and detail in `error_message`.

Temporary env:

- `EMAIL_AGENT_PROVIDER=talia-ai|n8n`: selects the primary classifier/drafter provider.
- `email_connections.metadata.email_agent_provider`: optional per-connection
  override (`inherit`, `talia-ai` or `n8n`) used for canary rollout and rollback.
- `TALIA_AI_BASE_URL`: server-to-server URL for `talia-ai`.
- `TALIA_AI_INTERNAL_API_KEY`: bearer credential shared only by TALIA services.
- `DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL`: legacy n8n webhook for mailboxes still explicitly assigned to n8n.
- `INTERNAL_API_KEY`: protects internal endpoints in production.
- `CRON_SECRET`: protects `/api/cron/email/sync` while it is invoked by an external scheduler.

Provider resolution order:

1. Per-connection `email_agent_provider` when set to `talia-ai` or `n8n`.
2. Global `EMAIL_AGENT_PROVIDER` when the connection is set to `inherit`.
3. Safe legacy default `n8n` when neither is configured.

Backstage records the requested provider and actual provider for the classifier
and drafter independently. Historical fallback traces remain readable, but a
new `talia-ai` execution never invokes n8n automatically. Backstage
also summarizes the latest 25 executions for the mailbox. A validation error
does not trigger fallback. New execution metadata does not persist the raw
provider response because it can duplicate email or draft content.

Canary procedure: `docs/operations/email-agent-canary.md`.

Legacy n8n workflow, pending removal:

- Importable blueprint: `n8n-workflows/TALIA-Generic-Email-Agent-Draft-Workflow.json`.
- Recommended decoupled blueprints:
  - `n8n-workflows/TALIA-Email-Classifier-Workflow.json`;
  - `n8n-workflows/TALIA-Email-Drafter-Workflow.json`.
- Importable cron blueprint: `n8n-workflows/TALIA-Email-Sync-Cron-Workflow.json`.
- TALIA orchestrates two separate agents:
  - `Email classifier agent`: classifies intent, topic, priority, confidence and whether a response should be generated.
  - `Email drafter agent`: only runs if TALIA decides it applies based on classification, configuration, permissions and draft mode.
- Before calling the AI classifier, TALIA applies deterministic rules to prevent newsletters, bounces, no-reply and automated messages from ending up generating drafts.
- If the classifier decides no draft should be generated, the workflow returns only classification metadata and TALIA marks the thread as ignored/non-actionable.
- The knowledge base remains shared with the chatbot (`knowledge_items`). TALIA sends the workflow the relevant matches for that email in `relevant_knowledge`.
- The email channel's own rules live in `email_connections.metadata.email_agent_settings`:
  - `tone`: draft tone;
  - `draft_style`: length/density of the response;
  - `signature`: preferred sign-off;
  - `human_review_topics`: sensitive topics that require review;
  - `classification_rules`: additional rules for the classifier.
- Environment variables in n8n:
  - `TALIA_BASE_URL`, for example `https://talia-client.vercel.app`;
  - `TALIA_INTERNAL_API_KEY`, same value as `INTERNAL_API_KEY` in TALIA.
- For the cron workflow, create an HTTP Header Auth credential with:
  - Name: `Authorization`;
  - Value: `Bearer <CRON_SECRET>`.
- When importing, replace the OpenAI credential `REPLACE_WITH_OPENAI_CREDENTIAL_ID`.
- Webhooks supported by TALIA:
  - `DEFAULT_N8N_EMAIL_CLASSIFIER_WEBHOOK_URL`;
  - `DEFAULT_N8N_EMAIL_DRAFTER_WEBHOOK_URL`;
  - `DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL` remains for the legacy provider path.
- Per-venue overrides:
  - `email_connections.metadata.n8n_email_classifier_webhook_url`;
  - `email_connections.metadata.n8n_email_drafter_webhook_url`;
  - `email_connections.metadata.n8n_email_agent_webhook_url` remains for the legacy provider path.

## Automation — sync cron

The current deployment uses n8n only to wake the sync endpoint because frequent
Vercel Hobby schedules are not viable. This dependency must be replaced by a
managed scheduler before n8n is decommissioned. The scheduler only invokes the
authenticated endpoint; mailbox sync remains in `talia-client`.

```txt
Schedule Trigger every 15 min
  -> GET https://<TALIA_BASE_URL>/api/cron/email/sync
     Authorization: Bearer <CRON_SECRET>
```

The endpoint checks active Gmail connections with `sync_mode = polling` and `cron_enabled != false`. Each venue decides whether it's time to sync based on `sync_frequency_minutes`, with a maximum of `gmail_sync_limit` messages per pass (100 by default): it first checks which ids already exist in `email_messages` and only downloads the full detail of new messages.

## Providers

First phase:

- Google Gmail API.

Next:

- Microsoft Graph for Outlook/Exchange.

Avoid IMAP/SMTP as a first choice unless necessary, because it complicates permissions, security and traceability.

## Google OAuth

The Gmail connection starts from Àgora and returns to `/api/email/google/callback`.

Required variables:

- `GOOGLE_CLIENT_ID`;
- `GOOGLE_CLIENT_SECRET`;
- `NEXT_PUBLIC_APP_URL`;
- `EMAIL_TOKEN_ENCRYPTION_KEY`;
- `EMAIL_OAUTH_STATE_SECRET`.

MVP Scopes:

- `https://www.googleapis.com/auth/gmail.readonly`;
- `https://www.googleapis.com/auth/gmail.compose`.

`gmail.readonly` allows reading authorized emails. `gmail.compose` allows creating drafts without granting automatic send permissions. Refresh/access tokens are stored encrypted inside `email_connections.oauth_metadata.encrypted_tokens`.

Draft creation:

- TALIA renews the access token with the encrypted refresh token.
- TALIA calls Gmail `users.drafts.create`.
- The draft becomes visible in the drafts folder of the connected mailbox.
- TALIA saves the `provider_draft_id` to trace the local draft to the real draft from the provider.

Disconnection:

- Àgora allows disconnecting Gmail.
- TALIA attempts to revoke the refresh/access token in Google.
- The connection is left as `revoked`.
- `oauth_metadata`, `sync_cursor` and `last_synced_at` are cleared.

Operational persistence:

- The connection must work without users connected to Àgora.
- The encrypted refresh token allows renewing access tokens from workers/server jobs.
- If Google revokes permissions or the refresh fails, `email_connections.status` moves to `error` or `revoked` and reconnection is requested.
- Weekend synchronization must run from a worker/cron, not from the browser.
- The MVP uses polling against Gmail `messages.list` + `messages.get` to import the latest messages from `in:inbox newer_than:14d`.
- Ingestion is idempotent via `unique(connection_id, provider_message_id)`, so the cron can run repeatedly without duplicating emails.
- Backstage can adjust per connection:
  - `gmail_sync_window_days`: 1, 7, 14 or 30;
  - `sync_frequency_minutes`: 15, 30, 60 or 240;
  - `gmail_sync_limit`: 10, 25, 50, 100, 250 or 500;
  - `cron_enabled`: allows pausing the automatic cron per connection without disconnecting the mailbox or preventing manual syncs;
  - `gmail_sync_query`: advanced Gmail query for internal overrides;
  - `auto_process_after_sync`: chains email processing after syncing imported emails;
  - `exclude_automated`: ignores newsletters, bounces, no-reply and automated replies before calling the agent;
  - `blocked_senders` and `blocked_domains`: internal rules to ignore emails by sender;
  - `email_agent_settings`: settings specific to the email channel without duplicating the knowledge base.

## Experience by surface

### In Gmail/Outlook

The client sees: normal incoming emails, drafts prepared by TALIA, responses sent from the real mailbox, labels if the provider supports them.

### In Àgora

The client sees: connection status, synced threads with manual selection, processed emails, generated drafts, pending review, sent, escalated, frequent topics, average response time, sync errors.

### In Backstage

TALIA manages: provider, scopes, OAuth status, sync mode, automatic frequency, draft mode, exclusion rules, plan limits, errors, support and disconnection.

## Data Model

### `email_connections`

Mailbox connection per venue.

- `theatre_id`
- `provider`: `google`, `microsoft`, `imap`, `forwarding`
- `mailbox_email`
- `status`: `draft`, `connected`, `syncing`, `error`, `revoked`, `disabled`
- `sync_mode`: `polling`, `webhook`, `manual`
- `draft_mode`: `provider_drafts`, `agora_review`, `disabled`
- `oauth_metadata`, `sync_cursor`, `last_synced_at`, `error_message`

### `email_threads`

- `provider_thread_id`, `subject`, `sender_email`
- `status`: `new`, `drafted`, `waiting_human`, `sent`, `resolved`, `escalated`, `ignored`
- `topic`, `priority`, `last_message_at`

### `email_messages`

Messages of a thread: inbound/outbound, provider message id, body text/html, recipients, timestamps.

### `email_drafts`

- `provider_draft_id`
- `status`: `generated`, `created_in_provider`, `edited_by_human`, `approved`, `sent`, `discarded`, `error`
- generated subject/body, reviewer, sent timestamp

## States

Thread: new; drafted; waiting_human; sent; resolved; escalated; ignored.

Draft: generated; created_in_provider; edited_by_human; approved; sent; discarded; error.

## Permissions

| Permission | Description |
|---|---|
| `view_email` | View email agent metrics/status |
| `review_email` | Review drafts and mark statuses |
| `send_email` | Send responses from TALIA, once available |
| `manage_email` | Connect mailbox and modify configuration |
| `manage_email_automation` | Activate auto-send and advanced rules |

MVP: owner/admin can manage; operator can review if enabled; viewer is read-only.

## Billing and limits

Log in `usage_events`:

- `module_key='email'`, `channel='email'`
- `event_type='conversation_started'` when a new processable thread appears
- `event_type='ai_call'` when TALIA generates a response
- `event_type='resolution'` when it is resolved/sent
- `event_type='fallback'` when it is escalated

The main commercial limit will be: emails/threads processed per month, drafts generated per month, optional auto-send per plan.

## Initial Guardrails

The agent must:

- use only the knowledge base and authorized sources,
- indicate uncertainty,
- create a draft, not send,
- escalate if there is personal data, complaints, payments or sensitive topics,
- maintain a professional and concise tone,
- respect the email's language,
- not invent prices, availability or policies.

## Risks

- OAuth and refresh tokens.
- Personal data security.
- Gmail/Outlook rate limits.
- Detection of emails that should not be responded to.
- Avoiding dangerous auto-responses.
- Maintaining traceability between the draft and the original email.

## MVP Decisions

- No auto-send.
- No deleting emails.
- No modifying existing emails except creating a draft.
- Save only what is necessary.
- Backstage sees technical status.
- Client sees connection, mailbox and metrics.

## Technical Roadmap

1. Base data model.
2. Initial Email module screen in Àgora.
3. Backstage to activate the module and prepare the connection.
4. Gmail OAuth.
5. Gmail polling sync.
6. Internal draft generation.
7. Real draft creation in Gmail.
8. Draft status sync.
9. Metrics and usage.
10. Microsoft 365.
11. Controlled auto-send.
