# Pricing y Límites

Este documento define la lógica de precios y límites de TALIA. Los importes pueden cambiar comercialmente, pero la arquitectura debe soportar planes, uso incluido, overages y módulos independientes.

## Planes Base

| Plan | Perfil |
| --- | --- |
| Essential | Cliente pequeño o primera implantación |
| Professional | Cliente con más volumen o varias necesidades operativas |
| Enterprise | Cliente con volumen alto, varias venues o requirements avanzados |
| Custom | Acuerdos específicos |

## Módulos

Los módulos se contratan por venue:

- Atención.
- Data.
- Marketing.

Dentro de Atención, los canales pueden tener límites separados:

- Chatbot web: conversaciones.
- Email: conversaciones o emails procesados.
- Voz: minutos.
- WhatsApp/Instagram: conversaciones o mensajes.

## Límites Recomendados

Los límites deben estar en base de datos, no hardcodeados.

Ejemplo inicial:

| Plan | Chatbot | Email | Voz |
| --- | ---: | ---: | ---: |
| Essential | 1.000 conversaciones/mes | 0-500 conversaciones/mes | 0 minutos |
| Professional | 4.000 conversaciones/mes | 500-1.500 conversaciones/mes | 60-120 minutos |
| Enterprise | 12.000 conversaciones/mes | 2.000+ conversaciones/mes | 120+ minutos |

## Coste Real vs Coste Estimado

El coste por conversación no se obtiene automáticamente de OpenAI con granularidad perfecta por conversación salvo que lo calculemos nosotros.

Arquitectura recomendada:

- Guardar tokens de entrada y salida cuando el backend propio haga la llamada al modelo.
- Guardar modelo usado.
- Calcular coste estimado con tabla interna de precios.
- Guardar `cost_estimate_cents` en `usage_events`.
- Comparar mensualmente con factura real de proveedores.

Mientras n8n gestione parte del flujo, el coste será estimado si no devuelve tokens. Cuando migremos a backend propio, el tracking será más fiable.

## Hard Limits

Soportar tres comportamientos:

- `notify_only`: avisar internamente, no bloquear.
- `fallback`: responder con mensaje de fallback y contacto humano.
- `block`: bloquear uso al superar el límite.

Para demos y primeros clientes, se recomienda `notify_only` o `fallback`, no bloqueo duro.
