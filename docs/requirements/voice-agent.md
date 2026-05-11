# Requirements: Agente de Voz

Ver también [`../../README.VOICE.md`](../../README.VOICE.md).

## Objetivo

Permitir que una venue atienda llamadas con TALIA usando voz conversacional y guardando transcript, métricas y estado operativo.

## Modelo Operativo

La voz se configura por venue.

Opciones:

- número TALIA;
- desvío desde número del cliente;
- portabilidad o routing avanzado con Twilio.

## Requirements Funcionales

- Activar/desactivar módulo voz por venue.
- Guardar Agent ID de ElevenLabs.
- Guardar Voice ID.
- Configurar tono, idioma, temperatura y prompt.
- Guardar número público del cliente.
- Guardar número operativo TALIA.
- Guardar notas de desvío.
- Guardar estado operativo: draft, provisioning, active, paused, error.
- Registrar llamadas, duración y transcript.
- Clasificar tema/intención tras llamada.

## Backstage

Debe permitir:

- configurar telefonía;
- ver IDs internos;
- revisar errores de sincronización;
- gestionar estado operativo.

## Àgora

Debe permitir:

- ver número activo;
- ver instrucciones de desvío;
- configurar tono/prompt si el rol lo permite;
- ver uso de minutos.

## Providers

### ElevenLabs

Responsable de:

- voz conversacional;
- agente;
- modelo;
- voz;
- número si se usa telefonía nativa.

### Twilio

Usar cuando haga falta:

- routing avanzado;
- portabilidad;
- países con regulación;
- horarios;
- fallback humano.
