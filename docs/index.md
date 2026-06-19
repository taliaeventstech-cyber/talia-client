# Indice de Documentacion TALIA

Este directorio recoge la documentacion curada de producto, arquitectura, requirements, seguridad, legal y operacion.

## Entrada Principal

- [`current-state.md`](current-state.md): estado real de la app, modulos activos, legacy y deuda conocida.

## Producto

- [`product/roadmap.md`](product/roadmap.md): vision por fases y modulos.
- [`product/pricing.md`](product/pricing.md): planes, limites y criterios de monetizacion.
- [`product/onboarding.md`](product/onboarding.md): flujo de alta self-serve, accounts, venues e invitaciones de equipo.
- [`product/accessibility-widget.md`](product/accessibility-widget.md): exploracion inicial de widget de accesibilidad.

## Arquitectura

- [`architecture/accounts-venues-access.md`](architecture/accounts-venues-access.md): accounts, venues, profiles, roles e invitaciones.
- [`architecture/usage-billing.md`](architecture/usage-billing.md): medicion de uso, limites y facturacion.
- [`architecture/ai-agents.md`](architecture/ai-agents.md): principios compartidos para chatbot, email, voz y futuros canales.
- [`architecture/knowledge-ingestion.md`](architecture/knowledge-ingestion.md): ingestion de FAQs, Excel, PDFs, URLs y futura capa de retrieval.
- [`architecture/scaling-roadmap-lisbon-2026.md`](architecture/scaling-roadmap-lisbon-2026.md): plan de arquitectura escalable hacia noviembre de 2026.

## Requirements

- [`requirements/chatbot.md`](requirements/chatbot.md): chatbot web y widget.
- [`requirements/email-agent.md`](requirements/email-agent.md): agente de email y conexion con buzones reales.
- [`requirements/voice-agent.md`](requirements/voice-agent.md): agente de voz, telefonia y ElevenLabs/Twilio.

## Operaciones

- [`operations/client-launch-checklist.md`](operations/client-launch-checklist.md): checklist interno para lanzar un cliente.
- [`operations/google-cloud-production-oauth.md`](operations/google-cloud-production-oauth.md): verificacion OAuth de Google para Gmail.
- [`operations/data-retention.md`](operations/data-retention.md): politica operativa de retencion y limpieza.

## Seguridad y Legal

- [`security/auth-phase-1.md`](security/auth-phase-1.md): primera fase de hardening de signup/signin.
- [`legal/privacy-policy-google-en.md`](legal/privacy-policy-google-en.md): politica de privacidad vigente para Google OAuth.
- [`legal/terms-of-service-google-en.md`](legal/terms-of-service-google-en.md): terminos de servicio vigentes.

## Otros

- [`backlog.md`](backlog.md): deuda y mejoras no bloqueantes.
- [`stripe-checkout.md`](stripe-checkout.md): configuracion de Stripe Checkout y webhook.

## Naming de Producto

- **Backstage**: panel interno de TALIA.
- **Account**: cliente u organizacion contratada.
- **Venue**: centro, teatro, museo, sala o sede gestionada dentro de un account.
- **Agora**: dashboard operativo de una venue.
- **Account dashboard**: dashboard agregado de un account con varias venues.

## Principios

- TALIA usa signup self-serve para crear el primer workspace.
- Las invitaciones son para equipos existentes.
- Los modulos contratados se definen por venue.
- Un account puede tener una o varias venues.
- Las personas y emails son rotativos; el modelo debe permitir vincular, desvincular y cambiar accesos sin romper historial.
- Los canales de atencion son adaptadores sobre un nucleo comun: conocimiento, conversaciones, permisos, metricas y limites.
