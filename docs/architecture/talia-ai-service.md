# TALIA AI Service

## Decision

Crear un repositorio separado llamado `talia-ai` y desplegarlo en Fly.io.

Este servicio debe concentrar la logica de IA, RAG, ingestion pesada, embeddings, prompts tecnicos y providers. El repo actual `talia-client` debe seguir siendo Agora/widget/API publica ligera mientras migramos por fases.

## Objetivo

Separar TALIA en tres capas:

```txt
talia-client
  Next.js: Agora, widget, marketing, BFF/API publica ligera

talia-api
  Futuro backend producto: tenants, billing, permisos, usage, configuracion

talia-ai
  Servicio IA: chat, email draft, RAG, ingestion, embeddings, prompts, providers
```

Primera prioridad: crear `talia-ai`. `talia-api` vendra despues.

## Stack Recomendado

Usar TypeScript + Node.js.

Stack base:

- Runtime: Node.js 22 LTS.
- Framework HTTP: Fastify.
- Validacion: Zod.
- Tests: Vitest.
- Logger: Pino.
- Deploy: Docker en Fly.io.
- DB: Supabase Postgres via `@supabase/supabase-js` con service role.
- IA: OpenAI Responses API y Embeddings API.

No usar Next.js en `talia-ai`.

Razon:

- El servicio no tiene UI.
- Necesita workers, procesos largos y jobs.
- Debe ser portable fuera de Vercel.
- Fastify + Docker encaja mejor con Fly y con un futuro backend propio.

## Principios

- El widget nunca llama directamente a `talia-ai`.
- Agora/Next llama a TALIA API local o futura `talia-api`.
- `talia-ai` se llama solo server-to-server.
- Todo request debe estar autenticado con clave interna.
- Los contratos deben ser JSON estables y versionados bajo `/v1`.
- n8n queda como adapter temporal, no como cerebro central.
- El servicio debe ser stateless salvo DB/colas externas.
- Toda operacion larga debe ser idempotente.

## Seguridad

Autenticacion inicial:

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

Reglas:

- No aceptar llamadas desde navegador.
- No exponer service role al cliente.
- No loguear prompts completos con datos personales salvo modo debug controlado.
- No enviar emails automaticamente.
- No crear enlaces inventados en respuestas.
- Todas las queries deben filtrar por `tenant_id`.

## Endpoints MVP

### GET /health

Devuelve estado basico.

Response:

```json
{
  "ok": true,
  "service": "talia-ai",
  "version": "0.1.0"
}
```

### POST /v1/chat/respond

Genera respuesta de chatbot.

Request:

```json
{
  "tenant_id": "uuid",
  "session_id": "session-publica",
  "message": "Pregunta del usuario",
  "language": "es",
  "tenant": {
    "name": "Sala Ejemplo",
    "system_prompt": "Reglas del asistente",
    "fallback_email": "info@example.com",
    "fallback_phone": "+34..."
  },
  "relevant_knowledge": [
    {
      "id": "chunk-id",
      "source_id": "source-id",
      "source_type": "pdf",
      "question": "Documento sala",
      "answer": "Fragmento relevante",
      "category": "documento",
      "score": 0.91
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "reply": "Respuesta final para el widget",
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

Errores:

```json
{
  "ok": false,
  "error": "model_unavailable",
  "details": "OpenAI responded with 429"
}
```

### POST /v1/knowledge/retrieve

Recupera conocimiento relevante.

Request:

```json
{
  "tenant_id": "uuid",
  "query": "Hay acceso para silla de ruedas?",
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
      "content": "Texto recuperado",
      "score": 0.88,
      "retrieval": "vector"
    }
  ]
}
```

### POST /v1/knowledge/embed

Genera embeddings para chunks pendientes o fuente concreta.

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

Primer MVP puede no implementar ingestion completa. Si se implementa, debe aceptar una fuente ya subida o texto normalizado. No subir archivos binarios grandes directamente como primer corte.

Request inicial recomendado:

```json
{
  "tenant_id": "uuid",
  "source_id": "source-id",
  "source_type": "pdf",
  "text": "Texto extraido por TALIA o por worker",
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

No es primer corte si Google/Microsoft siguen bloqueando producto, pero debe estar previsto.

Regla:

- Nunca enviar emails.
- Solo devolver borrador.

Request:

```json
{
  "tenant_id": "uuid",
  "message": {
    "subject": "Consulta",
    "body": "Texto del cliente",
    "from": "cliente@example.com"
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
    "subject": "Re: Consulta",
    "body": "Borrador revisable por humano"
  }
}
```

## Estructura del Repo

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

Primer deploy:

```bash
fly launch --name talia-ai --region mad
fly secrets set TALIA_AI_INTERNAL_API_KEY=...
fly secrets set SUPABASE_URL=...
fly secrets set SUPABASE_SERVICE_ROLE_KEY=...
fly secrets set OPENAI_API_KEY=...
fly deploy
```

`fly.toml` minimo:

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

Cuando haya mas trafico:

- subir a 1GB RAM;
- mantener una maquina minima encendida si la latencia de cold start molesta;
- separar worker de ingestion si los PDFs crecen.

## Integracion con talia-client

Crear provider nuevo en este repo:

```txt
src/lib/agent-runtime/talia-ai-provider.ts
```

Variables en `talia-client`:

- `TALIA_AI_BASE_URL`
- `TALIA_AI_INTERNAL_API_KEY`
- `CHAT_AGENT_PROVIDER=talia-ai|n8n`

Regla:

- Si `CHAT_AGENT_PROVIDER=talia-ai`, `runChatAgent` llama a `talia-ai`.
- Si falla con 5xx o timeout, puede caer a n8n temporalmente si el tenant tiene webhook.
- El widget no cambia.

## Fases de Implementacion

### Fase 1 - Skeleton

- Crear repo.
- Fastify server.
- `/health`.
- Auth interna.
- Dockerfile.
- Fly deploy.
- Tests basicos.

Done cuando:

- `curl /health` responde.
- llamadas sin auth devuelven 401.
- CI local pasa.

### Fase 2 - Chat Provider

- Implementar `/v1/chat/respond`.
- Usar OpenAI Responses API.
- Recibir `relevant_knowledge`.
- Devolver contrato estable.
- Integrar `TaliaAiChatAgentProvider` en `talia-client`.

Done cuando:

- un tenant puede responder sin n8n;
- n8n sigue como fallback;
- usage se sigue registrando en `talia-client`.

### Fase 3 - Retrieval

- Mover retrieval semantico a `talia-ai`.
- Leer `knowledge_chunks`.
- Usar `match_knowledge_chunks`.
- Mantener fallback textual.

Done cuando:

- `/v1/knowledge/retrieve` devuelve fuentes con score;
- `talia-client` puede delegar retrieval sin cambiar widget.

### Fase 4 - Embeddings Worker

- Implementado en `talia-ai` con `/v1/knowledge/embed` y `/v1/knowledge/embed/pending`.
- Procesar batches desde Fly/cron.
- Reintentar errores con `retry_errors`.
- Loguear metricas.

Done cuando:

- Next deja de generar embeddings. Hecho: `talia-client` solo llama al adaptador HTTP.
- Fly procesa embeddings periodicamente. Pendiente de configuracion de deploy/cron.

### Fase 5 - Ingestion Worker

- Mover parsing/chunking pesado a `talia-ai`.
- Mantener Agora como UI de fuentes.
- Añadir estado `processing/error/ready` visible.

Done cuando:

- PDF upload no bloquea la request de Agora;
- errores de parsing quedan registrados por fuente.

## Criterios de Calidad

- Tests unitarios para prompts, schemas, auth y parsing de respuestas.
- Tests de contrato para cada endpoint.
- Timeouts en llamadas OpenAI.
- Retries con backoff solo en errores transitorios.
- Logs estructurados con request id.
- No mezclar prompts tecnicos con UI/config editable.
- No depender de n8n dentro de `talia-ai`.

## Fuera de Alcance Inicial

- Panel admin propio.
- Multi-provider complejo.
- Cola distribuida avanzada.
- Fine-tuning.
- Auto-envio de email.
- Voz.
- WhatsApp/Instagram.

## Orden de Trabajo para el Agente

1. Crear repo `talia-ai`.
2. Implementar skeleton Fastify + auth + health.
3. Implementar schemas compartidos de `/v1/chat/respond`.
4. Implementar `OpenAIChatProvider`.
5. Añadir Dockerfile y `fly.toml`.
6. Añadir README con comandos.
7. Volver a `talia-client` y añadir `TaliaAiChatAgentProvider`.
8. Probar con un tenant real en modo staging.
