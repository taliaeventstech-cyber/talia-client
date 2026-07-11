# Ticketing Integrations Prestudy

Last updated: July 11, 2026

## Executive Summary

Ticketing integrations are viable for TALIA, but they should not start as "the
assistant buys tickets". The safer medium-term architecture is a TALIA Ticketing
Integration Hub: a server-side connector layer that normalizes event discovery,
availability, purchase links, reservations and order support across ticketing
providers.

The first product slice should be read-mostly:

- import or sync events, dates, prices, availability labels and official purchase
  URLs per venue;
- let the chatbot, email agent and future voice agent answer ticketing questions
  from normalized event data;
- redirect the user to the official ticketing checkout with tracking;
- capture demand signals and unresolved intent for the venue.

Only after this slice is stable should TALIA attempt transactional flows such as
seat reservation, cart creation, payment, refund or order lookup.

## Why This Fits TALIA

TALIA is currently a multichannel attention layer for cultural venues. Ticketing
is a natural extension because visitors often ask:

- what is on;
- what dates and times are available;
- whether an event has accessible seating;
- what tickets cost;
- where to buy;
- whether there are discounts, memberships or group sales;
- what to do after a purchase.

This fits the existing direction:

- Knowledge remains the common core for content and policy answers.
- `talia-ai` can classify ticketing intent and generate responses.
- `talia-client` remains the venue-facing product and public gateway.
- A future `talia-api` can own the public API, credentials, connectors and
  action audit trail when the backend is split out.

## Viability Assessment

### High Viability: Discovery and Referral

This is the best first target.

Capabilities:

- sync the venue's events and sessions;
- expose normalized event cards to TALIA channels;
- answer common questions with fresh event data;
- send the visitor to the official ticketing checkout;
- measure assisted conversions via UTM, affiliate IDs or provider tracking when
  available.

Why it is viable:

- many providers expose catalog/discovery APIs or feeds;
- TALIA avoids handling payment, card data, seat locks and refunds;
- the business value is visible quickly because ticketing intent becomes
  measurable.

### Medium Viability: Availability and Cart Initiation

This is useful once TALIA has a pilot venue and a willing ticketing provider.

Capabilities:

- query real-time availability;
- recommend a performance based on user constraints;
- preselect date, quantity or price zone;
- create a short-lived cart or reservation only when the provider supports it;
- hand off to hosted checkout.

Main constraints:

- provider access often requires commercial agreements;
- reservation flows require strict cleanup and idempotency;
- availability can change during the conversation;
- failures must degrade to a purchase link, not a broken promise.

### Lower Viability First: End-to-End Checkout in TALIA

This should not be the initial goal.

Reasons:

- it introduces payment, tax, refund, fraud, support and accessibility edge
  cases;
- some providers restrict purchase APIs to certified partners;
- payment handling may pull TALIA toward PCI and SCA responsibilities;
- conversational checkout creates high expectations around seat selection,
  consent, cancellation and support.

The recommended principle is: TALIA assists purchase decisions first; it only
executes purchase steps when the provider contract and operational model are
ready.

## Provider Landscape Snapshot

This is a point-in-time reading of public documentation, not a final provider
selection.

- Ticketmaster has an open Discovery API for event, attraction and venue search,
  but its Partner API for reserve/purchase/order flows is restricted to official
  distribution relationships. This implies easy catalog experiments and harder
  transactional access.
- Eventbrite exposes APIs and webhooks for event/order-related platform
  integration, but purchase flows may still need redirect or embedded checkout
  depending on the use case and available account capabilities.
- Onebox presents itself as API-first and exposes catalog, distribution, orders,
  access-control, customer and webhook surfaces, but onboarding starts with a
  business agreement before credentials.
- Tessitura is common in cultural institutions and has developer resources, but
  documentation access is gated for registered developers. Expect longer
  discovery, implementation and validation cycles.

Potential Spanish/cultural-market providers to assess next:

- Onebox;
- Entradas.com / Eventim;
- Eventbrite;
- Ticketmaster;
- Tessitura;
- local or venue-owned ticketing systems used by current prospects.

## Architecture Direction

### Target Shape

```txt
Widget / Agora / Backstage / Email / Voice
  -> TALIA public or internal API
    -> Ticketing Integration Hub
      -> Provider connector: Onebox
      -> Provider connector: Eventbrite
      -> Provider connector: Ticketmaster
      -> Provider connector: Tessitura
    -> Normalized ticketing store
    -> Usage, audit and analytics

talia-ai
  -> intent classification
  -> answer generation
  -> tool/action planning requests
```

### Layer Responsibilities

`talia-client` now:

- show venue integration settings in Agora or Backstage;
- keep the widget and chat route as TALIA-owned public surfaces;
- call server-side integration services only from trusted routes;
- display ticketing configuration, health and logs.

Future `talia-api`:

- own public API versioning;
- store encrypted provider credentials;
- enforce tenant, module and rate limits;
- run connector jobs and webhook ingestion;
- expose normalized ticketing endpoints to TALIA channels.

`talia-ai`:

- detect ticketing intent;
- extract user constraints such as event, date, quantity, accessibility need,
  language and budget;
- decide when to answer from knowledge vs request a deterministic ticketing
  action;
- never hold provider secrets;
- never invent availability, purchase URLs or order status.

Connector layer:

- implement provider-specific API clients;
- normalize provider data to TALIA concepts;
- handle retries, idempotency, polling and webhook verification;
- degrade consistently when provider access is unavailable.

## Public API Position

Yes, TALIA will need a public API, but it should be narrow and versioned. It
should not expose provider credentials or raw provider APIs.

Recommended public API categories:

- `GET /v1/venues/{venue_id}/events`
- `GET /v1/events/{event_id}`
- `GET /v1/events/{event_id}/performances`
- `GET /v1/performances/{performance_id}/availability`
- `POST /v1/ticketing/referrals`
- later: `POST /v1/ticketing/carts`
- later: `POST /v1/ticketing/orders/lookup`

The browser/widget can call only safe, public, rate-limited endpoints. Anything
that touches provider credentials, reservation, payment, order lookup or customer
data must run server-to-server.

## Normalized Domain Model

Initial tables or entities:

- `ticketing_providers`: provider catalog and connector metadata.
- `venue_ticketing_connections`: one provider connection per venue, with status,
  scopes and encrypted credentials reference.
- `ticketing_events`: normalized event/show record linked to a venue.
- `ticketing_performances`: dated sessions, performances or screenings.
- `ticketing_offers`: price bands, ticket types, discounts and availability
  labels.
- `ticketing_referrals`: TALIA-assisted handoffs to external checkout.
- `ticketing_action_logs`: auditable action attempts and outcomes.
- `ticketing_webhook_events`: raw webhook envelopes, verification state and
  processing status.
- `usage_events`: existing usage model extended with ticketing tool calls and
  referrals.

Later transactional entities:

- `ticketing_carts`;
- `ticketing_reservations`;
- `ticketing_order_refs`;
- `ticketing_customer_links`.

Order/customer data should be minimized. Store provider references and status
metadata unless TALIA has a clear reason and legal basis to store more.

## Chat and Agent Flow

Example flow:

```txt
Visitor asks: "Hay entradas para el sabado?"
  -> /api/chat/:tenantId
  -> talia-ai classifies intent=ticketing.availability
  -> TALIA retrieves normalized performances for this venue
  -> connector checks live availability if enabled
  -> deterministic action returns available options and official checkout links
  -> talia-ai writes the final answer using only returned facts
  -> TALIA logs ticketing_referral or ticketing_action_log
```

The key rule: AI can interpret intent and explain options, but deterministic
services must own availability, price, URL, reservation and order facts.

## MVP Proposal

### Phase 0: Research and Partner Fit

Output:

- shortlist 3-5 providers used by target venues;
- collect API access requirements, sandbox availability, commercial terms,
  certification requirements and data scopes;
- select one pilot provider and one pilot venue.

Decision gate:

- provider gives access to event/session data or at least a stable feed.

### Phase 1: Read-Only Ticketing Data

Build:

- connector contract;
- one provider adapter;
- normalized event/performance store;
- manual Backstage connection status;
- event data exposed to chatbot responses;
- tracked purchase-link referral.

Success criteria:

- TALIA can answer event/date/price/purchase-link questions without hallucinated
  links;
- venue can see ticketing intent and referrals in Backstage;
- fallback is an official purchase page when live data is unavailable.

### Phase 2: Live Availability

Build:

- availability endpoint and connector method;
- freshness metadata in responses;
- graceful fallback to "check the official checkout";
- usage and provider-error reporting.

Success criteria:

- TALIA can distinguish available, limited, sold out and unknown states;
- no response promises a ticket without live confirmation.

### Phase 3: Cart or Reservation Handoff

Build only with a provider that supports it:

- short-lived cart/reservation creation;
- idempotency keys;
- reservation cleanup;
- hosted-checkout handoff;
- webhook reconciliation.

Success criteria:

- user completes payment outside TALIA or in a provider-hosted flow;
- TALIA records attribution and final provider status when available.

### Phase 4: Order Support

Build:

- order lookup with strict identity checks;
- refund/change policy answers from Knowledge;
- escalation to venue staff for sensitive cases.

Success criteria:

- TALIA can help with "where are my tickets?" without exposing another user's
  order data.

## Security and Compliance

Required from the first implementation:

- per-venue tenant isolation;
- provider credentials encrypted and never exposed to the browser;
- scoped API keys or OAuth where supported;
- webhook signature verification;
- idempotency keys for every mutation;
- rate limits per venue, IP and API key;
- audit logs for every provider action;
- explicit separation between public event data and customer/order data;
- GDPR retention rules for ticketing logs and order references;
- no card data in TALIA for the initial phases.

## Commercial Packaging

Ticketing should probably be an add-on or higher-tier capability, not part of the
base chatbot.

Possible packaging:

- Discovery/referral: included in higher plan or paid add-on.
- Live availability: paid integration add-on due to provider cost and support.
- Reservation/order support: enterprise or custom integration.

Usage units to add:

- ticketing data sync;
- availability lookup;
- referral click;
- cart/reservation attempt;
- order lookup;
- provider webhook processed.

## Risks

- Provider access depends on business agreements, not only code.
- Ticketing APIs vary heavily in concepts: events, sessions, performances,
  products, zones, seats, carts and orders.
- Live availability is perishable and must not be cached too aggressively.
- End-to-end checkout can shift TALIA into payment and support obligations.
- Cultural venues may use legacy systems with limited API access.
- Public API scope can expand too quickly if it is not versioned and governed.

## Recommended Next Steps

1. Interview 3-5 target venues and list their ticketing systems.
2. Select one pilot system with accessible documentation or sandbox.
3. Draft the connector contract before implementing provider-specific code.
4. Add a `ticketing` module entitlement and usage-event names to the billing
   model.
5. Build a read-only provider adapter and Backstage health view.
6. Connect chatbot ticketing intent to normalized event data and official
   checkout links.
7. Decide later whether the public API lives first in `talia-client` routes or
   waits for `talia-api`; avoid designing a broad external developer platform
   before the first provider proves the contract.

## Source Notes

- Ticketmaster Discovery API: event, attraction and venue discovery with API-key
  access and documented rate limits:
  https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
- Ticketmaster Partner API: reserve, purchase and order capabilities, but
  restricted to official distribution relationships:
  https://developer.ticketmaster.com/products-and-docs/apis/partner/
- Eventbrite platform documentation: public API and webhook documentation for
  event/order-related platform integration:
  https://www.eventbrite.com/platform/docs/introduction
  https://www.eventbrite.com/platform/docs/webhooks
- Onebox developer documentation: API-first ticketing platform with catalog,
  distribution, orders, access control, customers and webhook surfaces; requires
  business onboarding before test credentials:
  https://developer.oneboxtds.com/docs/
- Tessitura developer resources: API documentation access is available to
  registered developers, which implies a gated discovery process:
  https://www.tessitura.com/support/start/developers
