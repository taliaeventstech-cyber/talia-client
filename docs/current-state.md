# Current State of TALIA

Last updated: October 12, 2026

This document is the quick reference for understanding where the app stands before touching code. For deeper decisions, go to the documents linked at the end.

## Summary

TALIA is a SaaS for cultural institutions. The product should not be understood as a standalone chatbot, but as a multichannel Attention layer for cultural venues.

Current state:

- Main active module: **Attention**.
- Most mature channel: **Web chatbot**.
- Channel in testing: **Gmail email agent**, in supervised drafts mode.
- Channel in development: validated WhatsApp Cloud API pilot and tenant Embedded Signup.
- Instagram direct messages are active for the gated pilot, with direct
  Instagram Login, an independent agent and channel-local conversation history;
  Microsoft/Outlook and voice remain planned or paused.
- Marketing has a first gated Meta Marketing API foundation: owner/admin access,
  venue-scoped connection metadata, encrypted backend-only credentials and an
  Agora pilot surface. A supervised OAuth flow now lets an authorized operator
  choose a Business Portfolio and ad account. Manual read-only synchronization
  stores independent 7-, 30- and 90-day campaign and Insights snapshots. Gated
  write flows create paused campaign containers and paused traffic ad sets;
  rollout remains disabled by default.
- Client dashboard: **Agora**, per venue.
- Internal panel: **Backstage**.
- Current commercial model: 7-day free trial, upgrade to paid plans and add-ons.
- Mexico/Brazil launch scope: **Web Agent**. Email remains available for
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
- Backstage account deletion cascades through the account's venues and their
  operational content, memberships and configuration. It refuses deletion while
  a linked Stripe subscription is not cancelled, records the destructive action,
  and retains only detached audit and statutory billing records.
- The initial founder capability grant is email-matched against existing
  Supabase Auth identities in an idempotent migration; credentials are never
  stored or provisioned from the repository.
- Email confirmation before entering the product.
- Intermediate "account confirmed" screen before starting onboarding.
- Login with language selector.
- Backstage access requires TOTP multi-factor authentication for every platform
  owner, administrator and support account. Server-side authorization requires an
  `aal2` Supabase Auth session both in Backstage and when platform privileges are
  used to access a customer workspace.
- Strengthened password policy.
- Toggle to show/hide password.
- Security baseline documented in `docs/security/auth-phase-1.md`.
- Gmail/Outlook operational tables are backend-only. Browser database roles
  cannot query message bodies, drafts, connection metadata or encrypted OAuth
  tokens; composite constraints enforce tenant consistency through the complete
  connection/thread/message/draft graph.

Pending:

- Enterprise SSO and advanced organization-level MFA policies beyond the
  mandatory TOTP baseline for TALIA platform administrators.
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
- Country selection sets the initial commercial market and the first Àgora
  interface language: Brazil opens in Brazilian Portuguese, while Spain and
  Mexico open in Spanish. The user can still change the interface language.
- Selection of up to 3 purposes/use cases.
- Creation of the first operational workspace.
- Subsequent flow toward initial chatbot configuration.

Current rule:

- Initial onboarding creates the account/venue context.
- The self-service creator is the account owner and receives the dedicated
  billing-management permission. New launch accounts start with the
  `basic` commercial plan and without the Email module.
- Invitations are for teams that already exist, not for the client's initial signup.

Reference:

- `docs/product/onboarding.md`.
- `docs/security/authorization-model.md`.

### Chatbot Onboarding

Implemented:

- Chatbot-specific wizard after client onboarding.
- Agora sidebar hidden while the initial wizard is pending.
- Language selector and day/night mode also available in this wizard.
- If the user postpones the wizard, the Web Agent configuration link remains
  visible in Agora and returns to the wizard until the initial setup is complete.
- Configuration of initial message, tone, first managed web source from the
  venue URL, brand color and launcher icon. Fallback behavior remains available
  in the full Web Agent settings. The source reuses the Knowledge managed-web
  flow, is activated automatically during initial onboarding, and remains
  subject to its quotas and permissions. Sources created later in Knowledge
  retain the per-source Backstage rollout control.
- Upon completion, the user returns to Agora.

Pending:

- Improve the bot testing experience with a side preview closer to Botsonic.
- Definitively separate editable prompts from technical prompts.

### Agora

Implemented:

- Dashboard per venue.
- Overview includes a compact chatbot-installation card for authorized
  operators. It reuses the canonical widget snippet generator, supports
  one-click copy and links to the complete chatbot configuration without
  claiming that installation was detected when no reliable signal exists.
- Sidebar with modules visible based on permissions, plan and access.
- Launch-facing navigation limited to the Web Agent and Accessibility;
  Overview and Knowledge remain as supporting operational areas.
- The Email Agent navigation and customer-facing routes are restricted to the
  authenticated legacy account allowlist (`LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS`),
  which defaults to `talia.events.tech@gmail.com`, or to tenants with an explicit
  non-disabled mailbox configured in Backstage for the controlled canary. Module access and `manage_email`
  permissions remain mandatory. This keeps migration and Google verification
  work visible without exposing Email to launch customers by default.
- Interface languages: Spanish, Catalan, English and Brazilian Portuguese.
- Overview metrics use the active subscription period instead of all-time
  conversation totals. Agora and the venue detail in Backstage expose up to 12
  retained billing periods with billable chatbot replies, conversations and
  messages; Backstage also includes the estimated AI cost for each period.
  Stripe-backed periods preserve their exact UTC renewal instants, while
  activity timestamps are rendered in each operator's browser time zone.
- Global day/night mode.
- Trial visible in sidebar.
- Upgrade button leading to the plans screen.
- Hiding of modules when the trial ends or there is no product access.

Pending:

- Aggregated dashboard per account.
- Improve visual consistency on some screens.
- Complete translations of less-used areas if new sections appear.

## Modules

### Attention Channel Foundation

Implemented:

- A versioned channel-agent contract covers Web, Email, Voice, WhatsApp and
  Instagram. Each channel has its own agent key, delivery mode, fallback modes,
  allowlisted actions and billing unit.
- Knowledge remains shared and governed per venue, while conversations,
  histories and identities remain channel-local. TALIA does not automatically
  match identities or share conversation context across channels.
- The common operational event vocabulary is bounded to received interactions,
  completed responses, fallbacks, handoffs and incidents. It excludes visitor
  content and raw provider identifiers.
- The canonical Attention channel and module key for the website agent is `web`.
  Historical billing, usage and entitlement rows are migrated to the same key;
  the commercial plan keys `basic` and `premium` identify products rather than
  Attention channels.

These contracts do not activate paused or planned channels. Entitlements,
provider verification and rollout controls remain mandatory before a venue can
use Email, Voice, WhatsApp or Instagram.

Reference:

- `docs/architecture/channel-agent-contracts.md`.

### Marketing

Status: foundation in development, gated per venue.

Implemented:

- Independent `marketing` entitlement and owner/admin `manage_marketing`
  permission in Agora.
- Backend-only Meta connection foundation scoped to one venue and one ad
  account, with encrypted credential envelopes, audited connect/disconnect
  operations and rollout disabled by default.
- Initial Agora Marketing surface showing connection and rollout state plus the
  `ads_read`, `ads_management` and `business_management` prerequisites.
- Supervised Meta OAuth flow with signed state, short-lived encrypted selection
  session and server-verified Business Portfolio/ad-account selection.
- Manual read-only synchronization of account totals and per-campaign Insights
  for selectable 7-, 30- and 90-day periods. Agora separates what happened,
  what is working and what needs review, and handles both a first sync and an
  account without campaigns.
- Account-level daily Insights use Meta's `time_increment=1` and feed a compact
  Recharts view where operators can inspect spend, link clicks or CTR without
  mixing incompatible units on a dual axis. Accounts without delivery retain a
  visible, explicit chart empty state instead of making the visualization
  disappear.
- Campaign comparison ranks the selected period by link clicks, spend or CTR,
  filters it by delivery status and keeps exact values in the campaign table.
  The global period selector always changes KPI cards, daily evolution and
  campaign Insights together; it never slices only one visualization.
- Backend-only, venue-scoped campaign snapshots. Account-level reach and
  frequency and the daily account series remain separate from campaign rows to
  avoid invalid aggregation.
- Supervised creation of the top-level Meta campaign object for three supported
  objectives. The server always sends `status=PAUSED` and
  `special_ad_categories=[]`; creation is idempotent, audited and unavailable
  until the venue connection has `rollout_enabled=true` and `ads_management`.
- Supervised traffic ad-set creation for an eligible campaign, with exact
  account-currency budget conversion, UTC schedule, country/age targeting,
  automatic placements and server-owned delivery settings. Requests are
  idempotent and always reach Meta as `PAUSED`.
- Supervised static traffic-ad creation for an ad set previously created by
  TALIA. The operator selects a Page promotable by the connected ad account,
  supplies bounded copy and destination, and uploads one JPEG or PNG image.
  TALIA validates the file signature, sends the bytes directly to Meta without
  retaining them, and uses the returned image hash to create the Page-backed
  creative and final ad idempotently. The ad is always sent as `PAUSED`.
- Marketing credentials and lifecycle are separate from Instagram direct
  messages and WhatsApp.

Pending:

- Creation of engagement/awareness ad sets once their promoted-object contract
  is defined, plus video and multi-asset creatives.
- Meta App Review, advanced access and Business Verification before a customer
  pilot.

Current guardrail:

- TALIA cannot activate advertising spend. Current writes can assemble a
  complete static traffic campaign, but campaign, ad set and final ad all remain
  `PAUSED`; no path changes provider status to `ACTIVE`.

Reference:

- `docs/architecture/marketing-module.md`.
- `docs/operations/meta-marketing-api-development.md`.

### Web Chatbot

Status: active.

Implemented:

- Configuration per venue.
- General active/inactive control in Agora. Disabling it hides the public widget
  and blocks new chat requests without affecting Accessibility or Knowledge.
- Newly provisioned chatbots remain inactive by default. Agora only allows an
  inactive chatbot to be activated after at least one active FAQ or one active,
  embedded knowledge fragment is ready; existing active tenants are not
  disabled retroactively.
- Settings save action is shown above the editor, activates only after a change,
  and warns before leaving the page with unsaved changes.
- Installable widget through one asynchronous external script. The same snippet
  can be pasted in the document head or before the closing body tag, waits for
  the host DOM, ignores duplicate tenant loads and keeps working when browser
  storage is unavailable.
- The installation panel documents the exact CSP allowlist required by the
  public widget origin. Operations can run `npm run widget:smoke -- --site URL
  --tenant UUID` before launch to verify the landing response, CSP, widget
  asset, CORS and public tenant configuration end to end.
- Agora also provides platform-specific installation steps for Next.js/Vercel,
  WordPress, Webflow, Shopify and generic HTML. The public widget records a
  throttled, domain-validated heartbeat after loading its configuration, so the
  installation assistant can confirm the origin and last successful detection
  without fetching customer URLs from the server. Disabled widgets return a
  normal silent configuration state and still report installation presence.
- Initial message and brand color.
- Configurable proactive greeting that appears beside the launcher after a delay
  without opening the chat panel; selecting it starts the conversation.
- Up to 24 tenant-scoped suggested questions can be created, activated,
  deactivated and reordered in Agora, with at most six visible at once. They use
  the chatbot's configured primary language and can remain general or target up
  to five page rules by exact hostname, path prefix or exact public URL.
  Contextual matches are shown first and remaining slots are filled with
  general questions without duplicate text. The configuration preview can
  simulate a public page URL, while the installed widget recalculates the
  suggestions on SPA navigation. Selections follow the normal agent/RAG flow
  and persist whether they were contextual or general plus the server-validated
  matching rule.
- Interactive, production-sized Agora preview for the launcher, proactive
  greeting, suggested questions and chat panel. The preview doubles as a test
  chat: messages are answered by the same agent as the public widget, using the
  venue's current Knowledge and saved settings (also while the widget is still
  switched off), and each answer lists the Knowledge sources it used or warns
  when none were used. Test messages are not stored as conversations, do not
  appear in analytics and do not count toward the plan; only their AI cost is
  recorded as an internal `ai_call`.
- Voice mode in the installed widget: microphone input (speech to text), a
  global `Alt+Shift+V` shortcut (`Option+Shift+V` on a Mac) for blind and low-vision visitors that opens
  the agent and starts listening, distinct audio cues and live-region
  announcements for every step, spoken replies (automatic for voice turns,
  optional "read answers aloud" toggle for typed turns) and local voice
  commands (stop, repeat, slower, write it), hands-free follow-up listening
  after spoken answers, an opt-in "Hola TALIA" wake word, and a per-venue
  voice chosen in Agora. Listening uses the browser's speech engine first
  (live transcript in the chat); TALIA's server recognition is used only in
  browsers without one. Speech goes through the guarded
  `/api/chat/[tenantId]/transcribe` and `/speech` routes to `talia-ai`
  (`/v1/voice/*`, OpenAI) on all plans, with measured per-call cost in
  `ai_usage_events`, and falls back to the browser's Web Speech engine. The
  widget privacy summary discloses voice processing; the Agora preview shows
  the voice controls (inert). Venues can switch voice off in Agora (Web Agent
  → Voice, `widget_config.voiceEnabled`, on by default): the widget then hides
  every voice control and the voice routes refuse with `voice_disabled`.
  Accessibility (EN 301 549 / WCAG 2.1 AA): the widget adds a hidden-until-
  focused access link as the first tab stop of the page ("Asistente de voz
  TALIA: pulsa Alt+Mayús+V…", opens the agent and starts listening) and is a
  named landmark ("Agente web TALIA"). Closing the voice greeting hides it for
  the current visit only (sessionStorage, per venue).
  After the first spoken answer, TALIA asks once by voice whether to turn on
  "Hola TALIA" for next time (explaining the browser listens for the phrase);
  it only turns on after a spoken "yes". Returning visitors with it on see
  "Di «Hola TALIA» o pulsa Hablar" in the greeting and can open TALIA by
  voice alone.
  Details: `docs/requirements/chatbot.md`.
- Auto-growing chat composer in production and preview, with `Enter` to send,
  `Shift + Enter` for line breaks and a bounded internal scroll for long drafts.
- Per-response feedback uses a localized TALIA micro-survey with compact
  Yes/No chips instead of generic thumbs-up/down icon buttons.
- Agora conversation details expose positive and negative response ratings.
  Responses with negative feedback or a controlled fallback offer an
  owner/admin-only supervised correction form. Confirming the correction
  creates an active manual FAQ with a deterministic link to the assistant
  message, reindexes the tenant's manual Knowledge source and records an audit
  event. The form does not ask for a response language: source-language
  metadata never governs TALIA's answer. Conversation text or public feedback
  alone never modifies Knowledge. The complete supervised-correction UI,
  including validation and indexing states, is localized in Spanish, Catalan,
  English and Brazilian Portuguese.
- Each TALIA response with recorded Knowledge evidence shows the operator the
  human-readable names of the sources used. The customer view deliberately
  omits scores, chunks, prompts and diagnostic metadata, and links to
  Knowledge only for members who can manage it. The same presentation is used
  in Web, WhatsApp and Instagram conversation details.
- The Agora conversation list is server-side paginated with selectable page
  sizes of 10, 25, 50 or 100 sessions. Each conversation
  row distinguishes pending negative responses, pending controlled fallbacks
  and supervised corrections already applied; these states link directly to
  the relevant assistant response. Negative visitor feedback and controlled
  fallbacks are presented to customers under one constructive
  "opportunity to improve" state; their technical causes remain separate in
  metadata for internal diagnosis. Conversation detail shows the newest turn
  first while preserving question-before-answer order inside each turn. The
  list displays and sorts by the latest message activity, not by the date when
  a long-running session originally started. Its header includes a review
  sticky navigator that remains visible while it cycles through responses with
  improvement opportunities. Each navigation step briefly highlights the
  related visitor question and TALIA response together, then keeps the selected
  turn visually active. Review
  controls stay collapsed until requested and allow an authorized operator to
  either correct and publish knowledge or validate TALIA's original response.
  Validation preserves the visitor's original rating, creates no Knowledge
  entry and records the human decision in message metadata and `audit_events`.
- Stable chatbot UI copy, including response ratings and the compact
  pre-restart survey, uses the chatbot's configured primary language. This UI
  language does not constrain the Answer Agent: TALIA still replies in the
  language used in each visitor message, and the initial message remains
  configurable as free text in any language.
- The widget host, chrome, composer and dynamic messages opt out of automatic
  browser translation so translated host pages cannot rewrite TALIA content.
- Public widget service errors are rendered as localized retry messages instead
  of exposing internal error codes to visitors.
- Channel prompt.
- Configurable fallback.
- Structured fallback policy delegated to `talia-ai`, with an optional tenant
  message, verified email/phone contacts, an explicit WhatsApp toggle and
  traceable fallback metadata in Backstage.
- Verified chat actions keep WhatsApp destinations separate from visible reply
  text, so the widget displays the configured phone number as the link label
  instead of exposing the full `wa.me` URL.
- Source-backed physical-address answers can include a verified location action.
  `talia-ai` copies the postal address from a cited Knowledge source and builds
  Google Maps destinations deterministically; Next validates them again before
  the widget renders a localized venue card, progressive embedded map and
  external Maps link. TALIA and ContigoSí allow only the exact Google Maps frame
  origins needed by that card; third-party hosts must do the same or the branded
  fallback and external link remain usable. If the Answer Agent omits its
  auxiliary location field, `talia-ai` can derive the card from one unambiguous
  cited postal address; it never chooses automatically between several venues.
  Unsupported postal addresses invalidate the full answer before rendering,
  and named venues are not admitted unless the selected tenant evidence
  actually supports that entity. Response traces retain bounded grounding-gate
  diagnostics so Backstage exports identify the exact critical fact or source
  declaration that caused a safe rejection.
- Explicit purchase and reservation turns can include a verified purchase CTA.
  Managed web ingestion preserves a bounded set of HTTPS transaction links in
  Knowledge; `talia-ai` requires the selected item and exact destination to
  belong to the same cited evidence before publishing an action. Next validates
  the service metadata again, and the widget renders a localized
  "Comprar/Buy" card instead of trusting or parsing a generated raw URL.
- International fallback phone input shared by onboarding, Agora and Backstage;
  country prefix and national number are edited separately while storage and
  service contracts keep a single normalized E.164 value.
- Persisted conversations and messages.
- Each new turn sends at most the six most recent messages from the same
  tenant-scoped public session to `talia-ai` (maximum 2,000 characters per
  message and 6,000 characters in total). This bounded context lets TALIA
  understand conversational references without exposing another venue or
  session; restarting the widget creates a new session and therefore clears the
  context.
- Conversation context is not treated as Knowledge. `talia-ai` rewrites a
  probable follow-up into a standalone semantic query and runs tenant-scoped
  retrieval again, so factual answers must still be supported by the current
  knowledge base.
- Each assistant turn persists a compact, versioned conversational-resolution
  state and the gateway sends it back on the next turn. The runtime
  distinguishes active, clarification, evidence-backed answer, partial answer
  and handoff states without treating model output as the authority. It allows
  at most two consecutive clarification requests before activating the
  controlled fallback, preventing open-ended clarification loops.
- Basic analytics of topics and intents.
- Usage tied to billing/limits.
- Internal chat runtime in `src/lib/agent-runtime/chat.ts`, with `talia-ai` as
  the sole provider for new web-chat responses.
- Next acts as a gateway: it validates tenant, limits and session, and delegates
  retrieval + response to `/v1/chat/respond`. `talia-ai` is the only executable
  web-agent provider; failures remain visible and have no secondary runtime
  fallback.
- `talia-ai` is the sole authority for visitor-language
  detection and response-language selection. Next sends the tenant language as
  `fallback_language` and requires `metadata.response_language` in successful
  responses.
- The latest visitor message is always authoritative for response language.
  Knowledge may be written in any other language; retrieval does not penalize a
  source for that difference, and the Answer Agent translates or synthesizes
  the evidence into the visitor's language.
- Agent runtime responses save compact sources (`id`, `source_id`, `source_type`, `score`) in the assistant message metadata, legacy conversation metadata, and usage for auditing.
- Backstage can opt a venue into an official-site search fallback. TALIA still
  completes its initial and bounded Knowledge retrieval first; only a final
  evidence fallback may invoke OpenAI hosted `web_search`, restricted
  server-side to the hostname in `theatres.website_url`. The visitor receives
  clickable inline official citations. Citation URLs and titles remain
  conversation trace metadata; searched page content is never written to
  Knowledge or embeddings. A missing, external or malformed citation fails
  closed to the existing controlled fallback.
- `talia-ai` reports measured usage separately for the Answer Agent, optional
  Language Agent, optional official web search and retrieval embedding. `talia-client` persists each
  component against a versioned OpenAI price in fractional USD microdollars.
- Backstage includes an AI cost view with current-month measured cost,
  projection, cost per response, token/cache totals and breakdowns by venue,
  model and component. A monthly table preserves up to 12 months of measured
  cost, responses, requests, tokens and cost per response, including zero-usage
  gaps. It updates when the view is loaded instead of polling in the background.
  Legacy heuristic estimates remain visibly separate.
- Backstage shows RAG health per venue, response traceability, original question, requested/used provider, model, language, retrieval status, low-confidence/fallback warnings, sources, scores, chunks retrieved from `talia-ai`, and internal actions to reprocess PDFs or retry embeddings.
- Bounded conversational retrieval remains fully traceable through the Next
  gateway: each initial or agent-requested Knowledge query is sanitized and
  persisted with its reason, result count, selected count, top score and status.
  Backstage renders those attempts in the RAG detail and includes them in the
  downloadable response-trace JSON, without requiring a database migration.
- Response traceability reports venue-wide feedback accuracy as useful responses
  divided by all positively or negatively rated responses, together with rating
  coverage so small or biased samples remain visible.
- Agora exposes the same venue-wide signal to customers as response
  satisfaction through a compact percentage in Overview. Conversations stays
  focused on the session list and per-response review state, while Analytics
  remains focused on intents, topics and demand trends.
- Every successful web-assistant turn persists a message-linked, idempotent
  analytics event from `talia-ai` with versioned topic, visitor intent,
  classification confidence and source. Deterministic runtime classification
  covers model-free paths, and the additive migration backfills historical
  assistant messages that were not analyzed after the n8n-to-`talia-ai`
  migration.
- Each Backstage response trace can be downloaded as a versioned JSON file with
  the question, answer, provider, language decision, retrieval sources/chunks,
  feedback and persisted trace metadata for support and debugging without
  screenshots.
- Backstage can request an on-demand AI diagnostic for a persisted response
  trace that is unrated or rated negatively, or for a Knowledge source with
  processing errors. Positively rated responses do not expose the action. The browser submits only
  the tenant and artifact identifiers; the authenticated server reloads and
  sanitizes the evidence, rate-limits the operator, and calls the internal
  `talia-ai` diagnostic endpoint server-to-server. Reports distinguish probable
  causes from proven root causes, expose confidence, evidence, recommended
  checks and limitations, can be downloaded as versioned JSON, and never run a
  repair automatically. Successful generations record an audit event without
  persisting the report body, and their measured model usage is attributed to
  the venue as a Backstage diagnostic component.
- Response diagnostics run a fresh, bounded hybrid Knowledge search from the
  original visitor question before generating the report. The diagnostic agent
  compares up to 12 tenant-scoped results with the answer and original trace,
  identifies contradictory values and scope mismatches, and cites the source
  IDs behind each observation. Generic FAQs, section headings and source
  language are not treated as evidence for an attribute of a named event when
  a subject-specific source says otherwise. Backstage shows the investigation
  query, number of evidences reviewed and competing values directly in the
  report. Retrieval-embedding and diagnostic-agent usage remain measured as
  separate AI components.

Pending:

- Validate in production that `metadata.retrieval.chunks` appears in Backstage after deploying `talia-ai`.
- Consolidate knowledge as the primary source ahead of free-form prompts.
- Improve integrated preview/test.
- Validate `/v1/chat/respond` and its analytics contract under production load.
- Persist bounded gateway/service incidents that fail before an assistant
  message exists, so the same Backstage diagnostic flow can cover hard HTTP
  failures as well as persisted fallbacks and response-quality incidents.

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
- Manual FAQs and Excel/CSV are saved as `knowledge_items` and also maintain
  item-level embeddings. Their rendered aggregate chunks remain available
  during backfill but the unified retrieval functions avoid returning duplicate
  structured evidence once the item-level representation is ready.
- Agora currently exposes Web, Files and FAQs as knowledge-source tabs. Apps and
  Spreadsheets remain implemented but hidden, including from direct tab URLs,
  until their product reliability is audited.
- `knowledge_chunks` table for documentary fragments prepared for retrieval and embeddings.
- Internal ingestion seam in `src/lib/knowledge/ingestion.ts`, which uploads PDFs to Storage and delegates parsing/chunking to `talia-ai`; for structured sources it normalizes text and delegates chunking/embeddings to `talia-ai`.
- Internal retrieval seam in `src/lib/knowledge/retrieval.ts`.
- Embeddings for documentary chunks and curated FAQs are delegated to `talia-ai`
  via server-to-server HTTP; Next does not generate embeddings locally.
- Semantic retrieval and indexed full-text retrieval over the complete active
  tenant corpus are delegated to `talia-ai`; in the main chatbot flow with
  retrieval happens inside `/v1/chat/respond`.
- Reprocessable PDFs from Storage: Backstage can ask `talia-ai` to regenerate chunks and embeddings without re-uploading the file.
- Backstage allows reindexing all of a venue's knowledge and reprocessing individual RAG sources.
- Backstage can delete an individual processed source after explicit
  confirmation. The deletion is tenant-scoped, removes its structured items and
  cascaded chunks/documents/sync history, cleans up stored files when applicable
  and records the platform-admin action for audit.
- Local text-only fallback in Next over chunks/items.
- Installed-web detection is opt-in per venue and defaults to disabled. Agora
  presents it as one advanced fallback toggle rather than as a second refresh
  schedule: managed sync first uses direct HTTP and browser capture, while the
  installed widget can submit visible public page text as pages are visited.
  Enabling the customer-facing fallback selects automatic capture; the legacy
  manual mode remains supported internally for existing configuration.
- Installed-widget captures are one logical `knowledge_sources` row per venue
  (`type = web_snapshot`, `config.installed_web_logical = true`, enforced by a
  unique index) with one `knowledge_documents` row per captured page
  (`capture_method = installed_widget`) and chunks linked by `document_id`.
  Pages register, refresh, fail and get retired individually; Agora keeps
  listing them page by page while Backstage and the Knowledge health counters
  show a single web source. Capture tokens and "Desvincular" act on the page.
  Response evidence from these chunks is labelled with the page title.
- Installed-web sources are connected to `knowledge_sources` as
  `web_snapshot`: the installed widget extracts visible DOM text and `talia-ai`
  normalizes, chunks and generates embeddings. Automatic captures persist a
  content hash and skip reingestion when the page has not changed. In automatic
  mode, `talia-ai` also evaluates likely cultural programme pages and stores
  typed events alongside the unchanged RAG representation. Strong programme
  URLs are admitted directly; other pages require both cultural and explicit
  date signals. Generic pages are marked as evaluated without an extraction
  model call, and each content hash is evaluated at most once.
- Installed-web capture applies a lifecycle policy: archive listing URLs (tag,
  category, author, pagination, search, feed and `?s=`/`?paged=`-style
  parameters) are never registered and existing ones are deactivated when seen
  again; a venue can register at most 50 new installed pages per rolling 24h;
  and an operator-retired page remains as a `removed` document tombstone while
  its chunks and structured events are deleted. A later visit cannot silently
  recreate or reactivate that retired content.
- Installed-web URLs are canonicalized across the widget, API and database. Tracking parameters are discarded, functional query parameters are preserved, duplicate rows are merged before a unique tenant/type/URL index is enforced, and page-presence writes are throttled to once per hour per source.
- Agora can configure managed single-page, sitemap and bounded-website sources
  with manual, daily, weekly or monthly refresh policies. The persistence model
  separates logical sources, canonical documents and auditable sync runs, with
  worker leases, idempotency and per-run counters. Monthly refreshes clamp to
  the final valid day of shorter months instead of overflowing into the next one.
- Website and sitemap sources can be limited to path sections ("Solo estas
  rutas" / "Ignorar estas rutas", stored as `config.include_paths` /
  `config.exclude_paths`, `*` within a segment). A website source that starts
  below the root (e.g. `/programacio/`) is kept inside that path by default.
  `talia-ai` only crawls in-scope links and retires pages captured before the
  scope was narrowed. Scope is set when the source is created.
- Managed pages whose structured programme has fully ended (every event has a
  last date more than 3 days ago) are retired automatically on the next sync:
  chunks and events are deleted and the page stays as a `removed` tombstone
  (`removed_reason = programme_expired`) until its content changes. Pages
  without events, or with an event lacking an end date, are not retired by date.
- Managed URL, sitemap and bounded-website sources can opt into structured
  programme extraction. Each successful changed-page capture keeps the normal
  RAG chunks and also refreshes typed current events with dates, times,
  duration, participants, location, purchase links and field-level evidence.
  This repeats automatically only when the source is enabled and its refresh
  policy is daily, weekly or monthly; a `manual` source requires **Actualizar
  ahora**.
- The installed widget remains available as a first-party capture fallback for
  public pages that direct HTTP/browser capture cannot read reliably.
- Backstage summarizes each source as four distinct operational concepts:
  capture scope, update automation, structured events and ready knowledge.
  Technical sync, extraction and embedding counters remain available in a
  collapsed detail panel, and operators can enqueue an explicit refresh.
  Sources with processing errors expose an inline technical diagnostic with the
  latest error code, run, incident counters and embedding failures; operators
  can also download the sanitized JSON diagnostic from the same source row.
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
- Agora and Backstage present one shared operational sequence for managed web
  knowledge: queued, worker phase, embedding preparation and ready. Supabase
  Realtime invalidates active sync runs, while embedding preparation uses a
  bounded polling fallback because chunk updates are not exposed through the
  realtime publication.
- Installed-widget capture is labelled as an optional, independent ingestion
  path. Enabling or disabling it does not activate, pause or block managed web
  sources.
- Customers can register an idempotent support request from an affected source.
  The request stores tenant/source/run context without page or chunk bodies and
  sends a traceable support email when the application mail provider is
  configured; otherwise it remains pending for operational follow-up.
- Managed public URLs are the primary Agora web-source flow. Installed-widget
  capture remains an optional fallback for pages the managed worker cannot read
  reliably.
- A website whose `robots.txt` blocks TALIA now keeps the specific
  `robots_disallowed` diagnosis. Agora offers two explicit resolutions instead
  of presenting the generic no-pages-discovered failure: authorize
  `TALIA-AI-KnowledgeSync` in `robots.txt`, or verify ownership with a widget
  heartbeat from the same origin and record revocable owner consent for that
  source. The latter may ignore only `robots.txt`; same-origin discovery,
  public-network validation, excluded private routes, HTTP access controls and
  all quotas remain enforced. Consent and revocation are written to
  `audit_events`, and a successful authorization queues a retry.
- Managed page refreshes preserve secure ticket, booking, reservation and
  checkout links as source-scoped chunk metadata for verified chatbot purchase
  actions. Existing sources need their normal refresh/reprocess cycle to gain
  this metadata; no schema migration is required.
- Structured import per the configuration screen, already connected to RAG for manual FAQs and Excel/CSV.

Product direction:

- Keep Knowledge as the common core for chatbot, email, voice and future channels.
- Expand in the future toward Sources, Guidelines, Workflows and Actions.
- Recommended evolution: keep moving ingestion/retrieval/AI to `talia-ai` while keeping TALIA's internal contract stable.
- The managed web worker is deployed on Fly as a five-minute cron. A production
  onboarding canary on 2026-08-03 completed a bounded website crawl without
  failed or blocked pages; continue monitoring operational alerts while usage
  expands to more venues.

### Email Agent

Status: active testing with Gmail.

Product principle:

- TALIA does not send emails automatically.
- TALIA generates supervised drafts.
- The human reviews and sends from Gmail.

Implemented:

- Gmail OAuth connection from Agora.
- Email configuration is the last Email Agent section in Agora. It owns the
  mailbox connection and a customer-facing `Prepare drafts automatically`
  setting. Enabling it also enables the classification prerequisite; disabling
  it leaves manual processing available. It never enables automatic sending.
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
  Postgres global lease and durable `email_sync_runs` records. Vercel Cron wakes
  the scheduler every 15 minutes for controlled canary operation on the Pro
  plan. The email agent remains outside the commercial launch. Message and
  thread uniqueness keep repeated deliveries idempotent.
- Failed mailbox syncs retry up to three consecutive runs before the connection
  remains in an actionable error state.
- Deleting an email thread from TALIA atomically removes its stored messages and
  drafts while retaining only connection-scoped SHA-256 suppression markers.
  Later mailbox syncs skip those exact provider messages without downloading
  their content again; a genuinely new reply in the provider thread can still
  be imported.

Pending:

- Complete Google OAuth verification.
- Complete Microsoft Graph.
- Observe the managed scheduler for a complete operating window before
  considering any commercial email launch.
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

### WhatsApp

Status: native Cloud API pilot in development; not commercially available.

Implemented:

- Meta webhook verification and signed-body validation in the Next.js provider
  boundary.
- A real inbound message from Meta's test number reaches the deployed TALIA
  webhook successfully.
- Backend-only venue mapping by WABA ID and phone-number ID.
- Atomic, idempotent persistence of channel-local contacts, conversations and
  messages, followed by a durable inbound job.
- Rollout, module and entitlement gates fail closed before agent processing.
- Unsupported message types enter human handoff without retaining the raw Meta
  payload.
- WhatsApp content and channel-local identities use the common 90-day content
  retention policy.
- A dedicated `/v1/whatsapp/respond` runtime in `talia-ai` applies WhatsApp
  policy and retrieval without provider side effects. Its safe default returns
  a non-sendable human handoff when evidence is insufficient.
- A durable worker in `talia-client` claims inbound jobs, persists one
  idempotent outbound reply before calling Meta, sends through Cloud API and
  atomically completes the message, conversation and job after confirmation.
- Consecutive messages from the same WhatsApp conversation are coalesced into
  one natural-language turn after a 2.5-second quiet window, capped at 8 seconds
  from the first message. Every inbound message remains individually durable
  and billable, while the turn produces one agent request and at most one reply.
- A final transactional freshness check prevents TALIA from sending a generated
  reply when a newer message has arrived. The stale turn is requeued and
  regenerated with the new message instead.
- The first confirmed automated response in a conversation clearly identifies
  Talía as an AI agent for the venue in the response language, falling back to
  the venue language. A duplicate leading greeting is removed from the generated
  answer before the disclosure is prepended. The disclosure is not repeated and
  is only persisted after Meta confirms the send.
- Confirmed Meta rejections can retry with bounded backoff. Network timeouts or
  invalid success responses are treated as uncertain outcomes and move to
  handoff without automatic resend.
- Signed Meta status webhooks reconcile outbound `sent`, `delivered`, `read` and
  `failed` states idempotently without allowing out-of-order callbacks to move a
  message backwards. Confirmed delivery failures enter operator handoff. Only
  bounded error codes and pricing classifications are retained.
- The webhook schedules a best-effort post-response worker wake-up, while a
  one-minute authenticated Vercel cron recovers durable jobs independently.
- WhatsApp message, fallback and measured AI usage events use the canonical
  `whatsapp` module/channel without phone numbers or message content in their
  operational metadata.
- Àgora exposes WhatsApp as an independent attention agent with its own
  conversation history. Tenant viewers can inspect masked conversation lists
  and transcripts. A reusable in-conversation navigator jumps directly to the
  message that triggered the current human handoff, where the operator controls
  are shown inline. Owners, administrators and operators can reply or ignore:
  opening the reply composer atomically claims the handoff, a confirmed manual
  send resolves it automatically, and ignoring resolves it without sending.
  Both decisions are audited. Manual sends are persisted before Meta is called,
  are idempotent, and never retry automatically when the provider outcome is
  uncertain.
- Owners, administrators and operators can also take over any active WhatsApp
  conversation before an error or handoff occurs. While manual mode is active,
  new inbound messages remain durable but automatic replies are suppressed;
  the assigned operator can send multiple replies and explicitly return the
  conversation to TALIA. Takeover and release are tenant-scoped and audited.
- Owners and administrators can review any successfully sent TALIA answer in a
  WhatsApp transcript, edit the grouped inbound question and official answer,
  and publish it as an active manual FAQ. The FAQ is linked to the originating
  WhatsApp message, reindexed immediately and remains governed through the
  shared venue Knowledge surface.
- WhatsApp treats the latest inbound message as authoritative for response
  language; the venue language is only a fallback when the message language
  cannot be established.
- Venue owners and administrators have a dedicated WhatsApp connection surface
  in Àgora. It uses Meta Embedded Signup v4, exchanges the 30-second browser code
  server-to-server, validates the selected WABA/phone pair and stores the
  business token plus generated two-step PIN in a per-connection AES-256-GCM
  envelope. Outbound automated and manual sends resolve the credential by venue
  and phone-number ID; the original environment token remains only as a
  backwards-compatible pilot source.

Validated in the current pilot:

- The end-to-end canary with TALIA's test tenant and Meta test number receives,
  grounds and returns a real WhatsApp response.
- A six-message burst is coalesced into one grounded response, all six inbound
  jobs complete, and Meta delivery callbacks advance the outbound message to
  `read` without generating another agent turn.
- Real low-confidence/manual-reply and unsupported-message/ignore handoffs have
  been completed from Àgora against Meta. Both cases resolve correctly and are
  reflected in Supabase.

Pending:

- Configure the production Login for Business configuration, allowed domains
  and App Review/Access Verification gates in Meta.
- Run the first non-TALIA tenant onboarding canary through Embedded Signup and
  retain evidence of inbound, automated outbound and operator handoff.
- Add managed credential renewal, revocation and disconnect flows before broad
  commercial availability.

Reference:

- `docs/operations/whatsapp-cloud-api-development.md`.

### Instagram

Status: gated pilot active for venues with the Instagram module; external
customer access still depends on Meta review.

Implemented:

- The independent `instagram_agent` contract already defines direct response,
  channel-local conversations and identities, safe handoff, message usage and
  90-day content retention.
- The first pilot is explicitly limited to inbound one-to-one text DMs from an
  Instagram Business or Creator account. Publishing, comments, insights,
  campaigns, multimedia automation and unsolicited outbound messaging are out
  of scope.
- Direct Instagram Login is the selected first connection method. It requests
  only `instagram_business_basic` and
  `instagram_business_manage_messages`; Facebook Login remains a deferred,
  evidence-driven alternative.
- OAuth preparation uses dedicated Instagram configuration, signed ten-minute
  state bound to the venue and initiating TALIA user, server-side code exchange
  and server-side long-lived-token exchange. Provider error bodies and tokens
  are never exposed through application errors.
- A backend-only `instagram_connections` foundation enforces one Professional
  account per venue and prevents the same Instagram account from being attached
  to two venues. Provider tokens use a dedicated AES-256-GCM envelope, browser
  database roles have no table or RPC access, and newly connected accounts stay
  rollout-disabled.
- Owners and administrators have a dedicated `manage_instagram` permission for
  the dedicated Agora pilot-connection surface. It appears as a distinct
  Instagram agent in Attention only when the venue has the Instagram module
  enabled; it exposes connection configuration, never a shared WhatsApp view
  or a misleading active-message state. Connection, summary, credential
  retrieval and local disconnect operations are service-role-only and audited
  where they change customer state.
- Authenticated connect and callback routes now enforce the Instagram module,
  commercial access, venue permission and initiating-user binding. The callback
  exchanges the one-use code server-side, upgrades the token, validates a
  Business or Creator profile and persists only the encrypted long-lived
  credential.
- OAuth completion also subscribes the authorized Professional account to the
  `messages` webhook through its own long-lived token before saving the local
  connection. Configuring the app-level callback in Meta alone is not treated
  as an account subscription.
- New Instagram accounts remain rollout-disabled for the gated pilot. Once an
  account has been explicitly approved for the pilot, disconnecting and
  reconnecting that same Professional account preserves the approval and
  restores message routing; replacing it with a different account never
  inherits the previous account's approval.
- OAuth requests both `id` and `user_id` from `GET /me`, but stores the
  Professional account `user_id` as text. The app-scoped `id` is not a webhook
  routing identifier; using it would make valid `messages` notifications appear
  unmatched. Keeping the Professional ID as text also prevents JavaScript
  precision loss and aligns connection, webhook and Send API identifiers.
- A dedicated `/api/webhooks/meta/instagram` boundary validates Meta's
  verification challenge and the raw-body `X-Hub-Signature-256` before parsing
  any notification. It accepts only inbound Instagram message events and does
  not reuse the WhatsApp parser or ingestion path.
- Backend-only `instagram_contacts`, `instagram_conversations`,
  `instagram_messages` and `instagram_inbound_jobs` tables provide channel-local
  identity, durable deduplication and an independent queue. The ingestion RPC
  fails closed before storing content unless the connection, rollout, module
  and entitlement are all active; raw webhook envelopes are never persisted.
- The pilot parser queues only one-to-one text DMs. Attachments, unsupported
  message types and empty messages are persisted minimally as Instagram
  handoffs, without attempting automated processing.
- A dedicated Instagram worker leases only `instagram_inbound_jobs`, loads at
  most six messages from the same Instagram conversation and calls the separate
  `/v1/instagram/respond` contract. `talia-ai` fixes the channel to Instagram
  and identifies every decision as `instagram_agent` while continuing to use
  venue-scoped Knowledge and the controlled grounding runtime.
- Direct text replies are prepared durably before any Meta side effect and sent
  through `graph.instagram.com` with the connection's encrypted token. Once the
  provider-send boundary starts, ambiguous or failed outcomes become a handoff
  and are never automatically retried, preventing duplicate customer replies.
- Instagram message and measured AI usage are recorded with Instagram-specific
  idempotency keys. A dedicated minute cron recovers jobs when the webhook
  wake-up is unavailable.
- Agora exposes a tenant-scoped Instagram conversation list and ordered detail
  view to members with conversation access. Contact identifiers remain masked,
  and the UI never merges Instagram history or identities with Web or WhatsApp.
- Web, WhatsApp and Instagram conversation screens share the same history,
  detail-header and message-list components. Each channel maps its own records
  into that presentation contract and supplies channel-only controls (review,
  deletion, handoff, FAQ promotion) through explicit extension slots.
- Venue owners and administrators can reconnect or disconnect the Instagram
  account from Settings. Disconnect first asks Meta to remove the account-level
  webhook subscription, then disables rollout and removes local credentials;
  the existing conversation history is retained.
- Instagram handoffs can be claimed by an authorized owner, administrator or
  operator from the conversation detail. A human-authored reply is persisted
  before the provider call, uses the normal response window during the first 24
  hours and uses Meta's `HUMAN_AGENT` tag only between 24 hours and seven days.
  Replies after seven days fail closed. While a handoff is claimed, new inbound
  DMs remain durable but TALIA does not enqueue an automated response. Manual
  sends are idempotent, audited and never retried automatically after an
  uncertain provider outcome; a confirmed send or an explicit ignore resolves
  the handoff.
- Instagram also mirrors WhatsApp's proactive operator controls. An authorized
  operator can take over any active conversation, atomically suppress queued AI
  work, reply manually and later return it to TALIA. Manual mode remains active
  after each human reply until that explicit release. Reactive handoffs expose
  the shared attention navigator, highlight every pending message and render
  the reply controls inline with the latest message that needs attention.
- Confirmed Instagram replies from TALIA can be promoted into an editable,
  tenant-scoped FAQ using the same supervised Knowledge workflow as WhatsApp.
  Operator-authored replies are never offered as reusable TALIA answers.

Pending:

- Add channel retention controls before broader availability; reactive and
  proactive human handoff are complete.
- Complete a real app-role canary and the Meta review required for external
  customer accounts.

References:

- `docs/requirements/instagram-agent.md`.
- `docs/operations/instagram-api-development.md`.

## Billing and Trial

Implemented:

- 7-day free trial.
- After the trial, access to the Web Agent is replaced by an upgrade prompt.
- `/upgrade` screen with the two public Web Agent plans: Basic at EUR 60/month
  and Premium at EUR 120/month for the Spanish market.
- The current commercial plan is read-only in chatbot settings. Subscription
  changes go through the billing flow and cannot be written by the widget settings
  server action.
- Paid account owners can open Stripe Customer Portal from `/upgrade` to manage
  billing or confirm cancellation. Scheduled cancellations remain active until
  the paid period ends, and webhook metadata makes that state visible in Agora.
- Stripe Checkout.
- Monthly Stripe prices selected from the onboarding market. Spain has approved
  EUR prices; Mexico and Brazil remain price-on-request pending local amounts.
- Documented Stripe webhook.
- The former public add-ons and annual cadence are not part of the current offer.

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
- The sidebar identifies the active platform profile with its canonical name,
  email and platform role next to the logout action.

Pending:

- Consolidate internal permissions.
- Improve visibility of self-serve users and per-venue configurations.

## Legal, OAuth and Operations

Current documents:

- Privacy policy for Google OAuth: `docs/legal/privacy-policy-google-en.md`.
- Terms of Service: `docs/legal/terms-of-service-google-en.md`.
- Data Processing Agreement: `docs/legal/data-processing-agreement.md`.
- Subprocessor list: `docs/legal/subprocessors.md`.
- Mexico and Brazil regional notice templates: `docs/legal/regional-notice-mexico-es.md` and `docs/legal/regional-notice-brazil-pt-br.md`.
- EU AI Act operational controls and release gate: `docs/compliance/eu-ai-act.md`.
- Google OAuth production checklist: `docs/operations/google-cloud-production-oauth.md`.
- Data retention: `docs/operations/data-retention.md`.
- Web conversations and messages are retained for 90 days after their last activity. Venue owners and administrators can manually delete individual Web, WhatsApp and Instagram conversations from Àgora using the same shared control in each channel; their content is removed, while usage records stripped of conversation and session identifiers remain for 12 months and already-recorded consumption stays unchanged for billing integrity.
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
