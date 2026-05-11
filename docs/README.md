# TALIA Documentation

Este directorio recoge la documentación de producto, arquitectura, requirements y operación de TALIA. Está estructurado para poder migrarse después a Notion sin cambiar la jerarquía.

## Estructura

### Producto

- [`product/roadmap.md`](product/roadmap.md): visión por fases y módulos.
- [`product/pricing.md`](product/pricing.md): planes, límites y criterios de monetización.
- [`product/onboarding.md`](product/onboarding.md): flujo de alta de clientes, accounts, venues e invitaciones.

### Arquitectura

- [`architecture/accounts-venues-access.md`](architecture/accounts-venues-access.md): modelo de accounts, venues, profiles, roles e invitaciones.
- [`architecture/usage-billing.md`](architecture/usage-billing.md): medición de uso, límites y facturación por módulo.
- [`architecture/ai-agents.md`](architecture/ai-agents.md): principios compartidos para chatbot, voz, email y futuros canales.

### Requirements

- [`requirements/chatbot.md`](requirements/chatbot.md): chatbot web y widget.
- [`requirements/voice-agent.md`](requirements/voice-agent.md): agente de voz, telefonía y ElevenLabs/Twilio.
- [`requirements/email-agent.md`](requirements/email-agent.md): agente de email y conexión con buzones reales.

### Operaciones

- [`operations/client-launch-checklist.md`](operations/client-launch-checklist.md): checklist interno para lanzar un cliente.

## Naming de Producto

- **Backstage**: panel interno de TALIA.
- **Account**: cliente/organización contratada.
- **Venue**: centro, teatro, museo, sala o sede gestionada dentro de un account.
- **Àgora**: dashboard operativo de una venue.
- **Account dashboard**: dashboard agregado de un account con varias venues.

## Principios

- TALIA no es signup libre: funciona por invitación.
- Los módulos contratados se definen por venue.
- Un account puede tener una o varias venues.
- Las personas y emails son rotativos; el modelo debe permitir vincular, desvincular y cambiar accesos sin romper la historia del cliente.
- Los canales de atención son adaptadores sobre un núcleo común: conocimiento, conversaciones, permisos, métricas y límites.
