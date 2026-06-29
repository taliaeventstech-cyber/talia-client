# Requirements: Chatbot Web

## Objetivo

Permitir que una venue instale TALIA en su web mediante un script y responda preguntas de visitantes con configuración propia.

## MVP Actual

- Widget JS embebible.
- Configuración por venue.
- Color primario.
- Mensaje inicial.
- Persistencia de sesión por `localStorage`.
- API TALIA como proxy hacia n8n/backend.
- Guardado de conversaciones y mensajes.
- Clasificación de temas e intención.
- Uso y límites por venue.

## Requirements Funcionales

- Instalar con script simple.
- Identificar `tenantId`.
- Responder en la lengua configurada.
- Usar base de conocimiento antes que respuestas generativas.
- Guardar historial.
- Permitir configurar:
  - prompt base;
  - fuentes;
  - FAQs;
  - fallback email/teléfono;
  - color;
  - auto-open.

## Requirements de Demo

- Poder probar con landing ficticia.
- Poder introducir nombre de invitado en demos.
- Poder cambiar tenant sin editar el widget.

## Requirements Técnicos

- CORS controlado por API TALIA.
- No exponer secretos en frontend.
- No depender de n8n en el navegador.
- Fallback si no hay webhook configurado.
- Registro de usage events.

## Pendiente

- Attribution de fuentes en UI.
- Mejor estado de errores.
- Modo de preview desde dashboard.
- Tipado de eventos del widget.
