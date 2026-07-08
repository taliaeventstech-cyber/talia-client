---
name: dashboard-component
description: Build a new Agora/Backstage dashboard screen or component in talia-client, following the repo's real conventions (not the old CLAUDE.md architecture diagram). Use when adding a new feature page, form, or action under (dashboard)/[tenantId].
---

# Dashboard components in talia-client

Ground truth is the actual tree under `src/app/(dashboard)/[tenantId]/`, not the `/components/dashboard` layout described in the (stale) root `CLAUDE.md` — that folder doesn't exist.

## Where things actually live

- **Feature UI and logic: co-located inside the route folder**, not in a shared components directory. For a feature `foo`:
  - `src/app/(dashboard)/[tenantId]/foo/page.tsx` — the page (Server Component by default).
  - `src/app/(dashboard)/[tenantId]/foo/foo-form.tsx` (or similar) — the interactive piece, `'use client'` only where interactivity is actually needed.
  - `src/app/(dashboard)/[tenantId]/foo/actions.ts` — Server Actions for mutations.
  - `src/app/(dashboard)/[tenantId]/foo/loading.tsx` — loading state, add one if the page does real data fetching.
  - See `src/app/(dashboard)/[tenantId]/settings/` or `.../conversations/` for the concrete pattern (`settings-form.tsx`, `actions.ts`, `knowledge-form.tsx`, `copy-script-button.tsx`).
- **Generic, cross-feature UI primitives**: `src/components/ui/` (shadcn-style atoms — toasts, checkboxes, etc.).
- **Shared cross-page components** (nav, toggles): flat under `src/components/` (e.g. `dashboard-nav.tsx`, `theme-toggle.tsx`, `language-toggle/`).

Only reach for a shared component when the same UI is genuinely used across more than one feature — otherwise keep it co-located with the route.

## Gating by permission/module

Follow the pattern in `src/components/dashboard-nav.tsx`: use `hasTenantPermission` and `isTenantModuleEnabled` from `@/lib/auth/permissions` (`TenantModuleKey`, `TenantRole`) to decide what's visible — don't hand-roll role checks in the component.

## Data access

- Reads: `createClient()` from `src/lib/supabase/server.ts` (respects RLS, session-scoped).
- Writes: `createAdminClient()` from `src/lib/supabase/admin.ts` inside a Server Action — this bypasses RLS, so the action itself must check the caller has the right `account_membership`/`venue_membership` before writing (see [`supabase-rls`](../supabase-rls/SKILL.md) skill).

## Forms

`react-hook-form` + `@hookform/resolvers` + `zod`, matching existing forms like `settings-form.tsx`. Define the zod schema in `/src/types/` if it's shared with a Server Action, otherwise inline in the form file.

## Tests

Co-located `*.test.ts` files exist widely under `src/lib/` (logic, server-side helpers) — that's the actual test coverage in this repo today. Component-level `.test.tsx` rendering tests are not currently a strong pattern here; prioritize testing the logic (Server Actions, `src/lib/**`) over the JSX itself unless the component has real conditional/interactive logic worth covering.

## Before finishing

```bash
npm run typecheck
npm run lint
```
