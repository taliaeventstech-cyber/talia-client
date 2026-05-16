# Requirements: Agente de Email

## Objetivo

Permitir que TALIA ayude a responder emails de atención sin obligar al cliente a abandonar su buzón.

El cliente debe poder trabajar desde Gmail/Outlook y ver borradores preparados por TALIA.

## Principio de Producto

MVP recomendado: **draft-first**.

TALIA no envía emails automáticamente al principio. Genera borradores, los deja en el buzón del cliente y un humano los revisa/envía.

## Flujo MVP

1. Cliente conecta buzón desde Àgora o TALIA lo configura desde Backstage.
2. TALIA lee emails entrantes autorizados.
3. TALIA aplica reglas locales de elegibilidad para ignorar newsletters, rebotes, no-reply o remitentes bloqueados sin llamar al agente.
4. TALIA llama al workflow/agente IA para clasificar los casos candidatos y generar respuesta si aplica.
5. TALIA consulta knowledge base de la venue.
6. TALIA genera respuesta.
7. TALIA crea borrador en Gmail/Outlook.
8. Humano revisa y envía desde su buzón.
9. TALIA registra estado, tema, intención, razón de clasificación y uso.

## Workflow Técnico MVP

La API de TALIA mantiene el contrato estable. n8n solo actúa como adapter temporal para clasificación/generación.

```txt
Gmail / Workspace
  -> TALIA sync guarda email_threads + email_messages
  -> POST /api/internal/email/process
  -> EmailAgentProvider
  -> N8nEmailAgentProvider ahora
  -> TaliaEmailAgentProvider futuro
  -> email_drafts + Gmail draft + usage_events
```

Reglas:

- El navegador y el cliente nunca llaman directamente a n8n.
- n8n no escribe directamente en Supabase.
- n8n no crea borradores directamente en Gmail.
- TALIA persiste threads, mensajes, drafts y uso.
- TALIA crea el borrador real en Gmail/Outlook cuando `draft_mode = provider_drafts`.
- El provider debe devolver un contrato simple: `shouldReply`, `subject`, `bodyText/bodyHtml`, `topic`, `priority`, `confidence`.
- El workflow puede devolver también `should_process` y `classification_reason`; si `should_process` es `false`, TALIA lo interpreta como `shouldReply = false`.

Payload TALIA -> n8n:

```json
{
  "agent_type": "email",
  "tenant_id": "uuid",
  "connection_id": "uuid",
  "thread_id": "uuid",
  "message_id": "uuid",
  "mailbox_email": "info@cliente.com",
  "subject": "Consulta sobre entradas",
  "sender_email": "persona@example.com",
  "sender_name": "Persona",
  "body_text": "Hola, queria saber horarios...",
  "fallback_email": "info@cliente.com",
  "fallback_phone": "933000000",
  "relevant_knowledge": []
}
```

Respuesta n8n -> TALIA:

```json
{
  "should_process": true,
  "should_reply": true,
  "classification_reason": "visitor_question",
  "subject": "Re: Consulta sobre entradas",
  "body_text": "Hola...",
  "body_html": "<p>Hola...</p>",
  "topic": "entradas",
  "priority": "normal",
  "confidence": 0.86,
  "escalation_reason": null
}
```

Endpoints internos:

- `GET /api/internal/tenants/:tenantId/email-config`: contexto estable para workflows.
- `POST /api/internal/email/sync`: sincroniza Gmail por polling y guarda `email_threads` + `email_messages`.
- `POST /api/internal/email/process`: procesa el último mensaje inbound o uno concreto por `thread_id`/`message_id`.

Resultado esperado:

- Si no debe responder: thread `ignored`.
- Si se genera solo para revisión interna: draft `generated`.
- Si se crea en el buzón del cliente: draft `created_in_provider` con `provider_draft_id`.
- Si falla Gmail/Outlook: draft `error` y detalle en `error_message`.

Env temporal:

- `DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL`: webhook n8n para generación de borradores.
- `INTERNAL_API_KEY`: protege endpoints internos en producción.
- `CRON_SECRET`: protege `/api/cron/email/sync` cuando lo invoca un scheduler externo como n8n.

Workflow n8n:

- Blueprint importable: `n8n-workflows/TALIA-Generic-Email-Agent-Draft-Workflow.json`.
- Blueprints desacoplados recomendados:
  - `n8n-workflows/TALIA-Email-Classifier-Workflow.json`;
  - `n8n-workflows/TALIA-Email-Drafter-Workflow.json`.
- Blueprint de cron importable: `n8n-workflows/TALIA-Email-Sync-Cron-Workflow.json`.
- TALIA orquesta dos agentes separados:
  - `Email classifier agent`: clasifica intención, tema, prioridad, confianza y si debe generarse respuesta.
  - `Email drafter agent`: solo se ejecuta si TALIA decide que aplica según clasificación, configuración, permisos y modo de draft.
- La orquestación vive en TALIA, no dentro de n8n. Esto permite clasificar sin redactar, reintentar drafts sin reclasificar, medir costes separados y desacoplar el backend más adelante.
- Antes de llamar al clasificador IA, TALIA aplica reglas deterministas para evitar que newsletters, rebotes, no-reply y automatismos acaben generando drafts.
- Si el clasificador decide que no hay que generar borrador, el workflow devuelve solo metadatos de clasificación y TALIA marca el thread como ignorado/no accionable.
- La base de conocimiento se mantiene compartida con el chatbot (`knowledge_items`). TALIA envía al workflow los matches relevantes para ese email en `relevant_knowledge`.
- Las reglas propias del canal email viven en `email_connections.metadata.email_agent_settings`:
  - `tone`: tono del borrador;
  - `draft_style`: longitud/densidad de la respuesta;
  - `signature`: cierre preferido;
  - `human_review_topics`: temas sensibles que requieren revisión;
  - `classification_rules`: reglas adicionales para el clasificador.
- Variables de entorno en n8n:
  - `TALIA_BASE_URL`, por ejemplo `https://talia-client.vercel.app`;
  - `TALIA_INTERNAL_API_KEY`, mismo valor que `INTERNAL_API_KEY` en TALIA.
- Para el workflow de cron, crear una credencial HTTP Header Auth con:
  - Name: `Authorization`;
  - Value: `Bearer <CRON_SECRET>`.
- Al importar, sustituir la credencial OpenAI `REPLACE_WITH_OPENAI_CREDENTIAL_ID`.
- Webhooks soportados por TALIA:
  - `DEFAULT_N8N_EMAIL_CLASSIFIER_WEBHOOK_URL`;
  - `DEFAULT_N8N_EMAIL_DRAFTER_WEBHOOK_URL`;
  - `DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL` queda como fallback legado.
- Overrides por venue:
  - `email_connections.metadata.n8n_email_classifier_webhook_url`;
  - `email_connections.metadata.n8n_email_drafter_webhook_url`;
  - `email_connections.metadata.n8n_email_agent_webhook_url` queda como fallback legado.

## Providers

Primera fase:

- Google Gmail API.

Siguiente:

- Microsoft Graph para Outlook/Exchange.

Evitar IMAP/SMTP como primera opción salvo necesidad, porque complica permisos, seguridad y trazabilidad.

## OAuth Google

La conexión de Gmail se inicia desde Àgora y vuelve a `/api/email/google/callback`.

Variables necesarias:

- `GOOGLE_CLIENT_ID`;
- `GOOGLE_CLIENT_SECRET`;
- `NEXT_PUBLIC_APP_URL`;
- `EMAIL_TOKEN_ENCRYPTION_KEY`;
- `EMAIL_OAUTH_STATE_SECRET`.

Scopes MVP:

- `https://www.googleapis.com/auth/gmail.readonly`;
- `https://www.googleapis.com/auth/gmail.compose`.

`gmail.readonly` permite leer los emails autorizados. `gmail.compose` permite crear borradores sin conceder permisos de envío automático. Los refresh/access tokens se guardan cifrados dentro de `email_connections.oauth_metadata.encrypted_tokens`.

Creación de borradores:

- TALIA renueva el access token con el refresh token cifrado.
- TALIA llama a Gmail `users.drafts.create`.
- El borrador queda visible en la carpeta de borradores del buzón conectado.
- TALIA guarda el `provider_draft_id` para trazar el borrador local con el draft real del proveedor.

Desconexión:

- Àgora permite desconectar Gmail.
- TALIA intenta revocar el refresh/access token en Google.
- La conexión queda como `revoked`.
- Se limpian `oauth_metadata`, `sync_cursor` y `last_synced_at`.

Persistencia operativa:

- La conexión debe funcionar sin usuarios conectados a Àgora.
- El refresh token cifrado permite renovar access tokens desde workers/server jobs.
- Si Google revoca permisos o falla el refresh, `email_connections.status` pasa a `error` o `revoked` y se pide reconexión.
- La sincronización de fin de semana debe ejecutarse desde un worker/cron, no desde el navegador.
- El MVP usa polling contra Gmail `messages.list` + `messages.get` para importar los últimos mensajes de `in:inbox newer_than:14d`.
- La ingesta es idempotente por `unique(connection_id, provider_message_id)`, así que el cron puede ejecutarse repetidamente sin duplicar emails.
- Backstage puede ajustar por conexión:
  - `gmail_sync_window_days`: 1, 7, 14 o 30;
  - `sync_frequency_minutes`: 15, 30, 60 o 240;
  - `gmail_sync_limit`: 10, 25, 50, 100, 250 o 500;
  - `cron_enabled`: permite pausar el cron automático por conexión sin desconectar el buzón ni impedir sincronizaciones manuales;
  - `gmail_sync_query`: query avanzada de Gmail para overrides internos;
  - `auto_process_after_sync`: encadena procesamiento de emails importados después de sincronizar;
  - `exclude_automated`: ignora newsletters, rebotes, no-reply y respuestas automáticas antes de llamar al agente;
  - `blocked_senders` y `blocked_domains`: reglas internas para ignorar emails por remitente;
  - `email_agent_settings`: configuración específica del canal email sin duplicar la base de conocimiento.
- El cron de producción recomendado para Vercel Hobby vive en n8n: schedule cada 15 minutos contra `/api/cron/email/sync`. Cada conexión decide si toca sincronizar según `sync_frequency_minutes`.

## Modelo de Datos

Tablas previstas:

- `email_connections`: conexión del buzón.
- `email_threads`: hilos.
- `email_messages`: mensajes.
- `email_drafts`: borradores generados.

## Estados

Thread:

- new;
- drafted;
- waiting_human;
- sent;
- resolved;
- escalated;
- ignored.

Draft:

- generated;
- created_in_provider;
- edited_by_human;
- approved;
- sent;
- discarded;
- error.

## Permisos

Permisos sugeridos:

- `view_email`;
- `review_email`;
- `send_email`;
- `manage_email`;
- `manage_email_automation`.

MVP:

- owner/admin pueden gestionar;
- operator puede revisar si se decide activarlo;
- viewer solo lectura.

## Riesgos

- OAuth y refresh tokens.
- Seguridad de datos personales.
- Rate limits de Gmail/Outlook.
- Detección de emails que no deben responderse.
- Evitar auto-respuestas peligrosas.
- Mantener trazabilidad entre borrador y email original.

## Decisiones MVP

- No auto-send.
- No borrar emails.
- No modificar emails existentes salvo crear borrador.
- Guardar solo lo necesario.
- Backstage ve estado técnico.
- Cliente ve conexión, buzón y métricas.
