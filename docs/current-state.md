# Current State of TALIA

Last updated: July 14, 2026

This document is the quick reference for understanding where the app stands before touching code. For deeper decisions, go to the documents linked at the end.

## Summary

TALIA is a SaaS for cultural institutions. The product should not be understood as a standalone chatbot, but as a multichannel Attention layer for cultural venues.

Current state:

- Main active module: **Attention**.
- Most mature channel: **Web chatbot**.
- Channel in testing: **Gmail email agent**, in supervised drafts mode.
- Planned or paused channels: Microsoft/Outlook, voice, WhatsApp, Instagram.
- Client dashboard: **Agora**, per venue.
- Internal panel: **Backstage**.
- Current commercial model: 14-day free trial, upgrade to paid plans and add-ons.

## Implemented Product

### Signup and Auth

Implemented:

- Public signup with email/password.
- Email confirmation before entering the product.
- Intermediate "account confirmed" screen before starting onboarding.
- Login with language selector.
- Strengthened password policy.
- Toggle to show/hide password.
- Security baseline documented in `docs/security/auth-phase-1.md`.

Pending:

- Enterprise MFA/SSO.
- Advanced team policies.
- More robust rate limiting outside the Next.js layer.

### Client Onboarding

Implemented:

- Main onboarding after confirming the account.
- Language selector and day/night mode in onboarding.
- Collection of basic user and entity data.
- Selection of up to 3 purposes/use cases.
- Creation of the first operational workspace.
- Subsequent flow toward initial chatbot configuration.

Current rule:

- Initial onboarding creates the account/venue context.
- Invitations are for teams that already exist, not for the client's initial signup.

Reference:

- `docs/product/onboarding.md`.

### Chatbot Onboarding

Implemented:

- Chatbot-specific wizard after client onboarding.
- Agora sidebar hidden while the initial wizard is pending.
- Language selector and day/night mode also available in this wizard.
- Configuration of initial message, tone, first knowledge source, color and fallback.
- Upon completion, the user returns to Agora.

Pending:

- Improve the bot testing experience with a side preview closer to Botsonic.
- Definitively separate editable prompts from technical prompts.

### Agora

Implemented:

- Dashboard per venue.
- Sidebar with modules visible based on permissions, plan and access.
- Languages: Spanish, Catalan and English.
- Global day/night mode.
- Trial visible in sidebar.
- Upgrade button leading to the plans screen.
- Hiding of modules when the trial ends or there is no product access.

Pending:

- Aggregated dashboard per account.
- Improve visual consistency on some screens.
- Complete translations of less-used areas if new sections appear.

## Modules

### Web Chatbot

Status: active.

Implemented:

- Configuration per venue.
- General active/inactive control in Agora. Disabling it hides the public widget
  and blocks new chat requests without affecting Accessibility or Knowledge.
- Settings save action is shown above the editor, activates only after a change,
  and warns before leaving the page with unsaved changes.
- Installable widget/script.
- Initial message and brand color.
- Configurable proactive greeting that appears beside the launcher after a delay
  without opening the chat panel; selecting it starts the conversation.
- Interactive, production-sized Agora preview for the launcher, proactive
  greeting and chat panel; message submission stays disabled in preview mode.
- Auto-growing chat composer in production and preview, with `Enter` to send,
  `Shift + Enter` for line breaks and a bounded internal scroll for long drafts.
- Channel prompt.
- Configurable fallback.
- Structured fallback policy delegated to `talia-ai`, with an optional tenant
  message, verified email/phone contacts, an explicit WhatsApp toggle and
  traceable fallback metadata in Backstage.
- Verified chat actions keep WhatsApp destinations separate from visible reply
  text, so the widget displays the configured phone number as the link label
  instead of exposing the full `wa.me` URL.
- International fallback phone input shared by onboarding, Agora and Backstage;
  country prefix and national number are edited separately while storage and
  service contracts keep a single normalized E.164 value.
- Persisted conversations and messages.
- Basic analytics of topics and intents.
- Usage tied to billing/limits.
- Internal chat runtime in `src/lib/agent-runtime/chat.ts`, with n8n encapsulated as a temporary adapter.
- Selectable `talia-ai` provider via `CHAT_AGENT_PROVIDER=talia-ai`, with temporary fallback to n8n on 5xx errors.
- When `CHAT_AGENT_PROVIDER=talia-ai`, Next acts as a gateway: it validates tenant, limits and session, and delegates retrieval + response to `/v1/chat/respond`.
- In that delegated flow, `talia-ai` is the sole authority for visitor-language
  detection and response-language selection. Next sends the tenant language as
  `fallback_language`, requires `metadata.response_language` in successful
  responses and keeps local language detection only for the legacy n8n path.
- Agent runtime responses save compact sources (`id`, `source_id`, `source_type`, `score`) in the assistant message metadata, legacy conversation metadata, and usage for auditing.
- Backstage shows RAG health per venue, response traceability, original question, requested/used provider, model, language, retrieval status, low-confidence/fallback warnings, sources, scores, chunks retrieved from `talia-ai`, and internal actions to reprocess PDFs or retry embeddings.

Pending:

- Validate in production that `metadata.retrieval.chunks` appears in Backstage after deploying `talia-ai`.
- Consolidate knowledge as the primary source ahead of free-form prompts.
- Improve integrated preview/test.
- Stabilize `/v1/chat/respond` in the external `talia-ai` repo to reduce dependency on n8n.

Reference:

- `docs/requirements/chatbot.md`.

### Accessibility / Clear View

Status: functional technical MVP, undergoing product hardening.

Implemented:

- Standalone widget in `public/accessibility-widget.js`.
- Per-tenant activation from the Accessibility section of Agora.
- Visual controls: text size, contrast, grayscale, highlighted links, animation pause, spacing, readable font and reset.
- Clear View as a simplified reading mode for the public page.
- Clear View uses AI when a provider is configured and falls back locally when it isn't.
- Public endpoint with tenant validation, explicit activation, payload limit and basic rate limiting per IP/tenant.
- Sanitization so the AI cannot invent new links.

Pending:

- Visual QA on `public/olympia.html` and real websites.
- Define pricing/add-on and commercial limits for AI usage.
- Usage reporting if it becomes an independent paid product.

Reference:

- `docs/product/accessibility-widget.md`.

### Knowledge

Status: active, entering incremental RAG phase.

Implemented:

- Knowledge base shared per venue.
- FAQs/official answers.
- PDF import with text extraction and knowledge fragments.
- Manual FAQs and Excel/CSV are saved as `knowledge_items` for UI/fallback, but are reindexed as `knowledge_chunks` via `talia-ai`.
- `knowledge_chunks` table for documentary fragments prepared for retrieval and embeddings.
- Internal ingestion seam in `src/lib/knowledge/ingestion.ts`, which uploads PDFs to Storage and delegates parsing/chunking to `talia-ai`; for structured sources it normalizes text and delegates chunking/embeddings to `talia-ai`.
- Internal retrieval seam in `src/lib/knowledge/retrieval.ts`.
- Embeddings delegated to `talia-ai` via server-to-server HTTP; Next does not generate embeddings locally.
- Semantic retrieval delegated to `talia-ai`; in the main chatbot flow with `CHAT_AGENT_PROVIDER=talia-ai`, retrieval happens inside `/v1/chat/respond`.
- Reprocessable PDFs from Storage: Backstage can ask `talia-ai` to regenerate chunks and embeddings without re-uploading the file.
- Backstage allows reindexing all of a venue's knowledge and reprocessing individual RAG sources.
- Local text-only fallback in Next over chunks/items.
- Installed-web sources connected to `knowledge_sources` of type `web_snapshot`: Agora generates a signed capture URL, the installed widget extracts visible DOM text from the landing page, and `talia-ai` normalizes, chunks and generates embeddings.
- Installed-web URLs are canonicalized across the widget, API and database. Tracking parameters are discarded, functional query parameters are preserved, duplicate rows are merged before a unique tenant/type/URL index is enforced, and page-presence writes are throttled to once per hour per source.
- Agora can configure managed single-page, sitemap and bounded-website sources
  with manual, daily, weekly or monthly refresh policies. The persistence model
  separates logical sources, canonical documents and auditable sync runs, with
  worker leases, idempotency and per-run counters.
- The installed widget remains available as a first-party capture fallback for
  public pages that direct HTTP/browser capture cannot read reliably.
- Backstage shows managed-source frequency, next refresh, document count and the
  latest sync-run counters, and can enqueue an operator-triggered refresh.
- Managed web ingestion currently applies one universal quota across plans: 10
  sources, 500 active documents per tenant, 100 documents per source and 10
  manual refreshes per UTC day. The database enforces limits atomically while
  Agora and Backstage show current usage; entitlement overrides are reserved for
  a future plan decision.
- Backstage exposes derived managed-web operational alerts globally and per
  venue. Postgres aggregates repeated sync failures, overdue schedules and
  source/per-source-page/document/manual-sync quota pressure with warning and critical
  severities; healthy state clears alerts automatically without a second alert
  persistence model.
- Backstage has a per-source managed-web rollout control. Pausing a source
  cancels queued runs and excludes it from worker claims while preserving the
  last known-good documents and chunks; this is the normal canary rollback.
- Agora presents managed-web outcomes in customer language and prioritizes the
  latest sync run over the generic source status. Complete, unchanged, partial,
  blocked, quota and failed results have bounded explanations and relevant
  actions without exposing raw worker errors.
- Customers can register an idempotent support request from an affected source.
  The request stores tenant/source/run context without page or chunk bodies and
  sends a traceable support email when the application mail provider is
  configured; otherwise it remains pending for operational follow-up.
- Ingestion via external URLs is outside the main Agora flow for clients; the recommended path is to install the script on the client's own website and capture detected pages.
- Structured import per the configuration screen, already connected to RAG for manual FAQs and Excel/CSV.

Product direction:

- Keep Knowledge as the common core for chatbot, email, voice and future channels.
- Expand in the future toward Sources, Guidelines, Workflows and Actions.
- Recommended evolution: keep moving ingestion/retrieval/AI to `talia-ai` while keeping TALIA's internal contract stable.
- Key pending item: deploy the managed web worker and complete the controlled
  single-source canary before expanding to sitemap and bounded full-site sources.

### Email Agent

Status: active testing with Gmail.

Product principle:

- TALIA does not send emails automatically.
- TALIA generates supervised drafts.
- The human reviews and sends from Gmail.

Implemented:

- Gmail OAuth connection from Agora.
- Microsoft/Outlook hidden until verification is complete.
- Current Gmail scopes:
  - `gmail.readonly`;
  - `gmail.compose`.
- Polling-based sync with configurable limits.
- Persistence of connections, threads, messages and drafts.
- Decoupled classifier and drafter.
- Per-connection email provider selector in Backstage using
  `email_connections.metadata.email_agent_provider` (`inherit`, `talia-ai` or
  `n8n`). `EMAIL_AGENT_PROVIDER` is only the default for connections that
  inherit the global setting.
- Backstage shows classifier and drafter traces independently, including the
  requested/actual provider, fallback, model, action and token usage. It also
  summarizes the latest 25 mailbox executions without sending their raw email
  metadata to the browser.
- `talia-ai` owns typed classification, drafting and review policy without
  receiving OAuth tokens or calling Gmail.
- n8n remains available only as an explicitly selected legacy provider for
  mailboxes not yet migrated. A `talia-ai` execution never falls back to n8n;
  failures remain visible for canary evaluation.
- Current field: `should_generate_draft`.
- `should_reply` is removed as a new contract.
- Drafts visible in Agora and/or created in Gmail depending on mode.
- n8n acts as a temporary adapter, not as the source of truth.

Pending:

- Complete Google OAuth verification.
- Complete Microsoft Graph.
- Run a controlled `talia-ai` canary from Backstage, validate it in production
  and then retire the n8n classifier/drafter webhooks and adapters.
- Replace the n8n job that wakes `/api/cron/email/sync` with a managed scheduler;
  n8n is not considered decommissioned until this operational dependency is gone.
- Improve draft review UI.

Reference:

- `docs/requirements/email-agent.md`.
- `docs/operations/google-cloud-production-oauth.md`.

### Voice

Status: planned/paused for client.

Context:

- There was exploration with ElevenLabs/Twilio.
- The voice agent must not appear in client onboarding nor as an active option in Agora until it is resumed.

Reference:

- `docs/requirements/voice-agent.md`.

## Billing and Trial

Implemented:

- 14-day free trial.
- After the trial, access to Chatbot/Email is replaced by an upgrade prompt.
- `/upgrade` screen with plans and add-ons.
- Stripe Checkout.
- Documented Stripe webhook.
- Add-ons:
  - white label;
  - +2,000 messages;
  - premium onboarding.

Pending:

- Validate the full live Stripe flow.
- Adjust reporting of current plan and add-ons after purchase.
- Polish the visual state of trial/upgrade.

References:

- `docs/product/pricing.md`.
- `docs/stripe-checkout.md`.
- `docs/architecture/usage-billing.md`.

## Data Model and Access

Target model:

```txt
auth.users
  -> profiles
  -> account_memberships -> accounts
  -> venue_memberships   -> theatres / venues
```

Rules:

- `auth.users` is identity, not business data.
- `profiles` represents the person.
- `accounts` represents the contractual client.
- `theatres` is the legacy technical name for venue.
- `account_memberships` and `venue_memberships` govern access.
- `public.users` is legacy and must not be the basis for new decisions.

Reference:

- `docs/architecture/accounts-venues-access.md`.

## Backstage

Status: internal TALIA panel.

Expected use:

- View and manage accounts/venues.
- Adjust contracted modules.
- Review advanced configurations.
- Diagnose connections.
- Configure operational parameters that should not be in the end client's hands.

Pending:

- Consolidate internal permissions.
- Improve visibility of self-serve users and per-venue configurations.

## Legal, OAuth and Operations

Current documents:

- Privacy policy for Google OAuth: `docs/legal/privacy-policy-google-en.md`.
- Terms of Service: `docs/legal/terms-of-service-google-en.md`.
- Google OAuth production checklist: `docs/operations/google-cloud-production-oauth.md`.
- Data retention: `docs/operations/data-retention.md`.
- Client launch checklist: `docs/operations/client-launch-checklist.md`.

Status:

- Google requires verification for restricted Gmail scopes.
- The homepage and policies must be public and verified in Search Console.
- The privacy policy must remain aligned with actual Gmail usage.

## Legacy and Known Debt

Do not take as a new model:

- `theatres` as a product name. In the product we talk about venues.
- `public.users` as the permissions model.
- `should_reply` in email workflows.
- `DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL` except as a temporary fallback.
- Voice agent in the client UI until it is reactivated.

Active debt:

- Separate editable prompts from technical prompts.
- Create a separate `talia-ai` repo following `docs/architecture/talia-ai-service.md`.
- Reduce dependency on n8n in chat and email.
- Consolidate roadmap docs so there are no parallel sources.
- Complete advanced roles and permissions.
- Complete observability and reporting.

## How to Get Started in the Repo

Recommended reading for new members:

1. `docs/current-state.md`.
2. `docs/index.md`.
3. `docs/product/roadmap.md`.
4. `docs/product/onboarding.md`.
5. `docs/architecture/accounts-venues-access.md`.
6. `docs/architecture/agent-runtime.md`.
7. `docs/architecture/talia-ai-service.md`.
8. `docs/requirements/chatbot.md`.
9. `docs/requirements/email-agent.md`.
10. `docs/security/auth-phase-1.md`.

## Basic Validation Before PR

Run:

```bash
npm run typecheck
npm run lint
```

Do not assume you need to start `npm run dev` for every change. If critical UI is touched, verify visually when necessary.
