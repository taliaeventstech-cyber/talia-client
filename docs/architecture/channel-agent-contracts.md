# Channel Agent Contracts

## Purpose

TALIA exposes several Attention channels, but each channel has its own agent,
conversation history, identity boundary, delivery mode, policies, and operational
constraints. This document defines the minimum contract that a channel adapter
must satisfy before it can enter a pilot.

The executable contract lives in:

```text
src/lib/attention/channel-agent.ts
```

## Product boundary

- Knowledge is governed and shared at venue scope.
- Conversations and histories are scoped to venue + channel + conversation.
- Identities are scoped to venue + channel.
- TALIA does not automatically match or merge identities across channels.
- Conversation content is context for its own channel conversation, never Knowledge.
- Factual responses require evidence from venue Knowledge or a verified tool result.

Sharing Knowledge does not mean that every channel receives the same prompt or
behaviour. Each agent applies its own mission, tone, fallback, limits, delivery
mode, and allowlisted actions.

## Channel matrix

| Channel | Delivery mode | Primary unit | Default fallback | Permitted effects | Content retention |
| --- | --- | --- | --- | --- | ---: |
| Web | Direct response | Message | Configured contact | Verified navigation, verified purchase referral, human handoff | 90 days |
| Email | Supervised draft | Email | Human review | Create draft and hand off; never send automatically | 90 days |
| Voice | Spoken response | Minute | Human handoff | Verified navigation and human handoff | 90 days |
| WhatsApp | Direct response | Message | Human handoff | Verified navigation and human handoff | 90 days |
| Instagram | Direct response | Message | Human handoff | Verified navigation and human handoff | 90 days |

Voice, WhatsApp, and Instagram entries describe the platform contract, not their
current commercial availability. Entitlements and rollout controls remain the
authority for whether a channel can be activated for a venue.

## Runtime policy

Every adapter must resolve a normalized policy before invoking its agent. The
policy contains:

- enabled state;
- channel-specific tone and prompt;
- one fallback mode supported by the channel;
- actions intersected with the channel allowlist.

An unsupported fallback or action is discarded in favour of the safe channel
default. In particular, the Email contract only permits supervised draft
creation and human handoff. It has no automatic-send action.

## Normalized operational events

Every adapter must emit the same bounded event vocabulary:

| Event | Meaning |
| --- | --- |
| `interaction_received` | TALIA accepted an inbound channel interaction. |
| `response_completed` | The channel agent completed its permitted output. |
| `fallback_triggered` | The agent could not complete the normal response path. |
| `handoff_requested` | The interaction requires a venue operator. |
| `incident_reported` | The adapter or runtime detected an operational failure. |

The normalized event includes the venue, channel, derived agent key,
channel-local interaction identifier, timestamp, bounded reason code, and
Knowledge source identifiers. It intentionally excludes visitor content,
mailbox addresses, phone numbers, external profile identifiers, and raw provider
payloads. Channel-specific operational tables may retain the minimum data they
need under their own access controls.

The canonical module and usage channel for the website agent is `web`. New and
historical module, entitlement, billing and usage records use this value. The
commercial plan key `chatbot_web` remains a separate product identifier.

## Permissions and retention

| Concern | Web | Email | Voice | WhatsApp | Instagram |
| --- | --- | --- | --- | --- | --- |
| Venue entitlement required | `web` | `email` | `voice` | `whatsapp` | `instagram` |
| Customer permission | `manage_chatbot` | `manage_email` | `manage_voice` | Channel permission before pilot | Channel permission before pilot |
| Public/inbound execution | Active widget | Connected mailbox | Active voice deployment | Verified venue number | Eligible connected account |
| Human supervision | On fallback/correction | Always before sending | On fallback | On fallback/handover | On fallback/handover |
| Content retention | 90 days | 90 days | 90 days | 90 days | 90 days |
| Usage/audit retention | 12 months | 12 months | 12 months | 12 months | 12 months |

WhatsApp and Instagram permissions must be introduced before their pilots. A
temporary platform-admin-only activation is acceptable for a design-partner
canary, but browser roles must never gain access to provider credentials or raw
cross-venue channel content.

## Adapter readiness checklist

A new channel cannot enter a pilot until it has:

1. A registered channel-agent contract and safe default policy.
2. Tenant resolution that fails closed.
3. A venue entitlement and an explicit rollout/activation control.
4. Encrypted provider credentials unavailable to browser database roles.
5. Idempotent inbound processing and provider-event deduplication.
6. Channel-local conversations and identities with no automatic cross-channel matching.
7. Shared Knowledge retrieval with tenant isolation and evidence traceability.
8. Allowlists for actions, fallbacks, and human handoff.
9. Normalized usage and operational events.
10. Retention enforcement, disconnect cleanup, incident diagnostics, and rollback.
