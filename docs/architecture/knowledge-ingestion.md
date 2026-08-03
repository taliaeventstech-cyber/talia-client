# Knowledge Ingestion

## Goal

The knowledge base must accept several sources without coupling the product to n8n:

- Manual FAQs.
- Excel/CSV.
- PDFs.
- Installed web with signed snapshots from the widget.
- Managed single-page, sitemap, and bounded website sources.
- Google Sheets and other apps later on.

## Current State

TALIA stores normalized knowledge in:

- `knowledge_sources`: origin of the information.
- `knowledge_documents`: canonical pages owned by a multi-page source.
- `knowledge_items`: units consumable by chatbot, email, and future channels.
- `knowledge_chunks`: document fragments prepared for retrieval and future embeddings.
- `knowledge_sync_runs`: auditable, idempotent refresh executions.

Ingestion begins behind the internal module `src/lib/knowledge/ingestion.ts`. Agora validates permissions/form and coordinates the source, but PDF parsing, chunking, document writing, and embeddings live in `talia-ai`.

The new chatbot consumes `talia-ai` when `CHAT_AGENT_PROVIDER=talia-ai`. `knowledge_items` still exists for UI, editing, and textual fallback, but structured sources are also reflected in `knowledge_chunks` for semantic retrieval.

## PDFs

In the current MVP, a PDF is processed in a hybrid way:

1. The user uploads a PDF from Knowledge.
2. `talia-client` creates or updates `knowledge_sources`.
3. `talia-client` uploads the PDF to the private bucket `knowledge-files`.
4. `talia-client` calls `talia-ai /v1/knowledge/ingest` with `source_id` and the storage path.
5. `talia-ai` downloads the PDF, extracts text, and splits it into bounded fragments.
6. `talia-ai` writes `knowledge_chunks`, cleans up obsolete chunks, and marks the source as `ready`.
7. `talia-client` requests embeddings from `talia-ai /v1/knowledge/embed`; if it fails, the chunks remain `pending` for the worker.

This approach is deliberately simple: it lets the product work now, but it does not replace a definitive RAG.

## Manual FAQs and Excel/CSV

Structured sources already follow the same RAG path as PDFs:

1. The user creates/edits/deletes an FAQ or imports an Excel/CSV file from Knowledge.
2. `talia-client` keeps `knowledge_items` as the editable model and fallback.
3. `talia-client` recomposes the complete source as normalized text:
   - visitor's question;
   - official answer;
   - language;
   - priority/confidence;
   - topic, if present.
4. `talia-client` calls `talia-ai /v1/knowledge/ingest` with `source_type` `manual`, `xlsx`, or `csv` and the normalized text.
5. `talia-ai` splits the source into `knowledge_chunks`, removes obsolete chunks, and marks the source as `ready`.
6. `talia-client` requests embeddings from `talia-ai /v1/knowledge/embed`.

The decision is to keep `knowledge_items` for now because:

- the Agora UI edits FAQs row by row;
- Backstage and legacy parts can still read items;
- it allows textual fallback if `talia-ai` is unavailable;
- it avoids a destructive migration while the RAG is stabilized.

Once the RAG is consolidated, `knowledge_items` could become an editorial view or disappear from the runtime.

## Installed Web

The client's own pages can be incorporated as RAG sources without server-side
URL reading from `talia-client`. This flow is opt-in per venue and defaults to
disabled:

1. The client installs the widget script on their website.
2. An administrator enables installed-page detection in Agora and selects
   manual or automatic processing.
3. The widget registers detected canonical pages as
   `knowledge_sources.type = web_snapshot` only while detection is enabled.
4. In manual mode, Agora exposes capture actions and generates a signed snapshot
   URL for the selected page.
5. In automatic mode, the widget extracts visible text from the DOM and submits
   it together with the page registration; manual capture actions remain hidden.
6. `talia-client` validates the tenant, domain and capture policy, then calls
   `talia-ai /v1/knowledge/ingest` with `source_type = web_snapshot`.
7. `talia-ai` normalizes the content, splits it into chunks, updates
   `knowledge_chunks`, and leaves the source ready for embeddings/retrieval.

Automatic processing stores a SHA-256 hash of the normalized visible text. A
ready source with the same hash is not sent through ingestion again, avoiding
unchanged-page token and embedding costs.

The tenant's official website remains administrative data. It is not used to automatically create URL sources.

## Managed Web Sources

TALIA also supports logical web sources whose lifecycle is independent from an
individual browser visit:

- `url`: one public page;
- `sitemap`: URLs discovered from an XML sitemap;
- `website`: a bounded same-site crawl starting from an approved URL.

Agora owns source configuration and exposes `manual`, `daily`, `weekly`, and
`monthly` refresh policies. A source owns many `knowledge_documents`; documents
own their chunks through `knowledge_chunks.document_id`. This prevents one row
per widget visit and lets the system preserve unchanged chunks.

Each refresh is represented by `knowledge_sync_runs`. The database guarantees:

- one queued/running execution per source;
- tenant-scoped idempotency keys;
- worker leases with expiry and safe reclaim;
- bounded terminal errors and per-run counters;
- a deterministic next refresh after a successful, partial, or failed run.

The service-role worker contract is:

```sql
select * from claim_due_knowledge_sync_runs(worker_id, batch_size, lease_seconds);
select finish_knowledge_sync_run(run_id, worker_id, terminal_status, ...counters);
```

`talia-ai` owns discovery, network safety after DNS resolution, HTML rendering,
main-content extraction, content hashing, chunk replacement, and embeddings.
It must reindex only changed documents. `talia-client` owns authorization,
source configuration, persistence contracts, Agora/Backstage state, and quotas.

Capture uses a controlled waterfall:

1. safe HTTP fetch and conditional headers;
2. rendered browser for public JavaScript-heavy pages;
3. installed-widget or explicit manual browser capture when direct capture is blocked;
4. CMS/provider API when a deterministic integration exists.

No worker may bypass CAPTCHA, authentication, explicit access controls, robots
rules, or provider terms. Checkout, account, authentication, form, and private
routes are excluded by default. The installed widget remains a first-party
fallback rather than being removed.

Operational reference:

- `docs/operations/knowledge-web-sync.md`.

## Seams Toward RAG

### Knowledge Ingestion

The current ingestion seam is:

```ts
importPdfKnowledgeSource({ admin, tenantId, file })
```

Current interface:

- receives tenant, admin client, and file;
- validates the PDF;
- creates/updates `knowledge_sources`;
- uploads the PDF to Supabase Storage;
- delegates parsing/chunking/document writing to `talia-ai`;
- requests embeddings from `talia-ai`.

For structured sources, the current seam is:

```ts
reindexStructuredKnowledgeSource({
  admin,
  tenantId,
  sourceId,
  sourceType,
  sourceName,
})
```

This seam:

- reads the source's active `knowledge_items`;
- deletes chunks if the source ends up empty;
- normalizes the content into official text;
- delegates chunking and chunk writing to `talia-ai`;
- requests embeddings from `talia-ai`;
- keeps `knowledge_items` as an editable source.

Current implementation:

- does not use `pdf-parse` inside Next;
- does not parse PDFs, does not chunk, and does not write `knowledge_chunks` locally;
- calls `talia-ai /v1/knowledge/ingest` for chunking and document writing;
- delegates URL reading, HTML cleanup, and basic SSRF blocking to `talia-ai`;
- requests embeddings from `talia-ai` via server-to-server HTTP if the service is configured;
- leaves chunks as `pending` if the embeddings step fails;
- limits PDF size.

The managed-web persistence and Agora configuration live in `talia-client`.
The scheduled discovery/capture worker is deployed in `talia-ai` as a Fly cron;
queued sources remain visible and auditable until the worker claims them.

Future implementation:

- the same seam can delegate to an ingestion queue;
- PDF parsing already lives in `talia-ai` and can be moved to a dedicated worker if volume grows;
- Agora would continue querying status/sources, not doing heavy parsing.

### Embedding Backfill

Embeddings are no longer generated in Next. The operational seam lives in `talia-ai`.

Per-source endpoint:

```txt
POST $TALIA_AI_BASE_URL/v1/knowledge/embed
```

Global worker endpoint:

```txt
POST $TALIA_AI_BASE_URL/v1/knowledge/embed/pending
```

Authentication:

- `Authorization: Bearer $TALIA_AI_INTERNAL_API_KEY`.

Per-source payload:

```json
{
  "tenant_id": "tenant-uuid",
  "source_id": "source-uuid",
  "limit": 20,
  "retry_errors": true
}
```

Worker payload:

```json
{
  "limit": 20,
  "retry_errors": true
}
```

Use:

- backfill of old chunks after enabling pgvector;
- retry of chunks with `embedding_status = error`;
- periodic execution with an external scheduler or Fly cron.

Operational reference:

- `docs/operations/knowledge-embeddings.md`.

### Knowledge Retrieval

The current retrieval seam is:

```ts
retrieveTenantKnowledge({ admin, tenantId, query, channel, language })
```

Current interface:

- receives tenant, channel, and question;
- returns matches ordered by score;
- exposes `topMatch`;
- decides whether TALIA can answer directly from knowledge;
- allows building `relevant_knowledge` for the agent runtime.

Current implementation:

- attempts vector search over `knowledge_chunks` when embeddings are available;
- falls back to deterministic text search over `knowledge_chunks` and `knowledge_items`;
- limits to the best matches;
- responds directly only if the score exceeds the threshold;
- if it doesn't exceed the threshold, passes the retrieved context to n8n.

Future implementation:

- should move embedding generation, backfill, and retries to a dedicated worker/backend;
- can apply filters by tenant, channel, language, and source;
- can move to an external AI service while keeping the chat endpoint contract.

## MVP Limitations

- There is no embeddings worker or automatic backfill of old chunks.
- Managed URL, sitemap, and website sources can be configured, but their scheduled
  crawler must still be implemented and deployed in `talia-ai`.
- There is a limit on chunk size and number to avoid huge prompts.
- Scanned PDFs without selectable text are not processed.

## Recommended Evolution

When we decouple backend/AI:

1. Complete the dedicated ingestion worker in `talia-ai`:
   - PDF parsing;
   - safe sitemap and bounded website discovery;
   - HTTP/browser/first-party capture waterfall;
   - conditional fetch and normalized content hashes;
   - chunking;
   - optional OCR;
   - embeddings;
   - processing status;
   - retries and errors.
2. Create a retrieval service:
   - receives tenant, channel, and question;
   - returns relevant chunks with score and source.
3. Keep TALIA's contract stable:
   - the widget still talks to `/api/chat/:tenantId`;
   - `talia-ai` consumes the service-role sync-run contract;
   - the dashboard doesn't depend on the AI provider.

## n8n

The legacy workflow can keep working if it treats `knowledge_items` as general knowledge, not just as FAQs. It's worth mentally renaming the prompt section from `FAQs OFICIALES` to `CONOCIMIENTO OFICIAL` and prioritizing those items as an official source while the migration to `talia-ai` is completed.
