# Requirements: Chatbot Web

## Objective

Allow a venue to install TALIA on its website via a script and answer visitor questions with its own configuration.

## Current MVP

- Embeddable JS widget.
- Per-venue configuration.
- Primary color.
- Initial message.
- Session persistence via `localStorage`.
- TALIA API as a proxy to n8n/backend.
- Saving of conversations and messages.
- Topic and intent classification.
- Usage and limits per venue.

## Functional Requirements

- Install with a simple script.
- Identify `tenantId`.
- Respond in the language of the visitor's latest message when it can be
  determined, using the configured tenant language only as fallback.
- Use the knowledge base before generative responses.
- Maintain conversational context through discovery, recommendation and an
  explicit purchase or reservation turn, while retrieving tenant Knowledge
  again for every factual response.
- Render a localized purchase CTA only when `talia-ai` returns an item and exact
  HTTPS destination verified against the same cited Knowledge source.
- Save history.
- Allow configuring:
  - base prompt;
  - sources;
  - FAQs;
  - fallback email/phone;
  - color;
  - auto-open.

## Voice Mode (speech to text and spoken replies)

Visitor experience:

- A microphone button in the composer starts and stops voice input.
- Global keyboard shortcut `Alt+Shift+V` — `Option+Shift+V` on macOS/iPadOS, the
  same physical keys; every visible and spoken mention names the visitor's own
  keys (e.g. "Opción+Mayús+V" on a Mac) — (works before the widget has focus)
  opens the agent and starts listening; pressing it again stops listening and
  sends what was heard, or interrupts a reply that is being spoken. `Escape`
  cancels listening, a pending transcription or speech. The launcher and the
  microphone expose the shortcut through `aria-keyshortcuts` and a
  screen-reader description; the first time the panel is opened, an accessible
  tip announces it.
- Every step plays a distinct synthesized audio cue and is announced in an
  assertive live region: ready to talk, speech captured, transcribing, message
  sent, reply ready, cancelled/no speech, and error (microphone denied,
  unsupported browser, transcription failure). Recording starts only after the
  "ready" cue so the cue is never captured.
- Recording stops by itself after a 1.5 s pause once the visitor has spoken,
  after 8 s without speech, or at a 30 s cap.
- Replies to voice turns are spoken in the reply language
  (`response_language`), with markdown stripped and URLs replaced by a
  localized "link" word. A header speaker toggle ("read answers aloud",
  persisted per browser) also speaks replies to typed turns.

Hands-free conversation and wake word:

- After a voice question is answered aloud, the widget automatically listens
  again (with the "ready" cue) so the visitor can keep talking without
  pressing anything. Eight seconds of silence, Escape, typing, closing the
  panel, "para" or "escríbelo" end the conversation ("No he oído nada más…").
- Opt-in "Hola TALIA" mode (ear button in the widget header, remembered per
  browser): while on, the browser's speech engine listens for "Hola / Hello /
  Hey / Olá / Bon dia TALIA" (also "Talía", "Thalia" or a one-word custom
  assistant name) and then opens the agent and starts listening. It only
  listens while the agent is idle and the tab is visible, shows a green dot
  on the launcher (and in its accessible name), restarts with backoff when
  the browser ends recognition, and is hidden where browser recognition is
  unsupported (Firefox). Enabling it announces that the browser listens to
  the microphone while it is on; the privacy texts disclose it.

Voice invitation on first visit (venue setting "Invitar a usar la voz al
entrar", `widget_config.voiceInvitation`, off by default): visitors see an
informative card «Di "Hola TALIA"» explaining that, if they turn voice on,
their browser will listen to the microphone only to detect the wake phrase,
with **Activar voz** / **Ahora no** and a privacy link. The microphone is only
enabled from that click (opt-in consent: pre-enabled/opt-out listening is not
valid consent under GDPR per CJEU Planet49 and the EDPB, and browsers tend to
block microphone prompts on page load). After accepting, the card shows
"Voz activada" with **Desactivar**; the ear button and green launcher dot keep
the state visible and reversible (EDPB virtual voice assistant guidelines).
The choice is remembered per browser; opening the chat dismisses the card
without recording a choice. Not shown where browser recognition is
unavailable (Firefox). Venues enabling it should mention it in their own
privacy notice (they are the controller; TALIA processes on their behalf).

Agent voice: each venue chooses one of 11 OpenAI voices in Agora (Web Agent
settings, "Voz del agente", with a listen button per voice). It is stored as
`widget_config.agentVoice` and sent to `talia-ai` server-side by the speech
route; visitors cannot change it.

Voice commands (TAL-8), matched locally on short voice utterances in es, ca,
en and pt-BR without an AI call:

- "para / stop / atura / pare" stops speech;
- "repite / repeat / repeteix / repete" replays the last answer;
- "más despacio / slower / més a poc a poc / mais devagar" switches to a slow
  pace for the rest of the visit (TALIA voice `pace: slow`, browser rate 0.8)
  and repeats the last answer;
- "escríbelo / write it / per escrit / por escrito" stops speaking replies to
  voice turns (the speaker toggle re-enables it).
- "Talk to a person" is deliberately not a local command: it is sent to the
  agent, whose fallback policy offers the venue's verified human contacts.

Engines:

- **TALIA voice (default when configured):** the widget records with
  `MediaRecorder` and uploads to `POST /api/chat/[tenantId]/transcribe`;
  replies are synthesized by `POST /api/chat/[tenantId]/speech` (at most 1,200
  characters per request; the widget sends a short first chunk and prefetches
  the rest) and played through Web Audio, so host pages need no `media-src`
  changes. These Next routes are the guarded public gateway (TAL-6): they call
  `talia-ai` server-to-server (`/v1/voice/transcribe`, `/v1/voice/speech`, with
  the internal bearer key), and `talia-ai` calls OpenAI (`gpt-4o-mini-transcribe`
  with language auto-detection, `gpt-4o-mini-tts`). The browser never receives
  `talia-ai` or OpenAI credentials. The public widget configuration reports
  `voice.provider: 'talia'` when `TALIA_AI_BASE_URL` and
  `TALIA_AI_INTERNAL_API_KEY` are set and `WIDGET_SERVER_VOICE_ENABLED` is not
  `false`. Available on all plans.
- **Browser voice (fallback):** Web Speech recognition and synthesis. Used when
  TALIA voice is not configured, and for the rest of the visit when an
  endpoint answers 402, 429, 502 or 503. Not available in Firefox.

Server rules (both endpoints, same order as the chat endpoint): provider
configured → per-venue and per-IP rate limit (transcribe 15/min and 60/10 min;
speech 40/min and 160/10 min) → active venue with enabled widget → allowed
embedding domain → chatbot usage limit (no paid call when answers are
blocked). Audio is limited to 2 MB and known audio types. Each successful call
is recorded like chat AI calls: one `usage_events` row (`ai_call` / `call` on
the `web` channel, `accuracy: measured`) plus measured `ai_usage_events` rows
(`speech_to_text` / `text_to_speech`) priced from `ai_model_pricing`, using the
exact token usage returned by `talia-ai`. Audio is never stored by TALIA.

Privacy: with TALIA voice, visitor audio and reply text are processed by
OpenAI through `talia-ai`; with the browser fallback, by the browser vendor's
recognition service (Google in Chrome/Edge, Apple in Safari). The widget's
privacy summary discloses this in all four languages. Host pages whose
`Permissions-Policy` blocks `microphone` get the localized "microphone
unavailable" message.

Opt-out per installation with `data-voice="off"` on the script tag, or
`voice: false` in the public widget configuration.

## Demo Requirements

- Be able to test with a fictitious landing page.
- Be able to enter a guest name in demos.
- Be able to switch tenant without editing the widget.

## Technical Requirements

- CORS controlled by the TALIA API.
- No secrets exposed in the frontend.
- No dependency on n8n in the browser.
- Fallback if no webhook is configured.
- Logging of usage events.
- Treat model output as untrusted for external destinations. Next accepts a
  purchase action only with `metadata.purchase_action=verified`, matching item
  labels and a secure URL, and the widget validates it again before rendering.
- When `talia-ai` is the active provider, language detection, multilingual
  retrieval expansion and response-language selection belong exclusively to
  `talia-ai`. The client sends `fallback_language` as the canonical field,
  temporarily mirrors it to the deprecated `language` field for rolling-deploy
  compatibility, and persists `metadata.response_language`.

## Pending

- Source attribution in the UI.
- Better error state.
- Preview mode from the dashboard.
- Typing of widget events.
