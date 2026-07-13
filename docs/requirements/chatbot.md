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
- Save history.
- Allow configuring:
  - base prompt;
  - sources;
  - FAQs;
  - fallback email/phone;
  - color;
  - auto-open.

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
