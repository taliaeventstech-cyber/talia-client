# Architecture: Accounts, Venues, Profiles, and Access

## Model

```txt
auth.users
  │
  ▼
profiles
  │
  ├── account_memberships ──► accounts
  │                              │
  │                              ▼
  └── venue_memberships ───► theatres / venues
```

## Entities

### `auth.users`

Supabase Auth identity.

Responsibility:

- Email.
- Password/session.
- Account confirmation.

Must not contain TALIA business logic.

### `profiles`

Stable person profile in TALIA.

Responsibility:

- `auth_user_id`.
- Normalized email.
- Name.
- Status.
- Contact details.

### `accounts`

Contractual client.

Example:

- Layers of Reality.
- Sample institutional client.
- Culturactiva.

### `theatres` / venues

Operating center within the account.

Example:

- IDEAL Barcelona.
- IDEAL Madrid.
- Teatro Aurora.

The technical name `theatres` is legacy. In the product we talk about venues.

### `account_memberships`

A person's access to an account.

Used for:

- viewing the aggregated dashboard,
- managing multiple venues,
- inviting users,
- managing billing.

### `venue_memberships`

A person's access to a venue.

Used for:

- operating Àgora,
- viewing conversations,
- configuring the chatbot,
- viewing metrics,
- managing the voice/email channel if permitted.

## Legacy

`public.users` is considered legacy.

It may continue to exist for compatibility, but the future architecture must depend on:

- `profiles`;
- `account_memberships`;
- `venue_memberships`.

## Rules

- An account can have many venues.
- A venue belongs to one account.
- A person can be in several accounts.
- A person can be in several venues.
- TALIA can link, unlink, and change permissions without deleting history.
- Emails are credentials, not the main source of truth for the business model.

## Dashboard

### Account Dashboard

Route: `/accounts/[accountId]`.

Shows:

- aggregated view;
- list of venues;
- usage per venue;
- access to each Àgora;
- account users and invitations.

### Àgora

Route: `/[tenantId]/overview`.

Shows:

- operation of a venue;
- conversations;
- knowledge base;
- chatbot configuration;
- voice/email if contracted.

### Backstage

Route: `/backstage`.

Internal TALIA panel for:

- creating accounts;
- creating venues;
- activating modules;
- inviting users;
- opening dashboards;
- diagnosing configuration.
