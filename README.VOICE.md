# TALIA Agora — Agente de Voz

Documentación técnica y operativa del agente de voz de TALIA, basado en ElevenLabs Conversational AI.

---

## Arquitectura

```
Llamada entrante
      │
      ▼
┌─────────────┐     gestiona la llamada     ┌─────────────────────────┐
│   Twilio    │ ◄────────────────────────── │  ElevenLabs Conv. AI    │
│ (teléfono)  │                             │  (STT + LLM + TTS)      │
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

Cada teatro tiene su propio agente en ElevenLabs. No hay n8n en el flujo de voz.

---

## Stack

| Componente | Servicio |
|---|---|
| Telefonía | Twilio (número de teléfono) |
| Voz conversacional | ElevenLabs Conversational AI |
| STT | ElevenLabs (integrado) |
| LLM | Configurable en ElevenLabs (por defecto GPT-4o mini) |
| TTS | ElevenLabs Voices |
| Base de datos | Supabase (`voice_conversations`, `theatres`) |
| Backend webhook | Next.js App Router (`/api/voice/conversations`) |
| Panel de gestión | TALIA Agora |

---

## Setup por tenant (paso a paso)

### 1. Twilio — número de teléfono

1. Compra un número en [console.twilio.com](https://console.twilio.com) → Phone Numbers → Buy a number
   - Números de EEUU (+1): sin documentación adicional, compra inmediata
   - Números de España (+34) / UK (+44): requieren Regulatory Bundle (3–7 días)
2. Anota el **Account SID** y **Auth Token** (Dashboard de Twilio → Account Info)

### 2. ElevenLabs — crear el agente

1. ElevenLabs → Conversational AI → Agentes → Nuevo agente
2. Configura:
   - **Nombre**: e.g. `talia_[nombre_teatro]`
   - **Voz**: elige una del catálogo o clonada. Copia el **Voice ID** (Voices → click en la voz)
   - **Idioma**: según el teatro
3. Pestaña **Agente** → copia el **Agent ID** de la URL: `elevenlabs.io/app/conversational-ai/agents/agent_XXXXX`

### 3. ElevenLabs — importar número de Twilio

1. ElevenLabs → Números de teléfono → Importar de Twilio
2. Introduce Account SID + Auth Token de Twilio
3. Selecciona el número comprado
4. Asígnalo al agente del teatro

### 4. ElevenLabs — configurar post-call webhook

1. ElevenLabs → Agentes → [agente] → Avanzado (o Análisis)
2. **Post-call webhook URL**: `https://talia-client.vercel.app/api/voice/conversations`
3. Guarda el **Webhook Secret** que genera ElevenLabs → añádelo a las variables de entorno

### 5. TALIA Agora — configurar el tenant

1. Agora → [Teatro] → Agente de voz → Configuración
2. Rellena:
   - **Agente de voz activo**: ✓
   - **Agent ID**: el de ElevenLabs (`agent_XXXXX`)
   - **Voice ID**: el de la voz elegida
   - **Número de teléfono**: el número comprado en Twilio
   - **Idioma**: según el teatro
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

### Tabla `theatres` — columnas de voz

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

---

## Tonos disponibles

| Tono | Descripción | Ideal para |
|---|---|---|
| `warm` | Cálido, cercano, entusiasta | Teatros familiares, públicos generales |
| `professional` | Eficiente, preciso, conciso | Teatros de ópera, circuitos corporativos |
| `neutral` | Equilibrado, claro, sin excesos | Por defecto |

---

## Escalado multi-tenant

Cada teatro tiene:
- Su propio agente en ElevenLabs (1 agent ID por teatro)
- Su propio número de teléfono en Twilio (importado en ElevenLabs)
- Su propio prompt (generado o personalizado)
- Sus propias conversaciones en `voice_conversations` (aisladas por RLS)

Para añadir un nuevo teatro: completar el Setup (pasos 1–5). No hay configuración centralizada que modificar.
