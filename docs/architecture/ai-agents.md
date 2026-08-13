# Architecture: AI Agents

## Principle

Chatbot, voice, email, WhatsApp, and Instagram must not be separate products. They must be channels on top of the same attention layer.

They are not one universal agent. Each channel has an independent agent,
conversation history, identity boundary, delivery mode and policy. They share
venue-governed Knowledge and common operational contracts. See
[`channel-agent-contracts.md`](channel-agent-contracts.md).

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

Conversation content is never promoted to Knowledge automatically. Cross-channel
identity matching and conversation-context sharing are also disabled: any future
link between channels requires an explicit product flow and visitor consent.

## Temporary Provider vs. In-House Backend

n8n is useful for demos and speed.

The architecture must allow replacing it with an in-house backend without changing:

- the widget;
- the data model;
- the dashboards;
- per-tenant configuration.

That's why the widget's public API must talk to TALIA, not directly to n8n.
