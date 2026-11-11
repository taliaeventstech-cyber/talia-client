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
})
```

Current provider:

- `TaliaAiChatAgentProvider`

Runtime configuration:

```txt
TALIA_AI_BASE_URL=https://...
TALIA_AI_INTERNAL_API_KEY=...
```

Variables for `talia-ai`:

```txt
TALIA_AI_BASE_URL=https://talia-ai.fly.dev
TALIA_AI_INTERNAL_API_KEY=...
```

If `talia-ai` returns an error, the gateway surfaces that failure. There is no
secondary provider or workflow fallback.

Route handler responsibilities:

- validate tenant, session, and limits;
- pass the widget's validated IANA time zone as trusted request context;
- log usage of the user's message;
- pass bounded conversation state and venue policy to the runtime;
- log usage of the response.

Runtime responsibilities:

- encapsulate the AI/orchestrator provider;
- retrieve venue-scoped Knowledge and ground the response;
- normalize errors;
- return `{ ok, provider, reply }` on success;
- return `{ ok: false, provider, status, error }` on failure.

The former n8n provider, callback routes and venue webhook configuration were
removed after the production rollback window closed. Backstage still accepts
`n8n` as a historical trace label so previously recorded executions remain
inspectable; it is not an executable provider.
