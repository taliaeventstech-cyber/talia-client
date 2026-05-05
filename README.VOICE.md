# TALIA Voice Agent – Architecture & Implementation Guide

This document describes the voice agent architecture for TALIA. The current implementation uses n8n as the orchestration layer. This is intentional and temporary — the design is built to be backend-agnostic so that n8n can be replaced by a custom API (Node.js/Python) at any point without restructuring the core logic.

---

## Overview

When a user calls a theatre's TALIA phone number, the call is handled by Twilio, transcribed by Whisper, processed by GPT-4o (with the theatre's config loaded from Supabase), and the response is converted to natural speech by ElevenLabs and played back to the caller. All conversations are saved to Supabase. The flow loops until the caller hangs up.

This is the same pattern used by voice AI platforms like Bookline (hospitality sector). TALIA applies it to cultural venues.

---

## Call Flow

```
1. User calls theatre phone number (Twilio)
2. Twilio sends audio webhook to n8n
3. n8n sends audio to Whisper → receives transcript
4. n8n fetches theatre config from Supabase (system_prompt, language, fallback)
5. n8n sends transcript + config to GPT-4o → receives text response
6. n8n sends text to ElevenLabs → receives audio (mp3)
7. n8n responds to Twilio with TwiML containing audio URL
8. Twilio plays audio to caller
9. Twilio captures caller's next utterance → loop back to step 2
10. On hangup: n8n saves full conversation to Supabase
```

Target latency per turn: **< 1.5 seconds** (achievable with ElevenLabs Turbo v2 + GPT-4o streaming).

---

## Tech Stack

| Component | Service | Purpose |
|---|---|---|
| Telephony | Twilio | Phone number, call handling, audio playback |
| Speech-to-text | OpenAI Whisper | Transcribe caller audio to text |
| LLM | OpenAI GPT-4o | Generate contextual response |
| Text-to-speech | ElevenLabs Turbo v2 | Convert response to natural voice |
| Orchestration | n8n (self-hosted, Render) | Glue everything together |
| Database | Supabase (PostgreSQL) | Theatre config, conversation logs |
| Phone provisioning | Twilio Console | One number per theatre or shared number with routing |

---

## Multi-tenant Design

Every theatre has its own configuration in Supabase. The voice agent is shared infrastructure — a single n8n workflow serves all theatres. The `theatre_id` is resolved at call time from the incoming Twilio number.

```
Theatre A → number +34 93 XXX XX XX → theatre_id: uuid-a → loads config A
Theatre B → number +34 91 XXX XX XX → theatre_id: uuid-b → loads config B
```

Supabase `theatres` table stores per-theatre voice config:

```sql
-- Voice-specific columns added to theatres table
alter table theatres add column if not exists
  twilio_phone_number    text,         -- e.g. +34931234567
  voice_id               text,         -- ElevenLabs voice ID
  voice_language         text default 'ca',  -- ca | es | en
  voice_system_prompt    text,         -- separate from chat prompt
  voice_enabled          boolean default false,
  voice_max_turns        int default 10;     -- safety limit per call
```

---

## n8n Workflow Structure

The workflow is a synchronous request-response loop driven by Twilio webhooks.

### Nodes in order

**1. Webhook Trigger**
- Method: POST
- Path: `/webhook/voice/incoming`
- Receives Twilio's call payload: `CallSid`, `From`, `To`, `RecordingUrl` (after gather)

**2. Resolve Theatre**
- HTTP Request → Supabase REST API
- Query: `GET /rest/v1/theatres?twilio_phone_number=eq.{To}&select=id,voice_system_prompt,voice_id,voice_language,voice_max_turns`
- Returns theatre config for the dialled number

**3. Branch: First turn vs subsequent turns**
- If no `RecordingUrl` in payload → it's the first turn → play greeting and start `<Gather>`
- If `RecordingUrl` present → transcribe and continue

**4. Transcribe (Whisper)**
- HTTP Request → `POST https://api.openai.com/v1/audio/transcriptions`
- Body: audio file from Twilio recording URL + `model: whisper-1` + `language: {voice_language}`
- Returns: `{ text: "..." }`

**5. Build conversation context**
- Set Node: assembles messages array from session memory (stored in Supabase or n8n memory node)
- Appends new user message to history
- Injects theatre system prompt

**6. Generate response (GPT-4o)**
- HTTP Request → `POST https://api.openai.com/v1/chat/completions`
- Model: `gpt-4o`
- Temperature: `0.3`
- Max tokens: `120` — keep responses short for natural conversation
- System prompt includes: theatre info, fallback contact, language rule, brevity instruction

**7. Synthesize voice (ElevenLabs)**
- HTTP Request → `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- Model: `eleven_turbo_v2_5` — lowest latency
- Returns: mp3 binary
- Upload to temporary storage (Supabase Storage or S3) → get public URL

**8. Respond to Twilio (TwiML)**
- Respond Node: returns XML to Twilio
```xml
<Response>
  <Play>{audio_url}</Play>
  <Gather input="speech" action="/webhook/voice/incoming" method="POST"
          speechTimeout="auto" language="{voice_language}">
  </Gather>
  <Redirect>/webhook/voice/incoming</Redirect>
</Response>
```

**9. On hangup (separate webhook)**
- Twilio calls `/webhook/voice/hangup` with `CallSid`
- n8n saves full conversation to Supabase `voice_conversations` table
- Runs topic classification (same GPT-4o-mini pattern as chat)

---

## Supabase Schema (Voice)

```sql
create table voice_conversations (
  id           uuid primary key default gen_random_uuid(),
  theatre_id   uuid references theatres(id) on delete cascade,
  call_sid     text not null,        -- Twilio CallSid
  from_number  text,                 -- caller's number (anonymised if needed)
  duration_sec int,
  turns        int,
  transcript   jsonb,                -- array of {role, content, timestamp}
  topic        text,                 -- classified after hangup
  created_at   timestamptz default now()
);

alter table voice_conversations enable row level security;

create policy "tenant_select" on voice_conversations
  for select using (theatre_id = public.current_theatre_id());

create index idx_voice_conv_theatre on voice_conversations(theatre_id);
create index idx_voice_conv_call    on voice_conversations(call_sid);
```

---

## Latency Optimisation

Three things that make or break the voice experience:

**1. Use ElevenLabs Turbo v2.5**
`eleven_turbo_v2_5` adds ~300ms vs the standard model. Never use the standard model for voice agents.

**2. Keep GPT-4o responses short**
Add to every voice system prompt:
```
VOICE RULE: Respond in maximum 2 short sentences. Never lists. Never long explanations.
If a full answer requires more detail, give the short version and offer to send more info by email.
```

**3. Parallel audio upload**
While ElevenLabs is synthesising, pre-generate the TwiML structure. Upload audio to Supabase Storage with a predictable filename pattern so the URL is known before upload completes.

Target breakdown per turn:
```
Twilio webhook delivery:    ~100ms
Whisper transcription:      ~400ms
GPT-4o response:            ~600ms
ElevenLabs Turbo synthesis: ~300ms
Audio upload + URL:         ~150ms
Total:                     ~1.55s
```

---

## Voice Agent System Prompt Pattern

The voice system prompt is separate from the chat system prompt. It is shorter and more constrained.

```
You are TALIA, the voice assistant for {theatre_name}.

LANGUAGE: Always respond in {voice_language}. Never switch languages.

VOICE RULES:
- Maximum 2 short sentences per response.
- Natural spoken language only — no lists, no markdown, no URLs.
- If you don't know something, say so briefly and offer to connect them with a human.
- Never spell out phone numbers digit by digit — say "call us at nine-three-zero..."

BASIC INFO (no web lookup needed):
{voice_basic_info}

FALLBACK:
If you cannot answer: "For that I'd suggest calling us directly at {fallback_phone} or emailing {fallback_email}."

END OF CALL:
When the user says goodbye, respond warmly and end with <end_call/> tag so the system can hang up gracefully.
```

---

## Twilio Configuration

One number per theatre is the cleanest setup for multi-tenancy.

```
Theatre A: +34 93 XXX XX XX → webhook: https://n8n.onrender.com/webhook/voice/incoming
Theatre B: +34 91 XXX XX XX → webhook: https://n8n.onrender.com/webhook/voice/incoming
```

Both point to the same webhook. The `To` field in Twilio's payload identifies which theatre is being called. n8n resolves the theatre from Supabase using that number.

For demo purposes (TNC), one number is sufficient.

Twilio webhook settings per number:
- Voice → A call comes in → Webhook → POST → `{n8n_base_url}/webhook/voice/incoming`
- Call status changes → Webhook → POST → `{n8n_base_url}/webhook/voice/hangup`

---

## Demo Setup (TNC — Fast Path)

For the TNC demo, the fastest path is ElevenLabs Conversational AI with Twilio native integration. This bypasses n8n entirely and is not multi-tenant — it is a standalone demo agent only.

**Steps:**
1. Create ElevenLabs account → Agents → Create agent
2. Set system prompt (TNC-specific, in Catalan)
3. Choose voice (recommend: multilingual female, natural pace)
4. Go to Telephony → Import Twilio number (Account SID + Auth Token)
5. Link number to agent
6. Test: call the number

This is ready in under 2 hours. It does not connect to Supabase or the TALIA dashboard. Use it exclusively for the demo.

Once the demo is done, migrate TNC to the full n8n multi-tenant workflow.

---

## Migration Path: n8n → Custom Backend

The architecture is designed so that n8n is a replaceable orchestration layer. All business logic lives in:
- Supabase (config, data)
- The system prompt pattern (documented above)
- The node sequence (documented above)

When migrating to a custom backend (Node.js/Fastify or Python/FastAPI):

1. Recreate the webhook endpoints: `POST /voice/incoming` and `POST /voice/hangup`
2. Replicate the node sequence as async functions
3. Keep the same Supabase schema — zero DB migration needed
4. Keep the same Twilio webhook URLs (just change the target host)
5. Keep the same ElevenLabs and OpenAI calls

The migration is a backend rewrite, not an architecture change. Estimated effort: 3-5 days for a senior backend developer familiar with the stack.

---

## Environment Variables (Voice-specific additions)

```bash
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=          # default/demo number

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_VOICE_ID=  # fallback voice if theatre has none set

# OpenAI (shared with chat)
OPENAI_API_KEY=               # already set

# Supabase Storage (for audio files)
SUPABASE_STORAGE_BUCKET=talia-voice-audio
```

---

## Build Order

**Step 1 — Demo (TNC, this week)**
- ElevenLabs Conversational AI + Twilio
- Standalone, no Supabase, no n8n
- Goal: working demo call in < 2 hours

**Step 2 — n8n voice workflow (production)**
- Add voice columns to `theatres` table
- Create `voice_conversations` table with RLS
- Build n8n workflow following node sequence above
- Test with one theatre (IDEAL or TNC)

**Step 3 — Dashboard integration**
- Add voice section to theatre settings (enable/disable, voice selection, phone number)
- Add voice conversations to analytics
- Surface call transcripts in conversations view

**Step 4 — Scale**
- WhatsApp Business API (parallel to voice — same orchestration pattern)
- Custom backend to replace n8n (when volume justifies it)

---

## Notes

- Audio files stored in Supabase Storage should be deleted after 24 hours — they are temporary synthesis artifacts, not long-term assets.
- Caller phone numbers should be anonymised (hash or truncate) before storing in Supabase to comply with GDPR.
- The `voice_max_turns` limit in theatre config is a safety valve — prevents infinite loops and runaway API costs if something goes wrong.
- ElevenLabs Turbo v2.5 supports Catalan, Spanish, and English natively.