# Google Cloud production OAuth

Documento operativo para sacar a produccion la integracion de Gmail de TALIA.

## Problema actual

Google muestra `Access blocked: talia-mail has not completed the Google verification process` cuando una cuenta no autorizada intenta conectar Gmail.

Esto ocurre porque el OAuth consent screen esta en modo testing o porque la app aun no esta verificada para los scopes solicitados.

## Scopes actuales

TALIA solicita:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.compose`

Ambos son scopes restringidos de Gmail. Google exige verificacion OAuth para apps publicas que los usen. Si la app almacena o transmite datos de scopes restringidos en servidores, Google puede exigir security assessment.

## Desbloqueo temporal para pruebas

En Google Cloud Console:

1. Abrir el proyecto OAuth actual.
2. Ir a Google Auth Platform / Audience.
3. Mantener publishing status en `Testing`.
4. Anadir las cuentas de prueba en Test users.
5. Reintentar conectar Gmail.

Limitaciones:

- Maximo 100 test users.
- Las autorizaciones de test users caducan a los 7 dias si se usan scopes fuera de perfil/email/openid.
- No sirve como solucion para clientes reales.

## Produccion recomendada

Crear un proyecto de Google Cloud separado para produccion.

1. Crear proyecto `talia-production`.
2. Activar Gmail API.
3. Configurar Google Auth Platform.
4. User type: `External`, salvo que el producto sea solo para un Google Workspace interno.
5. Branding:
   - App name: `TALIA` o `GoTalia`.
   - User support email.
   - Logo.
   - Home page publica.
   - Privacy policy publica.
   - Terms of service publica.
   - Authorized domain: dominio final de produccion.
6. Data access:
   - Declarar solo `gmail.readonly` y `gmail.compose`.
   - Justificar por que se necesitan.
7. OAuth client:
   - Tipo: Web application.
   - Authorized redirect URI:
     - `https://APP_PROD_DOMAIN/api/email/google/callback`
   - Authorized JavaScript origins:
     - `https://APP_PROD_DOMAIN`
8. Publicar app en `In production`.
9. Solicitar verificacion de branding y data access.

## Variables de entorno de produccion

Configurar en el entorno donde corre Next:

```bash
NEXT_PUBLIC_APP_URL=https://APP_PROD_DOMAIN
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
EMAIL_OAUTH_STATE_SECRET=...
EMAIL_TOKEN_ENCRYPTION_KEY=...
```

`NEXT_PUBLIC_APP_URL` es critico: el codigo genera el redirect URI como:

```text
${NEXT_PUBLIC_APP_URL}/api/email/google/callback
```

Ese valor debe coincidir exactamente con el redirect URI autorizado en Google Cloud.

## Evidencias para verificacion

Preparar antes de enviar la solicitud:

- URL publica de la app.
- Politica de privacidad con mencion explicita a datos de Gmail.
- Terminos de servicio.
- Video corto mostrando:
  - login en TALIA;
  - conexion de Gmail;
  - lectura de bandeja autorizada;
  - creacion de borrador;
  - desconexion/revocacion.
- Explicacion de uso de datos:
  - se leen emails autorizados para clasificar y preparar respuestas;
  - se crean borradores supervisados;
  - TALIA no envia emails automaticamente con el scope actual;
  - tokens OAuth se guardan cifrados;
  - el usuario puede desconectar la cuenta.

## Despliegue de la app

El frontend/backend Next puede correr en Cloud Run, Vercel u otro hosting. Lo importante para Google OAuth es:

- dominio HTTPS estable;
- redirect URI estable;
- paginas publicas de privacidad y terminos;
- proyecto OAuth de produccion verificado.

Si se despliega en Google Cloud, Cloud Run es la opcion mas directa para esta app.

## Referencias oficiales

- OAuth App Verification: https://support.google.com/cloud/answer/13463073
- Manage App Audience: https://support.google.com/cloud/answer/15549945
- Gmail API scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
- Submit app for verification: https://support.google.com/cloud/answer/13461325
- Restricted scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
