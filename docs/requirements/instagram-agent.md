# Instagram Agent

## Status

Connection, durable message processing, agent runtime and provider text sending
are implemented for the app-role pilot. Instagram remains unavailable to
customers until the operator handoff surface, revocation/retention controls and
pilot gates are implemented and validated.

## Pilot objective

The first Instagram pilot lets an eligible venue connect one Instagram
Professional account and use an independent `instagram_agent` to answer inbound
direct messages from shared venue Knowledge. Instagram conversations,
identities, prompts, permissions, usage and history remain isolated from every
other Attention channel.

Instagram and WhatsApp share Meta as provider infrastructure only. They do not
share connections, provider identifiers, credentials, conversations, contact
identities, history, agent state or rollout controls.

## Version 1 scope

Included:

- Direct connection of an Instagram Business or Creator account through
  Instagram Login.
- Inbound one-to-one direct messages initiated by the Instagram user.
- Text messages as the only automatically processable inbound type.
- Answers grounded in venue Knowledge, using the existing Instagram channel
  contract and a dedicated Instagram runtime policy.
- Safe human handoff for unsupported content, insufficient evidence, provider
  restrictions and operational failures.
- Channel-local history, operator takeover and manual replies in Agora.
- Explicit activation, entitlement and rollout controls per venue.
- Ninety-day content retention and bounded operational metadata.

Excluded from version 1:

- Facebook Login as an alternative connection path.
- Consumer/personal Instagram accounts.
- Starting unsolicited or promotional conversations.
- Comments, private replies to comments, mentions and comment moderation.
- Content publishing, scheduling, insights, ads, tagging or social-media
  management.
- Automatic understanding or generation of images, audio, video, stickers,
  reactions, story shares or other non-text content.
- Group conversations and cross-channel identity matching or context.

Unsupported inbound types must be persisted only to the minimum degree needed
to create an operator handoff. Raw provider payloads must not be retained.

## Connection decision

The pilot uses Instagram API with Instagram Login rather than Instagram API
with Facebook Login. This permits a Professional Instagram account to authorize
TALIA directly without making a linked Facebook Page a TALIA prerequisite.

The initial OAuth request is limited to:

- `instagram_business_basic`
- `instagram_business_manage_messages`

Facebook Login may be evaluated after the pilot only if real customers cannot
complete direct Instagram Login because of their account governance. It is a
separate connection method, not an automatic fallback inside the same OAuth
attempt.

## Provider and security boundaries

- Instagram uses dedicated configuration values even when the same Meta
  developer organization or app also contains WhatsApp.
- OAuth state is signed, expires after ten minutes and is bound to the initiating
  venue and TALIA user.
- Authorization codes and access tokens are exchanged server-side.
- Tokens never enter logs, URLs controlled by TALIA, browser storage, operational
  events or `talia-ai`.
- Long-lived credentials will be encrypted per Instagram connection before the
  connection becomes active.
- Browser database roles must never be able to read Instagram credentials or raw
  cross-venue content.
- Meta webhook signatures must be validated against the unmodified request body
  before parsing or tenant resolution.
- A newly authorized connection remains rollout-disabled until the separate
  Instagram ingestion and send path passes its canary.

## Pilot acceptance criteria

The channel can enter a design-partner canary only when:

1. A Professional test account authorizes TALIA through Instagram Login.
2. The callback is bound to the authenticated TALIA user and expected venue.
3. The account and encrypted credential are stored in an Instagram-specific
   connection record.
4. A real inbound text DM is received, deduplicated and mapped to the correct
   venue without retaining the raw webhook envelope.
5. `instagram_agent` produces a grounded response and TALIA sends it once.
6. Unsupported content and low-confidence answers create a visible operator
   handoff.
7. Disconnect/revocation, retention, audit, usage and rollout controls have been
   exercised.
8. Meta App Review and the required production access are complete for accounts
   outside app roles.

## Deferred decision

After the first external canary, record how the venue currently administers its
Instagram account. Add Facebook Login only if direct Instagram authorization is
an observed adoption blocker; do not add it solely because the account is also
linked to a Facebook Page or managed in Meta Business Suite.
