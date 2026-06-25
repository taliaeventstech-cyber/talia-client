# Agent Runtime

## Objetivo

`/api/chat/:tenantId` no debe saber si la respuesta viene de n8n, de un backend propio o de otro proveedor IA. La API publica del widget debe hablar siempre con TALIA y TALIA debe decidir el runtime.

## Estado actual

El seam de runtime de chat vive en:

```txt
src/lib/agent-runtime/chat.ts
```

Contrato principal:

```ts
runChatAgent({
  tenantId,
  sessionId,
  message,
  n8nWebhookUrl,
  relevantKnowledge,
})
```

Provider actual:

- `N8nChatAgentProvider`
- `TaliaAiChatAgentProvider`

Selector actual:

```txt
CHAT_AGENT_PROVIDER=n8n
CHAT_AGENT_PROVIDER=talia-ai
```

Variables para `talia-ai`:

```txt
TALIA_AI_BASE_URL=https://talia-ai.fly.dev
TALIA_AI_INTERNAL_API_KEY=...
```

Si `CHAT_AGENT_PROVIDER=talia-ai` y el servicio devuelve un error temporal 5xx, TALIA puede caer a `N8nChatAgentProvider` si el tenant tiene `n8nWebhookUrl` configurado.

Responsabilidades del route handler:

- validar tenant, session y limites;
- registrar uso del mensaje de usuario;
- recuperar conocimiento;
- responder directo si hay match fiable;
- si no hay match directo, llamar al runtime;
- registrar uso de la respuesta.

Responsabilidades del runtime:

- encapsular provider IA/orquestador;
- normalizar errores;
- devolver `{ ok, provider, reply }` en exito;
- devolver `{ ok: false, provider, status, error }` en fallo.

## Siguiente paso

Implementar `/v1/chat/respond` en el repo `talia-ai` siguiendo `docs/architecture/talia-ai-service.md`.

El selector de provider ya puede decidir por entorno:

```txt
n8n -> runtime propio -> backend externo
```

La migracion debe ser gradual: mantener n8n como fallback mientras `talia-ai` estabiliza chat, retrieval y embeddings.
