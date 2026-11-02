# Agent Runtime

## Goal

`/api/chat/:tenantId` delegates new web-chat responses to `talia-ai`. The
widget's public API always talks to TALIA and never calls a workflow provider
directly.

## Current State

The chat runtime seam lives in:

```txt
src/lib/agent-runtime/chat.ts
```

Main contract:

```ts
runChatAgent({
  tenantId,
  sessionId,
  message,
  n8nWebhookUrl,
  relevantKnowledge,
})
```

Current provider:

- `N8nChatAgentProvider`
- `TaliaAiChatAgentProvider`

Current selector:

```txt
TALIA_AI_BASE_URL=https://...
TALIA_AI_INTERNAL_API_KEY=...
```

Variables for `talia-ai`:

```txt
TALIA_AI_BASE_URL=https://talia-ai.fly.dev
TALIA_AI_INTERNAL_API_KEY=...
```

If `talia-ai` returns an error, the gateway surfaces that failure. It does not
fall back to n8n, because doing so would reintroduce a second runtime contract
and produce inconsistent retrieval, language and analytics behavior.

Route handler responsibilities:

- validate tenant, session, and limits;
- pass the widget's validated IANA time zone as trusted request context;
- log usage of the user's message;
- retrieve knowledge;
- respond directly if there is a reliable match;
- if there is no direct match, call the runtime;
- log usage of the response.

Runtime responsibilities:

- encapsulate the AI/orchestrator provider;
- normalize errors;
- return `{ ok, provider, reply }` on success;
- return `{ ok: false, provider, status, error }` on failure.

## Next Step

Implement `/v1/chat/respond` in the `talia-ai` repo following `docs/architecture/talia-ai-service.md`.

The provider selector can already decide by environment:

```txt
n8n -> in-house runtime -> external backend
```

Historical n8n adapters and webhook routes may remain during the rollback
window, but the provider factory cannot select or fall back to them.
