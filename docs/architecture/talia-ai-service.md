# TALIA AI Service

## Decision

Create a separate repository called `talia-ai` and deploy it to Fly.io.

This service should concentrate AI logic, RAG, heavy ingestion, embeddings, technical prompts and providers. The current `talia-client` repo should stay as a lightweight Agora/widget/public API while we migrate in phases.

## Goal

Split TALIA into three layers:

```txt
talia-client
  Next.js: Agora, widget, marketing, lightweight BFF/public API

talia-api
  Future product backend: tenants, billing, permissions, usage, configuration

talia-ai
  AI service: chat, email draft, RAG, ingestion, embeddings, prompts, providers
```

First priority: create `talia-ai`. `talia-api` comes later.

## Recommended Stack

Use TypeScript + Node.js.

Base stack:

- Runtime: Node.js 22 LTS.
- HTTP framework: Fastify.
- Validation: Zod.
- Tests: Vitest.
- Logger: Pino.
- Deploy: Docker on Fly.io.
- DB: Supabase Postgres via `@supabase/supabase-js` with service role.
- AI: OpenAI Responses API and Embeddings API.

Don't use Next.js in `talia-ai`.

Reason:

- The service has no UI.
- It needs workers, long-running processes and jobs.
- It must be portable outside Vercel.
- Fastify + Docker fits Fly better, and a future own backend too.

## Principles

- The widget never calls `talia-ai` directly.
- Agora/Next calls the local TALIA API or the future `talia-api`.
- `talia-ai` is only called server-to-server.
- Every request must be authenticated with an internal key.
- Contracts must be stable, versioned JSON under `/v1`.
- n8n stays as a temporary adapter, not the central brain.
- The service must be stateless except for external DB/queues.
- Every long-running operation must be idempotent.

## Security

Initial authentication:

- Header `Authorization: Bearer $TALIA_AI_INTERNAL_API_KEY`.

Variables:

- `TALIA_AI_INTERNAL_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `LOG_LEVEL`
- `NODE_ENV`

Rules:

- Don't accept calls from the browser.
- Don't expose the service role to the client.
- Don't log full prompts with personal data except in a controlled debug mode.
- Don't send emails automatically.
- Don't invent links in responses.
- All queries must filter by `tenant_id`.

## MVP Endpoints

### GET /health

Returns basic status.

Response:

```json
{
  "ok": true,
  "service": "talia-ai",
  "version": "0.1.0"
}
```

### POST /v1/chat/respond

Generates a chatbot response.

Request:

```json
{
  "tenant_id": "uuid",
  "session_id": "public-session",
  "message": "User's question",
  "fallback_language": "es",
  "tenant": {
    "name": "Example Venue",
    "system_prompt": "Assistant rules",
    "fallback_email": "info@example.com",
    "fallback_phone": "+34..."
  },
  "relevant_knowledge": [
    {
      "id": "chunk-id",
      "source_id": "source-id",
      "source_type": "pdf",
      "question": "Venue document",
      "answer": "Relevant excerpt",
      "category": "document",
      "score": 0.91
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "reply": "Final answer for the widget",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "usage": {
    "input_tokens": 1200,
    "output_tokens": 180
  },
  "sources": [
    {
      "id": "chunk-id",
      "source_id": "source-id",
      "source_type": "pdf",
      "score": 0.91
    }
  ],
  "metadata": {
    "intent": "tickets",
    "confidence": 0.82
  }
}
```

Errors:

```json
{
  "ok": false,
  "error": "model_unavailable",
  "details": "OpenAI responded with 429"
}
```

### POST /v1/knowledge/retrieve

Retrieves relevant knowledge.

Request:

```json
{
  "tenant_id": "uuid",
  "query": "Is there wheelchair access?",
  "channel": "chatbot",
  "limit": 5,
  "language": "es"
}
```

Response:

```json
{
  "ok": true,
  "matches": [
    {
      "id": "chunk-id",
      "source_id": "source-id",
      "source_type": "pdf",
      "content": "Retrieved text",
      "score": 0.88,
      "retrieval": "vector"
    }
  ]
}
```

### POST /v1/knowledge/embed

Generates embeddings for pending chunks or a specific source.

Request:

```json
{
  "tenant_id": "uuid",
  "source_id": "source-id",
  "limit": 20,
  "retry_errors": true
}
```

Response:

```json
{
  "ok": true,
  "checked": 20,
  "embedded": 18,
  "failed": 2,
  "skipped": 0
}
```

### POST /v1/knowledge/ingest

The first MVP may not implement full ingestion. If implemented, it should accept an already-uploaded source or normalized text. Don't upload large binary files directly in this first cut.

Recommended initial request:

```json
{
  "tenant_id": "uuid",
  "source_id": "source-id",
  "source_type": "pdf",
  "text": "Text extracted by TALIA or by a worker",
  "metadata": {
    "file_name": "info.pdf"
  }
}
```

Response:

```json
{
  "ok": true,
  "source_id": "source-id",
  "chunks": 12
}
```

### POST /v1/email/draft

The email runtime also exposes `POST /v1/email/classify`. Classification and
drafting are separate server-to-server decisions. `talia-ai` does not receive
OAuth tokens and does not call Gmail or Outlook; provider draft creation remains
in `talia-client`.

Rule:

- Never send emails.
- Only return a draft.

Request:

```json
{
  "tenant_id": "uuid",
  "message": {
    "subject": "Inquiry",
    "body": "Customer's text",
    "from": "customer@example.com"
  },
  "relevant_knowledge": []
}
```

Response:

```json
{
  "ok": true,
  "should_generate_draft": true,
  "draft": {
    "subject": "Re: Inquiry",
    "body": "Draft for human review"
  }
}
```

## Repo Structure

```txt
talia-ai/
  src/
    server.ts
    env.ts
    routes/
      health.ts
      chat.ts
      knowledge.ts
      email.ts
    services/
      chat/
        chat-runtime.ts
        prompts.ts
        openai-chat-provider.ts
      knowledge/
        retrieval.ts
        embeddings.ts
        ingestion.ts
        chunking.ts
      email/
        draft-runtime.ts
    adapters/
      supabase.ts
      openai.ts
    shared/
      auth.ts
      errors.ts
      logger.ts
      schemas.ts
  tests/
  Dockerfile
  fly.toml
  package.json
  tsconfig.json
  README.md
```

## Package Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

## Fly.io

First deploy:

```bash
fly launch --name talia-ai --region mad
fly secrets set TALIA_AI_INTERNAL_API_KEY=...
fly secrets set SUPABASE_URL=...
fly secrets set SUPABASE_SERVICE_ROLE_KEY=...
fly secrets set OPENAI_API_KEY=...
fly deploy
```

Minimal `fly.toml`:

```toml
app = "talia-ai"
primary_region = "mad"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

When there's more traffic:

- bump to 1GB RAM;
- keep one machine warm if cold-start latency becomes an issue;
- split off an ingestion worker if PDF volume grows.

## Integration with talia-client

Create a new provider in this repo:

```txt
src/lib/agent-runtime/talia-ai-provider.ts
```

Variables in `talia-client`:

- `TALIA_AI_BASE_URL`
- `TALIA_AI_INTERNAL_API_KEY`
- `CHAT_AGENT_PROVIDER=talia-ai|n8n`

Rule:

- If `CHAT_AGENT_PROVIDER=talia-ai`, `runChatAgent` calls `talia-ai`.
- If it fails with a 5xx or times out, it can temporarily fall back to n8n if the tenant has a webhook.
- The widget doesn't change.

## Implementation Phases

### Phase 1 - Skeleton

- Create the repo.
- Fastify server.
- `/health`.
- Internal auth.
- Dockerfile.
- Fly deploy.
- Basic tests.

Done when:

- `curl /health` responds.
- Calls without auth return 401.
- Local CI passes.

### Phase 2 - Chat Provider

- Implement `/v1/chat/respond`.
- Use the OpenAI Responses API.
- Receive `relevant_knowledge`.
- Return a stable contract.
- Integrate `TaliaAiChatAgentProvider` into `talia-client`.

Done when:

- a tenant can get a response without n8n;
- n8n still works as a fallback;
- usage is still logged in `talia-client`.

### Phase 3 - Retrieval

- Move semantic retrieval to `talia-ai`.
- Read `knowledge_chunks`.
- Use `match_knowledge_chunks`.
- Keep the textual fallback.

Done when:

- `/v1/knowledge/retrieve` returns sources with a score;
- `talia-client` can delegate retrieval without changing the widget.

### Phase 4 - Embeddings Worker

- Implemented in `talia-ai` with `/v1/knowledge/embed` and `/v1/knowledge/embed/pending`.
- Process batches from Fly/cron.
- Retry errors with `retry_errors`.
- Log metrics.

Done when:

- Next stops generating embeddings. Done: `talia-client` only calls the HTTP adapter.
- Fly processes embeddings periodically. Pending deploy/cron configuration.

### Phase 5 - Ingestion Worker

- Move heavy parsing/chunking to `talia-ai`.
- Keep Agora as the sources UI.
- Add a visible `processing/error/ready` status.

Done when:

- PDF upload doesn't block Agora's request;
- parsing errors are logged per source.

## Quality Criteria

- Unit tests for prompts, schemas, auth and response parsing.
- Contract tests for every endpoint.
- Timeouts on OpenAI calls.
- Retries with backoff only on transient errors.
- Structured logs with request id.
- Don't mix technical prompts with editable UI/config.
- Don't depend on n8n inside `talia-ai`.

## Initial Out of Scope

- Own admin panel.
- Complex multi-provider support.
- Advanced distributed queue.
- Fine-tuning.
- Automatic email sending.
- Voice.
- WhatsApp/Instagram.

## Agent Work Order

1. Create the `talia-ai` repo.
2. Implement the Fastify skeleton + auth + health.
3. Implement shared schemas for `/v1/chat/respond`.
4. Implement `OpenAIChatProvider`.
5. Add Dockerfile and `fly.toml`.
6. Add README with commands.
7. Go back to `talia-client` and add `TaliaAiChatAgentProvider`.
8. Test with a real tenant in staging mode.
