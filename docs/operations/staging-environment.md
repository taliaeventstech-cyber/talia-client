# Staging Environment

`develop` deploys to a **staging** environment on Vercel that uses its own
Supabase project, Stripe test mode and its own secrets. Production data and
credentials are never used outside production.

| Environment | Branch | URL | Supabase |
|---|---|---|---|
| Production | `main` | https://agora.talia.events | production |
| Staging | `develop` | https://talia-client-git-develop-talia-intelligence.vercel.app | staging |
| PR previews | other branches | Vercel preview URL | staging |
| Local | any | http://localhost:3000 | staging or local |

> Confirm the staging URL in Vercel → Deployments → a `develop` deployment →
> "Domains". If it differs, update this file and `CLAUDE.md`.

## 1. Supabase staging project

1. In Supabase, create a new project `talia-staging` in the same region as
   production. Store its database password in your password manager.
2. In the staging SQL Editor, put the `extensions` schema on the search path,
   as it is in production. Without this, the migrations that use pgvector fail
   with `type "vector" does not exist`:
   ```sql
   alter database postgres set search_path to "$user", public, extensions;
   ```
   (Setting it on the `postgres` role is not enough: the Supabase CLI connects
   with its own role.)
3. Link it locally and apply every migration:
   ```bash
   npx supabase link --project-ref <staging-ref>
   npx supabase db push
   ```
   Keep the local CLI **linked to staging** from now on. Production migrations
   are a deliberate, separate step (link to production, push, link back).
4. Load `supabase/seed.sql` if it's useful, then create a test account and venue
   through the staging app (not by copying production data).
5. Auth → URL Configuration:
   - Site URL: the staging URL.
   - Redirect URLs:
     - `https://talia-client-git-develop-talia-intelligence.vercel.app/**`
     - `https://*-talia-intelligence.vercel.app/**` (PR previews)
     - `http://localhost:3000/**`
6. Auth → Email templates: copy them from production
   (`docs/operations/auth-email-templates.md`).

## 2. Vercel environment variables

Vercel → Project → Settings → Environment Variables. Production keeps its
current values. Create the **Preview** values below; mark the ones in
"develop only" as Preview + branch `develop`, so PR previews fall back to their
own URL.

| Variable(s) | Staging value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Staging project keys |
| `NEXT_PUBLIC_APP_URL` (develop only) | The staging URL |
| `STRIPE_SECRET_KEY` | Stripe **test mode** secret key |
| `STRIPE_WEBHOOK_SECRET` | Secret of a test-mode webhook pointing to `<staging URL>/api/billing/stripe/webhook` |
| `STRIPE_*_PRICE_ID` | Test-mode price IDs (create matching products in test mode) |
| `EMAIL_TOKEN_ENCRYPTION_KEY`, `WHATSAPP_TOKEN_ENCRYPTION_KEY`, `META_MARKETING_TOKEN_ENCRYPTION_KEY` | New random values — never production's |
| `EMAIL_OAUTH_STATE_SECRET`, `META_MARKETING_OAUTH_STATE_SECRET`, `WEB_CAPTURE_TOKEN_SECRET`, `CRON_SECRET`, `INTERNAL_API_KEY` | New random values |
| `OPENAI_API_KEY` | A separate key with a low monthly spend limit |
| `CHAT_AGENT_PROVIDER`, `TALIA_AI_BASE_URL`, `TALIA_AI_INTERNAL_API_KEY` | `talia-ai-staging` — see "talia-ai" below |
| `GOOGLE_*`, `MICROSOFT_*`, `META_*`, `NEXT_PUBLIC_META_*`, `ELEVENLABS_*`, `N8N_BASE_URL`, `DEFAULT_N8N_*` | Leave **unset** at first; the related channels are unavailable in staging |
| `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`, `WIDGET_OPENAI_VOICE_ENABLED` | Optional; same as production (not secrets). Web Agent voice uses `OPENAI_API_KEY` |
| `OPENAI_ACCESSIBILITY_MODEL`, `EMAIL_AGENT_*`, `KNOWLEDGE_EMBEDDINGS_ENABLED`, `META_MARKETING_GRAPH_API_VERSION`, `NEXT_PUBLIC_AUTH_SPLINE_SCENE_URL` | Same as production (not secrets) |

Generate random values with:
```bash
openssl rand -base64 32
```

After saving, redeploy `develop` (Vercel → Deployments → latest `develop` →
Redeploy) so the new values are picked up.

### talia-ai

`talia-ai` reads Supabase directly with the service role, so staging uses its
own Fly app, `talia-ai-staging`, connected to the staging database. Set it up
following `docs/staging-deployment.md` in the `talia-ai` repo, then set these
Preview variables:

| Variable | Value |
|---|---|
| `CHAT_AGENT_PROVIDER` | `talia-ai` |
| `TALIA_AI_BASE_URL` | `https://talia-ai-staging.fly.dev` |
| `TALIA_AI_INTERNAL_API_KEY` | Same value as the `talia-ai-staging` Fly secret |

Never point staging at the production `talia-ai`: it would serve staging
tenants from the production database.

## 3. Access

Keep Vercel **Deployment Protection** on for previews: this is an app with
tenant data. Give junior developers access by adding them to the Vercel team,
not by making previews public.

## 4. Local development

Point `.env.local` at the staging project (or at local Supabase with
`npx supabase start`). Never keep production credentials in `.env.local`.

## 5. Check it works

1. Open the staging URL and sign up a new test user.
2. Confirm the user appears in the **staging** Supabase project and **not** in
   production.
3. Start a checkout and complete it with Stripe test card `4242 4242 4242 4242`;
   confirm the webhook arrives in Stripe's test-mode dashboard.
