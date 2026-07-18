# TALIA Client

TALIA's Next.js application: signup, onboarding, Agora, Backstage, web chatbot, email agent, billing and operational configuration.

## Source of Truth

Before touching code, read:

1. [`docs/current-state.md`](docs/current-state.md): real state of the app, active modules, debt and legacy.
2. [`docs/index.md`](docs/index.md): curated documentation index.
3. [`docs/product/roadmap.md`](docs/product/roadmap.md): product direction.

Do not use old documents, loose notes or code comments as the primary source if they contradict `docs/current-state.md`.

## Stack

- Next.js App Router.
- TypeScript.
- Supabase Auth/Postgres/RLS.
- Stripe Checkout.
- Google OAuth/Gmail API for the email agent.
- `talia-ai` as the classifier and drafter runtime for email; n8n remains legacy only in other channels.
- Vercel for deployment.

## Current Modules

- **Auth and onboarding**: self-serve signup, email confirmation and initial configuration.
- **Agora**: operational dashboard per venue.
- **Web chatbot**: most mature channel of the Attention module.
- **Email agent**: active testing with Gmail, supervised drafts mode.
- **Billing**: 14-day trial, plans, add-ons and Stripe Checkout.
- **Backstage**: internal TALIA panel for configuration and diagnostics.

## Basic Commands

```bash
npm install
npm run typecheck
npm run lint
```

For local development:

```bash
npm run dev
```

## Environment Variables

The app depends on Supabase, Stripe, Google OAuth, internal secrets and public URLs. Use `.env.local` locally and configure equivalents in Vercel for production.

Related documents:

- [`docs/stripe-checkout.md`](docs/stripe-checkout.md)
- [`docs/operations/google-cloud-production-oauth.md`](docs/operations/google-cloud-production-oauth.md)
- [`docs/security/auth-phase-1.md`](docs/security/auth-phase-1.md)

## Rules for New Changes

- Keep `docs/current-state.md` up to date when the app's real behavior changes.
- Do not introduce new dependencies on `public.users`; the target model uses `profiles`, `accounts`, `account_memberships` and `venue_memberships`.
- Do not reintroduce `should_reply` in email; the current contract uses `should_generate_draft`.
- Do not show the voice agent in client flows until it is reactivated.
- Run `npm run typecheck` and `npm run lint` before a PR.
