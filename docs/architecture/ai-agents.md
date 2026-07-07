# Architecture: AI Agents

## Principle

Chatbot, voice, email, WhatsApp, and Instagram must not be separate products. They must be channels on top of the same attention layer.

## Shared Core

The core must be able to answer:

- which account and venue own the interaction;
- which channel received it;
- which agent responded;
- which knowledge was used;
- what state the conversation is in;
- whether there was human escalation;
- which intent/topic was detected;
- how much it cost or consumed.

## Channels

### Chatbot

Currently the most mature channel.

Input:

- web widget.

Output:

- direct response in the widget.

### Voice

Input:

- phone call.

Output:

- conversational voice;
- transcript;
- post-call event.

### Email

Input:

- the client's real mailbox.

MVP output:

- draft in Gmail/Outlook;
- human review.

No auto-send in the first version.

## Knowledge Base

The knowledge base must take priority over any generative fallback.

Sources:

- manual FAQs.
- CSV/XLSX.
- Google Sheets later on.
- PDFs and installed-web snapshots.

Rule:

1. Search for a deterministic answer.
2. If there is a reliable match, respond with the source.
3. If there is no answer, fall back to a human.

## Temporary Provider vs. In-House Backend

n8n is useful for demos and speed.

The architecture must allow replacing it with an in-house backend without changing:

- the widget;
- the data model;
- the dashboards;
- per-tenant configuration.

That's why the widget's public API must talk to TALIA, not directly to n8n.
