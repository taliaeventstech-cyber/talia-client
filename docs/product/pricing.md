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

## Propuesta Estimada Para Cliente Institucional

Esta propuesta es preliminar. Sirve para presentar un rango profesional y defendible antes de tener datos reales de uso. No debe comunicarse como pricing validado hasta medir volumen, coste de proveedores y carga operativa durante una prueba real.

### Proceso Comercial Recomendado

Después de la primera presentación/demo, no conviene cerrar precio definitivo sin una mínima fase de discovery. El proceso recomendado es:

1. **Demo inicial**
   - Enseñar TALIA con chatbot, email agent y voice agent como visión de módulo Atención.
   - Mostrar el valor operativo: menos fricción para el visitante, respuestas más rápidas, datos de intención y trazabilidad.

2. **Confirmación de volumen**
   - Pedir datos aproximados:
     - visitas mensuales a la web;
     - conversaciones o consultas web actuales;
     - emails mensuales de atención;
     - llamadas mensuales o minutos estimados;
     - idiomas;
     - picos por campaña/temporada;
     - número de venues o áreas implicadas.

3. **Clasificación del cliente**
   - Clasificar el cliente como Bronce, Plata u Oro según volumen, complejidad y canales.
   - Esta clasificación no es solo tamaño: también mide criticidad operativa, necesidad de soporte, idiomas, integraciones y número de equipos.

4. **Propuesta con 3 opciones**
   - Presentar tres alternativas claras:
     - una opción conservadora;
     - una opción recomendada;
     - una opción completa.
   - Cada opción debe indicar:
     - canales incluidos;
     - conversaciones/emails/minutos incluidos;
     - precio mensual;
     - setup;
     - coste por uso adicional.

### Clasificación Bronce / Plata / Oro

| Nivel | Perfil | Canales recomendados | Uso incluido orientativo |
| --- | --- | --- | --- |
| Bronce | Venue con volumen bajo o piloto controlado | Chatbot | 1.000-2.000 conversaciones chatbot |
| Plata | Venue con atención digital relevante | Chatbot + email | 4.000-6.000 conversaciones chatbot + 1.000-1.500 emails |
| Oro | Institución con atención multicanal y picos altos | Chatbot + email + voz | 12.000-18.000 conversaciones chatbot + 3.000-5.000 emails + 300-600 min voz |

### Preguntas de Discovery

Para poder clasificar bien:

- ¿Cuántas visitas mensuales tiene la web?
- ¿Cuántos emails recibe atención al público al mes?
- ¿Cuántas llamadas recibe el teatro al mes?
- ¿Qué porcentaje de preguntas son repetitivas?
- ¿En qué idiomas atienden?
- ¿Hay picos por estreno, temporada, descuentos o campañas?
- ¿El cliente quiere solo web/chat o también buzón y teléfono?
- ¿Necesitan revisar respuestas antes de enviarlas?
- ¿Cuántas personas del equipo usarán TALIA?

### Pack Atención TALIA

Incluye:

- Chatbot web para la web del cliente.
- Agente de email en modo borradores supervisados.
- Agente de voz con número TALIA o desvío desde número del cliente.
- Base de conocimiento inicial.
- Dashboard Àgora.
- Analítica básica de temas e intención.
- Configuración y soporte de puesta en marcha.

| Plan | Precio mensual estimado | Chatbot web | Email agent | Voice agent | Soporte |
| --- | ---: | ---: | ---: | ---: | --- |
| Essential | 349 €/mes | 2.000 conversaciones/mes | 500 emails procesados/mes | 60 min/mes | Email |
| Professional | 699 €/mes | 6.000 conversaciones/mes | 1.500 emails procesados/mes | 180 min/mes | Prioritario |
| Enterprise | 1.399 €/mes | 18.000 conversaciones/mes | 5.000 emails procesados/mes | 600 min/mes | Prioritario + seguimiento mensual |

### Propuesta por Canales

Para evitar vender de entrada algo sobredimensionado, también se puede presentar la propuesta por número de canales:

| Opción | Canales incluidos | Precio mensual estimado | Uso incluido |
| --- | --- | ---: | --- |
| Bronce | Chatbot web | 349 €/mes | 2.000 conversaciones chatbot |
| Plata | Chatbot web + email agent | 699 €/mes | 6.000 conversaciones chatbot + 1.500 emails |
| Oro | Chatbot web + email agent + voice agent | 1.399 €/mes | 18.000 conversaciones chatbot + 5.000 emails + 600 minutos voz |

Esta estructura es más fácil de explicar comercialmente:

- **Bronce**: empezamos por web.
- **Plata**: añadimos atención por buzón.
- **Oro**: cubrimos web, email y teléfono.

### Setup Inicial

Recomendación para cliente institucional:

| Concepto | Precio estimado |
| --- | ---: |
| Setup chatbot + widget + dashboard | 750 € |
| Carga inicial de base de conocimiento | 500 € |
| Configuración agente de email | 600 € |
| Configuración agente de voz + telefonía | 900 € |
| Total setup recomendado | 2.750 € |

Para una propuesta comercial más sencilla, se puede ofrecer:

- **Setup bonificado**: 1.500 € si contratan Professional o Enterprise.
- **Piloto de 60 días**: 699 €/mes + setup reducido.

### Overages Estimados

Los overages protegen margen y evitan usos no controlados.

| Canal | Unidad extra | Precio estimado |
| --- | ---: | ---: |
| Chatbot | 1.000 conversaciones extra | 49 € |
| Email | 500 emails procesados extra | 59 € |
| Voz | 100 minutos extra | 79 € |

### Límites Operativos

Los límites no deberían cortar el servicio de golpe en una demo o primer contrato. Recomendación:

- Al 80% de uso: aviso interno TALIA.
- Al 100%: aviso interno + aviso comercial al cliente.
- Al 120%: aplicar overage o pasar a fallback según contrato.
- No bloquear chatbot ni voz en eventos críticos sin aviso previo.

### Recomendación para Cliente Institucional

Para un cliente institucional, tras una demo inicial, la recomendación inicial sería clasificarlo probablemente entre **Plata** y **Oro**, pendiente de volumen real.

Si quieren empezar de forma sólida pero controlada, la propuesta más defendible es **Plata / Professional**:

- 699 €/mes.
- 6.000 conversaciones chatbot.
- 1.500 emails procesados.
- Sin voz incluida o con bolsa piloto limitada si se quiere probar.
- Setup bonificado de 1.500 €.

Si desde el principio quieren cubrir teléfono, la propuesta debería subir a **Oro / Enterprise** o a un Professional con add-on de voz:

- 699 €/mes base Professional.
- Add-on voz: 199-349 €/mes según minutos incluidos.
- Minutos extra según overage.

Motivo: un cliente institucional puede tener volumen alto, programación recurrente, preguntas de accesibilidad, ticketing, horarios y atención multicanal. Bronce se queda corto para una propuesta seria; Oro tiene sentido si confirman volumen de llamadas o quieren atención multicanal desde el día uno.

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
