# Scalable Architecture Roadmap toward Lisbon 2026

> Historical planning snapshot. Its n8n migration steps describe the starting
> point and are not current architecture; `talia-ai` is now the sole executable
> AI runtime and the temporary adapter has been removed.

Date: 19 June 2026

## Context

TALIA is about to start selling with a functional MVP for early users. The goal isn't to rewrite now, but to prevent the MVP from becoming a trap as customers, documents, conversations and channels grow.

Principle:

- The widget, Agora and the data model must keep a stable contract.
- n8n can keep going as a temporary adapter.
- AI, ingestion, retrieval and orchestration must be movable to our own backend without breaking the product.

## Goal for November

Before Web Summit Lisbon in November 2026, TALIA should be able to support:

- Multiple real tenants with isolated configuration.
- A stable, measurable web chatbot.
- Knowledge with FAQs, Excel/CSV, PDFs and URLs.
- A supervised email agent once Google approves OAuth.
- Minimal observability of errors, cost and usage.
- The ability to replace n8n with our own backend, piece by piece.

## Target architecture

```txt
Widget / Agora
  -> TALIA App/API
    -> Attention Core
      -> Knowledge Retrieval
      -> Agent Runtime
      -> Channel Adapters
      -> Usage/Billing
    -> Storage
```

### Deep modules to build

#### 1. Attention Core

Interface:

- receives a normalized interaction;
- knows tenant, channel, user/session, message and context;
- returns response, action, status, sources and usage.

Initial implementation:

- can keep calling n8n.

Future implementation:

- own runtime with OpenAI/other providers.

Leverage:

- chatbot, email, voice and future channels use the same central logic.

Locality:

- fallback rules, traceability, cost and sources live in one place.

#### 2. Knowledge Ingestion

Interface:

- receives a source: manual, Excel, PDF, installed web, Google Sheet;
- produces normalized sources and chunks;
- exposes status: pending, processing, ready, error.

Initial implementation:

- Excel/PDF via the TALIA App, delegating parsing/chunking to `talia-ai`.
- Installed-web captures via the widget and `talia-ai`.

Future implementation:

- own worker/backend with OCR, embeddings and retries.

Leverage:

- all channels consume the same knowledge base.

Locality:

- parsing, chunking, OCR and retry errors don't leak into screens or agents.

#### 3. Knowledge Retrieval

Interface:

- receives tenant, channel, question and limits;
- returns relevant chunks with score, source_id, source_type and snippet.

Initial implementation:

- top items by priority/category.

Future implementation:

- embeddings/vector store + filters by tenant/channel/language.

Leverage:

- improves answers without changing the widget, email or workflows.

Locality:

- ranking and source citation are fixed in a single module.

#### 4. Agent Runtime

Interface:

- receives a normalized task: chat reply, email classify, email draft, clear view;
- returns a stable JSON contract;
- logs cost, latency, model, errors and tokens.

Initial implementation:

- n8n adapter.

Future implementation:

- own backend with provider adapters.

Leverage:

- changing model/provider doesn't affect Agora or the widget.

Locality:

- technical prompts, safety, retries and observability live together.

#### 5. Channel Adapters

Interface:

- translate each channel into the Attention Core's common contract.

Adapters:

- Web Chat adapter.
- Gmail adapter.
- Future Outlook adapter.
- Future Voice adapter.

Leverage:

- adding channels doesn't duplicate AI or knowledge.

Locality:

- OAuth, Gmail drafts, widget sessions and telephony stay isolated per channel.

## Phase plan

### Phase 0 - Sellable MVP

Goal: ship what's already functional without blocking sales.

Includes:

- Web chatbot.
- Manual knowledge, Excel/CSV, basic PDFs and URLs.
- Accessibility MVP.
- Trial/upgrade.
- Email agent hidden or in controlled beta until OAuth.

Don't add yet:

- mandatory embeddings;
- OCR;
- complex multi-provider AI;
- full n8n rewrite.

### Phase 1 - Contract stabilization

Goal: make n8n replaceable.

Tasks:

- Define TypeScript contracts for:
  - `ChatInteractionInput`;
  - `AgentRuntimeResult`;
  - `KnowledgeRetrievalResult`;
  - `UsageEvent`.
- Make `/api/chat/:tenantId` talk to a `ChatAgentProvider`. Started: `src/lib/agent-runtime/chat.ts`.
- Keep the workflow provider behind a replaceable adapter. Completed historically;
  the adapter was later removed when `talia-ai` became the sole provider.
- Document internal payloads.

Result:

- The widget doesn't know whether n8n or our own backend is answering.

### Phase 2 - Real retrieval

Goal: make the knowledge base scale.

Tasks:

- Create the `knowledge_chunks` table. Started: the table already exists as the documentary base for PDFs.
- Separate FAQ-type `knowledge_items` from documentary chunks. Started: PDFs are stored as chunks and temporarily mirrored into `knowledge_items`.
- Store source, page, language and hash metadata.
- Create a `KnowledgeRetriever` module. Started: `src/lib/knowledge/retrieval.ts` already encapsulates the contract.
- First deterministic retrieval by text/priority. Started: retrieval queries chunks and items.
- Prepare a column for embeddings or an auxiliary table. Started: `knowledge_chunks.embedding` uses pgvector and `match_knowledge_chunks` enables optional semantic search.
- Prepare embeddings backfill/retries. Started: `talia-ai` exposes `/v1/knowledge/embed` and `/v1/knowledge/embed/pending`; Next no longer runs embeddings locally.

Result:

- Long PDFs and multiple sources don't bloat full prompts.

### Phase 3 - Own backend/worker

Goal: move heavy jobs out of Next.

Tasks:

- New repo or separate package:
  - `talia-ai-runtime`;
  - `talia-worker`;
  - or a monorepo when convenient.
- Jobs:
  - PDF parsing;
  - optional OCR;
  - embeddings;
  - URL sync;
  - email classification/drafting.
- Queue:
  - Supabase queue, pg-boss, Inngest, Trigger.dev or a custom worker.

Result:

- Agora only triggers ingestion and queries status.
- Slow processes don't depend on the web request.

### Phase 4 - Real observability and billing

Goal: know what's happening and what it costs.

Tasks:

- Log usage by:
  - tenant;
  - channel;
  - module;
  - model;
  - estimated/real tokens;
  - cost;
  - latency;
  - error_code.
- Internal Backstage panel for agent errors.
- Per-tenant failure alerts.
- Rate limits per tenant and channel.

Result:

- We can sell and operate without flying blind.

### Phase 5 - Demo/event preparation

Goal: reach November with a solid story.

Tasks:

- Clean demo tenant.
- Demo landing page with widget + accessibility.
- Realistic knowledge dataset.
- Polished onboarding flow.
- Demo mode not dependent on personal accounts.
- Demo script and rollback plan.

Result:

- A showable product, not just a technical prototype.

## Recommended decisions now

1. Keep the MVP deployment.
2. Stop growing n8n as the central brain.
3. Use n8n only as an adapter while we build stable interfaces.
4. Start with `Knowledge Retrieval` before complex embeddings.
5. Split backend/AI once there are two real adapters:
   - current n8n;
   - initial own runtime.

## Recommended first issues

1. Create TS contracts for the chat and retrieval runtime.
2. Encapsulate the chat workflow call behind the runtime interface. This
   historical migration step is complete and the temporary adapter is removed.
3. Create a deterministic `KnowledgeRetriever`.
4. Add the `knowledge_chunks` table.
5. Migrate PDFs from `knowledge_items` to `knowledge_chunks`.
6. Log real chatbot usage.
7. Create an internal agent-error dashboard.

## Risks

- Putting PDFs directly into `knowledge_items` works for the MVP, but doesn't scale.
- n8n with large prompts will be expensive, slow and hard to debug.
- Without per-tenant usage/cost, pricing and limits will be guesswork.
- Without internal contracts, decoupling the backend later will be a rewrite.

## Success criteria

The architecture will be ready to grow when:

- the widget doesn't depend on n8n;
- Agora doesn't know which AI provider is answering;
- Knowledge can process sources in the background;
- every response can explain which source it used;
- every tenant has observable limits, cost and errors;
- changing an AI provider means swapping an adapter, not touching the whole product.
