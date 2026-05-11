# Arquitectura: Usage y Billing

## Objetivo

Medir uso real o estimado por venue, módulo y canal para:

- controlar límites;
- calcular costes;
- justificar pricing;
- mostrar consumo al cliente;
- detectar abuso o necesidad de upgrade.

## Tablas Base

### `tenant_subscriptions`

Suscripción por venue y periodo.

Contiene:

- plan;
- estado;
- periodo de facturación;
- conversaciones incluidas;
- minutos de voz incluidos;
- precios de overage;
- comportamiento de hard limit.

### `tenant_module_entitlements`

Módulos activos por venue.

Contiene:

- módulo;
- enabled;
- límites específicos;
- metadata.

### `usage_events`

Evento granular.

Ejemplos:

- conversación iniciada;
- mensaje;
- llamada al modelo;
- tool call;
- minuto de voz;
- fallback;
- límite excedido.

### `tenant_usage_daily`

Agregado diario para dashboards rápidos.

## Unidades

Chatbot:

- conversación;
- mensaje;
- tokens;
- coste estimado.

Email:

- conversación;
- email inbound/outbound;
- draft generado;
- tokens;
- coste estimado.

Voz:

- minuto;
- llamada;
- resolución;
- fallback;
- coste proveedor.

## Coste IA

Para OpenAI:

- capturar modelo;
- capturar tokens input/output;
- aplicar tabla interna de precios;
- guardar `cost_estimate_cents`.

Si el flujo pasa por n8n y no devuelve tokens, el coste será estimado por heurística hasta migrar a backend propio.

## Límites

La función de límite debe responder:

- allowed;
- current;
- limit;
- behavior.

Comportamientos:

- `notify_only`;
- `fallback`;
- `block`.

## UI

En el dashboard cliente, mostrar uso de forma sutil:

- plan actual;
- conversaciones usadas / incluidas;
- minutos usados / incluidos;
- avisos de proximidad al límite.

No mostrar coste IA estimado al cliente salvo decisión comercial explícita.

En Backstage, sí mostrar:

- coste estimado;
- usage por venue;
- módulos contratados;
- overage potencial.
