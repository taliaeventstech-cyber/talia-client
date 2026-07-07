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

### `tenant_module_entitlements`

Active modules per venue.

Contains:

- module;
- enabled;
- specific limits;
- metadata.

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

- capture the model;
- capture input/output tokens;
- apply the internal pricing table;
- store `cost_estimate_cents`.

If the flow goes through n8n and doesn't return tokens, cost will be estimated via heuristic until migrating to an in-house backend.

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

Do not show estimated AI cost to the client unless there is an explicit business decision to do so.

In Backstage, do show:

- estimated cost;
- usage per venue;
- contracted modules;
- potential overage.
