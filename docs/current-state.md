# Estado Actual de TALIA

Ultima actualizacion: 12 junio 2026

Este documento es la fuente rapida para entender en que punto esta la app antes de tocar codigo. Para decisiones mas profundas, ir a los documentos enlazados al final.

## Resumen

TALIA es un SaaS para entidades culturales. El producto no debe entenderse como un chatbot aislado, sino como una capa de atencion multicanal para venues culturales.

Estado actual:

- Modulo principal activo: **Atencion**.
- Canal mas maduro: **Chatbot web**.
- Canal en testing: **Agente de email Gmail**, en modo borradores supervisados.
- Canales planificados o pausados: Microsoft/Outlook, voz, WhatsApp, Instagram.
- Dashboard cliente: **Agora**, por venue.
- Panel interno: **Backstage**.
- Modelo comercial actual: trial gratuito de 14 dias, upgrade a planes de pago y extras.

## Producto Implementado

### Signup y Auth

Implementado:

- Signup publico con email/password.
- Confirmacion por email antes de entrar al producto.
- Pantalla intermedia de cuenta confirmada antes de comenzar onboarding.
- Login con selector de idioma.
- Password policy reforzada.
- Toggle para visualizar password.
- Baseline de seguridad documentada en `docs/security/auth-phase-1.md`.

Pendiente:

- MFA/SSO empresarial.
- Politicas avanzadas por equipo.
- Rate limiting mas robusto fuera de la capa Next.js.

### Onboarding Cliente

Implementado:

- Onboarding principal tras confirmar cuenta.
- Selector de idioma y modo dia/noche en onboarding.
- Recogida de datos basicos de usuario y entidad.
- Seleccion de hasta 3 propositos/casos de uso.
- Creacion del primer workspace operativo.
- Flujo posterior hacia configuracion inicial del chatbot.

Regla actual:

- El onboarding inicial crea el contexto de account/venue.
- Las invitaciones son para equipos ya existentes, no para el alta inicial del cliente.

Referencia:

- `docs/product/onboarding.md`.

### Onboarding Chatbot

Implementado:

- Wizard especifico de chatbot despues del onboarding cliente.
- Sidebar del Agora oculto mientras el wizard inicial esta pendiente.
- Selector de idioma y modo dia/noche tambien disponible en este wizard.
- Configuracion de mensaje inicial, tono, primera fuente de conocimiento, color y fallback.
- Al finalizar, el usuario vuelve al Agora.

Pendiente:

- Mejorar experiencia de test del bot con preview lateral mas parecida a Botsonic.
- Separar definitivamente prompts editables de prompts tecnicos.

### Agora

Implementado:

- Dashboard por venue.
- Sidebar con modulos visibles segun permisos, plan y acceso.
- Idiomas: castellano, catalan e ingles.
- Modo dia/noche global.
- Trial visible en sidebar.
- Boton de upgrade hacia pantalla de planes.
- Ocultacion de modulos cuando el trial termina o no hay acceso de producto.

Pendiente:

- Dashboard agregado por account.
- Mejorar consistencia visual en algunas pantallas.
- Completar traducciones de zonas menos usadas si aparecen nuevas secciones.

## Modulos

### Chatbot Web

Estado: activo.

Implementado:

- Configuracion por venue.
- Widget/script instalable.
- Mensaje inicial y color de marca.
- Prompt de canal.
- Fallback configurable.
- Conversaciones y mensajes persistidos.
- Analitica basica de temas e intenciones.
- Uso asociado a billing/limits.

Pendiente:

- Reforzar trazabilidad de fuentes usadas por respuesta.
- Consolidar conocimiento como fuente primaria antes que scraping o prompts libres.
- Mejorar preview/test integrado.

Referencia:

- `docs/requirements/chatbot.md`.

### Accesibilidad / Clear View

Estado: MVP tecnico funcional, en endurecimiento de producto.

Implementado:

- Widget independiente en `public/accessibility-widget.js`.
- Activacion por tenant desde la seccion Accesibilidad del Agora.
- Controles visuales: tamano de texto, contraste, escala de grises, enlaces resaltados, pausa de animaciones, espaciado, fuente legible y reset.
- Clear View como lectura simplificada de la pagina publica.
- Clear View usa IA cuando hay proveedor configurado y fallback local cuando no.
- Endpoint publico con validacion de tenant, activacion explicita, limite de payload y rate limit basico por IP/tenant.
- Sanitizado para que la IA no pueda inventar enlaces nuevos.

Pendiente:

- QA visual en `public/olympia.html` y webs reales.
- Definir pricing/add-on y limites comerciales de uso IA.
- Reporting de uso si se convierte en producto de pago independiente.

Referencia:

- `docs/product/accessibility-widget.md`.

### Conocimiento

Estado: activo, con margen de ampliacion.

Implementado:

- Base de conocimiento compartida por venue.
- FAQs/respuestas oficiales.
- Fuentes/scrape URLs.
- Importacion estructurada segun pantalla de configuracion.

Direccion de producto:

- Mantener Conocimiento como nucleo comun para chatbot, email, voz y futuros canales.
- Ampliar en el futuro hacia Sources, Guidelines, Workflows y Actions.

### Agente de Email

Estado: testing activo con Gmail.

Principio de producto:

- TALIA no envia emails automaticamente.
- TALIA genera borradores supervisados.
- El humano revisa y envia desde Gmail.

Implementado:

- Conexion Gmail OAuth desde Agora.
- Microsoft/Outlook oculto hasta completar verificacion.
- Scopes Gmail actuales:
  - `gmail.readonly`;
  - `gmail.compose`.
- Sincronizacion por polling con limites configurables.
- Persistencia de conexiones, threads, mensajes y drafts.
- Clasificador y redactor desacoplados.
- Campo vigente: `should_generate_draft`.
- `should_reply` queda eliminado como contrato nuevo.
- Drafts visibles en Agora y/o creados en Gmail segun modo.
- n8n actua como adapter temporal, no como fuente de verdad.

Pendiente:

- Completar verificacion OAuth de Google.
- Completar Microsoft Graph.
- Mover mas logica a backend propio cuando toque desacoplar n8n.
- Mejorar UI de revision de drafts.

Referencia:

- `docs/requirements/email-agent.md`.
- `docs/operations/google-cloud-production-oauth.md`.

### Voz

Estado: planificado/pausado para cliente.

Contexto:

- Hubo exploracion con ElevenLabs/Twilio.
- El agente de voz no debe aparecer en onboarding cliente ni como opcion activa del Agora hasta que se retome.

Referencia:

- `docs/requirements/voice-agent.md`.

## Billing y Trial

Implementado:

- Trial gratuito de 14 dias.
- Despues del trial, el acceso a Chatbot/Email se reemplaza por upgrade.
- Pantalla `/upgrade` con planes y extras.
- Stripe Checkout.
- Webhook Stripe documentado.
- Extras:
  - white label;
  - +2.000 mensajes;
  - onboarding premium.

Pendiente:

- Validar flujo completo live de Stripe.
- Ajustar reporting de plan actual y add-ons despues de compra.
- Pulir estado visual de trial/upgrade.

Referencias:

- `docs/product/pricing.md`.
- `docs/stripe-checkout.md`.
- `docs/architecture/usage-billing.md`.

## Modelo de Datos y Accesos

Modelo objetivo:

```txt
auth.users
  -> profiles
  -> account_memberships -> accounts
  -> venue_memberships   -> theatres / venues
```

Reglas:

- `auth.users` es identidad, no negocio.
- `profiles` representa la persona.
- `accounts` representa el cliente contractual.
- `theatres` es el nombre tecnico legacy de venue.
- `account_memberships` y `venue_memberships` gobiernan acceso.
- `public.users` es legacy y no debe ser base de nuevas decisiones.

Referencia:

- `docs/architecture/accounts-venues-access.md`.

## Backstage

Estado: panel interno TALIA.

Uso esperado:

- Ver y gestionar accounts/venues.
- Ajustar modulos contratados.
- Revisar configuraciones avanzadas.
- Diagnosticar conexiones.
- Configurar parametros operativos que no deben estar en manos del cliente final.

Pendiente:

- Consolidar permisos internos.
- Mejorar visibilidad de usuarios self-serve y configuraciones por venue.

## Legal, OAuth y Operacion

Documentos vigentes:

- Politica de privacidad para Google OAuth: `docs/legal/privacy-policy-google-en.md`.
- Terms of Service: `docs/legal/terms-of-service-google-en.md`.
- Google OAuth production checklist: `docs/operations/google-cloud-production-oauth.md`.
- Data retention: `docs/operations/data-retention.md`.
- Checklist de lanzamiento cliente: `docs/operations/client-launch-checklist.md`.

Estado:

- Google exige verificacion para scopes restringidos de Gmail.
- La homepage y politicas deben ser publicas y verificadas en Search Console.
- La politica de privacidad debe mantenerse alineada con el uso real de Gmail.

## Legacy y Deuda Conocida

No tomar como modelo nuevo:

- `theatres` como nombre de producto. En producto hablamos de venues.
- `public.users` como modelo de permisos.
- `should_reply` en workflows email.
- `DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL` salvo fallback temporal.
- Voice agent en UI cliente hasta reactivarlo.

Deuda activa:

- Separar prompts editables de prompts tecnicos.
- Reducir dependencia de n8n en email.
- Consolidar docs de roadmap para que no haya fuentes paralelas.
- Completar roles y permisos avanzados.
- Completar observabilidad y reporting.

## Como Entrar al Repo

Lectura recomendada para nuevos miembros:

1. `docs/current-state.md`.
2. `docs/index.md`.
3. `docs/product/roadmap.md`.
4. `docs/product/onboarding.md`.
5. `docs/architecture/accounts-venues-access.md`.
6. `docs/requirements/chatbot.md`.
7. `docs/requirements/email-agent.md`.
8. `docs/security/auth-phase-1.md`.

## Validacion Basica Antes de PR

Ejecutar:

```bash
npm run typecheck
npm run lint
```

No asumir que hay que arrancar `npm run dev` para cada cambio. Si se toca UI critica, verificar visualmente cuando sea necesario.
