# Knowledge Embeddings

## Ownership

Los embeddings de conocimiento ya no se generan en `talia-client`.

`talia-client` mantiene:

- migraciones de Supabase para `knowledge_chunks.embedding`;
- ingesta inicial de PDFs en `knowledge_chunks`;
- adaptador HTTP hacia `talia-ai`.

`talia-ai` mantiene:

- llamadas a OpenAI Embeddings API;
- escritura de `embedding`, `embedding_model`, `embedding_status`;
- backfill y reintentos;
- endpoint worker global.

## Variables en talia-client

- `TALIA_AI_BASE_URL`
- `TALIA_AI_INTERNAL_API_KEY`

## Variables en talia-ai

- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TALIA_AI_INTERNAL_API_KEY`

## Endpoints

Procesar una fuente concreta:

```txt
POST $TALIA_AI_BASE_URL/v1/knowledge/embed
```

Payload:

```json
{
  "tenant_id": "uuid-del-tenant",
  "source_id": "uuid-de-la-fuente",
  "limit": 20,
  "retry_errors": true
}
```

Procesar pendientes globales:

```txt
POST $TALIA_AI_BASE_URL/v1/knowledge/embed/pending
```

Payload:

```json
{
  "limit": 20,
  "retry_errors": true
}
```

## Ejemplo

```bash
curl -X POST "$TALIA_AI_BASE_URL/v1/knowledge/embed/pending" \
  -H "Authorization: Bearer $TALIA_AI_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit":20,"retry_errors":true}'
```

## Comportamiento esperado

- Los chunks se crean en `pending`.
- `talia-ai` los pasa a `processing`.
- Si se generan embeddings, pasan a `ready`.
- Si falla OpenAI o Supabase, pasan a `error`.
- Si `talia-ai` no esta disponible al subir un PDF, los chunks quedan en `pending` para el worker.
