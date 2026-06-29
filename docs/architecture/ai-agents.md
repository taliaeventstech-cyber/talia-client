# Arquitectura: Agentes IA

## Principio

Chatbot, voz, email, WhatsApp e Instagram no deben ser productos separados. Deben ser canales sobre una misma capa de atención.

## Núcleo Compartido

El core debe responder:

- qué account y venue poseen la interacción;
- qué canal la recibió;
- qué agente respondió;
- qué conocimiento se usó;
- qué estado tiene la conversación;
- si hubo escalado humano;
- qué intención/tema se detectó;
- cuánto costó o consumió.

## Canales

### Chatbot

Canal actual más maduro.

Entrada:

- widget web.

Salida:

- respuesta directa en widget.

### Voz

Entrada:

- llamada telefónica.

Salida:

- voz conversacional;
- transcript;
- evento post-call.

### Email

Entrada:

- buzón real del cliente.

Salida MVP:

- borrador en Gmail/Outlook;
- revisión humana.

No auto-enviar en primera versión.

## Knowledge Base

La base de conocimiento debe tener prioridad sobre cualquier fallback generativo.

Fuentes:

- FAQs manuales.
- CSV/XLSX.
- Google Sheets más adelante.
- PDFs y capturas de web instalada.

Regla:

1. Buscar respuesta determinista.
2. Si hay match fiable, responder con fuente.
3. Si no hay respuesta, fallback humano.

## Proveedor Temporal vs Backend Propio

n8n es útil para demos y velocidad.

La arquitectura debe permitir sustituirlo por backend propio sin cambiar:

- widget;
- modelo de datos;
- dashboards;
- configuración por tenant.

Por eso la API pública del widget debe hablar con TALIA, no directamente con n8n.
