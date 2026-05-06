# TALIA: Auth, clientes, invitaciones, roles y módulos

Documento operativo para el modelo B2B de TALIA. La premisa de producto es que TALIA no es una herramienta self-service abierta: es una plataforma SaaS privada para entidades culturales contratadas.

## Principios

- El signup público no debe permitir crear clientes ni usar servicios sin contrato.
- TALIA crea primero el cliente desde Backstage.
- El cliente entra mediante invitación vinculada a una entidad cultural.
- Los módulos visibles dependen del contrato del cliente.
- Los permisos dependen del rol del usuario dentro del cliente.
- Los usuarios internos de TALIA no tienen por qué pertenecer a ningún cliente.
- Un `platform_admin` puede abrir el dashboard de un cliente desde Backstage sin crear una membership falsa en `public.users`.

## Naming

- **Backstage**: panel privado del equipo TALIA. Ruta: `/backstage`.
- **Cliente**: entidad cultural contratada. Técnicamente hoy vive en `public.theatres`.
- **tenant_id**: identificador técnico UUID del cliente. Lo mantenemos en código/APIs, pero en UI hablamos de cliente.
- **Usuario cliente**: usuario de una entidad cultural.
- **Platform admin**: usuario interno de TALIA.

## Actores

### Platform admin

Equipo interno de TALIA. Se guarda en `public.platform_admins`.

Roles internos:

- `owner`: administración completa de TALIA.
- `admin`: operación habitual de Backstage.
- `support`: soporte, diagnóstico y asistencia.

Acceso esperado:

- `/backstage`
- creación de clientes
- creación de invitaciones
- acceso al perfil/dashboard de cualquier cliente
- gestión futura de módulos, facturación, estados y soporte

### Usuario cliente

Usuario de la entidad cultural. Se guarda en `public.users` y siempre está vinculado a un `theatre_id`.

Roles de cliente:

- `owner`: responsable principal del cliente.
- `admin`: configura TALIA para el cliente.
- `operator`: atiende conversaciones y operativa diaria.
- `analyst`: consulta métricas e intención.
- `viewer`: lectura básica sin edición.

## Flujo de alta de cliente

1. TALIA firma contrato con la entidad cultural.
2. TALIA entra en `/backstage`.
3. TALIA crea el cliente en `public.theatres`.
4. TALIA activa módulos en `public.tenant_modules`.
5. TALIA crea una invitación para el email del cliente.
6. El cliente abre `/signup?invite=TOKEN`.
7. El signup valida la invitación.
8. Supabase Auth crea el usuario.
9. TALIA guarda la pertenencia en `public.users`.
10. El cliente entra en `/{tenantId}/overview`.

Si un usuario autenticado no tiene cliente ni es `platform_admin`, debe ver la pantalla de acceso por invitación.

## Acceso de TALIA al perfil del cliente

Necesitamos poder ver y configurar clientes desde TALIA. La forma correcta es:

- `public.platform_admins` autoriza el acceso desde Backstage.
- No insertamos al usuario TALIA en `public.users` del cliente.
- `getTenantAccess()` devuelve acceso `source: 'platform'` para platform admins.
- Ese acceso se trata como owner operativo para ver/configurar el cliente.
- Más adelante añadiremos auditoría para distinguir acciones de cliente vs acciones internas TALIA.

Esto mantiene separadas las responsabilidades:

- `public.users`: usuarios reales del cliente.
- `public.platform_admins`: equipo TALIA.

## Tablas principales

### `public.theatres`

Representa la entidad cliente.

Campos relevantes:

- `id`: UUID público del cliente.
- `name`: nombre de la entidad.
- `slug`: identificador humano interno.
- `entity_type`: `theatre`, `museum`, `cinema`, `auditorium`, `festival`, `cultural_center`, `other`.
- `primary_language`: `ca`, `es`, `en`.
- `plan`: plan contratado.
- `website_url`: web oficial.
- `scrape_urls`: URLs permitidas para scraping.
- `widget_config`: configuración visual y textos del widget.
- `fallback_email`, `fallback_phone`: contacto oficial.
- columnas de voz: `voice_enabled`, `elevenlabs_agent_id`, `voice_id`, etc.

### `public.users`

Membership entre Supabase Auth y cliente.

- `id`: `auth.users.id`.
- `theatre_id`: cliente asociado.
- `email`.
- `role`: rol dentro del cliente.

Un usuario cliente pertenece a un cliente en el modelo actual. Si más adelante necesitamos usuarios multi-cliente, esta tabla tendrá que pasar de PK `id` a PK compuesta o tabla de memberships separada.

### `public.platform_admins`

Usuarios internos de TALIA.

- `user_id`: `auth.users.id`.
- `role`: `owner`, `admin`, `support`.

No crea membership automática en `public.users`.

### `public.signup_invites`

Invitaciones privadas de signup.

- `theatre_id`: cliente al que se unirá el usuario.
- `email`: email exacto invitado.
- `token_hash`: SHA-256 del token. El token en claro solo se muestra una vez.
- `role`: rol inicial dentro del cliente.
- `expires_at`.
- `accepted_at`, `accepted_by`.
- `revoked_at`.

Regla: no guardar tokens en claro.

### `public.tenant_modules`

Módulos contratados por cliente.

Módulos actuales:

- `chatbot`
- `data`
- `voice`
- `email`
- `whatsapp`
- `instagram`
- `marketing`

Estados:

- `disabled`
- `trial`
- `active`
- `suspended`

El dashboard debe mostrar solo módulos contratados o en trial. Los módulos no contratados pueden mostrarse como próximos solo si aporta contexto comercial, pero no deben exponer configuración funcional.

## Redirecciones

Login:

- Sin sesión: `/login`.
- Usuario cliente: `/{tenantId}/overview`.
- Platform admin sin cliente: `/backstage`.
- Usuario sin cliente ni admin interno: `/onboarding` con mensaje de invitación.

Home `/`:

- Sin sesión: `/login`.
- Usuario cliente: `/{tenantId}/overview`.
- Platform admin: `/backstage`.
- Otro: `/onboarding`.

Confirmación de email:

- Usar `NEXT_PUBLIC_APP_URL` para construir `/auth/callback`.
- Nunca depender de `localhost` en producción.

## Matriz inicial de permisos de cliente

| Capacidad | owner | admin | operator | analyst | viewer |
| --- | --- | --- | --- | --- | --- |
| Ver overview | sí | sí | sí | sí | sí |
| Ver conversaciones | sí | sí | sí | no | sí |
| Borrar conversaciones | sí | sí | no | no | no |
| Ver analytics/data | sí | sí | no | sí | sí |
| Editar chatbot/settings | sí | sí | no | no | no |
| Editar knowledge base | sí | sí | no | no | no |
| Editar voz | sí | sí | no | no | no |
| Gestionar usuarios/roles | sí | no | no | no | no |

Esta matriz es la versión inicial. Es deliberadamente conservadora.

## Guardas necesarias

La UI no es seguridad. Cada operación sensible debe validar server-side:

- pertenencia al cliente o acceso de plataforma
- rol suficiente
- módulo contratado si aplica

Guardas mínimas:

- `settings`: requiere `owner` o `admin`, módulo `chatbot`.
- `knowledge`: requiere `owner` o `admin`, módulo `chatbot`.
- `voice/settings`: requiere `owner` o `admin`, módulo `voice`.
- `analytics`: requiere `owner`, `admin`, `analyst` o `viewer`, módulo `data`.
- `conversations`: requiere `owner`, `admin`, `operator` o `viewer`, módulo `chatbot`.
- borrar conversación: requiere `owner` o `admin`.

## Backstage

`/backstage` es el panel operativo privado de TALIA.

Versión actual:

- lista clientes
- crea clientes
- edita datos base del cliente
- activa/desactiva módulos contratados
- abre el perfil/dashboard de cualquier cliente
- genera invitaciones por cliente

Siguiente evolución:

- distinguir entre `trial`, `active`, `suspended` desde UI
- ver estado de onboarding
- reenviar/revocar invitaciones
- crear usuarios cliente desde Admin API cuando proceda
- auditoría de acciones internas

## Notas de implementación

- No crear usuarios en `auth.users` con SQL manual salvo emergencia. Usar Supabase Dashboard o Admin API.
- `platform_admins` y `users` son conceptos diferentes.
- El `tenant_id` sigue siendo un UUID técnico generado por base de datos; de cara a producto hablamos de cliente.
- El nombre del asistente no es configurable por cliente: TALIA es TALIA.
- El widget sí puede tener color, mensaje inicial, comportamiento y fuentes configurables por cliente.

## Riesgos abiertos

- `public.users` con PK `id` limita a un usuario a un solo cliente. Puede valer para la primera versión, pero si TALIA gestiona grupos o agencias será necesario migrarlo.
- Falta auditoría interna para acciones de `/backstage`.
- Falta UI para revocar invitaciones.
- Falta control fino por módulo en todas las rutas.
- Falta gestión completa de usuarios del cliente desde dashboard.
