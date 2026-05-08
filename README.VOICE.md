# TALIA Agora — Agente de Voz

Documentación técnica y operativa del agente de voz de TALIA, basado en ElevenLabs Conversational AI.

---

## Arquitectura

```
Llamada entrante
      │
      ▼
┌─────────────┐     gestiona la llamada     ┌─────────────────────────┐
│ Telefonía   │ ◄────────────────────────── │  ElevenLabs Conv. AI    │
│ nativa/Twilio│                            │  (STT + LLM + TTS)      │
└─────────────┘                             └──────────┬──────────────┘
                                                       │ post-call webhook
                                                       ▼
                                            ┌─────────────────────────┐
                                            │  TALIA Agora (Next.js)  │
                                            │  /api/voice/conversations│
                                            └──────────┬──────────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────────────┐
                                            │  Supabase               │
                                            │  voice_conversations    │
                                            │  conversation_topics    │
                                            └─────────────────────────┘
```

Cada venue tiene su propio agente en ElevenLabs. No hay n8n en el flujo de voz.

La telefonía puede operar en dos modos:

1. **Número gestionado por TALIA**: TALIA provisiona o importa el número y lo vincula al agente de la venue.
2. **Número del cliente**: el cliente conserva su número público y hace un desvío/portabilidad hacia el número gestionado por TALIA.

Para demos y primeras implantaciones, el modo recomendado es **número gestionado por TALIA + desvío desde el número del cliente**. Reduce fricción y nos da control sobre soporte, métricas, bajas y cambios de proveedor.

---

## Stack

| Componente | Servicio |
|---|---|
| Telefonía | ElevenLabs Phone Numbers o Twilio |
| Voz conversacional | ElevenLabs Conversational AI |
| STT | ElevenLabs (integrado) |
| LLM | Configurable en ElevenLabs (por defecto GPT-4o mini) |
| TTS | ElevenLabs Voices |
| Base de datos | Supabase (`voice_conversations`, `theatres`) |
| Backend webhook | Next.js App Router (`/api/voice/conversations`) |
| Panel de gestión | TALIA Agora / Backstage |

---

## Modelo de número telefónico

El número de voz se configura **por venue**, no por account.

### Opción A — Número gestionado por TALIA

TALIA compra/provisiona el número y lo asigna al agente de la venue.

Uso recomendado:
- demos,
- clientes sin centralita compleja,
- clientes que aceptan publicar un nuevo número,
- clientes que pueden desviar llamadas desde su número actual.

Ventajas:
- control operativo completo,
- baja complejidad para el cliente,
- troubleshooting más sencillo,
- métricas y límites fiables por venue.

### Opción B — Número del cliente con desvío

El cliente mantiene su número público y configura un desvío hacia el número TALIA.

Uso recomendado:
- teatros con número ya publicado,
- centralitas existentes,
- transición gradual sin cambiar comunicación pública.

La configuración del desvío vive fuera de TALIA, pero TALIA debe guardar una nota operativa en Backstage indicando:
- número público del cliente,
- número TALIA de destino,
- responsable técnico del cliente,
- estado del desvío.

### Opción C — Portabilidad o integración avanzada

Si el cliente quiere portar un número o usar reglas de routing avanzadas, TALIA debe usar Twilio u otro proveedor telefónico como capa de control.

Uso recomendado:
- multi-país,
- centralitas,
- horarios,
- grabaciones,
- routing por sede,
- fallback humano avanzado,
- futura integración con WhatsApp/SMS.

---

## Dónde se configura cada cosa

### TALIA Backstage

Backstage es la fuente operativa interna para activar voz en una venue:

- módulo `voice` activo en `tenant_modules`,
- plan y límites de minutos,
- `elevenlabs_agent_id`,
- `voice_phone_number`,
- proveedor telefónico previsto,
- estado del agente,
- instrucciones de desvío/portabilidad,
- fallback humano,
- notas internas de soporte.

Hoy ya se guardan estos campos en `theatres`:

- `voice_enabled`
- `elevenlabs_agent_id`
- `voice_phone_number`
- `voice_id`
- `voice_language`
- `voice_tone`
- `voice_temperature`
- `voice_system_prompt`
- `voice_max_turns`

Pendiente recomendado para producto:

- `voice_phone_provider`: `elevenlabs` / `twilio` / `external`
- `voice_phone_mode`: `talia_number` / `client_forwarding` / `portability`
- `voice_public_phone_number`: número que el cliente publica
- `voice_forwarding_notes`: instrucciones de desvío
- `voice_operational_status`: `draft` / `provisioning` / `active` / `paused` / `error`

### TALIA Agora

El cliente solo debería ver y editar ajustes seguros:

- activar/desactivar si su rol lo permite,
- tono,
- idioma,
- prompt/base de conocimiento,
- número activo de TALIA,
- instrucciones de desvío,
- minutos usados,
- límite del plan.

IDs internos, proveedor telefónico y errores de sincronización deberían quedar principalmente en Backstage.

### ElevenLabs

ElevenLabs contiene la capa conversacional:

- Agent ID,
- voz,
- idioma/modelo,
- system prompt,
- first message,
- knowledge base si se usa desde ElevenLabs,
- herramientas/webhooks si se añaden,
- número asignado si se usa telefonía nativa/importada.

TALIA sincroniza el prompt efectivo, voz y temperatura con `PATCH /v1/convai/agents/{agent_id}`.

### Twilio

Twilio se usa cuando TALIA necesita control telefónico por encima de ElevenLabs:

- comprar número,
- importar número en ElevenLabs,
- gestionar llamadas entrantes,
- routing,
- horarios,
- fallback,
- logs de llamada,
- grabaciones si aplican,
- portabilidad.

Si ElevenLabs Phone Numbers cubre el caso, Twilio no es obligatorio.

---

## Setup por venue (paso a paso)

### 1. Telefonía — elegir modelo

Antes de crear el agente, decide:

- **Número TALIA nuevo**: TALIA provisiona número y el cliente lo publica o desvía llamadas.
- **Número cliente con desvío**: el cliente conserva su número y redirige a TALIA.
- **Twilio/portabilidad**: TALIA gestiona routing avanzado.

### 2. Twilio — número de teléfono, si aplica

1. Compra un número en [console.twilio.com](https://console.twilio.com) → Phone Numbers → Buy a number
   - Números de EEUU (+1): sin documentación adicional, compra inmediata
   - Números de España (+34) / UK (+44): requieren Regulatory Bundle (3–7 días)
2. Anota el **Account SID** y **Auth Token** (Dashboard de Twilio → Account Info)

Si se usa número nativo de ElevenLabs, este paso puede omitirse.

### 3. ElevenLabs — crear el agente

1. ElevenLabs → Conversational AI → Agentes → Nuevo agente
2. Configura:
   - **Nombre**: e.g. `talia_[nombre_venue]`
   - **Voz**: elige una del catálogo o clonada. Copia el **Voice ID** (Voices → click en la voz)
   - **Idioma**: según la venue
3. Pestaña **Agente** → copia el **Agent ID** de la URL: `elevenlabs.io/app/conversational-ai/agents/agent_XXXXX`

### 4. ElevenLabs — configurar número

Si se usa telefonía de ElevenLabs:

1. ElevenLabs → Phone Numbers
2. Compra/asigna el número disponible
3. Asígnalo al agente de la venue

Si se usa Twilio:

1. ElevenLabs → Números de teléfono → Importar de Twilio
2. Introduce Account SID + Auth Token de Twilio
3. Selecciona el número comprado
4. Asígnalo al agente de la venue

### 5. ElevenLabs — configurar post-call webhook

1. ElevenLabs → Agentes → [agente] → Avanzado (o Análisis)
2. **Post-call webhook URL**: `https://talia-client.vercel.app/api/voice/conversations`
3. Guarda el **Webhook Secret** que genera ElevenLabs → añádelo a las variables de entorno

### 6. TALIA Backstage — activar módulo de voz

1. Backstage → Cliente → Venue
2. Activa el módulo **Voz**
3. Configura el plan/límite de minutos de la venue
4. Guarda el número y el proveedor elegido

### 7. TALIA Agora — configurar la venue

1. Agora → [Venue] → Agente de voz → Configuración
2. Rellena:
   - **Agente de voz activo**: ✓
   - **Agent ID**: el de ElevenLabs (`agent_XXXXX`)
   - **Voice ID**: el de la voz elegida
   - **Número de teléfono**: el número asignado a la venue
   - **Idioma**: según la venue
   - **Tono**: Cálido / Profesional / Neutro
   - **Creatividad**: slider 0–100% (mapea a temperatura LLM)
   - **Prompt**: déjalo vacío para generación automática
3. Guarda → TALIA sincronizará automáticamente el system prompt y la temperatura con ElevenLabs vía API

---

## Variables de entorno

```env
# ElevenLabs
ELEVENLABS_API_KEY=sk_...          # API key con permisos de escritura en agentes
ELEVENLABS_WEBHOOK_SECRET=wsec_... # Secreto del webhook post-llamada

# App
NEXT_PUBLIC_APP_URL=https://talia-client.vercel.app
INTERNAL_API_KEY=...              # Requerida en producción para endpoints internos
```

---

## Base de datos

### Tabla `theatres` — columnas de voz actuales

| Columna | Tipo | Descripción |
|---|---|---|
| `voice_enabled` | boolean | Agente activo/inactivo |
| `elevenlabs_agent_id` | text | ID del agente en ElevenLabs |
| `voice_phone_number` | text | Número de teléfono (solo referencia) |
| `voice_id` | text | Voice ID de ElevenLabs |
| `voice_language` | text | `ca` / `es` / `en` |
| `voice_tone` | text | `warm` / `professional` / `neutral` |
| `voice_temperature` | integer | 0–100 (mapea a 0.0–1.0 en ElevenLabs) |
| `voice_system_prompt` | text | Prompt personalizado (null = auto-generado) |
| `voice_max_turns` | integer | Límite de turnos por llamada |

### Campos recomendados próximos

| Columna | Tipo | Descripción |
|---|---|---|
| `voice_phone_provider` | text | `elevenlabs` / `twilio` / `external` |
| `voice_phone_mode` | text | `talia_number` / `client_forwarding` / `portability` |
| `voice_public_phone_number` | text | Número público del cliente, si es distinto del número TALIA |
| `voice_forwarding_notes` | text | Instrucciones o estado del desvío |
| `voice_operational_status` | text | `draft` / `provisioning` / `active` / `paused` / `error` |

### Tabla `voice_conversations`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `theatre_id` | uuid | FK → theatres |
| `call_sid` | text | `conversation_id` de ElevenLabs. Único para soportar reintentos del webhook |
| `status` | text | Estado final enviado por ElevenLabs |
| `from_number` | text | Número del llamante |
| `duration_sec` | integer | Duración en segundos |
| `turns` | integer | Número de intercambios |
| `transcript` | jsonb | Array `[{role, content}]` |
| `topic` | text | Tema canónico para métricas (`agenda`, `entradas`, `accesibilidad`, etc.) |
| `summary` | text | Resumen de la llamada (de ElevenLabs Analysis) |
| `created_at` | timestamptz | Timestamp |

### Migraciones

```
20260505000000_conversation_topics_channel.sql  — canal en topics
20260505001000_voice_agent.sql                  — columnas voice_* + voice_conversations
20260505002000_voice_elevenlabs_agent.sql        — elevenlabs_agent_id
20260505003000_voice_tone_temperature.sql        — voice_tone + voice_temperature
20260506000000_voice_conversation_hardening.sql  — status, summary, topic canónico e idempotencia
20260508001000_voice_phone_operations.sql        — proveedor, modo, número público, notas y estado operativo
```

---

## Prompt — generación automática

El system prompt se genera en `src/lib/voice/prompt-builder.ts` con estas secciones:

```
### Personality   ← nombre del teatro + descripción del tono
### Environment   ← contexto de llamada de voz
### Tone          ← instrucciones de estilo según tono elegido
### Goal          ← flujo de atención al cliente
### Guardrails    ← límites + contacto de escalado
### Knowledge Base ← ítems de la base de conocimiento del Agora
```

La sección `Knowledge Base` se puebla con los ítems activos de `knowledge_items` del tenant. Si el campo de prompt en el Agora tiene contenido, sobreescribe el generado.

**Sincronización**: al guardar en Agora → Agente de voz, se llama a `PATCH /v1/convai/agents/{agent_id}` con el prompt efectivo y la temperatura. Para catalán, TALIA no envía `language: ca` porque algunos modelos de ElevenLabs, como `eleven_flash_v2`, no aceptan ese valor; el catalán se fuerza desde el prompt. Si la API de ElevenLabs falla, el save en DB se mantiene y el dashboard muestra el error de sincronización.

---

## Endpoints API

### `POST /api/voice/conversations`

Webhook post-llamada de ElevenLabs. Verifica la firma HMAC-SHA256 (`elevenlabs-signature` header).

**Payload esperado:**
```json
{
  "type": "post_call_transcription",
  "data": {
    "agent_id": "agent_xxx",
    "conversation_id": "conv_xxx",
    "transcript": [
      { "role": "agent", "message": "Hola, soc TALIA..." },
      { "role": "user", "message": "Vull saber els preus..." }
    ],
    "metadata": {
      "call_duration_secs": 120,
      "phone_call": { "caller_id": "+34666..." }
    },
    "analysis": {
      "transcript_summary": "El usuario preguntó sobre precios de entradas."
    }
  }
}
```

Flujo interno:
1. Verifica firma ElevenLabs
2. Resuelve teatro por `elevenlabs_agent_id`
3. Guarda o actualiza en `voice_conversations` por `call_sid`
4. Separa `summary` de llamada y `topic` canónico
5. Guarda topic en `conversation_topics` con `channel: 'voice'` (aparece en Analytics → Temas e intención)

### `GET /api/internal/voice/resolve?phone=+1...`

Lookup de configuración por número de teléfono. Uso interno / admin. Requiere header `x-talia-internal-key`.

---

## Analytics

Las conversaciones de voz aparecen en **Data → Temas e intención** con el filtro de canal **Voz**. El resumen de ElevenLabs se guarda como `summary`; el `topic` se normaliza a una categoría canónica para que las métricas sean comparables entre web, voz y futuros canales.

Para billing y límites, los minutos deben registrarse en:

- `usage_events` con `module_key='voice'`, `channel='voice'`, `event_type='voice_minute'`
- `tenant_usage_daily.voice_minutes`
- `tenant_subscriptions.included_voice_minutes`

El webhook post-call ya recibe `call_duration_secs`. La conversión recomendada es:

```
voice_minutes = ceil(call_duration_secs / 60)
```

Esto permite aplicar límites por venue sin mezclar planes entre venues del mismo account.

---

## Tonos disponibles

| Tono | Descripción | Ideal para |
|---|---|---|
| `warm` | Cálido, cercano, entusiasta | Teatros familiares, públicos generales |
| `professional` | Eficiente, preciso, conciso | Teatros de ópera, circuitos corporativos |
| `neutral` | Equilibrado, claro, sin excesos | Por defecto |

---

## Escalado multi-tenant

Cada venue tiene:
- Su propio agente en ElevenLabs (1 agent ID por venue)
- Su propio número de teléfono gestionado por TALIA o desvío desde número del cliente
- Su propio prompt (generado o personalizado)
- Sus propias conversaciones en `voice_conversations` (aisladas por RLS)
- Sus propios límites de minutos y plan

Para añadir una nueva venue: completar el Setup (pasos 1–7). No hay configuración centralizada que modificar.

---

## Checklist de alta de voz

Backstage:
- Venue creada
- Módulo `voice` activo
- Plan de la venue definido
- Límite de minutos definido
- Estado operativo en `provisioning`

Telefonía:
- Modelo elegido: número TALIA / desvío cliente / portabilidad
- Número TALIA asignado
- Número público del cliente documentado, si aplica
- Desvío probado, si aplica

ElevenLabs:
- Agente creado
- Voice ID configurado
- Agent ID guardado en TALIA
- Número asignado al agente
- Post-call webhook configurado
- Webhook secret en entorno

TALIA Agora:
- `voice_enabled=true`
- Prompt generado o personalizado
- Tono y temperatura configurados
- Fallback humano configurado
- Llamada de prueba registrada en `voice_conversations`
