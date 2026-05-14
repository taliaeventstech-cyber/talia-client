# TALIA Agora — Agente de Email

Documentación de producto y arquitectura del módulo de agente de email de TALIA.

El objetivo no es reemplazar el buzón del cliente, sino asistirlo desde su buzón habitual. Para clientes culturales, el patrón recomendado es **mailbox-first**: Gmail/Outlook siguen siendo la herramienta de trabajo diaria, y TALIA genera borradores, clasifica, audita y mide el servicio.

---

## Principios

1. **El cliente conserva su buzón**
   - `info@venue.com`
   - `entrades@venue.com`
   - `grups@venue.com`

2. **TALÍA crea borradores, no envía automáticamente al inicio**
   - Fase inicial: humano revisa y envía.
   - Auto-send solo para categorías seguras y cuando el cliente lo active expresamente.

3. **La fuente de verdad de producto vive en TALIA**
   - conexiones,
   - threads,
   - mensajes,
   - drafts,
   - estados,
   - auditoría,
   - límites,
   - métricas.

4. **Proveedor-first, pero con capa interna estable**
   - Gmail y Microsoft tienen APIs distintas.
   - TALIA normaliza todo en `email_threads`, `email_messages`, `email_drafts`.

---

## Arquitectura

```
Gmail / Outlook
      │ OAuth + sync
      ▼
┌──────────────────────┐
│ TALIA Email Connector │
│ Gmail / Microsoft     │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ TALIA Email Engine    │
│ classify + retrieve   │
│ draft + guardrails    │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Supabase              │
│ email_connections     │
│ email_threads         │
│ email_messages        │
│ email_drafts          │
│ usage_events          │
└──────────────────────┘
```

---

## Flujo MVP recomendado

### Fase 1 — Gmail OAuth + borradores reales

1. TALIA conecta un buzón Gmail/Google Workspace por venue.
2. TALIA sincroniza threads entrantes.
3. TALIA clasifica el email.
4. TALIA consulta base de conocimiento y contexto de la venue.
5. TALIA crea un draft en Gmail asociado al thread original.
6. El equipo del cliente revisa y envía desde Gmail.
7. TALIA sincroniza el estado del draft y registra métricas.

No hay auto-send.

El procesamiento manual en Àgora es explícito: el usuario selecciona uno o varios threads y pulsa `Procesar seleccionados`. La acción `Borrar seleccionados` elimina los threads locales y sus mensajes/drafts en TALIA, pero no borra emails del buzón Gmail/Outlook.

### Fase 2 — Outlook/Microsoft 365

Se replica el patrón con Microsoft Graph:

- OAuth,
- delta queries,
- drafts,
- sent messages,
- webhooks/subscriptions si aplica.

### Fase 3 — Auto-send controlado

Solo para categorías seguras:

- horarios,
- ubicación,
- accesibilidad básica,
- información de compra,
- FAQs exactas.

Nunca auto-send para:

- reclamaciones,
- pagos,
- datos personales sensibles,
- prensa,
- contratos,
- conflictos,
- menores,
- incidencias graves,
- disponibilidad/precios no verificados.

---

## Experiencia cliente

### En Gmail/Outlook

El cliente ve:

- emails entrantes normales,
- borradores preparados por TALIA,
- respuestas enviadas desde el buzón real,
- etiquetas si el proveedor lo soporta.

### En Àgora

El cliente ve:

- estado de conexión,
- threads sincronizados con selección manual,
- emails procesados,
- drafts generados,
- pendientes de revisión,
- enviados,
- escalados,
- temas frecuentes,
- tiempo medio de respuesta,
- errores de sincronización.

### En Backstage

TALIA gestiona:

- proveedor,
- scopes,
- estado OAuth,
- modo de sincronización,
- frecuencia automática,
- modo de draft,
- reglas de exclusión,
- límites del plan,
- errores,
- soporte y desconexión.

---

## Automatización MVP

En Vercel Hobby no usamos Vercel Cron para email porque los schedules frecuentes no son viables. El scheduler recomendado es n8n.

Workflow importable:

```txt
n8n-workflows/TALIA-Email-Sync-Cron-Workflow.json
```

Flujo:

```txt
Schedule Trigger cada 15 min
  -> GET https://<TALIA_BASE_URL>/api/cron/email/sync
     Authorization: Bearer <CRON_SECRET>
```

Variables/credenciales:

- En TALIA/Vercel: `CRON_SECRET`.
- En n8n: `TALIA_BASE_URL`.
- En n8n: credencial HTTP Header Auth:
  - Header name: `Authorization`.
  - Header value: `Bearer <CRON_SECRET>`.

El endpoint revisa conexiones Gmail activas con `sync_mode = polling`. Cada venue decide si toca sincronizar según `email_connections.metadata.sync_frequency_minutes`.

---

## Permisos

Permisos de producto recomendados:

| Permiso | Descripción |
|---|---|
| `view_email` | Ver métricas/estado del agente de email |
| `review_email` | Revisar drafts y marcar estados |
| `send_email` | Enviar respuestas desde TALIA, cuando exista |
| `manage_email` | Conectar buzón y modificar configuración |
| `manage_email_automation` | Activar auto-send y reglas avanzadas |

Para el MVP, `owner` y `admin` pueden gestionar email.

---

## Modelo de datos

### `email_connections`

Conexión de buzón por venue.

Campos principales:

- `theatre_id`
- `provider`: `google`, `microsoft`, `imap`, `forwarding`
- `mailbox_email`
- `status`: `draft`, `connected`, `syncing`, `error`, `revoked`, `disabled`
- `sync_mode`: `polling`, `webhook`, `manual`
- `draft_mode`: `provider_drafts`, `agora_review`, `disabled`
- `oauth_metadata`
- `sync_cursor`
- `last_synced_at`
- `error_message`

### `email_threads`

Thread normalizado.

- `provider_thread_id`
- `subject`
- `sender_email`
- `status`: `new`, `drafted`, `waiting_human`, `sent`, `resolved`, `escalated`, `ignored`
- `topic`
- `priority`
- `last_message_at`

### `email_messages`

Mensajes de un thread.

- inbound/outbound
- provider message id
- body text/html
- recipients
- timestamps

### `email_drafts`

Borradores generados por TALIA.

- `provider_draft_id`
- `status`: `generated`, `created_in_provider`, `edited_by_human`, `approved`, `sent`, `discarded`, `error`
- generated subject/body
- reviewer
- sent timestamp

---

## Billing y límites

Registrar en `usage_events`:

- `module_key='email'`
- `channel='email'`
- `event_type='conversation_started'` cuando aparece un thread nuevo procesable
- `event_type='ai_call'` cuando TALIA genera respuesta
- `event_type='resolution'` cuando se resuelve/envía
- `event_type='fallback'` cuando se escala

El límite comercial principal será:

- emails/threads procesados al mes,
- drafts generados al mes,
- auto-send opcional por plan.

---

## Guardrails iniciales

El agente debe:

- usar solo knowledge base y fuentes autorizadas,
- indicar incertidumbre,
- crear draft, no enviar,
- escalar si hay datos personales, reclamaciones, pagos o temas sensibles,
- mantener tono profesional y breve,
- respetar idioma del email,
- no inventar precios, disponibilidad ni políticas.

---

## Roadmap técnico

1. Modelo de datos base.
2. Pantalla inicial de módulo Email en Àgora.
3. Backstage para activar módulo y preparar conexión.
4. Gmail OAuth.
5. Sync polling de Gmail.
6. Generación de draft interno.
7. Creación de draft real en Gmail.
8. Sync de estado de drafts.
9. Métricas y usage.
10. Microsoft 365.
11. Auto-send controlado.
