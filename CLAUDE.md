# TALIA – AI Assistant Platform for Theatres

Multi-tenant SaaS platform where theatres manage their TALIA chatbot and conversation analytics.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components by default)
- **Language**: TypeScript strict mode
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Charts**: Recharts
- **Forms**: react-hook-form + zod
- **Chatbot Backend**: n8n (self-hosted on Render)
- **Hosting**: Vercel

## Architecture

```
/src
  /app
    /(marketing)        # landing, pricing, signup
    /(dashboard)        # authenticated area, multi-tenant
      /[tenantId]
        /overview
        /conversations
        /analytics
        /settings
    /api                # routes (n8n webhooks, etc.)
  /components
    /ui                 # shadcn components
    /dashboard          # dashboard-specific components
  /lib
    /supabase           # clients (server, client, admin)
    /n8n                # helpers for workflow management
  /types                # global TypeScript types
/supabase
  /migrations           # SQL migrations
  /seed.sql
```

## Critical Rules

- **TypeScript strict always**. No `any` except where absolutely impossible.
- **Server Components by default**. `'use client'` only when interactivity is needed.
- **Multi-tenant via RLS**. EVERY table has `tenant_id` and RLS policy. Never query without filtering by tenant.
- **Use Server Actions** for mutations instead of API routes when possible.
- **Never expose service_role key** in client. Only in server actions or API routes with validation.
- **English for code, comments for domain context** when it helps understanding theatre business.
- **No default exports** except in Next.js pages/layouts.
- **Typed errors**: use Result pattern or throw specific error classes.

## Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Server actions: `kebab-case-action.ts`
- DB tables: `snake_case` plural (`conversations`, `theatre_settings`)
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

- `theatres` — one record per client (multi-tenant root)
- `users` — users with `theatre_id` for access control
- `conversations` — each conversation with TALIA
- `messages` — individual messages within a conversation
- `analytics_daily` — pre-calculated aggregates per day/theatre

## n8n Integration

- Each theatre has its own webhook URL stored in `theatres.n8n_webhook_url`
- Return webhook (n8n → our API) receives conversations for storage
- Endpoint: `POST /api/webhooks/n8n/[tenantId]` with HMAC verification

## Workflow

1. Before coding: read relevant docs with Context7 (`use context7 for nextjs 15 server actions`)
2. DB changes → always via migration in `/supabase/migrations`
3. After migration: regenerate types with `npm run db:types`
4. Tests co-located with code (`button.test.tsx` next to `button.tsx`)
5. Small, atomic commits

## What NOT to do

- ❌ Don't use `pages/` router (legacy)
- ❌ Don't use Prisma — use Supabase client directly with generated types
- ❌ Don't use `useEffect` for data fetching — use Server Components or React Query
- ❌ Don't install packages without clear justification
- ❌ Don't commit secrets (check `.env*`)

@AGENTS.md