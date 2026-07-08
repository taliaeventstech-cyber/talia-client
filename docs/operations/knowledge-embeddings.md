# Knowledge Embeddings

## Ownership

Knowledge embeddings are no longer generated in `talia-client`.

`talia-client` maintains:

- Supabase migrations for `knowledge_chunks.embedding`;
- initial ingestion of PDFs into `knowledge_chunks`;
- HTTP adapter toward `talia-ai`.

`talia-ai` maintains:

- calls to the OpenAI Embeddings API;
- writing of `embedding`, `embedding_model`, `embedding_status`;
- backfill and retries;
- global worker endpoint.

## Variables in talia-client

- `TALIA_AI_BASE_URL`
- `TALIA_AI_INTERNAL_API_KEY`

## Variables in talia-ai

- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TALIA_AI_INTERNAL_API_KEY`

## Endpoints

Process a specific source:

```txt
POST $TALIA_AI_BASE_URL/v1/knowledge/embed
```

Payload:

```json
{
  "tenant_id": "tenant-uuid",
  "source_id": "source-uuid",
  "limit": 20,
  "retry_errors": true
}
```

Process global pending items:

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

## Example

```bash
curl -X POST "$TALIA_AI_BASE_URL/v1/knowledge/embed/pending" \
  -H "Authorization: Bearer $TALIA_AI_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit":20,"retry_errors":true}'
```

## Expected behavior

- Chunks are created in `pending`.
- `talia-ai` moves them to `processing`.
- If embeddings are generated successfully, they move to `ready`.
- If OpenAI or Supabase fails, they move to `error`.
- If `talia-ai` is unavailable when a PDF is uploaded, the chunks remain in `pending` for the worker.
