# Pricing and Limits

This document defines TALIA's pricing and limits logic. Amounts may change commercially, but the architecture must support plans, included usage, overages, and independent modules.

## Base Plans

| Plan | Profile |
| --- | --- |
| Essential | Small client or first deployment |
| Professional | Client with more volume or several operational needs |
| Enterprise | Client with high volume, several venues, or advanced requirements |
| Custom | Specific agreements |

## Modules

Modules are contracted per venue:

- Attention.
- Data.
- Marketing.

Within Attention, channels can have separate limits:

- Web chatbot: conversations.
- Email: conversations or processed emails.
- Voice: minutes.
- WhatsApp/Instagram: conversations or messages.

## Recommended Limits

Limits should be in the database, not hardcoded.

Initial example:

| Plan | Chatbot | Email | Voice |
| --- | ---: | ---: | ---: |
| Essential | 1,000 conversations/month | 0-500 conversations/month | 0 minutes |
| Professional | 4,000 conversations/month | 500-1,500 conversations/month | 60-120 minutes |
| Enterprise | 12,000 conversations/month | 2,000+ conversations/month | 120+ minutes |

## Estimated Proposal For Institutional Client

This proposal is preliminary. It serves to present a professional and defensible range before having real usage data. It must not be communicated as validated pricing until volume, provider cost, and operational load are measured during a real trial.

### Recommended Commercial Process

After the initial presentation/demo, it is not advisable to close a definitive price without a minimal discovery phase. The recommended process is:

1. **Initial demo**
   - Show TALIA with chatbot, email agent, and voice agent as the vision for the Attention module.
   - Show the operational value: less friction for the visitor, faster responses, intent data, and traceability.

2. **Volume confirmation**
   - Request approximate data:
     - monthly website visits;
     - current conversations or web inquiries;
     - monthly attention emails;
     - monthly calls or estimated minutes;
     - languages;
     - peaks by campaign/season;
     - number of venues or areas involved.

3. **Client classification**
   - Classify the client as Bronze, Silver, or Gold based on volume, complexity, and channels.
   - This classification is not just about size: it also measures operational criticality, support needs, languages, integrations, and number of teams.

4. **Proposal with 3 options**
   - Present three clear alternatives:
     - a conservative option;
     - a recommended option;
     - a complete option.
   - Each option must indicate:
     - included channels;
     - included conversations/emails/minutes;
     - monthly price;
     - setup;
     - cost per additional usage.

### Bronze / Silver / Gold Classification

| Tier | Profile | Recommended channels | Indicative included usage |
| --- | --- | --- | --- |
| Bronze | Venue with low volume or controlled pilot | Chatbot | 1,000-2,000 chatbot conversations |
| Silver | Venue with significant digital attention | Chatbot + email | 4,000-6,000 chatbot conversations + 1,000-1,500 emails |
| Gold | Institution with multichannel attention and high peaks | Chatbot + email + voice | 12,000-18,000 chatbot conversations + 3,000-5,000 emails + 300-600 min voice |

### Discovery Questions

To classify properly:

- How many monthly visits does the website have?
- How many emails does public attention receive per month?
- How many calls does the venue receive per month?
- What percentage of questions are repetitive?
- What languages do they handle?
- Are there peaks due to premieres, season, discounts, or campaigns?
- Does the client want only web/chat, or also mailbox and phone?
- Do they need to review responses before sending them?
- How many people on the team will use TALIA?

### TALIA Attention Pack

Includes:

- Web chatbot for the client's website.
- Email agent in supervised-drafts mode.
- Voice agent with a TALIA number or forwarding from the client's number.
- Initial knowledge base.
- Agora dashboard.
- Basic analytics of topics and intent.
- Setup configuration and support.

| Plan | Estimated monthly price | Web chatbot | Email agent | Voice agent | Support |
| --- | ---: | ---: | ---: | ---: | --- |
| Essential | €349/month | 2,000 conversations/month | 500 processed emails/month | 60 min/month | Email |
| Professional | €699/month | 6,000 conversations/month | 1,500 processed emails/month | 180 min/month | Priority |
| Enterprise | €1,399/month | 18,000 conversations/month | 5,000 processed emails/month | 600 min/month | Priority + monthly follow-up |

### Proposal By Channels

To avoid selling an oversized package from the outset, the proposal can also be presented by number of channels:

| Option | Included channels | Estimated monthly price | Included usage |
| --- | --- | ---: | --- |
| Bronze | Web chatbot | €349/month | 2,000 chatbot conversations |
| Silver | Web chatbot + email agent | €699/month | 6,000 chatbot conversations + 1,500 emails |
| Gold | Web chatbot + email agent + voice agent | €1,399/month | 18,000 chatbot conversations + 5,000 emails + 600 voice minutes |

This structure is easier to explain commercially:

- **Bronze**: we start with the web.
- **Silver**: we add mailbox attention.
- **Gold**: we cover web, email, and phone.

### Initial Setup

Recommendation for institutional client:

| Item | Estimated price |
| --- | ---: |
| Chatbot + widget + dashboard setup | €750 |
| Initial knowledge base loading | €500 |
| Email agent configuration | €600 |
| Voice agent + telephony configuration | €900 |
| Total recommended setup | €2,750 |

For a simpler commercial proposal, we can offer:

- **Discounted setup**: €1,500 if they contract Professional or Enterprise.
- **60-day pilot**: €699/month + reduced setup.

### Estimated Overages

Overages protect margin and prevent uncontrolled usage.

| Channel | Extra unit | Estimated price |
| --- | ---: | ---: |
| Chatbot | 1,000 extra conversations | €49 |
| Email | 500 extra processed emails | €59 |
| Voice | 100 extra minutes | €79 |

### Operational Limits

Limits should not cut off service abruptly during a demo or first contract. Recommendation:

- At 80% usage: internal TALIA notice.
- At 100%: internal notice + commercial notice to the client.
- At 120%: apply overage or move to fallback per contract.
- Do not block chatbot or voice during critical events without prior notice.

### Recommendation For Institutional Client

For an institutional client, after an initial demo, the initial recommendation would probably be to classify them between **Silver** and **Gold**, pending real volume.

If they want to start solidly but in a controlled way, the most defensible proposal is **Silver / Professional**:

- €699/month.
- 6,000 chatbot conversations.
- 1,500 processed emails.
- No voice included, or with a limited pilot allowance if they want to test it.
- Discounted setup of €1,500.

If they want to cover the phone from the start, the proposal should move up to **Gold / Enterprise** or a Professional with a voice add-on:

- €699/month base Professional.
- Voice add-on: €199-349/month depending on included minutes.
- Extra minutes according to overage.

Reason: an institutional client may have high volume, recurring programming, accessibility questions, ticketing, schedules, and multichannel attention. Bronze falls short for a serious proposal; Gold makes sense if they confirm call volume or want multichannel attention from day one.

## Real Cost vs Estimated Cost

The cost per conversation is not automatically obtained from OpenAI with perfect granularity per conversation unless we calculate it ourselves.

Recommended architecture:

- Store input and output tokens when our own backend makes the model call.
- Store the model used.
- Calculate estimated cost with an internal pricing table.
- Store `cost_estimate_cents` in `usage_events`.
- Compare monthly against providers' actual invoices.

While n8n manages part of the flow, the cost will be estimated if it does not return tokens. When we migrate to our own backend, tracking will be more reliable.

## Hard Limits

Support three behaviors:

- `notify_only`: notify internally, do not block.
- `fallback`: respond with a fallback message and human contact.
- `block`: block usage when the limit is exceeded.

For demos and first clients, `notify_only` or `fallback` is recommended, not hard blocking.
