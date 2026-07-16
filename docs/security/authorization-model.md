# Authorization model

TALIA exposes two global user types:

- **Admin**: an internal TALIA operator present in `platform_admins`.
- **User**: every authenticated identity that is not a platform admin.

Global identity is intentionally separate from customer permissions. A User can
be the owner of an account without becoming a TALIA Admin.

## Sources of truth

| Concern | Source of truth |
| --- | --- |
| Backstage access | `platform_admins` |
| Account ownership and billing | `account_memberships` |
| Venue access and venue permissions | `venue_memberships` plus account membership |
| Authentication | Supabase Auth and `profiles` |

`public.users` belongs to the former invitation-first model. New signup and
invite flows do not write to it, application authorization does not read it,
and the RLS helper `current_theatre_ids()` no longer treats it as an access
grant. The table can be removed in a later migration after checking external
jobs and historical reporting.

## Self-service signup

Public signup creates:

1. an authenticated profile, whose global type is User;
2. an account membership with `owner` capability;
3. a venue membership for the initial venue.

It never creates a `platform_admins` row.

## Platform support access

Admins can open customer accounts and venues from Backstage. Platform-only
access is recorded in `audit_events` as `platform.support_accessed`, bounded to
one event per target and admin per hour to keep the trail useful without logging
every server render.

Platform Admin does not imply authority over customer billing. Administrative
subscription changes require the explicit `manage_customer_billing` capability
in `platform_admins.permissions`. This capability is reserved for approved
founders and is checked again in the server action, independently of the UI.

Grant it only after verifying the target auth user ID:

```sql
update public.platform_admins
set permissions = permissions || '["manage_customer_billing"]'::jsonb
where user_id = '<founder-auth-user-id>'
  and not permissions ? 'manage_customer_billing';
```

The initial founder grant is applied by
`20260715110000_grant_founder_billing_permission.sql`. It only matches existing,
confirmed Supabase Auth identities and never provisions or stores passwords. If
a founder identity does not exist when the migration runs, grant the capability
after signup with the SQL above.

Backstage cancellation requires an internal reason and typed confirmation. The
default is cancellation at the end of the paid period; immediate cancellation
uses a stronger confirmation. Success and failure are written to `audit_events`,
and TALIA attempts to notify the account billing email without blocking the
Stripe operation if email delivery is unavailable.

## Internal membership roles

Account and venue membership roles remain internal authorization details. They
support ownership and scoped permissions, but they are not global product roles
and must not be presented as Admin identities.
