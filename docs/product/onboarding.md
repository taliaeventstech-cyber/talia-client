# Onboarding de Clientes

TALIA usa alta self-serve como entrada principal: una entidad crea cuenta, completa el onboarding inicial y obtiene su primer account/venue operativo. Las invitaciones se mantienen como flujo separado para añadir miembros del equipo a un account o venue ya creado.

## Flujo Ideal

1. El usuario crea cuenta desde `/signup`.
2. El sistema crea `auth.users` y `profiles`.
3. El usuario entra en `/onboarding`.
4. El onboarding recoge los datos mínimos de la entidad cultural.
5. El sistema crea `account`, `venue`, `users`, `account_memberships` y `venue_memberships`.
6. El usuario entra en el Àgora de la venue creada.
7. Backstage puede ajustar módulos, plan, configuración avanzada y accesos.

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

Las invitaciones ya no son el mecanismo de alta inicial del cliente. Son un flujo de equipo para sumar personas a una organización existente.

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
- El enlace de invitación debe usar `/invite/TOKEN`, no `/signup?invite=TOKEN`.

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
