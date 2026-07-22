# Current State of TALIA

Last updated: July 15, 2026

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
- Mexico/Brazil launch scope: **Web AI Assistant**. Email remains available for
  internal testing and the `talia.events.tech@gmail.com` legacy account, but is not
  exposed to other client accounts or the public upgrade offer during this phase.

## Implemented Product

### Signup and Auth

Implemented:

- Public signup with email/password.
- Two global identity types: Admin for internal TALIA operators registered in
  `platform_admins`, and User for every customer identity.
- Account ownership and venue permissions are membership capabilities, not
  additional global roles. Public signup creates a User who owns the new account
  without granting Backstage access.
- Backstage support access to customer accounts and venues is recorded in
  `audit_events`; legacy `public.users.role` is no longer an authorization source.
- Backstage uses the venue as the canonical customer-detail surface. The venue
  page contains two primary operational views, Knowledge Health and Response
  Traceability; plan usage, venue configuration and restricted billing actions
  are available from the settings control in its header. The former account
  detail and venue-invite routes have been removed from Backstage.
- Backstage separates the operational summary from customer management:
  `/backstage` contains only platform metrics and alerts, while
  `/backstage/clients` owns the paginated accounts and venues dashboard.
- The processed knowledge-source list is server-side paginated with 10, 25, 50
  or 100 entries per page while global RAG health remains calculated across all
  venue sources.
- Backstage can filter processed sources by their persisted source type. It only
  exposes per-source reprocessing for types supported by the ingestion path;
  legacy `web_snapshot` rows remain inspectable but do not show a broken action.
- Customer billing intervention from Backstage requires the explicit
  `manage_customer_billing` platform capability, reserved for approved founders.
  Authorized founders can schedule period-end cancellation or perform an
  immediate cancellation with stronger confirmation, mandatory reason,
  customer notification and audit events.
- The initial founder capability grant is email-matched against existing
  Supabase Auth identities in an idempotent migration; credentials are never
  stored or provisioned from the repository.
- Email confirmation before entering the product.
- Intermediate "account confirmed" screen before starting onboarding.
- Login with language selector.
- Strengthened password policy.
- Toggle to show/hide password.
- Security baseline documented in `docs/security/auth-phase-1.md`.
- Gmail/Outlook operational tables are backend-only. Browser database roles
  cannot query message bodies, drafts, connection metadata or encrypted OAuth
  tokens; composite constraints enforce tenant consistency through the complete
  connection/thread/message/draft graph.

Pending:

- Enterprise MFA/SSO.
- Advanced team policies.
- Edge/WAF rate limiting as an additional layer before broad public launch.

Security baseline:

- Authentication, chat and Clear View use atomic distributed rate-limit
  counters in Supabase rather than relying on one Next.js process.
- Counter keys are HMAC digests; raw visitor IPs and user emails are not stored.
- Agora responses enforce CSP and production HSTS alongside frame, MIME,
  referrer and browser-permission headers.

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
- The self-service creator is the account owner and receives the dedicated
  billing-management permission. New launch accounts start with the
  `chatbot_web` commercial plan and without the Email module.
- Invitations are for teams that already exist, not for the client's initial signup.

Reference:

- `docs/product/onboarding.md`.
- `docs/security/authorization-model.md`.

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
- Launch-facing navigation limited to the Web AI Assistant and Accessibility;
  Overview and Knowledge remain as supporting operational areas.
- The Email Agent navigation and customer-facing routes are restricted to the
  authenticated legacy account allowlist (`LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS`),
  which defaults to `talia.events.tech@gmail.com`, or to tenants with an explicit
  `talia-ai` mailbox-level canary override. Module access and `manage_email`
  permissions remain mandatory. This keeps migration and Google verification
  work visible without exposing Email to launch customers by default.
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
- `talia-ai` reports measured usage separately for the Answer Agent, optional
  Language Agent and retrieval embedding. `talia-client` persists each
  component against a versioned OpenAI price in fractional USD microdollars.
- Backstage includes an AI cost view with current-month measured cost,
  projection, cost per response, token/cache totals and breakdowns by venue,
  model and component. It updates when the view is loaded instead of polling in
  the background. Legacy heuristic estimates remain visibly separate.
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
- Agora currently exposes Web, Files and FAQs as knowledge-source tabs. Apps and
  Spreadsheets remain implemented but hidden, including from direct tab URLs,
  until their product reliability is audited.
- `knowledge_chunks` table for documentary fragments prepared for retrieval and embeddings.
- Internal ingestion seam in `src/lib/knowledge/ingestion.ts`, which uploads PDFs to Storage and delegates parsing/chunking to `talia-ai`; for structured sources it normalizes text and delegates chunking/embeddings to `talia-ai`.
- Internal retrieval seam in `src/lib/knowledge/retrieval.ts`.
- Embeddings delegated to `talia-ai` via server-to-server HTTP; Next does not generate embeddings locally.
- Semantic retrieval delegated to `talia-ai`; in the main chatbot flow with `CHAT_AGENT_PROVIDER=talia-ai`, retrieval happens inside `/v1/chat/respond`.
- Reprocessable PDFs from Storage: Backstage can ask `talia-ai` to regenerate chunks and embeddings without re-uploading the file.
- Backstage allows reindexing all of a venue's knowledge and reprocessing individual RAG sources.
- Local text-only fallback in Next over chunks/items.
- Installed-web detection is opt-in per venue and defaults to disabled. Agora
  offers a manual mode, which exposes the explicit capture actions, and an
  automatic mode, in which the installed widget submits the visible page text
  as pages are visited. Capture actions are hidden outside manual mode.
- Installed-web sources are connected to `knowledge_sources` as
  `web_snapshot`: the installed widget extracts visible DOM text and `talia-ai`
  normalizes, chunks and generates embeddings. Automatic captures persist a
  content hash and skip reingestion when the page has not changed.
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
- `talia-ai` is the only classifier and drafter runtime for email.
- Backstage shows classifier and drafter traces independently, including the
  provider, model, action and token usage. It also
  summarizes the latest 25 mailbox executions without sending their raw email
  metadata to the browser.
- `talia-ai` owns typed classification, drafting and review policy without
  receiving OAuth tokens or calling Gmail.
- A `talia-ai` execution never falls back to n8n; failures remain visible for
  operational review.
- Current field: `should_generate_draft`.
- `should_reply` is removed as a new contract.
- Drafts visible in Agora and/or created in Gmail depending on mode.
- TAL-34 provides the secured `/api/cron/email/sync` scheduler endpoint,
  Postgres global lease and durable `email_sync_runs` records. Automatic Vercel
  scheduling is paused while the email agent remains out of the commercial
  launch; the previous 15-minute schedule is incompatible with the Hobby plan.
  Message and thread uniqueness keep explicit test runs idempotent.
- Failed mailbox syncs retry up to three consecutive runs before the connection
  remains in an actionable error state.

Pending:

- Complete Google OAuth verification.
- Complete Microsoft Graph.
- Before launching email, run production on a plan or worker that supports the
  required frequency, register the scheduler again and observe it for a
  complete operating window.
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
- After the trial, access to the Web AI Assistant is replaced by an upgrade prompt.
- `/upgrade` screen with the public Web AI Assistant plan and compatible add-ons.
- The current commercial plan is read-only in chatbot settings. Subscription
  changes go through the billing flow and cannot be written by the widget settings
  server action.
- Paid account owners can open Stripe Customer Portal from `/upgrade` to manage
  billing or confirm cancellation. Scheduled cancellations remain active until
  the paid period ends, and webhook metadata makes that state visible in Agora.
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
- Backup and restore exercises: `docs/operations/disaster-recovery.md`.
- Security incident response: `docs/security/incident-response.md`.
- Vulnerability management: `docs/security/vulnerability-management.md`.
- Client launch checklist: `docs/operations/client-launch-checklist.md`.

Status:

- Google requires verification for restricted Gmail scopes.
- The homepage and policies must be public and verified in Search Console.
- The privacy policy must remain aligned with actual Gmail usage.
- CASA operational controls are documented, but production backup capabilities,
  the restricted contact sheet and the first incident/restore exercises still
  require verification and retained evidence.

## Legacy and Known Debt

Do not take as a new model:

- `theatres` as a product name. In the product we talk about venues.
- `public.users` as the permissions model.
- `should_reply` in email workflows.
- Voice agent in the client UI until it is reactivated.

Active debt:

- Separate editable prompts from technical prompts.
- Create a separate `talia-ai` repo following `docs/architecture/talia-ai-service.md`.
- Reduce the remaining n8n dependency in chat; email no longer uses it at runtime.
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
