# Talía Product Roadmap

Talía is a SaaS platform for the cultural sector. The first module, **Attention**, is not a single chatbot: it is a multichannel AI support layer for theatres, festivals, promoters and cultural venues.

The current product proves the web-chat channel. The roadmap below turns that proof into a product architecture that can support chat, email and voice without creating separate islands per channel.

---

## Product Modules

### Attention
Status: active.

Purpose: resolve visitor/customer questions across support channels, escalate when needed, and produce actionable service analytics.

Channels:
- Web chatbot
- Email agent
- Voice agent
- WhatsApp / Instagram later

Core capabilities:
- Unified conversations
- Tenant-specific knowledge base
- Agent instructions and policies
- Human fallback / escalation
- Topic and intent analytics
- Channel-level performance metrics

### Data
Status: planned.

Purpose: build audience, intent and behavior intelligence from interactions.

Examples:
- Audience segments
- Question trends
- Demand signals
- Propensity and campaign inputs
- Cross-channel insight dashboards

### Marketing
Status: planned.

Purpose: use Attention + Data signals to trigger personalized and automated campaigns.

Examples:
- Follow-up emails
- Abandoned ticketing recovery
- Personalized recommendations
- Campaign audience exports

---

## Product Architecture Direction

Avoid building one system for web chat, another for email and another for voice. The channels should be adapters over a shared core.

Shared core entities:
- `tenants`
- `agents`
- `channels`
- `conversations`
- `messages`
- `knowledge_sources`
- `handoff_rules`
- `analytics_events`

Channel adapters:
- Web widget
- Email inbox / SMTP provider / inbound webhook
- Voice provider / call transcript webhook
- WhatsApp / Instagram integrations later

The shared core should answer:
- Which tenant owns this interaction?
- Which agent/channel handled it?
- Which knowledge source was used?
- Was the answer deterministic, scraped, or model-only?
- Was the conversation escalated?
- What topic/intent/business outcome was detected?

---

## Roadmap

### Phase 0 — Demo Stabilization
Goal: make the current TNC/IDEAL-style demos reliable.

- Keep the generic multi-tenant n8n workflow working.
- Route widget traffic through TALIA API to avoid browser CORS issues.
- Store conversations, messages and topics per tenant.
- Make widget branding configurable per tenant.
- Improve dashboard visual system and navigation.
- Use website scraping as a temporary source for live public info.

Exit criteria:
- A theatre can test the widget from its website/demo page.
- Conversations appear in the dashboard.
- The assistant can answer common website-backed questions.
- Tenant branding can be adjusted without code changes.

### Phase 1 — Deterministic Knowledge Base
Goal: stop relying on scraping as the primary source of truth.

- Add `knowledge_sources` table.
- Support manual FAQs.
- Support CSV/XLSX upload for structured venue information.
- Store source metadata: title, type, language, status, last updated.
- Expose tenant knowledge through an internal API for n8n/agents.
- Add dashboard UI to create, edit, enable/disable and preview sources.
- Decide first retrieval strategy:
  - Simple deterministic FAQ matching for MVP.
  - Embeddings/vector search later if needed.

Exit criteria:
- Tenant can upload or enter key information.
- Agent answers from stored tenant knowledge before scraping.
- Dashboard shows which source was used when possible.

### Phase 2 — Attention Core Model
Goal: prepare for email and voice without rewriting the product.

- Add `agents` table.
- Add `channels` table.
- Extend `conversations` with `channel_id`, `agent_id`, `status`, `priority`.
- Extend `messages` with provider metadata and source references.
- Add statuses: `open`, `resolved`, `escalated`, `failed`.
- Add handoff rules per tenant.
- Update dashboard from "chat conversations" to "Attention inbox".

Exit criteria:
- Web chat is represented as one channel inside Attention.
- Future email/voice channels can write to the same conversation model.
- The dashboard language no longer assumes only chat.

### Phase 3 — Email Agent
Goal: handle inbound email with the same knowledge and tenant policies.

- Add inbound email provider.
- Parse inbound emails into conversations/messages.
- Generate draft or automated replies.
- Store email-specific metadata.
- Add approval mode before full automation.
- Track response time and resolution status.

Exit criteria:
- Tenant can connect/support a support email.
- Email conversations appear in Attention.
- The agent can draft replies using tenant knowledge.

### Phase 4 — Voice Agent
Goal: provide voice support without fragmenting analytics.

- Choose voice provider.
- Store call transcripts as conversations/messages.
- Add call metadata: duration, caller, recording URL when allowed.
- Use the same knowledge base and handoff rules.
- Add voice-specific analytics.

Exit criteria:
- Voice interactions appear in the same Attention dashboard.
- The same tenant knowledge powers chat, email and voice.

### Phase 5 — Data Module
Goal: turn support interactions into cultural business intelligence.

- Normalize analytics events across channels.
- Add audience/question trend dashboards.
- Add exports and reporting.
- Define signals that Marketing can consume.

Exit criteria:
- Dashboard shows cross-channel trends.
- Attention data can inform operational and marketing decisions.

### Phase 6 — Marketing Module
Goal: automate personalized follow-up from reliable first-party signals.

- Define campaign triggers from conversation outcomes.
- Add audience exports/segments.
- Add approval flows for generated campaigns.
- Integrate with email/CRM providers.

Exit criteria:
- Tenant can act on Attention/Data insights directly inside Talía.

---

## Near-Term Backlog

Highest leverage next tasks:

1. Design and migrate `knowledge_sources`.
2. Add dashboard CRUD for FAQs.
3. Add internal endpoint: `GET /api/internal/tenants/[tenantId]/knowledge`.
4. Update n8n workflow to fetch deterministic knowledge before scraping.
5. Rename dashboard IA sections from chatbot-only language toward Attention/inbox language.
6. Add source attribution in stored assistant messages.
7. Define `agents` and `channels` schema, even if only web chat is active.

---

## Product Principles

- Tenant configuration must live in Supabase, not in code or one-off workflows.
- Channels are adapters; conversations and knowledge are shared.
- Deterministic tenant knowledge should be preferred over scraping.
- Scraping is useful as a fallback, not as the product's memory.
- Every automated answer should be traceable to a source or fallback policy where possible.
- The dashboard should explain what happened operationally, not just show raw chat logs.
