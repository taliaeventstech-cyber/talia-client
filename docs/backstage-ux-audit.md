# Auditoría de Backstage

Fecha de revisión: 16 julio 2026

Issue: TAL-29
Alcance: panel interno `src/app/backstage/**`. Ágora queda fuera de este rediseño.

## Objetivo

Convertir Backstage en una consola de operaciones sencilla para el equipo de TALIA y retirar las decisiones de interfaz heredadas del modelo inicial por invitación. Backstage no es el onboarding del cliente: el alta ordinaria es self-service y ocurre fuera de este panel.

## Modelo vigente

- `platform_admins` autoriza el acceso a Backstage.
- Los clientes se registran libremente y reciben rol global `User`.
- `account_memberships` define pertenencia y ownership de una cuenta.
- `venue_memberships` limita acceso cuando un miembro solo debe ver venues concretas.
- Las invitaciones siguen siendo válidas para añadir equipo a una cuenta ya creada.
- La cancelación administrativa de Stripe está limitada a founders mediante `manage_customer_billing`.

La tabla `signup_invites` no es legacy por sí misma. Lo obsoleto es usar la invitación como flujo principal de creación de clientes o mostrarla como eje de la portada.

## Hallazgos

### 1. Shell impropio

Backstage reutilizaba `auth-shell` y `auth-card`, con una anchura de 1080 px y apariencia de formulario de login. Esto recortaba tablas y no ofrecía navegación persistente. El primer corte de TAL-29 introduce un shell operativo a ancho completo y navegación propia.

### 2. Portada orientada al onboarding antiguo

La portada daba prioridad a un botón flotante de “Nuevo cliente”, una única pestaña inerte y métricas de invitaciones. Para el modelo self-service son más útiles:

- cuentas y venues activas;
- consumo y coste estimado;
- alertas de conocimiento;
- estado de cada cuenta;
- acceso rápido a Ágora y a la ficha operativa.

El alta manual incompleta se retira de Backstage. El registro self-service es el
único flujo ordinario y crea conjuntamente la cuenta, su propietario y la venue.

### 3. Detalle de cliente duplicado

Existían dos superficies, account y venue, que obligaban a alternar entre
pantallas para entender un mismo cliente.

La superficie canónica pasa a ser el venue. Contiene dos vistas operativas:
salud del conocimiento y trazabilidad de respuestas. El contexto del cliente,
el uso del plan, la configuración y las operaciones restringidas de facturación
se abren desde el control de configuración del header. La ruta de account y la
ruta administrativa de invitaciones por venue se eliminan por completo.

### 4. Archivos sobredimensionados

`backstage/actions.ts`, la ficha de account y la ficha de venue concentran consultas, mutaciones, formato y presentación. Esto dificulta probar cambios y hace que cualquier rediseño tenga demasiado radio de impacto.

Límites objetivo:

- servicios de lectura por dominio para account, venue, uso y conocimiento;
- acciones separadas por capacidad (`accounts`, `billing`, `invites`, `venues`);
- componentes de tabla, estado y formato compartidos;
- páginas servidoras dedicadas a composición y autorización.

### 5. Lenguaje inconsistente

Conviven “cliente”, “account”, “tenant”, “venue” y “teatro”. Criterio de producto:

| Concepto interno | Texto de interfaz |
| --- | --- |
| `account` | Cuenta |
| `theatre` / tenant | Venue |
| `account_membership` | Miembro del equipo |
| `signup_invite` | Invitación de equipo |
| Agora customer UI | Ágora |

Los identificadores técnicos pueden aparecer como dato secundario, nunca como título principal.

## Inventario de decisiones

| Área | Decisión | Estado |
| --- | --- | --- |
| Autorización con `platform_admins` | Conservar | Activa |
| Registro self-service y onboarding | Conservar fuera de Backstage | Activa |
| Alta manual de cuenta sin venue | Eliminar; producía cuentas incompletas | Retirada |
| Invitaciones de equipo a nivel account | Conservar | Activa |
| Invitaciones como alta inicial del cliente | Eliminar del lenguaje y navegación | Retirada |
| Gestión de invitaciones desde Backstage | Eliminar UI huérfana; conservar el mecanismo de equipo | Retirada |
| `public.users` como fuente de autorización | No reintroducir | Retirada |
| Roles globales distintos de Admin/User | No reintroducir | Retirada |
| Roles de membership dentro de una cuenta | Conservar; no son roles globales | Activa |

## Arquitectura de información objetivo

1. **Resumen**: salud de plataforma, uso, coste y alertas operativas.
2. **Clientes**: cuentas y venues con estado, plan, consumo y accesos.
3. **Venue**: salud RAG y fuentes, trazabilidad paginada y diagnóstico. El
   contexto de cuenta, plan, configuración y facturación vive en un panel
   secundario de esta misma vista.

No se añadirán secciones vacías para aparentar una navegación completa. Cada entrada del shell debe llevar a una capacidad real.

## Cortes de implementación

### Corte 1: estructura y legacy visible

- shell propio y responsive;
- portada con métricas operativas;
- retirada del alta manual incompleta;
- venue como vista canónica del detalle de cliente;
- eliminación de las rutas account e invitaciones por venue;
- dos tabs operativos: conocimiento y trazabilidad;
- configuración, uso y facturación en el panel del header;
- trazabilidad server-side con tamaños de 10, 25 y 50 respuestas;
- paginación server-side de cuentas con tamaños de 10, 25 y 50 filas.

### Corte 2: cuentas escalables

- búsqueda por nombre, email e ID;
- filtros por estado, plan y salud;
- estados vacíos y errores de consulta explícitos.

### Corte 3: modularización

- extraer consultas de las páginas;
- dividir `actions.ts` por dominio;
- unificar formatters, pills, tablas y breadcrumbs;
- cubrir permisos y mutaciones críticas con tests.

### Corte 4: operaciones y trazabilidad

- actividad administrativa real desde audit log;
- alertas priorizadas por severidad y antigüedad;
- vistas progresivas para RAG, email y facturación;
- enlaces de soporte y runbooks desde errores accionables.

## Criterios de salida

- Un admin identifica en menos de un minuto qué cuenta o venue requiere atención.
- Ningún flujo sugiere que el alta ordinaria de clientes se hace por invitación.
- El detalle operativo de cliente tiene una única superficie canónica por venue.
- Las tablas funcionan a zoom 100 % y en viewport estrecho sin cortar acciones.
- Las mutaciones críticas mantienen autorización, auditoría y confirmación explícita.
- Backstage no depende de `public.users` ni amplía los roles globales más allá de Admin/User.
