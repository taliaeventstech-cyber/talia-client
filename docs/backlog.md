# Backlog

Tareas y mejoras de medio plazo que no bloquean el avance actual, pero conviene no perder.

## Arquitectura de agentes

### Separar prompts editables de prompts técnicos

Estado: pendiente

Contexto:
- La base de conocimiento es común por venue.
- Cada canal tiene configuración propia: Chatbot, Email, Voz.
- Los workflows/agentes de n8n también tienen prompts técnicos de sistema.

Mejora:
- Distinguir explícitamente entre `channelPrompt` e instrucciones técnicas del agente.
- `channelPrompt`: editable desde producto/backstage; define tono, preferencias y comportamiento del canal.
- Prompt técnico: vive en n8n/backend; contiene reglas duras, formato de salida, límites de seguridad y contrato JSON.

Motivo:
- Evita que un usuario rompa el contrato técnico del agente.
- Mantiene trazabilidad por canal.
- Permite compartir conocimiento sin mezclarlo con comportamiento.

Canales afectados:
- Chatbot: `theatres.system_prompt`.
- Email: `email_connections.metadata.email_agent_settings.channel_prompt`.
- Voz: `theatres.voice_system_prompt`.

Decisión pendiente:
- Si renombramos internamente `system_prompt` del chatbot a un nombre más claro en una futura migración.
- Si añadimos versionado/auditoría de cambios de prompts por canal.
