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

El chatbot sigue consumiendo `/api/internal/tenants/:tenantId/chat-config`, que devuelve `knowledge_items` junto con la configuracion del tenant. n8n actua como orquestador temporal.

## PDFs

En el MVP, un PDF se procesa en Agora:

1. El usuario sube un PDF desde Conocimiento.
2. TALIA extrae texto en servidor.
3. TALIA divide el texto en fragmentos acotados.
4. Cada fragmento se guarda como `knowledge_items` con `source_type = pdf` en metadata.
5. El runtime del chatbot puede leer esos fragmentos sin cambiar el widget.

Este enfoque es deliberadamente simple: permite que el producto funcione ya, pero no sustituye a un RAG definitivo.

## Limitaciones del MVP

- No hay embeddings ni ranking semantico por fragmento.
- Los fragmentos de PDF se envian al flujo como conocimiento textual normal.
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
