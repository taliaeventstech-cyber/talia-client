# Voice channel reactivation: gap analysis and implementation plan

Response to `docs/briefs/voice-channel-reactivation-claude-code.md`. It covers the
four items that brief asks for before editing: verified gap analysis, slices with
their blocking decisions, data model/API changes with security boundaries, and the
test matrix and rollback plan.

No product code has been changed. Every slice below touches an area that
`CLAUDE.md` lists as needing the maintainer's explicit approval (migrations,
`src/app/api/**` webhooks/internal routes, `createAdminClient()`, billing/usage,
provider integrations, secrets, retention). There is also **no Linear issue
for this work yet**: the existing voice issues (TAL-6 to TAL-10, TALAI-3 to TALAI-5)
cover the web-widget voice FAQ, which is a different feature.

## 1. Verified gap analysis

Checked against `develop` at `8e07311`.

### What exists (confirmed)

| Piece | Location | Notes |
|---|---|---|
| Venue voice columns | `theatres`: `voice_enabled`, `elevenlabs_agent_id`, `voice_id`, `voice_language`, `voice_tone`, `voice_temperature`, `voice_system_prompt`, `voice_max_turns` | migrations `20260505001000`–`20260505003000` |
| Phone operations columns | `theatres`: `voice_phone_number`, `voice_phone_provider` (`elevenlabs`/`twilio`/`external`), `voice_phone_mode` (`talia_number`/`client_forwarding`/`portability`), `voice_public_phone_number`, `voice_forwarding_notes`, `voice_operational_status` (`draft`/`provisioning`/`active`/`paused`/`error`) | `20260508001000`. These are the "recommended upcoming fields" in `voice-agent.md`, which **already exist**, so they must not be re-added |
| Call log | `voice_conversations` (`call_sid` unique, `status`, `from_number`, `duration_sec`, `turns`, `transcript` jsonb, `topic`, `summary`) | `20260505001000`, `20260506000000` |
| Backstage form | `src/app/backstage/actions.ts` (lines ~107–112, ~502–509) | Writes all phone operation fields directly to `theatres` |
| Hidden Agora settings | `src/app/(dashboard)/[tenantId]/voice/settings/` | Gated by `requireTenantPermission(…, 'manage_voice', 'voice')` |
| Agent sync | `src/lib/voice/elevenlabs-sync.ts` | `PATCH /v1/convai/agents/{id}`: prompt, temperature, language, voice only |
| Static prompt | `src/lib/voice/prompt-builder.ts` | ≤50 active `knowledge_items` embedded as Q/A |
| Post-call webhook | `src/app/api/voice/conversations/route.ts` | HMAC `t=…,v0=…`, 5-minute window, timing-safe compare |
| Internal endpoints | `api/internal/voice/resolve`, `api/internal/tenants/[tenantId]/voice-config` | `x-talia-internal-key` |
| Permission | `manage_voice: ['owner','admin']` in `src/lib/auth/permissions.ts` | ✓ matches brief |
| Billing primitives | `usage_events` (`voice_minute`, `unique(idempotency_key)`), `tenant_usage_daily.voice_minutes`, `tenant_subscriptions.included_voice_minutes`, `recordUsageEvent()` in `src/lib/usage/service.ts` | Never called for voice |
| Channel contract | `src/lib/attention/channel-agent.ts`: `voice` with `human_handoff` default fallback | ✓ |
| Retrieval channel | `KnowledgeRetrievalChannel` already includes `'voice'` in `src/lib/knowledge/retrieval.ts` | Reusable for a grounded tool |
| Reusable patterns | `instagram_connections`/`whatsapp` connection tables with `security definer` authorize functions, AES-256-GCM `encrypted_credentials`, `rollout_enabled`, `audit_events` | Template for `voice_phone_connections` |

### Gaps the brief lists, confirmed

- **No TALIA-owned provisioning/lifecycle.** There is no Twilio code anywhere in `src/`, and no connection entity. State is free-form columns on `theatres` that Backstage edits by hand.
- **Static knowledge.** The prompt is a snapshot built at save time. It goes stale until someone saves again, and it is capped at 50 items.
- **No usage emission.** The webhook never calls `recordUsageEvent`.
- **No retention.** `apply_data_retention` (`20260602000000`, `20260802170000`) does not touch `voice_conversations`.
- **No call history, handoff view or operator audit.**
- **No tests.** Nothing under `src/lib/voice/` or `src/app/api/voice/` has a test.

### Additional defects found (not in the brief)

1. **The webhook rejects unknown event types with 422.** ElevenLabs also sends `post_call_audio` and `call_initiation_failure`. A non-2xx response causes retries and can get the endpoint auto-disabled. Unknown types should be acknowledged and ignored.
2. **Disabled or unknown agent returns 404**, which also triggers retries. Per the brief it must fail closed: don't persist, but answer with a deliberate status and an operational event.
3. **Agent → venue resolution can collide.** `elevenlabs_agent_id` has no unique constraint. If two venues share an agent ID, `.single()` errors and every call is dropped. The internal resolve route has the same problem with `voice_phone_number`, compared as a raw string with no E.164 normalization.
4. **Late deliveries can overwrite newer data.** The upsert on `call_sid` replaces every column on each delivery. A replay also deletes and re-inserts the topic, so replays are not side-effect free.
5. **Caller and content leaks.** The raw caller number is stored in `from_number` and the full transcript is always stored. The DB error message (`insertError.message`) is returned to the provider.
6. **Unsigned webhooks accepted outside production.** When `ELEVENLABS_WEBHOOK_SECRET` is missing and `NODE_ENV !== 'production'`, unsigned requests are accepted. Acceptable locally, but it should be explicit and tested.
7. **RLS on `voice_conversations` uses `current_theatre_id()`.** That now resolves to `current_theatre_ids() limit 1`. A user with several venues would only ever see one arbitrary venue's calls. Newer tables use `theatre_id in (select current_theatre_ids())`.
8. **Agora settings expose provider internals.** The hidden form asks customers for the ElevenLabs Agent ID and Voice ID. It shows the webhook URL and lets an owner/admin toggle `voice_enabled` directly, bypassing `voice_operational_status`. All of this contradicts the brief.
9. **No AI disclosure or first message** is set by TALIA. The sync never sets `first_message`, privacy/retention settings or the `transfer_to_number` tool.
10. **"Theatre" wording.** The prompt builder says "theatre" 6 times, against the naming rule.
11. **Rounding conflict.** `voice-agent.md` specifies `ceil(secs/60)` per call, while the brief recommends fractional minutes. This needs a decision (see D4).

## 2. Proposed Linear-sized slices

Order follows risk: first secure what already receives traffic, then add the domain model, then new capabilities.

| # | Slice | Blocking decision | Approval areas |
|---|---|---|---|
| **S1** | **Webhook hardening + contract tests.** Sanitized fixtures; tests for signature/timestamp/replay/unknown type/unknown agent/disabled venue; 2xx-ack unknown types; stop leaking DB errors; ordered status upsert; topic write idempotent; caller number stored as redacted + keyed hash | D1 (caller identity storage) | webhooks, admin client |
| **S2** | **`voice_phone_connections` domain + migration.** Table, constraints, authorize/save RPCs, audit events, backfill from `theatres`, Backstage reads/writes via the connection | D2 (mode vocabulary), D3 (keep or freeze `theatres` columns) | migration, RLS, types, admin client |
| **S3** | **Tenant-safe resolution + lifecycle.** Resolve by connection (`provider_agent_id` / assigned number) with uniqueness; lifecycle states with monotonic transitions; fix `voice_conversations` RLS | none beyond S2 | migration, webhooks |
| **S4** | **Usage + retention.** Idempotent `voice_minute` (`idempotency_key = voice:<conversation_id>`); add voice to `apply_data_retention` with dry-run counts; anonymize usage metadata after 90 days | D4 (rounding) | billing/usage, retention |
| **S5** | **Conversation initiation + grounded tool.** Authenticated initiation webhook (dynamic variables, disclosure first message); `venue_knowledge_lookup` server tool backed by `retrieveTenantKnowledge(channel:'voice')` with a latency budget and an "insufficient evidence" result | D5 (tool in Next.js vs `talia-ai`), D6 (latency budget), legal wording | new webhook routes, provider config |
| **S6** | **Human transfer policy.** Transfer destination, timezone, hours, exceptions, reasons; loop check; sync `transfer_to_number` only inside policy; persist transfer facts | D7 (pilot operator number, hours) | provider config |
| **S7** | **Twilio provisioning workflow.** Subaccount per account, regulatory status, number purchase, ElevenLabs import/assign, idempotent async job, encrypted credentials | D8 (Twilio account/API-key strategy), D9 (job runner) | OAuth/integrations, secrets, new dependency (if any), cron/internal |
| **S8** | **Agora connection wizard + Backstage control plane.** Gated by module + `rollout_enabled`; replace the Agent-ID form; forwarding verification flow; status, last test, last error; call history | depends on S2, S6, S7 | UI (fine), server actions (admin client) |
| **S9** | **Observability + runbook.** Structured events/counters; documented pause/unassign rollback; update `current-state.md`, `voice-agent.md`, runbook | owners named in runbook | docs |

S1, S3 and S4 together close the security, billing and privacy gaps for the code that is **already deployed**. They are worth doing even if the canary slips.

### Decisions needed

- **D1 – caller identity.** Recommended: store `caller_number_hash` (HMAC-SHA256 with a server secret) plus a `caller_number_display` like `+34 6•• ••• 123`, and drop the full number. Full E.164 only if operations needs callbacks.
- **D2 – mode vocabulary.** The brief uses `talia_managed | client_forwarding | bring_your_own_twilio | sip | porting`, while the DB has `talia_number | client_forwarding | portability`. Recommended: adopt the brief's vocabulary on the new table and map the old values (`talia_number→talia_managed`, `portability→porting`).
- **D3 – legacy `theatres` columns.** Recommended: the connection table becomes the source of truth. Keep the `theatres` columns read-only for one release via a compatibility view or trigger, then drop them in a later migration.
- **D4 – rounding.** Fractional minutes (`round(secs/60, 4)`, which `numeric(12,4)` supports) or `ceil` per call. This is a pricing decision.
- **D5 – where the knowledge tool lives.** Recommended for the canary: a Next.js `POST /api/voice/tools/knowledge` that reuses `retrieveTenantKnowledge`, which already delegates to `talia-ai` when configured. Move it into `talia-ai` when that service exposes a voice-safe endpoint (see TALAI-3/5).
- **D6 – latency budget.** Proposed: p95 ≤ 1.2 s for the tool, with a hard timeout at 2 s that returns `insufficient_evidence`.
- **D7 – pilot data.** Venue, number country, operator E.164 number, transfer hours and timezone. These are the four inputs the runbook already names.
- **D8 – Twilio credentials.** A TALIA parent account with a subaccount per contractual account and a restricted API key per subaccount, encrypted with the existing AES-256-GCM pattern.
- **D9 – async runner.** Vercel crons only run in production. Options: a Fly worker (as for managed web sync), or step-wise server actions with a resumable state machine and a production cron sweeper.

## 3. Data model and API changes

### New table `voice_phone_connections` (S2)

```text
id uuid pk
theatre_id uuid not null → theatres (cascade)
account_id uuid not null → accounts           -- for subaccount scoping
provider text check in ('twilio','elevenlabs','sip')
connection_method text check in ('talia_managed','client_forwarding','bring_your_own_twilio','sip','porting')
status text check in ('draft','details_pending','regulatory_review','provisioning',
                      'test_pending','active','paused','error','disconnected')
public_phone_number text   -- E.164, customer-facing; never overwritten by assigned
assigned_phone_number text -- E.164, TALIA technical destination
transfer_phone_number text -- E.164, human operator
transfer_policy jsonb      -- timezone, weekly hours, exceptions, reasons, fallback
forwarding_state text check in ('not_applicable','instructions_shown','customer_confirmed',
                                'verification_pending','verified','failed')
provider_refs jsonb        -- twilio subaccount SID, phone number SID, elevenlabs agent/phone ids (no secrets)
credential_metadata jsonb  -- encrypted_credentials only (AES-256-GCM), same checks as instagram
regulatory_status text, regulatory_ref text
rollout_enabled boolean default false
last_test_at, last_test_result jsonb, last_error_code text, last_error_at
last_event_at timestamptz
requested_by_profile_id, verified_by_profile_id, activated_by_profile_id → profiles (set null)
activated_at, paused_at, disconnected_at timestamptz
created_at, updated_at
```

Constraints:

- `unique (theatre_id) where status <> 'disconnected'` (one active inbound connection per venue)
- `unique (assigned_phone_number) where status <> 'disconnected'`
- `unique ((provider_refs->>'elevenlabs_agent_id')) where status <> 'disconnected'`
- E.164 check (`^\+[1-9]\d{6,14}$`) on all three numbers
- loop check: `transfer_phone_number is distinct from public_phone_number` and `transfer_phone_number is distinct from assigned_phone_number`, unless `transfer_policy->>'loop_exception_tested' = 'true'`
- `status = 'active'` requires `last_test_result->>'ok' = 'true'`, plus `forwarding_state = 'verified'` when `connection_method = 'client_forwarding'`
- RLS on, `revoke all` from `anon, authenticated`; reads through a `select` policy on `current_theatre_ids()` limited to non-secret columns via a view; all writes via `security definer` RPCs (`authorize_voice_connection_admin`, modelled on `authorize_instagram_connection_admin`) that write `audit_events` (`voice.connection_requested|verified|activated|changed|paused|disconnected`)

Profile FKs use `on delete set null`, so the connection survives the creator leaving the team.

### Changes to `voice_conversations` (S1/S3/S4)

- add `connection_id`, `lifecycle_status` (`initiated|connected|transferred|completed|failed`), `status_rank smallint` (monotonic: a late event with a lower rank never overwrites), `provider_event_ids text[]`, `caller_number_hash`, `caller_number_display`, `transfer_outcome`, `usage_recorded_at`
- backfill, then drop the raw `from_number` (D1)
- replace RLS with `theatre_id in (select public.current_theatre_ids())`
- add to `apply_data_retention`: delete transcript/summary/caller fields at 90 days, and strip `conversation_id` from `usage_events.metadata`

### Routes (all `src/app/api/**` → approval)

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/voice/conversations` (existing) | ElevenLabs HMAC | post-call; harden per S1 |
| `POST /api/voice/initiation` (new) | ElevenLabs initiation secret/header | returns `dynamic_variables` + first message + allowed overrides; 4xx if the mapping is missing, paused or not entitled |
| `POST /api/voice/tools/knowledge` (new) | per-connection tool secret, venue resolved from the connection, never from the payload | cited, venue-scoped answer or `insufficient_evidence` |
| `api/internal/voice/resolve` (existing) | internal key | resolve via the connection table with normalized E.164; deprecate the `theatres` lookup |

Server actions (Agora/Backstage): `requestVoiceConnection`, `confirmForwarding`, `startVerificationCall`, `pauseVoiceConnection`, `disconnectVoiceConnection`, `updateTransferPolicy`. Each one calls `requireTenantPermission(…, 'manage_voice', 'voice')`, checks entitlement and subscription, ignores any client-sent account, venue, price or provider ID, and goes through the RPCs.

### Security boundaries

- The browser never sees agent IDs, SIDs, tokens or webhook URLs.
- The provider routes resolve the venue only from a connection mapping, never from the caller number.
- Secrets are stored only in env (`ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, new `ELEVENLABS_TOOL_SECRET`, `TWILIO_*`, `VOICE_CALLER_HASH_KEY`) or encrypted in `credential_metadata`.
- Logs record event type, connection ID and outcome only. Transcripts, numbers and payloads are never logged.
- "Disconnect" unassigns the agent and stops routing. Releasing or porting the number is a separate, explicit Backstage action.

## 4. Test matrix

| Area | Test | Slice | Type |
|---|---|---|---|
| Signature | valid / missing / malformed / wrong secret / stale `t` / future `t` | S1 | unit (route) |
| Event types | `post_call_transcription` stored; `post_call_audio`, `call_initiation_failure`, unknown → 200 and ignored/recorded | S1 | unit |
| Fail-closed | unknown agent, paused connection, module disabled → not stored, deliberate status, event emitted | S1/S3 | unit |
| Idempotency | same payload twice → 1 row, 1 topic, 1 usage event | S1/S4 | unit |
| Ordering | `completed` then a late `initiated` → stays `completed` | S3 | unit |
| Privacy | stored row has no raw caller number; response body has no DB error; logger spy sees no number or transcript | S1 | unit |
| Collision | same agent ID on two venues rejected by constraint | S2 | migration test (pattern: `*-migration.test.ts`) |
| Number claim | typed public number never becomes `assigned`; same assigned number on two venues rejected | S2 | migration + action |
| Loop | transfer = public or assigned rejected; tested exception allowed | S2/S6 | unit + migration |
| Activation gate | `active` without test pass / forwarding verified rejected | S2 | migration |
| Authorization | operator/viewer cannot call any mutation; owner/admin can; removing the creator's membership keeps the connection active | S2/S8 | action tests |
| Resume | repeating the provisioning step with the same idempotency key creates no second number/agent | S7 | unit with mocked Twilio/ElevenLabs clients |
| Usage | rounding per D4; one event per call; replay no-op | S4 | unit |
| Retention | dry-run counts include voice; destructive run deletes only rows >90 days and only content; usage quantities kept | S4 | SQL/integration |
| Knowledge tool | venue scoping; timeout → `insufficient_evidence`; no answer without a citation | S5 | unit |
| Transfer policy | inside hours → tool enabled with E.164; outside → fallback; timezone/DST edges | S6 | unit |
| Manual (canary) | real inbound call, disclosure heard, transfer in/out of hours, forwarding verification, rollback drill | S9 | runbook evidence |

## 5. Rollback plan

Per slice (code): each slice is a separate PR into `develop`. Migrations are additive (new table and columns); legacy `theatres` columns stay until S2 has been in production for one release. Reverting a PR leaves the old path working.

Per venue (operations, in order):

1. Backstage → set connection `paused`. Within one request, the initiation webhook refuses calls and the knowledge tool returns `insufficient_evidence`.
2. Unassign the agent from the number in ElevenLabs (automated by `pauseVoiceConnection` from S7 on, manual before).
3. Point the Twilio number's voice URL to the human fallback or an approved message.
4. Keep the `voice_conversations`, `audit_events` and usage rows. Never release the number as part of a rollback.
5. Open an incident if privacy or security was affected.

Customers keep their public number throughout (`client_forwarding`), so a rollback never changes the venue's published line.

## Recommended next step

Create a Linear issue for **S1 (webhook hardening + contract tests)**, decide **D1**, and give the "go" for changes under `src/app/api/voice/**`. S1 needs no migration if D1 is deferred: it can stop storing the raw caller number in new rows without changing the schema.
