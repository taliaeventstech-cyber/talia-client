# Requirements: Voice Agent

Technical and operational documentation for TALIA's voice agent, based on ElevenLabs Conversational AI.

Status: planned/paused for client. Must not appear in client onboarding nor as an active option in Agora until it is reactivated (see `docs/current-state.md`).

---

## Objective

Allow a venue to handle calls with TALIA using conversational voice, saving transcript, metrics and operational status.

---

## Architecture

```
Incoming call
      │
      ▼
┌─────────────┐     handles the call        ┌─────────────────────────┐
│ Telephony   │ ◄────────────────────────── │  ElevenLabs Conv. AI    │
│ native/Twilio│                            │  (STT + LLM + TTS)      │
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

Each venue has its own agent in ElevenLabs. There is no n8n in the voice flow.

Telephony can operate in two modes:

1. **Number managed by TALIA**: TALIA provisions or imports the number and links it to the venue's agent.
2. **Client's number**: the client keeps their public number and sets up a forward/porting toward the number managed by TALIA.

For demos and first deployments, the recommended mode is **TALIA-managed number + forwarding from the client's number**. It reduces friction and gives us control over support, metrics, cancellations and provider changes.

---

## Stack

| Component | Service |
|---|---|
| Telephony | ElevenLabs Phone Numbers or Twilio |
| Conversational voice | ElevenLabs Conversational AI |
| STT | ElevenLabs (built-in) |
| LLM | Configurable in ElevenLabs (GPT-4o mini by default) |
| TTS | ElevenLabs Voices |
| Database | Supabase (`voice_conversations`, `theatres`) |
| Backend webhook | Next.js App Router (`/api/voice/conversations`) |
| Management panel | TALIA Agora / Backstage |

---

## Functional Requirements

- Enable/disable the voice module per venue.
- Save Agent ID and Voice ID from ElevenLabs.
- Configure tone, language, temperature and prompt.
- Save the client's public number and TALIA's operational number.
- Save forwarding notes.
- Save operational status: `draft`, `provisioning`, `active`, `paused`, `error`.
- Log calls, duration and transcript.
- Classify topic/intent after the call.

---

## Phone Number Model

The voice number is configured **per venue**, not per account.

### Option A — Number managed by TALIA

TALIA buys/provisions the number and assigns it to the venue's agent.

Recommended use: demos, clients without a complex switchboard, clients who accept publishing a new number, clients who can forward calls from their current number.

Advantages: full operational control, low complexity for the client, easier troubleshooting, reliable metrics and limits per venue.

### Option B — Client's number with forwarding

The client keeps their public number and sets up forwarding toward the TALIA number.

Recommended use: theatres with an already-published number, existing switchboards, gradual transition without changing public communications.

The forwarding setup lives outside TALIA, but TALIA must save an operational note in Backstage indicating: client's public number, destination TALIA number, client's technical contact, forwarding status.

### Option C — Porting or advanced integration

If the client wants to port a number or use advanced routing rules, TALIA must use Twilio or another telephony provider as a control layer.

Recommended use: multi-country, switchboards, schedules, recordings, routing per site, advanced human fallback, future WhatsApp/SMS integration.

---

## Where each thing is configured

### TALIA Backstage

Internal operational source to activate voice on a venue:

- `voice` module active in `tenant_modules`,
- plan and minute limits,
- `elevenlabs_agent_id`,
- `voice_phone_number`,
- planned telephony provider,
- agent status,
- forwarding/porting instructions,
- human fallback,
- internal support notes.

These fields are already saved today in `theatres`:

- `voice_enabled`
- `elevenlabs_agent_id`
- `voice_phone_number`
- `voice_id`
- `voice_language`
- `voice_tone`
- `voice_temperature`
- `voice_system_prompt`
- `voice_max_turns`

Recommended upcoming fields for the product:

- `voice_phone_provider`: `elevenlabs` / `twilio` / `external`
- `voice_phone_mode`: `talia_number` / `client_forwarding` / `portability`
- `voice_public_phone_number`: number the client publishes
- `voice_forwarding_notes`: forwarding instructions or status
- `voice_operational_status`: `draft` / `provisioning` / `active` / `paused` / `error`

### TALIA Agora

The client should only see and edit safe settings: enable/disable if their role allows it, tone, language, prompt/knowledge base, TALIA's active number, forwarding instructions, minutes used, plan limit.

Internal IDs, telephony provider and sync errors should remain mainly in Backstage.

### ElevenLabs

Contains the conversational layer: Agent ID, voice, language/model, system prompt, first message, knowledge base if used from ElevenLabs, tools/webhooks if added, assigned number if native/imported telephony is used.

TALIA syncs the effective prompt, voice and temperature with `PATCH /v1/convai/agents/{agent_id}`.

### Twilio

Used when TALIA needs telephony control above ElevenLabs: buying a number, importing a number into ElevenLabs, managing incoming calls, routing, schedules, fallback, call logs, recordings if applicable, porting.

If ElevenLabs Phone Numbers covers the case, Twilio is not mandatory.

---

## Setup per venue (step by step)

### 1. Telephony — choose the model

Before creating the agent, decide: **New TALIA number** (TALIA provisions the number and the client publishes it or forwards calls), **Client number with forwarding** (the client keeps their number and redirects to TALIA), or **Twilio/porting** (TALIA manages advanced routing).

### 2. Twilio — phone number, if applicable

1. Buy a number at [console.twilio.com](https://console.twilio.com) → Phone Numbers → Buy a number
   - US numbers (+1): no additional documentation, immediate purchase
   - Spain (+34) / UK (+44) numbers: require a Regulatory Bundle (3–7 days)
2. Note down the **Account SID** and **Auth Token** (Twilio Dashboard → Account Info)

If ElevenLabs' native number is used, this step can be skipped.

### 3. ElevenLabs — create the agent

1. ElevenLabs → Conversational AI → Agents → New agent
2. Configure:
   - **Name**: e.g. `talia_[venue_name]`
   - **Voice**: choose one from the catalog or a clone. Copy the **Voice ID** (Voices → click on the voice)
   - **Language**: based on the venue
3. **Agent** tab → copy the **Agent ID** from the URL: `elevenlabs.io/app/conversational-ai/agents/agent_XXXXX`

### 4. ElevenLabs — configure the number

If ElevenLabs telephony is used:

1. ElevenLabs → Phone Numbers
2. Buy/assign the available number
3. Assign it to the venue's agent

If Twilio is used:

1. ElevenLabs → Phone Numbers → Import from Twilio
2. Enter the Twilio Account SID + Auth Token
3. Select the purchased number
4. Assign it to the venue's agent

### 5. ElevenLabs — configure post-call webhook

1. ElevenLabs → Agents → [agent] → Advanced (or Analysis)
2. **Post-call webhook URL**: `https://talia-client.vercel.app/api/voice/conversations`
3. Save the **Webhook Secret** generated by ElevenLabs → add it to the environment variables

### 6. TALIA Backstage — activate the voice module

1. Backstage → Client → Venue
2. Activate the **Voice** module
3. Configure the venue's minute plan/limit
4. Save the number and the chosen provider

### 7. TALIA Agora — configure the venue

1. Agora → [Venue] → Voice agent → Configuration
2. Fill in:
   - **Voice agent active**: ✓
   - **Agent ID**: the one from ElevenLabs (`agent_XXXXX`)
   - **Voice ID**: the one for the chosen voice
   - **Phone number**: the number assigned to the venue
   - **Language**: based on the venue
   - **Tone**: Warm / Professional / Neutral
   - **Creativity**: 0–100% slider (maps to LLM temperature)
   - **Prompt**: leave empty for automatic generation
3. Save → TALIA will automatically sync the system prompt and temperature with ElevenLabs via API

---

## Environment variables

```env
# ElevenLabs
ELEVENLABS_API_KEY=sk_...          # API key with write permissions on agents
ELEVENLABS_WEBHOOK_SECRET=wsec_... # Post-call webhook secret

# App
NEXT_PUBLIC_APP_URL=https://talia-client.vercel.app
INTERNAL_API_KEY=...              # Required in production for internal endpoints
```

---

## Database

### `theatres` table — current voice columns

| Column | Type | Description |
|---|---|---|
| `voice_enabled` | boolean | Agent active/inactive |
| `elevenlabs_agent_id` | text | Agent ID in ElevenLabs |
| `voice_phone_number` | text | Phone number (reference only) |
| `voice_id` | text | Voice ID from ElevenLabs |
| `voice_language` | text | `ca` / `es` / `en` |
| `voice_tone` | text | `warm` / `professional` / `neutral` |
| `voice_temperature` | integer | 0–100 (maps to 0.0–1.0 in ElevenLabs) |
| `voice_system_prompt` | text | Custom prompt (null = auto-generated) |
| `voice_max_turns` | integer | Turn limit per call |

### Recommended upcoming fields

| Column | Type | Description |
|---|---|---|
| `voice_phone_provider` | text | `elevenlabs` / `twilio` / `external` |
| `voice_phone_mode` | text | `talia_number` / `client_forwarding` / `portability` |
| `voice_public_phone_number` | text | Client's public number, if different from the TALIA number |
| `voice_forwarding_notes` | text | Forwarding instructions or status |
| `voice_operational_status` | text | `draft` / `provisioning` / `active` / `paused` / `error` |

### `voice_conversations` table

| Column | Type | Description |
|---|---|---|
| `id` | uuid | PK |
| `theatre_id` | uuid | FK → theatres |
| `call_sid` | text | ElevenLabs `conversation_id`. Unique to support webhook retries |
| `status` | text | Final status sent by ElevenLabs |
| `from_number` | text | Caller's number |
| `duration_sec` | integer | Duration in seconds |
| `turns` | integer | Number of exchanges |
| `transcript` | jsonb | Array `[{role, content}]` |
| `topic` | text | Canonical topic for metrics (`agenda`, `entradas`, `accesibilidad`, etc.) |
| `summary` | text | Call summary (from ElevenLabs Analysis) |
| `created_at` | timestamptz | Timestamp |

### Migrations

```
20260505000000_conversation_topics_channel.sql  — channel in topics
20260505001000_voice_agent.sql                  — voice_* columns + voice_conversations
20260505002000_voice_elevenlabs_agent.sql        — elevenlabs_agent_id
20260505003000_voice_tone_temperature.sql        — voice_tone + voice_temperature
20260506000000_voice_conversation_hardening.sql  — status, summary, canonical topic and idempotency
20260508001000_voice_phone_operations.sql        — provider, mode, public number, notes and operational status
```

---

## Prompt — automatic generation

The system prompt is generated in `src/lib/voice/prompt-builder.ts` with these sections:

```
### Personality   ← venue name + tone description
### Environment   ← voice call context
### Tone          ← style instructions based on chosen tone
### Goal          ← customer service flow
### Guardrails    ← limits + escalation contact
### Knowledge Base ← items from the Agora knowledge base
```

The `Knowledge Base` section is populated with the active items from the tenant's `knowledge_items`. If the prompt field in Agora has content, it overrides the generated one.

**Synchronization**: when saving in Agora → Voice agent, `PATCH /v1/convai/agents/{agent_id}` is called with the effective prompt and temperature. For Catalan, TALIA does not send `language: ca` because some ElevenLabs models, such as `eleven_flash_v2`, do not accept that value; Catalan is enforced from the prompt instead. If the ElevenLabs API fails, the save in the DB is kept and the dashboard shows the sync error.

---

## API Endpoints

### `POST /api/voice/conversations`

ElevenLabs post-call webhook. Verifies the HMAC-SHA256 signature (`elevenlabs-signature` header).

**Expected payload:**
```json
{
  "type": "post_call_transcription",
  "data": {
    "agent_id": "agent_xxx",
    "conversation_id": "conv_xxx",
    "transcript": [
      { "role": "agent", "message": "Hi, I'm TALIA..." },
      { "role": "user", "message": "I want to know the ticket prices..." }
    ],
    "metadata": {
      "call_duration_secs": 120,
      "phone_call": { "caller_id": "+34666..." }
    },
    "analysis": {
      "transcript_summary": "The user asked about ticket prices."
    }
  }
}
```

Internal flow:
1. Verifies ElevenLabs signature
2. Resolves venue by `elevenlabs_agent_id`
3. Saves or updates `voice_conversations` by `call_sid`
4. Separates the call `summary` and canonical `topic`
5. Saves topic in `conversation_topics` with `channel: 'voice'` (appears in Analytics → Topics and intent)

### `GET /api/internal/voice/resolve?phone=+1...`

Configuration lookup by phone number. Internal/admin use. Requires `x-talia-internal-key` header.

---

## Analytics

Voice conversations appear in **Data → Topics and intent** with the **Voice** channel filter. The ElevenLabs summary is saved as `summary`; the `topic` is normalized to a canonical category so metrics are comparable across web, voice and future channels.

For billing and limits, minutes must be logged in:

- `usage_events` with `module_key='voice'`, `channel='voice'`, `event_type='voice_minute'`
- `tenant_usage_daily.voice_minutes`
- `tenant_subscriptions.included_voice_minutes`

The post-call webhook already receives `call_duration_secs`. The recommended conversion is:

```
voice_minutes = ceil(call_duration_secs / 60)
```

This allows applying limits per venue without mixing plans across venues of the same account.

---

## Available tones

| Tone | Description | Ideal for |
|---|---|---|
| `warm` | Warm, approachable, enthusiastic | Family theatres, general audiences |
| `professional` | Efficient, precise, concise | Opera houses, corporate circuits |
| `neutral` | Balanced, clear, no excess | Default |

---

## Multi-tenant scaling

Each venue has: its own agent in ElevenLabs (1 agent ID per venue), its own phone number managed by TALIA or forwarding from the client's number, its own prompt (generated or custom), its own conversations in `voice_conversations` (isolated by RLS), its own minute limits and plan.

To add a new venue: complete the Setup (steps 1–7). There is no centralized configuration to modify.

---

## Voice onboarding checklist

Backstage:
- Venue created
- `voice` module active
- Venue plan defined
- Minute limit defined
- Operational status in `provisioning`

Telephony:
- Model chosen: TALIA number / client forwarding / porting
- TALIA number assigned
- Client's public number documented, if applicable
- Forwarding tested, if applicable

ElevenLabs:
- Agent created
- Voice ID configured
- Agent ID saved in TALIA
- Number assigned to the agent
- Post-call webhook configured
- Webhook secret in environment

TALIA Agora:
- `voice_enabled=true`
- Prompt generated or customized
- Tone and temperature configured
- Human fallback configured
- Test call logged in `voice_conversations`
