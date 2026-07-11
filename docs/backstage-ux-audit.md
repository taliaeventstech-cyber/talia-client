# Auditoría de Backstage — UI · UX · Visualización de datos

Fecha: 9 julio 2026
Alcance: panel interno **Backstage** (`src/app/backstage/**`). No cubre Agora (dashboard de cliente).
Objetivo: diagnosticar el estado actual y proponer un rediseño priorizado de interfaz, experiencia y visualización de datos.

---

## 1. Qué es hoy Backstage (estado real)

Panel interno de TALIA para el equipo de plataforma (`platform_admins`). Tres niveles de navegación:

| Nivel | Ruta | Contenido |
|-------|------|-----------|
| Home | `/backstage` | Tabla de accounts + crear account (FAB) |
| Account | `/backstage/accounts/[accountId]` | Tabs: Venues · Usuarios · Plan y módulos · Actividad |
| Venue | `/backstage/tenants/[tenantId]` | Uso del plan, salud RAG, trazabilidad de respuestas, fuentes de conocimiento, edición |
| Invitaciones | `/backstage/tenants/[tenantId]/invites` | Alta/gestión de invites por venue |

Stack visual: reutiliza el shell de autenticación (`auth-shell` / `auth-card`) con tokens de color de `globals.css`. Sin librería de gráficos activa (Recharts está en el stack pero **no se usa en Backstage**).

**Lo que ya está bien y hay que conservar:**
- La **trazabilidad RAG por respuesta** es excelente en profundidad de datos (provider pedido/usado, modelo, score, chunks, ContextAssembler, motivos de fallback). Es el activo más valioso del panel.
- Los tokens de diseño (paleta, modo día/noche) están centralizados y son coherentes.
- Acciones internas reales y útiles: reprocesar PDF, reintentar embeddings, reindexar venue.

---

## 2. Diagnóstico por capas

### 2.1 Arquitectura de UI / shell (severidad: **alta**)

1. **Backstage vive dentro de un `auth-card` centrado y limitado a `max-width: 1080px`** ([layout.tsx](../src/app/backstage/layout.tsx#L7-L9), [globals.css:350](../src/app/globals.css#L350)). Es un panel operativo metido en el chrome de una pantalla de login. Una consola de operaciones necesita ancho completo, densidad y un shell propio, no una tarjeta estrecha.
2. **No hay navegación global.** El header solo tiene "Cerrar sesión" ([layout.tsx:14-20](../src/app/backstage/layout.tsx#L14-L20)). No hay sidebar ni menú a secciones. El `CLAUDE.md` describe Backstage como "accounts/venues/config/diagnostics", pero **config y diagnostics no existen** como navegación.
3. **La pestaña "Clientes" del home es inerte** ([page.tsx:69-73](../src/app/backstage/page.tsx#L69-L73)): un `role="tablist"` con un solo tab que no lleva a ningún sitio. Aparenta navegación que no existe.
4. **Sin breadcrumbs.** El movimiento entre niveles depende de "back-links" de texto ("Volver a clientes") y de iconos. No hay rastro Backstage › Account › Venue.
5. **Terminología inconsistente en rutas y labels:** la ficha de venue vive en `/tenants/[tenantId]` y se etiqueta como "Ficha Backstage", "Editar venue" y "tenant" indistintamente. Filtra el nombre de tabla legacy `theatres`/`tenant`. El propio `CLAUDE.md` prohíbe decir "theatre" y fija "venue".

### 2.2 Visualización de datos (severidad: **alta** — es el foco del encargo)

6. **El home abre con una tabla plana, sin cabecera de salud de plataforma.** No hay KPIs agregados (nº de accounts, venues, conversaciones del periodo, coste IA total, venues cerca de límite, fuentes en error). Una consola de operaciones debería abrir con un pulso del sistema, no con una tabla de 50 filas.
7. **Todo el "uso" es texto plano.** `"123 / 500"`, `"€4,20 · 1,2k tokens"` ([page.tsx:126-127](../src/app/backstage/page.tsx#L126-L127)). Sin barras de progreso en la tabla, sin sparklines, sin color por severidad. La celda "Uso chatbot" mezcla 3 métricas apretadas y no se puede escanear en vertical.
8. **No hay dimensión temporal en ningún sitio.** Todo es agregado del periodo de facturación actual. No hay tendencia día a día, ni comparación con el periodo anterior, ni detección de picos. `tenant_usage_daily` **ya tiene granularidad diaria** y se está colapsando a un único total.
9. **Las tarjetas de salud RAG son solo números** ([tenants/page.tsx:162-183](../src/app/backstage/tenants/[tenantId]/page.tsx#L162-L183)). El `readinessPercent` (el dato más accionable) queda enterrado en un `<small>`. No hay barra de distribución listos/pendientes/error que comunique el estado de un vistazo.
10. **Recharts está disponible y sin usar.** Toda la visualización cuantitativa se está resolviendo con strings.

### 2.3 UX / flujo de trabajo (severidad: **media-alta**)

11. **Tabla de accounts sin búsqueda, orden ni filtro,** con `limit(50)` fijo y sin paginación ([page.tsx:16](../src/app/backstage/page.tsx#L16)). A 30-40 clientes ya es inmanejable encontrar uno concreto o "los que tienen RAG roto".
12. **La lista de trazas RAG es un muro de texto.** Datos excelentes, presentación densa: no se puede filtrar por "solo fallbacks" o "solo baja confianza", que es justo lo que un operador busca. Se listan las 8 últimas sin control.
13. **El botón primario de crear es un FAB flotante** y el empty-state tiene que *explicar dónde está*: "Usa el botón flotante para añadir la primera" ([accounts/page.tsx:180](../src/app/backstage/accounts/[accountId]/page.tsx#L180)). Si hay que explicar dónde está la acción principal, la acción está mal colocada.
14. **Acciones solo-icono con tooltip** en cada fila. Funciona para expertos, pero sin etiqueta visible aumenta la carga cognitiva y el riesgo de clic erróneo (p. ej. el borrar-invitación destructivo junto al resto).
15. **Estados como texto corrido:** `"2 pendientes · 3 aceptadas"` en vez de badges escaneables. El ojo no distingue rápido lo que requiere acción.
16. **Sin observabilidad del canal Email a nivel plataforma:** el email agent está en testing (drafts supervisados) pero Backstage no muestra conexiones con error ni drafts pendientes de forma agregada.

### 2.4 Consistencia y mantenibilidad (severidad: **baja**, pero fácil de saldar)

17. **Formatters duplicados** (`formatCurrency`, `formatTokens`, `formatDate`, `IconAction`) copiados en los tres `page.tsx`. Deben vivir en un módulo compartido (`src/lib/backstage/format.ts` + un `<IconAction>` compartido).
18. **Mezcla de idioma en labels** ("Account" vs "cuenta", eyebrows en inglés sobre contenido en español). El `CLAUDE.md` fija español en producto.

---

## 3. Propuesta de rediseño

### 3.1 Nuevo shell de Backstage

Sustituir el `auth-card` por un **shell de consola de ancho completo** con navegación lateral persistente:

```
┌──────────────────────────────────────────────────────────────┐
│ TALIA · Backstage          [buscar…]        admin@…  ⏻        │  ← topbar
├────────────┬─────────────────────────────────────────────────┤
│ ▸ Resumen  │  Backstage › Accounts › Teatre Lliure › RAG      │  ← breadcrumb
│ ▸ Accounts │ ┌─────────────────────────────────────────────┐ │
│ ▸ Venues   │ │                                             │ │
│ ▸ RAG      │ │            contenido de la sección          │ │
│ ▸ Email    │ │                                             │ │
│ ▸ Diagnos. │ └─────────────────────────────────────────────┘ │
└────────────┴─────────────────────────────────────────────────┘
```

- Sidebar con secciones reales: **Resumen · Accounts · Venues · RAG · Email · Diagnóstico**.
- Breadcrumb en cada nivel (elimina el patrón "back-link").
- Ancho completo (`max-width` ~1440px), densidad de consola.
- Terminología unificada a **venue** en toda la UI (rutas pueden seguir siendo `tenants` por compatibilidad, pero los labels no).

### 3.2 Nueva Home = "Resumen de plataforma"

Antes de la tabla, una **fila de KPIs + un panel de alertas + una mini-tendencia**:

```
┌── Accounts ──┐ ┌── Venues ──┐ ┌─ Conversaciones ─┐ ┌── Coste IA ──┐
│     42       │ │     67     │ │   12.480  ▲8%    │ │  €318,40 ▲12%│
│ 3 nuevos 30d │ │ 61 activas │ │  vs periodo ant. │ │ periodo actual│
└──────────────┘ └────────────┘ └──────────────────┘ └──────────────┘

┌─ Necesita atención ────────────────────────────────────────────┐
│ ● 4 venues con RAG en error      → ver                          │
│ ● 2 venues > 90% del límite      → ver                          │
│ ● 3 fuentes con embeddings stuck → ver                          │
│ ● 1 conexión email con error     → ver                          │
└────────────────────────────────────────────────────────────────┘

Conversaciones / día (periodo actual)   [▁▂▄▆█▇▅▆█▇ sparkline/area]
```

- **KPI tiles** con valor + delta vs periodo anterior (usa `tenant_usage_daily`, que ya guarda el diario).
- **Panel de alertas accionables**: la vista que un operador quiere abrir cada mañana. Cada alerta enlaza a la lista filtrada.
- **Gráfico de área de conversaciones/día** con Recharts (ya en el stack). Opcional: coste IA/día.

### 3.3 Tabla de accounts mejorada

- **Buscador** (nombre/slug/id) + **orden por columna** + **filtros rápidos** (con alertas, cerca de límite, plan).
- **Paginación** real en vez de `limit(50)` mudo.
- **Progreso de uso como mini-barra** dentro de la celda, con color por umbral (verde <70%, ámbar 70-90%, rojo >90%):
  ```
  Uso chatbot   ▓▓▓▓▓▓▓░░░  72%   123/500   €4,20
  ```
- **Estados como badges** en vez de texto corrido.
- Separar la métrica principal (conversaciones/límite) de las secundarias (coste, tokens) en columnas propias, escaneables en vertical.

### 3.4 Ficha de venue — salud RAG visual

- Convertir las 4 tarjetas numéricas en un **bloque con barra de distribución** listos / pendientes / procesando / error, con `readinessPercent` como número protagonista (no en `<small>`).
  ```
  Preparación RAG    88%   ▓▓▓▓▓▓▓▓▓░  340 listos · 30 pend · 12 error
  ```
- **Trazabilidad RAG con filtros**: chips "Todo · Con fuentes · Sin fuentes · Baja confianza · Fallback" sobre la lista actual (los datos ya se calculan en `getTraceStats`). Colapsar el detalle por defecto y permitir ver solo lo problemático.
- Mantener toda la profundidad de datos actual (es el activo estrella), solo mejorar el filtrado y la jerarquía visual.

### 3.5 Consistencia técnica

- Extraer `formatCurrency` / `formatTokens` / `formatDate` / `shortId` a `src/lib/backstage/format.ts`.
- Extraer `<IconAction>` a un componente compartido en la carpeta de Backstage.
- Considerar un `<StatTile>`, `<UsageBar>` y `<StatusBadge>` compartidos para KPIs y estados.
- Al construir cualquier gráfico, seguir la skill `dataviz` del repo (paleta y accesibilidad).

---

## 4. Plan por fases (esfuerzo → impacto)

| Fase | Alcance | Esfuerzo | Impacto |
|------|---------|----------|---------|
| **F1 — Quick wins** | Quitar tab inerte; badges de estado; barra de uso en tabla; `readinessPercent` protagonista; extraer formatters compartidos; unificar "venue" en labels. | S | Alto visible, bajo riesgo |
| **F2 — Resumen de plataforma** | Fila de KPIs con delta + panel de alertas accionables + buscador/orden/filtro en tabla de accounts. | M | Muy alto (cambia el propósito del panel) |
| **F3 — Visualización temporal** | Shell de consola con sidebar + breadcrumbs; gráfico conversaciones/día y coste/día con Recharts; comparación periodo anterior. | M-L | Alto |
| **F4 — RAG & Email ops** | Filtros en trazabilidad RAG; barra de distribución RAG; sección/observabilidad de Email a nivel plataforma; secciones Diagnóstico. | M | Alto para operación diaria |

**Recomendación:** empezar por **F1 + F2**. F1 sube la calidad percibida sin riesgo; F2 es donde Backstage deja de ser "un CRUD en tabla" y pasa a ser una consola de operaciones con la que se trabaja de verdad.

---

## 5. Preguntas abiertas antes de implementar

1. ¿Quién usa Backstage a diario y para qué tarea principal? (soporte, comercial, ops técnica → define qué va en el Resumen).
2. ¿Volumen esperado de accounts/venues a 6-12 meses? (define si la paginación/búsqueda es urgente o cosmética).
3. ¿El "coste IA estimado" es un dato interno sensible o se quiere destacar? (define su peso visual).
4. ¿Se quiere que Backstage sea responsive/móvil o es siempre escritorio? (una consola densa suele asumir escritorio).

---

*Documento de auditoría. No modifica código. Siguiente paso sugerido: validar las 4 preguntas de §5 y arrancar F1.*
