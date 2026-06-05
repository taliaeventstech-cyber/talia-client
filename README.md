# TALIA Client

Aplicacion Next.js de TALIA: signup, onboarding, Agora, Backstage, chatbot web, agente de email, billing y configuracion operativa.

## Fuente de Verdad

Antes de tocar codigo, leer:

1. [`docs/current-state.md`](docs/current-state.md): estado real de la app, modulos activos, deuda y legacy.
2. [`docs/index.md`](docs/index.md): indice curado de documentacion.
3. [`docs/product/roadmap.md`](docs/product/roadmap.md): direccion de producto.

No usar documentos antiguos, notas sueltas o comentarios de codigo como fuente principal si contradicen `docs/current-state.md`.

## Stack

- Next.js App Router.
- TypeScript.
- Supabase Auth/Postgres/RLS.
- Stripe Checkout.
- Google OAuth/Gmail API para el agente de email.
- n8n como adapter temporal para workflows de IA.
- Vercel para despliegue.

## Modulos Actuales

- **Auth y onboarding**: alta self-serve, confirmacion de email y configuracion inicial.
- **Agora**: dashboard operativo por venue.
- **Chatbot web**: canal mas maduro del modulo Atencion.
- **Agente de email**: testing activo con Gmail, modo borradores supervisados.
- **Billing**: trial de 7 dias, planes, extras y Stripe Checkout.
- **Backstage**: panel interno TALIA para configuracion y diagnostico.

## Comandos Basicos

```bash
npm install
npm run typecheck
npm run lint
```

Para desarrollo local:

```bash
npm run dev
```

## Variables de Entorno

La app depende de Supabase, Stripe, Google OAuth, secretos internos y URLs publicas. Usar `.env.local` en local y configurar equivalentes en Vercel para produccion.

Documentos relacionados:

- [`docs/stripe-checkout.md`](docs/stripe-checkout.md)
- [`docs/operations/google-cloud-production-oauth.md`](docs/operations/google-cloud-production-oauth.md)
- [`docs/security/auth-phase-1.md`](docs/security/auth-phase-1.md)

## Reglas Para Nuevos Cambios

- Mantener `docs/current-state.md` actualizado cuando cambie el comportamiento real de la app.
- No introducir nuevas dependencias de `public.users`; el modelo objetivo usa `profiles`, `accounts`, `account_memberships` y `venue_memberships`.
- No reintroducir `should_reply` en email; el contrato actual usa `should_generate_draft`.
- No mostrar el agente de voz en flujos cliente hasta que se reactive.
- Ejecutar `npm run typecheck` y `npm run lint` antes de PR.
