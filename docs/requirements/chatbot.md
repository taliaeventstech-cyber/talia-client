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
- Respond in the configured language.
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

## Pending

- Source attribution in the UI.
- Better error state.
- Preview mode from the dashboard.
- Typing of widget events.
