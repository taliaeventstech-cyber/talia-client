# TALIA – Multi-tenant AI Assistant Platform

TALIA is a SaaS platform that allows cultural venues (theatres, museums, exhibition centres) to deploy an AI-powered chatbot on their website. Each client gets their own configured assistant, managed from a shared dashboard, orchestrated by a single n8n workflow.

---

## Core Concept

A theatre signs up → configures their TALIA from the dashboard → gets an embed code → pastes it on their WordPress → their visitors chat with a fully customised AI assistant. No technical knowledge required on the client side.

The key architectural decision: **one n8n workflow serves all clients**. The workflow reads each theatre's configuration from Supabase on every request, using `tenant_id` to isolate data and behaviour per client.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Theatre's Website                       │
│   <script src="talia.js" data-tenant="abc123"></script> │
└────────────────────────┬────────────────────────────────┘
                         │ user sends message
                         ▼
┌─────────────────────────────────────────────────────────┐
│              n8n Master Workflow                         │
│                                                         │
│  1. Receive message + tenant_id                         │
│  2. Fetch theatre config from Supabase                  │
│  3. Build dynamic system prompt                         │
│  4. Run AI Agent (GPT-4o) with theatre's config         │
│  5. Scrape theatre's URLs if needed                     │
│  6. Return response to user                             │
│  7. Save conversation + classify topic → Supabase       │
└────────────────────────┬────────────────────────────────┘
                         │ read/write
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase                             │
│   theatres · users · conversations · messages ·         │
│   conversation_topics · analytics_daily                 │
└────────────────────────┬────────────────────────────────┘
                         │ read/write
                         ▼
┌─────────────────────────────────────────────────────────┐
│              TALIA Dashboard (Next.js 15)                │
│                                                         │
│  /signup          → create theatre account              │
│  /onboarding      → configure chatbot                   │
│  /dashboard       → analytics, conversations            │
│  /settings        → update config, get embed code       │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / Dashboard | Next.js 15 (App Router) |
| Language | TypeScript strict |
| Database + Auth | Supabase (PostgreSQL + RLS) |
| AI Orchestration | n8n (self-hosted on Render) |
| AI Model | GPT-4o (chat) + GPT-4o-mini (classification) |
| UI Components | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| Forms | react-hook-form + zod |
| Hosting | Vercel |

---

## Database Schema

### `theatres`
The root tenant table. One record per client.

```sql
create table theatres (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique not null,
  plan              text default 'esencial', -- esencial | profesional | pro
  system_prompt     text,                    -- custom AI instructions
  fallback_email    text,                    -- where to redirect if TALIA can't answer
  fallback_phone    text,
  scrape_urls       jsonb default '[]',      -- URLs the AI can fetch for live data
  widget_config     jsonb default '{}',      -- color, assistant name, languages
  webhook_secret    text,                    -- HMAC secret for n8n callbacks
  n8n_webhook_url   text,                    -- theatre's entry point into n8n
  created_at        timestamptz default now()
);
```

### `users`
Dashboard users linked to a theatre.

```sql
create table users (
  id          uuid primary key references auth.users(id),
  theatre_id  uuid references theatres(id) on delete cascade,
  email       text,
  role        text default 'admin'  -- admin | viewer
);
```

### `conversations`
One record per chat session.

```sql
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  theatre_id      uuid references theatres(id) on delete cascade,
  session_id      text not null,
  last_message_at timestamptz,
  created_at      timestamptz default now()
);
```

### `messages`
Individual messages within a conversation.

```sql
create table messages (
  id              uuid primary key default gen_random_uuid(),
  theatre_id      uuid references theatres(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  role            text not null,  -- user | assistant
  content         text,
  created_at      timestamptz default now()
);
```

### `conversation_topics`
Topic classification per conversation, used for analytics.

```sql
create table conversation_topics (
  id            uuid primary key default gen_random_uuid(),
  theatre_id    uuid references theatres(id) on delete cascade,
  session_id    text,
  topic         text,  -- agenda | precios | horarios | ubicacion | visita | entradas | otro
  user_message  text,
  created_at    timestamptz default now()
);
```

All tables use **Row Level Security (RLS)**. Users only see data from their own theatre. The `service_role` key (used in API routes and n8n callbacks) bypasses RLS where necessary.

---

## n8n Master Workflow

The workflow is multi-tenant by design. The `tenant_id` is sent by the widget on every message and drives the entire execution.

```
Chat Trigger (webhook, public)
  │  receives: { chatInput, sessionId, tenant_id }
  ▼
HTTP Request → GET /rest/v1/theatres?id=eq.{tenant_id}
  │  fetches: system_prompt, scrape_urls, fallback_email, fallback_phone
  ▼
Set Node → builds dynamic system prompt from DB data
  ▼
AI Agent (GPT-4o, Tools Agent)
  ├── Tool: Scrape_Agenda   → fixed URL from theatre's scrape_urls[0]
  ├── Tool: Scrape_FAQs     → fixed URL from theatre's scrape_urls[1]
  ├── Tool: Scrape_Horaris  → fixed URL from theatre's scrape_urls[2]
  └── Tool: Scrape_Arribar  → fixed URL from theatre's scrape_urls[3]
  ▼
HTTP Request → POST /api/webhooks/n8n/{tenant_id}
  │  saves conversation + messages to Supabase via dashboard API
  ▼
HTTP Request → POST api.openai.com (GPT-4o-mini)
  │  classifies the user message into a topic category
  ▼
HTTP Request → POST /api/webhooks/n8n/{tenant_id}/topics
  saves topic classification to Supabase
```

### What `tenant_id` enables
- Fetching the right system prompt and config per theatre
- Isolating conversations in Supabase by theatre
- Routing callbacks to the correct API endpoint
- Billing and usage tracking per client

---

## Widget Embed

Each theatre gets a unique embed snippet from their dashboard settings:

```html
<script
  src="https://talia.app/widget.js"
  data-tenant="abc123"
  data-color="#000000"
  data-name="TALIA"
></script>
```

The widget is a lightweight JS file hosted on our CDN. It reads `data-tenant` and includes it in every message sent to n8n.

---

## Dashboard Structure

```
/src/app
  /(marketing)
    /page.tsx              → landing page
    /pricing/page.tsx      → pricing plans
  /(auth)
    /signup/page.tsx       → register theatre
    /login/page.tsx
  /(dashboard)
    /[tenantId]
      /overview/page.tsx   → volume, topics, peak hours
      /conversations/page.tsx  → searchable conversation list
      /analytics/page.tsx  → charts (Recharts)
      /settings/page.tsx   → system prompt, URLs, embed code, branding
  /api
    /webhooks
      /n8n/[tenantId]/route.ts         → receive conversations from n8n
      /n8n/[tenantId]/topics/route.ts  → receive topic classifications
```

---

## API Endpoints (n8n → Dashboard)

### `POST /api/webhooks/n8n/[tenantId]`
Receives a completed conversation from n8n and saves it to Supabase.

Payload:
```json
{
  "session_id": "abc-123",
  "messages": [
    { "role": "user", "content": "Quines obres hi ha?" },
    { "role": "assistant", "content": "Ara mateix teniu Els Últims Dies de Pompeia..." }
  ]
}
```

Verified with HMAC-SHA256 using `theatres.webhook_secret`.

### `POST /api/webhooks/n8n/[tenantId]/topics`
Receives the topic classification for analytics.

Payload:
```json
{
  "session_id": "abc-123",
  "topic": "agenda",
  "user_message": "Quines obres hi ha?"
}
```

---

## Multi-tenancy & Security

- **RLS on every table** — users only access their theatre's data, enforced at DB level
- **HMAC verification** on all n8n → dashboard webhook calls
- **service_role key** only used server-side (API routes, never in client components)
- **tenant_id validated** on every API route against the authenticated session
- **Secrets never in client bundle** — widget only holds tenant_id (not sensitive)

---

## Build Order

Build in this sequence — each phase depends on the previous.

**Phase 1 — Multi-tenant core**
1. Supabase schema + RLS policies
2. Next.js auth (Supabase Auth)
3. Signup + onboarding flow (configure system prompt, URLs, branding)
4. Modify n8n workflow to be multi-tenant (fetch config from Supabase per request)
5. Widget JS with tenant_id

**Phase 2 — Dashboard**
6. Webhook endpoints to receive data from n8n
7. Overview page (volume, topics summary)
8. Conversations list
9. Analytics charts (Recharts)
10. Settings page + embed code generator

**Phase 3 — Scale**
11. Plan limits (max conversations/month per plan)
12. Overage alerts
13. Email channel (Módulo Acción)
14. Billing integration

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# n8n
N8N_BASE_URL=https://your-n8n.onrender.com
N8N_MASTER_WEBHOOK_URL=

# App
NEXT_PUBLIC_APP_URL=https://talia.app
```

---

## Current Status

- [x] n8n workflow operational (IDEAL Barcelona pilot)
- [x] Chatbot working with real-time web scraping
- [x] Topic classification per conversation
- [x] Basic analytics data being captured
- [ ] Multi-tenant n8n workflow (next)
- [ ] Supabase schema
- [ ] Next.js dashboard
- [ ] Widget JS