# Agent Runtime

## Goal

`/api/chat/:tenantId` must not know whether the response comes from n8n, from an in-house backend, or from another AI provider. The widget's public API must always talk to TALIA, and TALIA must decide the runtime.

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
CHAT_AGENT_PROVIDER=n8n
CHAT_AGENT_PROVIDER=talia-ai
```

Variables for `talia-ai`:

```txt
TALIA_AI_BASE_URL=https://talia-ai.fly.dev
TALIA_AI_INTERNAL_API_KEY=...
```

If `CHAT_AGENT_PROVIDER=talia-ai` and the service returns a temporary 5xx error, TALIA can fall back to `N8nChatAgentProvider` if the tenant has `n8nWebhookUrl` configured.

Route handler responsibilities:

- validate tenant, session, and limits;
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

The migration must be gradual: keep n8n as a fallback while `talia-ai` stabilizes chat, retrieval, and embeddings.
