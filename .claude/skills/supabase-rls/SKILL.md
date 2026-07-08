---
name: supabase-rls
description: Write new Supabase migrations for talia-client with correct multi-tenant RLS (accounts/venues/profiles model). Use when adding a new table, or a new column/policy on an existing one.
---

# Supabase RLS for talia-client

Ground truth: `docs/architecture/accounts-venues-access.md` and the real migrations under `supabase/migrations/`. If anything here conflicts with a newer migration, the migration wins.

## Data model recap

```
auth.users
  -> profiles
  -> account_memberships -> accounts
  -> venue_memberships   -> venues (DB table name: theatres)
```

Never build new logic on `public.users` — it's legacy from the old single-tenant model. Use `profiles` + `account_memberships` + `venue_memberships`.

## New table checklist

1. Decide the scope: **venue-scoped** (most product data — conversations, knowledge, drafts) or **account-scoped** (billing, account-level settings).
   - Venue-scoped: add `theatre_id uuid not null references public.theatres(id) on delete cascade`.
   - Account-scoped: add `account_id uuid not null references public.accounts(id) on delete cascade`.
2. Enable RLS: `alter table public.<table> enable row level security;`
3. Add a `select` policy using the existing helper functions — don't hand-roll tenant checks:
   - Single venue: `theatre_id = public.current_theatre_id()`
   - Any venue the profile can access (multi-venue account): `theatre_id in (select public.current_theatre_ids())`
   - Account-scoped: `account_id in (select public.current_account_ids())`
4. Add an `updated_at` trigger if the table has that column:
   ```sql
   create trigger <table>_updated_at
     before update on public.<table>
     for each row execute function public.set_updated_at();
   ```
5. Make policy/trigger statements idempotent (`drop policy if exists ... ; create policy ...`, `drop trigger if exists ... ; create trigger ...`) — migrations in this repo get re-run.
6. Add indexes on the tenant column plus whatever the table is actually queried by (see any recent migration under `supabase/migrations/` for the pattern).

## Writes do NOT go through RLS in this repo

RLS policies here only cover `select`. Mutations go through `createAdminClient()` (`src/lib/supabase/admin.ts`, service role key) inside Server Actions or API routes — which **bypasses RLS entirely**. That means:

- Every server action/API route that writes must do its own explicit tenant/permission check before calling the admin client (e.g. confirm the current profile has an active `account_membership`/`venue_membership` for the `theatre_id`/`account_id` being written).
- Don't assume a missing `insert`/`update`/`delete` policy means "blocked" — it means "not enforced by Postgres," enforcement is entirely in application code.

## After writing the migration

```bash
npm run db:migrate   # supabase db push
npm run db:types      # regenerate src/types/database.types.ts
```

Then add a zod schema for the new table's insert/update shape in `/src/types/`, matching the pattern used by other features (see any recent feature's types file for the shape).
