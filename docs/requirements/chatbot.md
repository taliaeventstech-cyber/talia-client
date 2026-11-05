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

- A microphone button in the composer starts and stops dictation. It is only
  rendered when the browser supports speech recognition (Chrome, Edge, Safari);
  elsewhere the visitor keeps the text composer.
- Global keyboard shortcut `Alt+Shift+V` (works before the widget has focus)
  opens the agent and starts listening; pressing it again stops listening and
  sends what was heard, or interrupts a reply that is being read aloud.
  `Escape` cancels listening or speech. The launcher and the microphone expose
  the shortcut through `aria-keyshortcuts` and a screen-reader description; the
  first time the panel is opened, an accessible tip announces it.
- Every step plays a distinct synthesized audio cue and is announced in an
  assertive live region: ready to talk, speech captured, message sent, reply
  ready, cancelled/no speech, and error (microphone denied, unsupported
  browser, recognition failure). Recognition starts only after the "ready"
  cue so the cue is never transcribed.
- Replies to voice turns are read aloud with the browser speech engine in the
  reply language (`response_language`), with markdown stripped and URLs
  replaced by a localized "link" word. A header speaker toggle ("read answers
  aloud", persisted per browser) also reads replies to typed turns.
- Recognition language: page `<html lang>`, then browser language, then the
  widget's configured language.
- Voice uses only browser-native Web Speech and Web Audio APIs: no new network
  requests from the widget, no audio files, no audio stored by TALIA. The
  browser's own recognition service may process audio (Google in Chrome/Edge,
  Apple in Safari); host pages whose `Permissions-Policy` blocks `microphone`
  get the localized "microphone unavailable" message.
- Opt-out per installation with `data-voice="off"` on the script tag, or
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
