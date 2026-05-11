# Requirements: Agente de Email

## Objetivo

Permitir que TALIA ayude a responder emails de atención sin obligar al cliente a abandonar su buzón.

El cliente debe poder trabajar desde Gmail/Outlook y ver borradores preparados por TALIA.

## Principio de Producto

MVP recomendado: **draft-first**.

TALIA no envía emails automáticamente al principio. Genera borradores, los deja en el buzón del cliente y un humano los revisa/envía.

## Flujo MVP

1. Cliente conecta buzón desde Àgora o TALIA lo configura desde Backstage.
2. TALIA lee emails entrantes autorizados.
3. TALIA detecta si debe responder.
4. TALIA consulta knowledge base de la venue.
5. TALIA genera respuesta.
6. TALIA crea borrador en Gmail/Outlook.
7. Humano revisa y envía desde su buzón.
8. TALIA registra estado, tema, intención y uso.

## Providers

Primera fase:

- Google Gmail API.

Siguiente:

- Microsoft Graph para Outlook/Exchange.

Evitar IMAP/SMTP como primera opción salvo necesidad, porque complica permisos, seguridad y trazabilidad.

## Modelo de Datos

Tablas previstas:

- `email_connections`: conexión del buzón.
- `email_threads`: hilos.
- `email_messages`: mensajes.
- `email_drafts`: borradores generados.

## Estados

Thread:

- new;
- drafted;
- waiting_human;
- sent;
- resolved;
- escalated;
- ignored.

Draft:

- generated;
- created_in_provider;
- edited_by_human;
- approved;
- sent;
- discarded;
- error.

## Permisos

Permisos sugeridos:

- `view_email`;
- `review_email`;
- `send_email`;
- `manage_email`;
- `manage_email_automation`.

MVP:

- owner/admin pueden gestionar;
- operator puede revisar si se decide activarlo;
- viewer solo lectura.

## Riesgos

- OAuth y refresh tokens.
- Seguridad de datos personales.
- Rate limits de Gmail/Outlook.
- Detección de emails que no deben responderse.
- Evitar auto-respuestas peligrosas.
- Mantener trazabilidad entre borrador y email original.

## Decisiones MVP

- No auto-send.
- No borrar emails.
- No modificar emails existentes salvo crear borrador.
- Guardar solo lo necesario.
- Backstage ve estado técnico.
- Cliente ve conexión, buzón y métricas.
