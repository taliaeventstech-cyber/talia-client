# Onboarding de Clientes

TALIA funciona por invitación. No debe existir signup libre operativo para clientes no contratados.

## Flujo Ideal

1. TALIA crea un account desde Backstage.
2. TALIA crea una o varias venues dentro del account.
3. TALIA activa módulos por venue.
4. TALIA genera invitaciones:
   - por account si el usuario debe ver varias venues;
   - por venue si el usuario solo debe operar una venue concreta.
5. El usuario recibe un enlace `/signup?invite=TOKEN`.
6. El usuario crea contraseña.
7. El sistema crea `profile` y memberships.
8. El usuario entra en:
   - account dashboard si tiene acceso de account;
   - Àgora de venue si solo tiene acceso de venue.

## Datos de Account

El account representa al cliente contractual.

Datos propios:

- Nombre legal/comercial.
- Email de facturación.
- Estado: prospect, trialing, active, paused, cancelled.
- Notas comerciales.

No debe almacenar datos específicos del agente, porque esos viven en cada venue.

## Datos de Venue

La venue representa el centro operativo.

Datos propios:

- Nombre público.
- Tipo: teatro, museo, cine, festival, auditorio, centro cultural.
- Web oficial.
- Email y teléfono fallback.
- Idioma principal.
- Plan de la venue.
- Módulos contratados.
- Configuración de chatbot.
- Configuración de voz.
- Configuración de email cuando exista.

## Invitaciones

### Invitación por Account

Uso:

- Cliente con varias venues.
- Dirección, gerencia o perfiles que necesitan visión agregada.

Resultado:

- Crea `account_membership`.
- Puede crear acceso a todas las venues del account según rol/permisos.

### Invitación por Venue

Uso:

- Operadores de una sede concreta.
- Clientes con una sola venue.

Resultado:

- Crea `venue_membership`.
- Puede crear también membership de account mínima si hace falta para navegación.

## Roles

Roles de account:

- `owner`: control total del cliente.
- `admin`: gestión habitual.
- `billing`: facturación.
- `viewer`: lectura.

Roles de venue:

- `owner`.
- `admin`.
- `operator`.
- `analyst`.
- `viewer`.

Los permisos reales deben validarse server-side. La UI solo oculta opciones, no protege datos.
