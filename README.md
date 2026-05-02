# TALIA – Multi-tenant AI Platform for Culture

TALIA is a SaaS platform for the cultural sector. The first active module, **Attention**, gives theatres and cultural venues AI-powered support across channels. The current implementation focuses on the web chatbot, but the product direction includes web chat, email and voice agents over one shared tenant, conversation and knowledge layer.

For the product roadmap and module architecture, see [docs/product-roadmap.md](docs/product-roadmap.md).

---

## Core Concept

A theatre signs up → configures Talía from the dashboard → connects one or more Attention channels → uploads or configures trusted information sources → visitors/customers get support through web chat, email or voice.

The key architectural decision today: **one generic n8n workflow serves all web-chat clients**. The workflow reads each theatre's configuration from Supabase on every request, using `tenant_id` to isolate data and behaviour per client. As Attention grows, n8n/channel integrations should behave as adapters over a shared core.

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

Importable workflow:

```txt
n8n-workflows/TALIA-Generic-Multi-Tenant-Widget-Webhook.json
```

```
Webhook Trigger (public, generic)
  │  receives: { chatInput, sessionId, tenant_id }
  ▼
HTTP Request → GET /api/internal/tenants/{tenant_id}/chat-config
  │  fetches: system_prompt, scrape_urls, fallback_email, fallback_phone, widget_config
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

The widget is a lightweight JS file hosted on our CDN. It reads `data-tenant`, sends messages to TALIA's `/api/chat/[tenantId]`, and TALIA forwards them to the correct n8n webhook server-side.

---

## Dashboard Structure

```
/src/app
  /(marketing)
    /page.tsx              → landing page
    /pricing/page.tsx      → pricing plans
    /signup/page.tsx       → register user
    /login/page.tsx
  /onboarding/page.tsx     → create theatre tenant
  /(dashboard)
    /[tenantId]
      /overview/page.tsx   → volume, topics, peak hours
      /conversations/page.tsx  → searchable conversation list
      /analytics/page.tsx  → charts (Recharts)
      /settings/page.tsx   → system prompt, URLs, embed code, branding
  /api
    /chat/[tenantId]/route.ts → widget → n8n proxy
    /internal
      /tenants/[tenantId]/chat-config/route.ts → tenant runtime config for n8n
    /webhooks
      /n8n/[tenantId]/route.ts         → receive conversations from n8n
      /n8n/[tenantId]/topics/route.ts  → receive topic classifications
```

---

## API Endpoints (Dashboard → n8n)

### `POST /api/chat/[tenantId]`
Receives widget messages, loads the theatre's `n8n_webhook_url`, forwards the message to n8n server-side, and returns the assistant reply to the widget.

Payload:
```json
{
  "session_id": "abc-123",
  "message": "Quines obres hi ha?"
}
```

### `GET /api/internal/tenants/[tenantId]/chat-config`
Internal runtime config endpoint for the generic n8n workflow.

If `INTERNAL_API_KEY` is configured, n8n must send it in:

```txt
x-talia-internal-key: <INTERNAL_API_KEY>
```

Response:
```json
{
  "tenant_id": "abc123",
  "name": "Teatre Nacional de Catalunya",
  "assistant_name": "TALIA",
  "primary_color": "#8056cf",
  "system_prompt": "...",
  "fallback_email": "info@tnc.cat",
  "fallback_phone": "933 065 700",
  "scrape_urls": ["https://www.tnc.cat/es"],
  "topic_categories": ["agenda", "precios", "horarios", "ubicacion", "visita", "entradas", "accesibilidad", "saludo", "otro"]
}
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

## Product Roadmap

The historical build order below describes the current web-chat MVP. The broader product roadmap is maintained in [docs/product-roadmap.md](docs/product-roadmap.md) and should guide new product decisions.

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
N8N_MASTER_WEBHOOK_URL=https://your-n8n.onrender.com/webhook/talia/chat
DEFAULT_N8N_WEBHOOK_URL=https://your-n8n.onrender.com/webhook/talia/chat

# Optional. If set, n8n must send x-talia-internal-key with the same value.
INTERNAL_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://talia.app
```

The generic n8n workflow keeps `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` compatible. It does not use
`$env`; the internal TALIA config request uses an n8n **HTTP Header Auth** credential instead.

n8n credential required for `Fetch Tenant Config`:

```txt
Credential type: HTTP Header Auth
Name: x-talia-internal-key
Value: <same value as INTERNAL_API_KEY>
```

---

## Current Status

- [x] Supabase tenant schema and dashboard auth
- [x] Next.js dashboard shell
- [x] Configurable widget JS
- [x] Generic multi-tenant n8n workflow
- [x] Widget → TALIA API → n8n server-side flow
- [x] Conversation and message capture
- [x] Topic classification per conversation
- [x] Basic analytics dashboard
- [x] Tenant widget branding from Supabase
- [ ] Deterministic tenant knowledge base
- [ ] Attention inbox model across chat/email/voice
- [ ] Email agent
- [ ] Voice agent
