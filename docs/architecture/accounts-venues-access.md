# Arquitectura: Accounts, Venues, Profiles y Accesos

## Modelo

```txt
auth.users
  │
  ▼
profiles
  │
  ├── account_memberships ──► accounts
  │                              │
  │                              ▼
  └── venue_memberships ───► theatres / venues
```

## Entidades

### `auth.users`

Identidad de Supabase Auth.

Responsabilidad:

- Email.
- Password/session.
- Confirmación de cuenta.

No debe contener lógica de negocio de TALIA.

### `profiles`

Perfil estable de persona en TALIA.

Responsabilidad:

- `auth_user_id`.
- Email normalizado.
- Nombre.
- Estado.
- Datos de contacto.

### `accounts`

Cliente contractual.

Ejemplo:

- Layers of Reality.
- Cliente institucional de ejemplo.
- Culturactiva.

### `theatres` / venues

Centro operativo dentro del account.

Ejemplo:

- IDEAL Barcelona.
- IDEAL Madrid.
- Teatro Aurora.

El nombre técnico `theatres` es legacy. En producto hablamos de venues.

### `account_memberships`

Acceso de una persona a un account.

Sirve para:

- ver dashboard agregado,
- gestionar varias venues,
- invitar usuarios,
- administrar facturación.

### `venue_memberships`

Acceso de una persona a una venue.

Sirve para:

- operar Àgora,
- ver conversaciones,
- configurar chatbot,
- ver métricas,
- gestionar canal de voz/email si tiene permiso.

## Legacy

`public.users` se considera legacy.

Puede seguir existiendo por compatibilidad, pero la arquitectura futura debe depender de:

- `profiles`;
- `account_memberships`;
- `venue_memberships`.

## Reglas

- Un account puede tener muchas venues.
- Una venue pertenece a un account.
- Una persona puede estar en varios accounts.
- Una persona puede estar en varias venues.
- TALIA puede vincular, desvincular y cambiar permisos sin borrar historial.
- Los emails son credenciales, no la fuente principal del modelo de negocio.

## Dashboard

### Account Dashboard

Ruta: `/accounts/[accountId]`.

Muestra:

- visión agregada;
- lista de venues;
- uso por venue;
- acceso a cada Àgora;
- usuarios e invitaciones de account.

### Àgora

Ruta: `/[tenantId]/overview`.

Muestra:

- operación de una venue;
- conversaciones;
- base de conocimiento;
- configuración del chatbot;
- voz/email si están contratados.

### Backstage

Ruta: `/backstage`.

Panel interno TALIA para:

- crear accounts;
- crear venues;
- activar módulos;
- invitar usuarios;
- abrir dashboards;
- diagnosticar configuración.
