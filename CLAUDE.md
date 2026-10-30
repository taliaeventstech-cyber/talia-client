# TALIA – AI Assistant Platform for Cultural Venues

Multi-tenant SaaS where an **account** (the contractual client) manages one or more **venues** (theatres, museums, cinemas...) and their TALIA channels: chatbot, email agent, voice (paused), accessibility widget. See `docs/current-state.md` for the authoritative, current product state — it wins over anything in this file if they conflict.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components by default)
- **Language**: TypeScript strict mode
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **UI**: shadcn/ui-derived components + Tailwind
- **Charts**: Recharts
- **Forms**: react-hook-form + zod
- **AI/RAG backend**: `talia-ai` — separate repo (Node/Fastify, Fly.io) taking over chat, email drafting, RAG, ingestion and embeddings over time. Selected via `CHAT_AGENT_PROVIDER=talia-ai`.
- **Legacy AI/workflow adapter**: n8n, self-hosted (`n8n.culturactiva.cat`) — **temporary**, being phased out in favor of `talia-ai`. Don't add new business logic to it.
- **Hosting**: Vercel

## Architecture

```
/src
  /app
    /(marketing)             # landing, pricing, signup
    /(dashboard)/[tenantId]  # Agora: authenticated area, per-venue
      /overview /conversations /analytics /settings /knowledge /email /voice /chatbot /accessibility /account /upgrade
    /backstage               # internal TALIA panel (accounts/venues/config/diagnostics)
    /auth /onboarding /invite
    /api                     # routes (n8n + talia-ai webhooks, cron, billing, etc.)
  /components
    /ui                      # shared shadcn-style primitives
    (flat files)             # cross-page shared components, e.g. dashboard-nav.tsx
    # feature-specific UI is co-located inside its route folder under (dashboard)/[tenantId]/<feature>/,
    # not in a separate /components/dashboard directory — see the `dashboard-component` skill
  /lib
    /supabase                # clients (server, client, admin)
    /auth                    # permissions (hasTenantPermission, isTenantModuleEnabled)
    /knowledge, /chat, /voice, /billing, ...
  /types                     # global TypeScript types, generated database.types.ts
/supabase
  /migrations                # SQL migrations
```

## Critical Rules

- **TypeScript strict always**. No `any` except where absolutely impossible.
- **Server Components by default**. `'use client'` only when interactivity is needed.
- **Multi-tenant via RLS + membership model** — see "Key Data Models" below. RLS policies here only cover `select`; mutations go through `createAdminClient()` (service role) in Server Actions/API routes, which bypasses RLS, so **the action itself must check the caller's membership before writing**. See the `supabase-rls` skill (`.claude/skills/supabase-rls/SKILL.md`).
- **Use Server Actions** for mutations instead of API routes when possible.
- **Never expose service_role key** in client. Only in server actions or API routes with validation.
- **English for code, comments for domain context** when it helps understanding the cultural-venue business.
- **No default exports** except in Next.js pages/layouts.
- **Typed errors**: use Result pattern or throw specific error classes.
- **Naming: "venue", never "theatre"** in product, UI or new code — `theatres` is only the legacy DB table name.

## Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Server actions: `kebab-case-action.ts`
- DB tables: `snake_case` plural (`conversations`, `email_drafts`; `theatres` is the legacy name for venues)
- DB columns: `snake_case`

## Project Commands

```bash
npm run dev              # start dev server
npm run build            # production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm test                 # Vitest
npm run db:migrate       # supabase db push
npm run db:types         # generate types from schema
```

## Key Data Models

```
auth.users
  -> profiles
  -> account_memberships -> accounts
  -> venue_memberships   -> venues (DB table: theatres)
```

- `accounts` — the contractual client (multi-tenant root); can own multiple venues.
- `profiles` — the person; linked to `auth.users` via `account_memberships`/`venue_memberships`.
- `theatres` — DB table name for venues, one row per venue.
- `public.users` — legacy, single-tenant precursor. Never build new permission logic on it.
- `conversations`, `messages` — chatbot conversations, per venue.
- `email_connections`, `email_threads`, `email_messages`, `email_drafts` — email agent, per venue.
- `knowledge_items`, `knowledge_chunks`, `knowledge_sources` — shared knowledge base feeding chatbot/email/voice.
- `usage_events` — billing/usage tracking across channels.

Full detail: `docs/architecture/accounts-venues-access.md`.

## n8n & talia-ai Integration

- n8n is a **temporary adapter** for chatbot/email classification and drafting — TALIA orchestrates, n8n never writes directly to Supabase or creates Gmail drafts itself. See `docs/requirements/email-agent.md` and `docs/architecture/agent-runtime.md`.
- `talia-ai` (separate repo) is the direction of travel: when `CHAT_AGENT_PROVIDER=talia-ai`, Next.js acts as a gateway (validates tenant/limits/session) and delegates retrieval + response to `talia-ai`'s `/v1/chat/respond`, with a temporary fallback to n8n on 5xx.
- Don't add new business logic to n8n. New AI/RAG logic belongs in `talia-ai`.

## Workflow

1. Read `docs/current-state.md` before changing product behavior; it's the source of truth, not this file.
2. DB changes → always via migration in `/supabase/migrations`, following the `supabase-rls` skill.
3. After migration: regenerate types with `npm run db:types`.
4. Tests are co-located (`*.test.ts` next to the module it tests) — coverage today is concentrated in `/src/lib/**` (logic, server-side helpers), not component rendering tests. Prioritize testing logic over JSX.
5. Small, atomic commits. See `CONTRIBUTING.md` for branch naming and PR flow.

## Environments

| Environment | Branch | URL | Database |
|---|---|---|---|
| Production | `main` | https://agora.talia.events | Supabase **production** project |
| Staging | `develop` | https://talia-client-git-develop-talia-intelligence.vercel.app | Supabase **staging** project (separate) |
| PR previews | any other branch | Vercel preview URL shown on the PR | Supabase **staging** project |
| Local | any | http://localhost:3000 | Supabase **staging** or local (`npx supabase start`) — never production |

- **Never point local work or a preview at the production database.** If `.env.local` (or any env you're given) contains the production Supabase URL, stop and tell the maintainer instead of continuing.
- **Never run `npm run db:migrate` / `supabase db push`** unless the maintainer explicitly asks in this session *and* you've confirmed the linked project is staging (`npx supabase projects list` shows the linked one). Applying migrations to production is always the maintainer's job.
- Vercel crons (`vercel.json`) only run in production. Staging uses Stripe **test mode**; integrations without staging credentials (Google/Microsoft OAuth, Meta, WhatsApp, Instagram, ElevenLabs, n8n) are expected to be unavailable there — that's not a bug to fix.
- How staging is set up: `docs/operations/staging-environment.md`.

## Git workflow (summary — full rules in `CONTRIBUTING.md`)

1. Branch from an up-to-date `develop`, one branch per Linear issue (`feature/TAL-XX-...`, `fix/TAL-XX-...`, etc.). In a Claude Code cloud session that started on its own `claude/*` branch, keep that branch.
2. Before opening a PR, run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. All must pass.
3. Open the PR **against `develop`**, with the Linear ID (`Closes TAL-XX`) and a short summary of what changed and how to test it.
4. **Never merge a PR yourself, and never push directly to `develop` or `main`.** The maintainer (Ricardo) merges after reviewing and once CI is green. `develop` → `main` is a manual release done only by the maintainer.
5. When the PR is open, share its link and its Vercel preview URL so the change can be checked before merging.

## Changes that need the maintainer's explicit approval first

This is a multi-tenant production app under a Google CASA security assessment. For anything below, **describe the plan and wait for an explicit "go"** before writing code — even if the task seems to require it:

- Database: migrations, RLS policies, schema or seed changes, `src/types/database.types.ts`.
- Auth and sessions: login, signup, MFA, password reset, cookies, middleware, `src/lib/auth/**` (permissions, membership checks).
- Anything using `createAdminClient()` / the service role key.
- Billing: Stripe, pricing, plans, usage limits, `src/app/api/billing/**`.
- `src/app/api/webhooks/**`, `src/app/api/cron/**`, `src/app/api/internal/**`.
- OAuth and channel integrations (Google, Microsoft, Meta, WhatsApp, Instagram), token encryption and secrets handling.
- Data retention and deletion.
- `vercel.json`, `next.config.ts`, CI (`.github/`), Husky, ESLint config, new dependencies.

If you're unsure whether a change touches one of these areas, ask. UI, copy, i18n and self-contained components inside a feature folder are fine to do directly.

## What NOT to do

- ❌ Don't use `pages/` router (legacy)
- ❌ Don't use Prisma — use Supabase client directly with generated types
- ❌ Don't use `useEffect` for data fetching — use Server Components or React Query
- ❌ Don't install packages without clear justification
- ❌ Don't commit secrets (check `.env*`)
- ❌ Don't say "theatre" in product/UI/new code, or build new logic on `public.users`
- ❌ Don't add new business logic to n8n — that belongs in `talia-ai` now

@AGENTS.md
