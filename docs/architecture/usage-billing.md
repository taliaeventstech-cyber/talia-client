# Architecture: Usage and Billing

## Goal

Measure real or estimated usage per venue, module, and channel in order to:

- control limits;
- calculate costs;
- justify pricing;
- show consumption to the client;
- detect abuse or the need for an upgrade.

## Base Tables

### `tenant_subscriptions`

Subscription per venue and period.

Contains:

- plan;
- status;
- billing period;
- included conversations;
- included voice minutes;
- overage prices;
- hard limit behavior.

Calendar dates remain available for daily aggregates and reporting. Precise
`billing_period_start_at` and `billing_period_end_at` UTC instants are the
authority for active-period selection, limits and Stripe renewal boundaries.

### `tenant_module_entitlements`

Active modules per venue.

Contains:

- module;
- enabled;
- specific limits;
- metadata.

The `data` entitlement also carries managed-web ingestion limits. These are
universal defaults for now, not commercial plan differentiation. The database
reads the entitlement at enforcement time so future per-plan or per-tenant
overrides do not require a worker contract change.

### `usage_events`

Granular event.

Examples:

- conversation started;
- message;
- model call;
- tool call;
- voice minute;
- fallback;
- limit exceeded.

### `tenant_usage_daily`

Daily aggregate for fast dashboards.

### `ai_model_pricing`

Versioned provider price catalogue. Each row identifies the exact provider and
model, effective interval, source URL and input, cached-input and output prices
in USD microdollars per million tokens.

### `ai_usage_events`

Authoritative AI cost ledger. One chat response can create several rows:

- `answer_agent`;
- `language_agent`, only when the LLM planner runs;
- `retrieval_embedding`.

Each row stores the raw measured tokens, request count, exact model,
`pricing_id`, fractional USD microdollars and an accuracy label:
`measured`, `estimated_legacy` or `reconciled`.

## Units

Chatbot:

- conversation;
- message;
- tokens;
- estimated cost.

Email:

- conversation;
- inbound/outbound email;
- draft generated;
- tokens;
- estimated cost.

Voice:

- minute;
- call;
- resolution;
- fallback;
- provider cost.

## AI Cost

For OpenAI:

- `talia-ai` returns per-component usage with exact model and measured input,
  cached-input and output tokens;
- `talia-client` persists those components and applies the price row effective
  when the request occurred;
- raw tokens and `pricing_id` remain authoritative, so historical values can be
  revalued or reconciled without rewriting conversational data;
- cost uses fractional USD microdollars and is never rounded per request to a
  whole cent.

Legacy n8n flows that do not return tokens remain heuristic and must be labelled
`estimated_legacy`; they are not mixed into measured Backstage metrics.

## Limits

The limit function must answer:

- allowed;
- current;
- limit;
- behavior.

Behaviors:

- `notify_only`;
- `fallback`;
- `block`.

## UI

In the client dashboard, show usage subtly:

- current plan;
- conversations used / included;
- minutes used / included;
- warnings when approaching the limit.

Activity timestamps are stored as UTC instants and rendered in the operator's
browser time zone. Billing-period labels remain based on their authoritative UTC
boundaries; future schedules tied to a venue's wall-clock time require a
separate persisted IANA time zone.

Do not show estimated AI cost to the client unless there is an explicit business decision to do so.

In Backstage, do show:

- measured USD cost and monthly projection;
- explicit measurement quality and separate legacy estimates;
- usage per venue;
- breakdown by model and runtime component;
- contracted modules;
- potential overage.
