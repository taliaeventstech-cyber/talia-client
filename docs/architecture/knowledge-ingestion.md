# Knowledge Ingestion

## Objetivo

La base de conocimiento debe aceptar varias fuentes sin acoplar el producto a n8n:

- FAQs manuales.
- Excel/CSV.
- PDFs.
- URLs scrapeables.
- Google Sheets y otras apps mas adelante.

## Estado actual

TALIA guarda conocimiento normalizado en:

- `knowledge_sources`: origen de la informacion.
- `knowledge_items`: unidades consumibles por chatbot, email y futuros canales.
- `knowledge_chunks`: fragmentos documentales preparados para retrieval y futuros embeddings.

La ingesta empieza detras del modulo interno `src/lib/knowledge/ingestion.ts`. Agora valida permisos/formulario y coordina la fuente, pero el parsing PDF, chunking, escritura documental y embeddings viven en `talia-ai`.

El chatbot nuevo consume `talia-ai` cuando `CHAT_AGENT_PROVIDER=talia-ai`. `knowledge_items` sigue existiendo para UI, edicion y fallback textual, pero las fuentes estructuradas tambien se reflejan en `knowledge_chunks` para retrieval semantico.

## PDFs

En el MVP actual, un PDF se procesa de forma hibrida:

1. El usuario sube un PDF desde Conocimiento.
2. `talia-client` crea o actualiza `knowledge_sources`.
3. `talia-client` sube el PDF al bucket privado `knowledge-files`.
4. `talia-client` llama a `talia-ai /v1/knowledge/ingest` con `source_id` y storage path.
5. `talia-ai` descarga el PDF, extrae texto y lo divide en fragmentos acotados.
6. `talia-ai` escribe `knowledge_chunks`, limpia chunks obsoletos y marca la fuente como `ready`.
7. `talia-client` solicita embeddings a `talia-ai /v1/knowledge/embed`; si falla, los chunks quedan `pending` para el worker.

Este enfoque es deliberadamente simple: permite que el producto funcione ya, pero no sustituye a un RAG definitivo.

## FAQs manuales y Excel/CSV

Las fuentes estructuradas ya siguen el mismo camino RAG que los PDFs:

1. El usuario crea/edita/elimina una FAQ o importa un Excel/CSV desde Conocimiento.
2. `talia-client` mantiene `knowledge_items` como modelo editable y fallback.
3. `talia-client` recompone la fuente completa como texto normalizado:
   - pregunta del visitante;
   - respuesta oficial;
   - idioma;
   - prioridad/confianza;
   - tema si existe.
4. `talia-client` llama a `talia-ai /v1/knowledge/ingest` con `source_type` `manual`, `xlsx` o `csv` y el texto normalizado.
5. `talia-ai` divide la fuente en `knowledge_chunks`, elimina chunks obsoletos y marca la fuente como `ready`.
6. `talia-client` solicita embeddings a `talia-ai /v1/knowledge/embed`.

La decision es mantener `knowledge_items` de momento porque:

- la UI de Agora edita FAQs fila a fila;
- Backstage y partes legacy aun pueden leer items;
- permite fallback textual si `talia-ai` no esta disponible;
- evita una migracion destructiva mientras se estabiliza el RAG.

Cuando el RAG este consolidado, `knowledge_items` podra convertirse en una vista editorial o desaparecer del runtime.

## URLs

Las URLs de conocimiento ya se sincronizan como fuentes RAG:

1. El usuario guarda URLs desde Conocimiento o añade la primera URL durante el onboarding del chatbot.
2. `talia-client` mantiene `theatres.scrape_urls` por compatibilidad con flujos legacy.
3. `talia-client` crea/actualiza `knowledge_sources` tipo `url` y elimina fuentes URL obsoletas.
4. `talia-client` llama a `talia-ai /v1/knowledge/ingest` con la URL.
5. `talia-ai` valida que la URL sea HTTP/HTTPS, bloquea hosts locales/redes privadas, descarga HTML/texto con limite de tamano y extrae texto legible.
6. `talia-ai` escribe `knowledge_chunks`; `talia-client` solicita embeddings.

Esta pieza sustituye el scraping implícito de n8n para el runtime RAG. El scraping sigue siendo deliberadamente acotado: una URL equivale a una fuente, no a un crawler recursivo.

## Seams hacia RAG

### Knowledge Ingestion

El seam actual de ingesta es:

```ts
importPdfKnowledgeSource({ admin, tenantId, file })
```

Interface actual:

- recibe tenant, cliente admin y archivo;
- valida PDF;
- crea/actualiza `knowledge_sources`;
- sube el PDF a Supabase Storage;
- delega parsing/chunking/escritura documental en `talia-ai`;
- solicita embeddings a `talia-ai`.

Para fuentes estructuradas, el seam actual es:

```ts
reindexStructuredKnowledgeSource({
  admin,
  tenantId,
  sourceId,
  sourceType,
  sourceName,
})
```

Este seam:

- lee los `knowledge_items` activos de la fuente;
- borra chunks si la fuente queda vacia;
- normaliza el contenido a texto oficial;
- delega chunking y escritura de chunks en `talia-ai`;
- solicita embeddings a `talia-ai`;
- mantiene `knowledge_items` como fuente editable.

Implementacion actual:

- no usa `pdf-parse` dentro de Next;
- no parsea PDFs, no trocea y no escribe `knowledge_chunks` localmente;
- llama a `talia-ai /v1/knowledge/ingest` para chunking y escritura documental;
- delega lectura de URL, limpieza HTML y bloqueo SSRF basico en `talia-ai`;
- solicita embeddings a `talia-ai` por HTTP server-to-server si el servicio esta configurado;
- deja chunks en `pending` si el paso de embeddings falla;
- limita tamano del PDF.

Implementacion futura:

- el mismo seam puede delegar en una cola de ingestion;
- el parsing PDF ya vive en `talia-ai` y puede moverse a worker dedicado si crece el volumen;
- Agora seguiria consultando estado/fuentes, no haciendo parsing pesado.

### Embedding Backfill

Los embeddings ya no se generan en Next. El seam operativo vive en `talia-ai`.

Endpoint por fuente:

```txt
POST $TALIA_AI_BASE_URL/v1/knowledge/embed
```

Endpoint worker global:

```txt
POST $TALIA_AI_BASE_URL/v1/knowledge/embed/pending
```

Autenticacion:

- `Authorization: Bearer $TALIA_AI_INTERNAL_API_KEY`.

Payload por fuente:

```json
{
  "tenant_id": "uuid-del-tenant",
  "source_id": "uuid-de-la-fuente",
  "limit": 20,
  "retry_errors": true
}
```

Payload worker:

```json
{
  "limit": 20,
  "retry_errors": true
}
```

Uso:

- backfill de chunks antiguos despues de activar pgvector;
- reintento de chunks con `embedding_status = error`;
- ejecucion periodica con scheduler externo o Fly cron.

Referencia operativa:

- `docs/operations/knowledge-embeddings.md`.

### Knowledge Retrieval

El seam actual de retrieval es:

```ts
retrieveTenantKnowledge({ admin, tenantId, query, channel, language })
```

Interface actual:

- recibe tenant, canal y pregunta;
- devuelve matches ordenados por score;
- expone `topMatch`;
- decide si TALIA puede responder directamente desde conocimiento;
- permite construir `relevant_knowledge` para el runtime del agente.

Implementacion actual:

- intenta busqueda vectorial sobre `knowledge_chunks` cuando hay embeddings disponibles;
- cae a busqueda textual determinista sobre `knowledge_chunks` y `knowledge_items`;
- limita a los mejores matches;
- responde directamente solo si el score supera el umbral;
- si no supera el umbral, pasa el contexto recuperado a n8n.

Implementacion futura:

- debe mover generacion de embeddings, backfill y retries a un worker/backend propio;
- puede aplicar filtros por tenant, canal, idioma y fuente;
- puede moverse a un servicio IA externo manteniendo el contrato del endpoint de chat.

## Limitaciones del MVP

- No hay worker de embeddings ni backfill automatico de chunks antiguos.
- Las URLs se ingieren una a una; no hay crawler recursivo ni sitemap automatico.
- Hay limite de tamano y numero de chunks para evitar prompts enormes.
- Los PDFs escaneados sin texto seleccionable no se procesan.

## Evolucion recomendada

Cuando desacoplemos backend/IA:

1. Crear un servicio de ingestion propio:
   - parsing PDF;
   - chunking;
   - OCR opcional;
   - embeddings;
   - estado de procesamiento;
   - reintentos y errores.
2. Crear un servicio de retrieval:
   - recibe tenant, canal y pregunta;
   - devuelve los chunks relevantes con score y fuente.
3. Mantener estable el contrato de TALIA:
   - el widget sigue hablando con `/api/chat/:tenantId`;
   - n8n o el backend propio consumen endpoints internos;
   - el dashboard no depende del proveedor IA.

## n8n

El workflow actual puede seguir funcionando si trata `knowledge_items` como conocimiento general, no solo como FAQs. Conviene renombrar mentalmente la seccion de prompt de `FAQs OFICIALES` a `CONOCIMIENTO OFICIAL` y priorizar esos items antes del scraping.
