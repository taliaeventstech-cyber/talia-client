# Roadmap de Arquitectura Escalable hacia Lisboa 2026

Fecha: 19 junio 2026

## Contexto

TALIA va a empezar a venderse con un MVP funcional para primeros usuarios. El objetivo no es reescribir ahora, sino evitar que el MVP se convierta en una trampa cuando aumenten clientes, documentos, conversaciones y canales.

Principio:

- El widget, Agora y el modelo de datos deben mantener un contrato estable.
- n8n puede seguir como adapter temporal.
- La IA, ingestion, retrieval y orquestacion deben poder moverse a backend propio sin romper el producto.

## Objetivo para noviembre

Antes del Web Summit de Lisboa en noviembre de 2026, TALIA deberia poder soportar:

- Multiples tenants reales con configuracion aislada.
- Chatbot web estable y medible.
- Conocimiento con FAQs, Excel/CSV, PDFs y URLs.
- Agente de email supervisado cuando Google apruebe OAuth.
- Observabilidad minima de errores, coste y uso.
- Capacidad de reemplazar n8n por backend propio por partes.

## Arquitectura objetivo

```txt
Widget / Agora
  -> TALIA App/API
    -> Attention Core
      -> Knowledge Retrieval
      -> Agent Runtime
      -> Channel Adapters
      -> Usage/Billing
    -> Storage
```

### Modulos profundos a crear

#### 1. Attention Core

Interface:

- recibe una interaccion normalizada;
- conoce tenant, canal, usuario/session, mensaje y contexto;
- devuelve respuesta, accion, estado, fuentes y uso.

Implementacion inicial:

- puede seguir llamando a n8n.

Implementacion futura:

- runtime propio con providers OpenAI/otros.

Leverage:

- chatbot, email, voz y futuros canales usan una misma logica central.

Locality:

- reglas de fallback, trazabilidad, costes y fuentes viven en un sitio.

#### 2. Knowledge Ingestion

Interface:

- recibe una fuente: manual, Excel, PDF, URL, Google Sheet;
- produce fuentes y chunks normalizados;
- expone estado: pending, processing, ready, error.

Implementacion inicial:

- Excel/PDF dentro de TALIA App.
- URLs via scraping actual.

Implementacion futura:

- worker/backend propio con OCR, embeddings y retries.

Leverage:

- todos los canales consumen la misma base.

Locality:

- errores de parsing, chunking, OCR y reintentos no contaminan pantallas ni agentes.

#### 3. Knowledge Retrieval

Interface:

- recibe tenant, canal, pregunta y limites;
- devuelve chunks relevantes con score, source_id, source_type y snippet.

Implementacion inicial:

- top items por prioridad/categoria.

Implementacion futura:

- embeddings/vector store + filtros por tenant/canal/idioma.

Leverage:

- mejora respuestas sin cambiar widget, email ni workflows.

Locality:

- ranking y citacion de fuentes se corrigen en un modulo.

#### 4. Agent Runtime

Interface:

- recibe tarea normalizada: chat reply, email classify, email draft, clear view;
- devuelve contrato JSON estable;
- registra coste, latencia, modelo, errores y tokens.

Implementacion inicial:

- adapter n8n.

Implementacion futura:

- backend propio con provider adapters.

Leverage:

- cambiar modelo/proveedor no afecta Agora ni widget.

Locality:

- prompts tecnicos, safety, retries y observabilidad viven juntos.

#### 5. Channel Adapters

Interface:

- traducen cada canal al contrato comun del Attention Core.

Adapters:

- Web Chat adapter.
- Gmail adapter.
- Outlook adapter futuro.
- Voice adapter futuro.

Leverage:

- añadir canales no duplica IA ni conocimiento.

Locality:

- OAuth, Gmail drafts, widget sessions y telefonia quedan aislados por canal.

## Plan por fases

### Fase 0 - MVP vendible

Objetivo: desplegar lo ya funcional sin bloquear ventas.

Incluye:

- Chatbot web.
- Conocimiento manual, Excel/CSV, PDFs basicos y URLs.
- Accesibilidad MVP.
- Trial/upgrade.
- Email agent oculto o en beta controlada hasta OAuth.

No meter todavia:

- embeddings obligatorios;
- OCR;
- multi-provider IA complejo;
- reescritura completa de n8n.

### Fase 1 - Estabilizacion de contratos

Objetivo: que n8n sea reemplazable.

Tareas:

- Definir contratos TypeScript para:
  - `ChatInteractionInput`;
  - `AgentRuntimeResult`;
  - `KnowledgeRetrievalResult`;
  - `UsageEvent`.
- Hacer que `/api/chat/:tenantId` hable con un `ChatAgentProvider`. Iniciado: `src/lib/agent-runtime/chat.ts`.
- Mantener `N8nChatAgentProvider` como adapter. Iniciado.
- Documentar payloads internos.

Resultado:

- El widget no sabe si responde n8n o backend propio.

### Fase 2 - Retrieval real

Objetivo: que la base de conocimiento escale.

Tareas:

- Crear tabla `knowledge_chunks`. Iniciado: la tabla ya existe como base documental para PDFs.
- Separar `knowledge_items` tipo FAQ de chunks documentales. Iniciado: los PDFs se guardan en chunks y se reflejan temporalmente en `knowledge_items`.
- Guardar metadata de fuente, pagina, idioma y hash.
- Crear modulo `KnowledgeRetriever`. Iniciado: `src/lib/knowledge/retrieval.ts` ya encapsula el contrato.
- Primer retrieval determinista por texto/prioridad. Iniciado: retrieval consulta chunks e items.
- Preparar columna para embeddings o tabla auxiliar. Iniciado: `knowledge_chunks.embedding` usa pgvector y `match_knowledge_chunks` habilita busqueda semantica opcional.
- Preparar backfill/reintentos de embeddings. Iniciado: `talia-ai` expone `/v1/knowledge/embed` y `/v1/knowledge/embed/pending`; Next ya no ejecuta embeddings localmente.

Resultado:

- PDFs largos y multiples fuentes no inflan prompts completos.

### Fase 3 - Backend/worker propio

Objetivo: sacar jobs pesados de Next.

Tareas:

- Repo nuevo o paquete separado:
  - `talia-ai-runtime`;
  - `talia-worker`;
  - o monorepo cuando sea conveniente.
- Jobs:
  - PDF parsing;
  - OCR opcional;
  - embeddings;
  - sync de URLs;
  - classification/drafting email.
- Cola:
  - Supabase queue, pg-boss, Inngest, Trigger.dev o worker propio.

Resultado:

- Agora solo dispara ingestion y consulta estados.
- Procesos lentos no dependen del request web.

### Fase 4 - Observabilidad y billing serio

Objetivo: saber que pasa y cuanto cuesta.

Tareas:

- Registrar usage por:
  - tenant;
  - canal;
  - modulo;
  - modelo;
  - tokens estimados/reales;
  - coste;
  - latencia;
  - error_code.
- Panel interno Backstage para errores de agentes.
- Alertas de fallo por tenant.
- Rate limits por tenant y canal.

Resultado:

- Podemos vender y operar sin ir a ciegas.

### Fase 5 - Preparacion demo/evento

Objetivo: llegar a noviembre con una historia solida.

Tareas:

- Tenant demo limpio.
- Landing demo con widget + accesibilidad.
- Dataset de conocimiento realista.
- Flujo de onboarding pulido.
- Modo demo sin depender de cuentas personales.
- Script de demo y rollback.

Resultado:

- Producto enseñable, no solo prototipo tecnico.

## Decisiones recomendadas ahora

1. Mantener el despliegue MVP.
2. No seguir aumentando n8n como cerebro central.
3. Usar n8n solo como adapter mientras creamos interfaces estables.
4. Empezar por `Knowledge Retrieval` antes que por embeddings complejos.
5. Separar backend/IA cuando haya dos adapters reales:
   - n8n actual;
   - runtime propio inicial.

## Primeros issues recomendados

1. Crear contratos TS para runtime de chat y retrieval.
2. Encapsular llamada n8n de chat en `N8nChatAgentProvider`.
3. Crear `KnowledgeRetriever` determinista.
4. Añadir tabla `knowledge_chunks`.
5. Migrar PDFs de `knowledge_items` a `knowledge_chunks`.
6. Registrar usage real del chatbot.
7. Crear dashboard interno de errores de agentes.

## Riesgos

- Meter PDFs directamente en `knowledge_items` sirve para MVP, pero no escala.
- n8n con prompts grandes sera caro, lento y dificil de depurar.
- Sin usage/coste por tenant, pricing y limites seran estimaciones.
- Sin contratos internos, desacoplar backend despues sera una reescritura.

## Criterio de exito

La arquitectura estara lista para crecer cuando:

- el widget no dependa de n8n;
- Agora no sepa que proveedor IA responde;
- Conocimiento pueda procesar fuentes en segundo plano;
- cada respuesta pueda explicar que fuente uso;
- cada tenant tenga limites, coste y errores observables;
- cambiar un proveedor IA sea cambiar un adapter, no tocar todo el producto.
