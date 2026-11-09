# Claude Code brief: reactivate the Voice channel

Use this document as the implementation brief for a Linear issue dedicated to
reactivating TALIA Voice. It is deliberately a controlled canary brief, not an
authorization to expose Voice to every client or launch it commercially.

## Mission

Turn the existing paused ElevenLabs/Twilio exploration into a secure,
observable and reversible inbound-call canary for one venue. A caller must be
able to speak with the TALIA agent, receive grounded answers from that venue's
knowledge, transfer to a human operator under explicit rules, and leave an
idempotently stored post-call record with correct usage and retention.

The target product is self-service: an authorized TALIA customer can connect a
telephone number from Àgora and have the venue's Voice agent answer it. In the
domain model, the connection belongs to the **venue**, not to the person who
clicked “Connect.” The initiating profile is retained only for authorization
and audit. This prevents a phone line from breaking when a team member leaves
and supports one account with several venues and administrators.

Do not deploy, purchase a number, modify a production ElevenLabs/Twilio agent,
or enable the module for a client as part of the code task unless the issue
explicitly authorizes that external operation.

## Read before changing code

Follow the repository hierarchy and workflow:

1. `AGENTS.md`
2. `docs/current-state.md` (wins on conflict)
3. `CONTRIBUTING.md`
4. `HARNESS.md`
5. `docs/requirements/voice-agent.md`
6. `docs/architecture/channel-agent-contracts.md`
7. `docs/architecture/ai-agents.md`
8. `docs/architecture/talia-ai-service.md`
9. `docs/operations/data-retention.md`

Read the relevant guide under `node_modules/next/dist/docs/` before changing a
Next.js API or UI. Read the Linear issue before implementation. Use the branch
and PR conventions in `CONTRIBUTING.md`; PRs target `develop`.

## Current state: treat this as evidence, then verify it

Voice is currently `planned/paused for client` and must remain absent from
onboarding and the active Agora navigation until the release gate is met.

The repository already contains:

- venue-level Voice and telephony fields, including ElevenLabs agent ID,
  number, provider, mode, forwarding notes and operational status;
- an internal Backstage form for Voice operational fields;
- a hidden Agora settings route under
  `src/app/(dashboard)/[tenantId]/voice/settings/`;
- `src/lib/voice/elevenlabs-sync.ts`, which synchronizes selected agent
  settings;
- `src/lib/voice/prompt-builder.ts`, which currently embeds at most 50 FAQ-like
  knowledge items in a static prompt;
- `src/app/api/voice/conversations/route.ts`, an HMAC-verified ElevenLabs
  post-call webhook that persists `voice_conversations`;
- internal Voice resolution/config endpoints;
- a `voice_minute` billing unit and voice usage totals in the billing schema.

Known gaps that block a production pilot:

- there is no complete inbound provisioning or call-lifecycle workflow owned
  by TALIA;
- Voice knowledge is a bounded prompt snapshot, not the shared grounded
  retrieval path used by active channels;
- the post-call path does not emit idempotent `voice_minute` usage;
- Voice transcript/identity deletion is not covered by the active retention
  job;
- there is no client call history, human-handoff operations view or operator
  audit trail;
- external provider configuration and payload contracts require revalidation;
- automated Voice tests are insufficient for a canary release.

Before writing code, inspect the current migrations and implementation. Do not
create duplicate columns merely because an older requirements document labels
them as “recommended upcoming fields.”

## Canary architecture decision

Default to a Twilio-purchased technical voice number imported through
ElevenLabs' native Twilio integration for the first canary. When the venue
already has a published telephone number, preserve it: the venue or its carrier
forwards that existing public number to the TALIA technical number. Do not
replace or port the venue's public number in the MVP.

This default is intentional:

- callers continue using the venue's existing public number;
- the number supports inbound and outbound calls;
- ElevenLabs can assign the number directly to an agent;
- native integration supports call transfer, including the richer Twilio
  transfer modes;
- Twilio remains the telephony control and compliance layer, while ElevenLabs
  provides the real-time conversation.

Do not use ElevenLabs' advanced Twilio “register call” flow for this canary if
human transfer is a requirement: the provider documents that transfer is not
available in that mode. Use SIP only when the pilot venue already has a PBX or
carrier trunk that must remain the system of record. Record a different choice
in an ADR or the Linear issue before implementing it.

Provider boundaries:

- Twilio owns number provisioning and PSTN delivery.
- ElevenLabs owns real-time STT, turn-taking, model orchestration and TTS.
- TALIA owns tenant resolution, authorization, venue configuration, knowledge,
  tool policy, durable records, usage, retention and operational status.
- A human operator owns escalated calls; the agent must not pretend a transfer
  succeeded until the provider confirms it.

### Self-service product model

For v1, allow one active inbound phone connection per venue. Only roles with
the existing `manage_voice` permission (`owner` and `admin`) may connect,
change, test, pause or disconnect it. Operators may handle transferred calls
but may not reconfigure telephony.

The default customer journey is:

1. Open `Àgora → Voice → Connect phone number`.
2. Choose the country/region and one of the supported connection methods.
3. Accept pricing, regulatory-data and AI disclosure notices.
4. Complete any customer/business documentation required for the number.
5. TALIA provisions or verifies the number asynchronously.
6. TALIA creates/updates the venue's ElevenLabs agent, imports the number and
   assigns it without exposing provider credentials to the browser.
7. The customer completes a guided test call and configures human fallback.
8. TALIA marks the connection active only after automated and manual checks.

Connection methods:

- `talia_managed`: recommended. TALIA creates or reuses a Twilio subaccount for
  the contractual account, provisions a number there and maps it to the venue.
  Twilio resources and usage are isolated per customer while TALIA owns central
  billing and support.
- `client_forwarding`: TALIA provisions the destination number; the customer
  keeps their published number and configures forwarding with their carrier.
  TALIA must verify the completed forwarding before activation.
- `bring_your_own_twilio` or `sip`: advanced/assisted onboarding. Do not make a
  customer paste a long-lived Twilio Auth Token into a normal form. Design a
  dedicated secure credential/authorization flow before supporting it.
- `porting`: assisted operation, never an instant self-service toggle. It needs
  proof of ownership, regulatory documents, status tracking and a scheduled
  cutover.

Typing a phone number is not proof of ownership and must never cause TALIA to
route that number. A number must be provisioned inside the correct Twilio
subaccount, verified through the supported provider flow, forwarded and tested,
or successfully ported before it can become active.

Do not expose ElevenLabs Agent IDs, provider tokens or webhook secrets in the
customer flow. The user sees the public/assigned number, connection method,
status, pricing/usage, test result, operator destination and disconnect
controls.

### Existing venue number: required MVP behavior

Treat an existing venue number as the normal customer case, not an exception.
The `client_forwarding` flow is:

1. An `owner` or `admin` enters the venue's existing public number in E.164 and
   confirms that the venue controls it.
2. TALIA provisions a separate technical Twilio number in the customer's
   subaccount and assigns it to the venue's ElevenLabs agent.
3. Àgora displays carrier-neutral forwarding instructions and the technical
   destination number. Merely entering the public number does not activate it.
4. The venue configures unconditional or conditional forwarding with its
   current carrier/PBX.
5. The authorized user starts a verification call from Àgora. TALIA correlates
   an inbound call to the expected technical number and records the successful
   route without exposing the caller's full number in logs.
6. Only after the test and all other release gates pass does TALIA mark the
   connection active.

Persist the two numbers with different semantics:

- `public_phone_number`: the venue's existing, customer-facing number;
- `assigned_phone_number`: the TALIA/Twilio technical destination connected to
  ElevenLabs.

Never overwrite one with the other. Display the public number as the venue's
main line and label the assigned number as a technical forwarding destination.

Forwarding details vary by carrier, so TALIA must not claim it completed the
carrier change automatically. Track at least `instructions_shown`,
`customer_confirmed`, `verification_pending`, `verified` and `failed` facts or
equivalent auditable states.

Human-transfer routing must prevent loops. The transfer destination cannot be
the same public number while that number forwards back to the AI. Require a
separate extension, queue or mobile number, or a PBX route that bypasses the
forwarding rule. Reject an identical destination by default and require an
explicitly tested advanced routing exception.

If the existing number is already a Twilio voice number controlled by the
customer, route it through the assisted `bring_your_own_twilio` flow and import
it into ElevenLabs only through a secure provider authorization/credential
boundary. If the customer has a SIP PBX, use the assisted SIP flow. Portability
is a later, scheduled operation and is not required to make the existing number
work in the MVP.

## Required implementation slices

Implement this as small vertical slices. Each slice must include tests and an
operator-visible failure state.

### 0. Self-service phone connection domain

- Introduce a first-class, venue-scoped phone connection instead of continuing
  to add lifecycle state directly to `theatres`. Reconcile/migrate existing
  Voice columns without losing their Backstage compatibility.
- Store provider, mode, normalized public and assigned numbers, provider
  resource references, regulatory/provisioning status, assigned agent,
  activation/paused timestamps, last test result and last actionable error.
- Keep secrets in the approved encrypted credential store; store provider IDs,
  not secrets, in the connection row.
- Enforce one active inbound connection per venue in v1 and prevent the same
  provider number from being active on two venues.
- Enforce separate public, assigned and human-transfer number roles. Add a
  fail-closed loop check for public/assigned/transfer destinations.
- Record who requested, verified, activated, changed, paused and disconnected
  the connection.
- Make provisioning an idempotent asynchronous workflow. Regulatory review,
  number purchase, provider import and test calls cannot be represented as one
  synchronous form submission.
- Require `manage_voice`, active module entitlement and an eligible
  subscription on every mutation. Do not trust a browser-supplied account,
  venue, price or provider resource ID.
- Define safe disconnect and reassignment semantics. Never release or port away
  a number as an incidental side effect of disabling the agent.

### 1. Audit and contract tests

- Capture sanitized fixtures for the current ElevenLabs initiation and
  post-call event shapes.
- Add contract tests for valid signatures, invalid signatures, stale
  timestamps, duplicate delivery, unknown event types, unknown agents and a
  disabled venue.
- Confirm that the webhook returns the provider-required success response only
  after the event is durably accepted.
- Keep webhook processing retry-safe; do not log secrets, full transcripts or
  raw caller phone numbers.

### 2. Tenant-safe call resolution and lifecycle

- Resolve the venue by a provider connection/agent mapping that cannot collide
  across tenants.
- Model the lifecycle required for at least `initiated`, `connected`,
  `transferred`, `completed` and `failed` outcomes, without overwriting a newer
  state with a late webhook.
- Preserve provider event IDs/call IDs for idempotency and audit.
- Store only the minimum telephone identity needed for operations. Prefer a
  normalized value plus a redacted display form or keyed hash where full E.164
  is not operationally required.

### 3. Call initialization and grounded knowledge

- Add a secure conversation-initiation boundary that can provide per-call
  dynamic variables and allowed overrides for the resolved venue.
- Authenticate provider calls and fail closed if the number/agent/venue mapping
  is absent, paused or not entitled.
- Do not expand the existing static 50-item prompt as the long-term solution.
  Integrate Voice with the shared `talia-ai` knowledge/retrieval boundary, or
  expose a narrowly scoped authenticated tool that returns cited, venue-scoped
  answers. Keep the real-time latency budget explicit.
- The agent must hand off or say it cannot verify an answer when retrieval is
  insufficient. It must never invent schedules, prices, accessibility details
  or ticket availability.

### 4. Human operator transfer

- Store and validate the transfer destination separately from the public
  number.
- Model venue timezone, operating hours, holiday/exception behavior,
  no-answer/busy fallback and permitted transfer reasons.
- Configure the ElevenLabs `transfer_to_number` system tool with explicit rules
  and E.164 destinations. The tool must be unavailable outside policy.
- Persist transfer requested/attempted/completed/failed facts without storing
  unnecessary conversation content.
- Do not build a full contact-center queue in this issue. A single tested
  operator destination plus an after-hours fallback is enough for the canary.

### 5. Usage, privacy and retention

- Emit one idempotent `voice_minute` usage event from the authoritative final
  duration. Define and test rounding (recommended: provider-billed seconds
  converted to fractional minutes unless pricing explicitly requires ceiling
  per call).
- Add Voice content and caller-identity deletion to the product retention job,
  aligned with the 90-day channel contract. Preserve only anonymized
  usage/audit data for its separate retention period.
- Keep provider-side retention aligned with TALIA. For the canary, the default
  recommendation is no saved call audio and no more than 90 days of provider
  transcript history; choose a shorter period where operations allow it.
- Ensure deletion is tenant-safe, observable in dry-run mode and covered by
  tests.
- Add the required first-message disclosure that the caller is interacting
  with AI and explain recording/storage accurately. Legal must approve the
  final wording before production.

### 6. Backstage, Agora and observability

- Backstage remains the operational control plane. Show configured provider,
  mode, assigned/public number, agent mapping, transfer destination/status,
  last successful event and an actionable error state without exposing
  secrets.
- Keep Voice behind both module and rollout gates. Do not add it to onboarding
  or general client navigation until the self-service flow is canary-ready.
- Build the customer-facing connection wizard behind the rollout gate. It must
  show progress for regulatory review/provisioning, require explicit number
  confirmation, and recover cleanly from refreshes and provider retries.
- Do not ask ordinary customers for an ElevenLabs Agent ID, Voice ID, Twilio
  SID or Twilio token. TALIA must create and map provider resources server-side.
- Add structured events and operational counters for call accepted, call
  completed, post-call rejected, provider retry, transfer result, retention
  deletion and usage emission.
- Document provider dashboards/logs and a rollback that pauses the agent or
  removes number assignment without losing audit history.

## Data and secret rules

- Never commit Twilio Account SIDs/tokens, API key secrets, ElevenLabs keys or
  webhook secrets.
- Prefer restricted Twilio API keys over an account-wide Auth Token when the
  native integration permits it.
- Production secrets live only in the approved secret store/environment.
- Do not pass internal service credentials to browser code.
- Do not use a caller phone number alone as tenant authorization.
- Do not persist raw provider payloads by default.

## Release gates

The code can be called “canary-ready” only when all of these are true:

- an owner/admin can start, leave and resume the connection flow without
  duplicate provider resources;
- an operator/viewer cannot connect, reassign or disconnect a number;
- the connection survives removal of the user who originally created it;
- a number cannot be claimed by typing it or assigned to two venues;
- an existing public venue number remains unchanged and activates only after a
  successful forwarding verification;
- the human transfer destination cannot loop back through the public number;
- inbound call reaches the correct venue agent from the assigned number;
- the AI/recording disclosure is heard before substantive interaction;
- grounded venue questions pass an agreed test set and unsupported questions
  produce a safe fallback;
- transfer succeeds during opening hours and follows the documented fallback
  outside them;
- duplicate and replayed webhooks do not duplicate calls, topics or usage;
- a complete call creates exactly one authoritative usage result;
- retention dry-run and destructive integration tests cover Voice data;
- secrets and personal data are absent from logs;
- provider failure produces an actionable Backstage status;
- `npm run typecheck`, `npm run lint` and `npm test` pass;
- the operational runbook has named owners and rollback contacts;
- the pilot venue has explicitly approved the number, disclosure, operator
  routing and test window.

Commercial availability, outbound campaigns, number porting, multi-operator
queues, bring-your-own-carrier self-service and call recording analytics are
out of scope for this canary.

## Implementation output expected from Claude Code

Before editing, return:

1. a verified gap analysis against the files and migrations in the repository;
2. the proposed Linear-sized slices and the decision that blocks each one;
3. the exact data model/API changes and security boundaries;
4. a test matrix and rollback plan.

Then implement only the slice authorized by the Linear issue. Update
`docs/current-state.md`, `docs/requirements/voice-agent.md` and the operational
runbook when behavior genuinely changes; do not mark Voice active merely
because scaffolding exists.

## Current provider references

Recheck these official references at implementation time because provider
contracts and consoles change:

- [ElevenLabs native Twilio integration](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration/)
- [ElevenLabs post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)
- [ElevenLabs conversation initiation personalization](https://elevenlabs.io/docs/eleven-agents/customization/personalization)
- [ElevenLabs transfer-to-number tool](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number)
- [ElevenLabs SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking)
- [ElevenLabs privacy and retention](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention)
- [ElevenLabs disclosure requirement](https://elevenlabs.io/docs/eleven-agents/legal/disclosure-requirement)
- [Twilio regulatory compliance](https://www.twilio.com/docs/trust-hub/registrations/regulatory-compliance)
- [Twilio subaccounts for customer isolation](https://www.twilio.com/docs/iam/api/subaccounts)
- [Twilio porting and number hosting](https://www.twilio.com/docs/numbers-and-senders/port-host)
