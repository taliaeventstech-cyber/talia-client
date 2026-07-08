# Client Onboarding

TALIA uses high self-serve as the primary entry point: an entity creates an account, completes the initial onboarding, and obtains its first operational account/venue. Invitations remain a separate flow for adding team members to an account or venue that already exists.

## Ideal Flow

1. The user creates an account from `/signup`.
2. The system creates `auth.users` and `profiles`.
3. The user enters `/onboarding`.
4. The onboarding collects the minimum data for the cultural entity.
5. The system creates `account`, `venue`, `users`, `account_memberships`, and `venue_memberships`.
6. The user enters the Agora of the created venue.
7. Backstage can adjust modules, plan, advanced configuration, and access.

## Account Data

The account represents the contractual client.

Own data:

- Legal/business name.
- Billing email.
- Status: prospect, trialing, active, paused, cancelled.
- Commercial notes.

It must not store agent-specific data, because that lives in each venue.

## Venue Data

The venue represents the operational center.

Own data:

- Public name.
- Type: theatre, museum, cinema, festival, auditorium, cultural center.
- Official website.
- Fallback email and phone.
- Primary language.
- Venue plan.
- Contracted modules.
- Chatbot configuration.
- Voice configuration.
- Email configuration when it exists.

## Invitations

Invitations are no longer the client's initial sign-up mechanism. They are a team flow for adding people to an existing organization.

### Invitation By Account

Use case:

- Client with several venues.
- Management, leadership, or profiles that need an aggregated view.

Result:

- Creates `account_membership`.
- Can create access to all venues of the account depending on role/permissions.

### Invitation By Venue

Use case:

- Operators of a specific site.
- Clients with a single venue.

Result:

- Creates `venue_membership`.
- Can also create a minimal account membership if needed for navigation.
- The invitation link must use `/invite/TOKEN`, not `/signup?invite=TOKEN`.

## Roles

Account roles:

- `owner`: full control of the client.
- `admin`: regular management.
- `billing`: billing.
- `viewer`: read-only.

Venue roles:

- `owner`.
- `admin`.
- `operator`.
- `analyst`.
- `viewer`.

Actual permissions must be validated server-side. The UI only hides options, it does not protect data.
