# Widget de Accesibilidad

Estado: MVP tecnico funcional con endurecimiento inicial de producto.

Objetivo: desarrollar un widget de accesibilidad ligero, independiente del chatbot de TALIA, orientado a mejorar la experiencia de usuarios finales y ayudar a clientes culturales a avanzar hacia mejores practicas de accesibilidad. No debe venderse como certificacion ni como garantia automatica de cumplimiento legal.

## Posicionamiento

El modulo se debe comunicar como:

- herramienta de mejora de accesibilidad;
- soporte operativo para reducir barreras comunes;
- modulo independiente dentro del ecosistema TALIA;
- ayuda previa o complementaria a auditorias humanas.

No se debe comunicar como:

- cumplimiento WCAG automatico;
- cumplimiento certificado;
- sustituto de auditoria legal o tecnica;
- solucion completa para EAA, ADA, EN 301 549 o normativa equivalente.

Mensaje comercial recomendado:

> TALIA Accessibility mejora la navegacion, lectura y adaptacion visual de la web mediante controles accesibles para visitantes. Ayuda a reducir friccion y a preparar mejor la web para auditorias, sin sustituir una auditoria profesional de accesibilidad.

## Referencias

OneTap vende un plugin de accesibilidad para WordPress con instalacion rapida, widget flotante, modulos activables, perfiles preconfigurados, personalizacion visual, soporte multidioma, generador de declaracion de accesibilidad y pricing por numero de webs o agencia.

Referencias de producto:

- https://wponetap.com/pricing/
- https://wponetap.com/features/
- https://wponetap.com/modules/

Referencias normativas y tecnicas:

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- European Accessibility Act, Directive (EU) 2019/882: https://eur-lex.europa.eu/eli/dir/2019/882/oj

## Encaje en TALIA

El modulo debe vivir dentro del ecosistema TALIA, pero separado del chatbot:

- se distribuye desde `public/accessibility-widget.js`;
- no se mezcla con el launcher conversacional del chatbot;
- puede reutilizar tenant/configuracion/branding de TALIA;
- se configura desde `widget_config.accessibility` o desde una tabla/configuracion dedicada si el producto crece;
- se activa por tenant/venue;
- convive con el chatbot web;
- se prueba inicialmente en paginas demo como `public/olympia.html`.

No se plantea como plugin WordPress independiente en el MVP.

Decision de producto: el chatbot y el widget de accesibilidad deben ser widgets distintos. El usuario final no debe interpretar que un chatbot es una herramienta de accesibilidad ni que los ajustes visuales forman parte de una conversacion. Pueden compartir branding, posicionamiento y configuracion, pero deben tener botones, labels y estados separados.

## MVP

El MVP debe ser pequeno, reversible y seguro en webs externas.

### Funciones

- Boton flotante propio de accesibilidad, independiente del launcher del chatbot.
- Panel accesible con controles:
  - aumentar texto;
  - reducir texto;
  - alto contraste;
  - escala de grises;
  - resaltar enlaces;
  - pausar animaciones;
  - aumentar espaciado;
  - fuente legible;
  - reset.
- Persistencia local por navegador con `localStorage`.
- Soporte inicial en castellano, catalan e ingles.
- Navegacion completa con teclado.
- Foco visible.
- Etiquetas ARIA claras.
- Sin cookies.
- Sin recopilacion de datos personales.

### Fuera del MVP

- Text-to-speech.
- Auditoria automatica WCAG.
- Generador legal de declaracion de accesibilidad.
- Crawling de paginas.
- Certificado de cumplimiento.
- Plugin WordPress.
- Panel de reporting avanzado.

## Clear View

Clear View es una lectura simplificada de la pagina publica dentro del widget.
Esta pensada para reducir carga cognitiva y ordenar informacion util, no para
certificar accesibilidad.

Implementado:

- Extraccion local de titulo, resumen, acciones y secciones visibles.
- Endpoint `POST /api/accessibility/clear-view`.
- Generacion con IA cuando `OPENAI_API_KEY` esta disponible.
- Fallback local si la IA no esta configurada o falla.
- Schema estricto para la respuesta.
- Sanitizado de acciones para impedir que la IA invente enlaces nuevos.
- Cache por pagina en `sessionStorage`.
- Activacion separada con `widget_config.accessibility.clearViewEnabled`.
- Rate limit basico por tenant e IP.
- Corte de payload excesivo antes de llamar al proveedor IA.

## Modo neurodivergente / baja estimulacion

Modo visual reversible dentro del widget. No sustituye a Clear View: Clear View
reordena la lectura dentro del panel, mientras que baja estimulacion adapta la
web actual sin salir de la pagina.

Implementado:

- Pausa animaciones y transiciones.
- Reduce saturacion/contraste de imagenes y medios.
- Elimina fondos intensos, gradientes, sombras y efectos de urgencia visual.
- Suaviza badges, alertas, contadores y elementos llamativos.
- Hace mas lineales los layouts tipo grid, carrusel o slider cuando el usuario lo activa.
- Mantiene excluidos los roots de TALIA para no romper el chatbot ni el propio widget.

## Orientacion de lectura

Modos reversibles para reducir distraccion durante la lectura sin modificar el DOM
de la pagina. Pueden usarse por separado o juntos.

Implementado:

- Mascara de lectura: oscurece arriba y abajo, dejando una banda central.
- Linea de lectura: linea fina que sigue el raton o foco.
- Reposicionamiento por foco de teclado, scroll y resize.
- Ligero ajuste de interlineado mientras la mascara esta activa.
- Persistencia en `localStorage` con el resto de ajustes.

## Resaltar contenido

Modo reversible para orientar al usuario sobre el bloque actual sin alterar la
estructura de la web.

Implementado:

- Detecta el bloque semantico bajo raton o foco de teclado.
- Prioriza contenedores como `section`, `article`, `form`, `li`, `p`, cards e items.
- Dibuja un overlay en Shadow DOM con borde y fondo suave.
- Reposiciona el overlay con `requestAnimationFrame`, scroll y resize.
- Excluye los roots de TALIA para no resaltar el widget ni el chatbot.

Reglas:

- Si `accessibility.enabled !== true`, el widget no se monta.
- Si `clearViewEnabled === false`, el boton de Clear View no aparece.
- El endpoint tambien bloquea Clear View cuando el tenant lo tiene desactivado.
- Clear View debe mantener copy prudente: ayuda de lectura, no cumplimiento legal.

## UX

### Launcher

Opciones consideradas:

1. Boton separado de accesibilidad.
2. Acceso dentro del panel del chatbot.
3. Launcher combinado con dos acciones.

Decision: boton separado, pequeno, cercano al launcher del chatbot cuando ambos esten instalados. Es mas claro para usuarios finales y evita mezclar conversacion con ajustes visuales.

Cuando conviva con el chatbot:

- el boton de accesibilidad debe quedar ligeramente por encima del boton del chatbot;
- ambos botones deben tener labels ARIA distintos;
- el panel de accesibilidad no debe abrir ni cerrar el chatbot;
- el chatbot no debe contener controles de accesibilidad en el MVP.

### Panel

El panel debe:

- abrirse como modal flotante no bloqueante;
- tener titulo claro: `Accesibilidad`;
- tener boton de cierre;
- tener controles grandes y escaneables;
- mostrar estado activo de cada control;
- incluir un boton `Restablecer`;
- no tapar el contenido principal mas de lo necesario.

### Copy inicial

Castellano:

- Titulo: `Accesibilidad`
- Descripcion: `Ajusta la lectura y visualizacion de esta web.`
- Reset: `Restablecer`

Catalan:

- Titulo: `Accessibilitat`
- Descripcion: `Ajusta la lectura i visualitzacio d'aquest web.`
- Reset: `Restableix`

Ingles:

- Title: `Accessibility`
- Description: `Adjust reading and visual display for this website.`
- Reset: `Reset`

## Configuracion

Propuesta de `widget_config`:

```json
{
  "accessibility": {
    "enabled": true,
    "position": "bottom-right",
    "language": "auto",
    "primaryColor": "#00e0c7",
    "highlightColor": "#fffb00",
    "showBranding": true,
    "controls": {
      "textSize": true,
      "contrast": true,
      "grayscale": true,
      "highlightLinks": true,
      "pauseAnimations": true,
      "lineSpacing": true,
      "readableFont": true,
      "lowStimulation": true,
      "readingMask": true,
      "readingLine": true,
      "highlightContent": true
    }
  }
}
```

Reglas:

- Si `accessibility.enabled !== true`, no se monta el modulo.
- Si no hay configuracion remota, el modulo no debe aparecer salvo que el script tenga atributo explicito.
- El idioma `auto` debe tomar `document.documentElement.lang`, con fallback a castellano.

## API de embed

Instalacion estable. Los cambios hechos en Agora se reflejan al recargar la web
publica porque el script consulta `/api/widget/{tenantId}`.

```html
<script
  src="https://agora.talia.events/accessibility-widget.js"
  data-tenant="TENANT_ID">
</script>
```

Si una web usa tambien el chatbot:

```html
<script
  src="https://agora.talia.events/widget.js"
  data-tenant="TENANT_ID">
</script>

<script
  src="https://agora.talia.events/accessibility-widget.js"
  data-tenant="TENANT_ID">
</script>
```

Prioridad:

1. Configuracion remota del tenant.
2. Atributos del script solo como override avanzado o fallback manual.
3. Defaults seguros.

## Arquitectura tecnica

El chatbot actual usa Shadow DOM en `public/widget.js`. El widget de accesibilidad debe tener su propio Shadow DOM en `public/accessibility-widget.js`. Los ajustes de accesibilidad deben afectar a la pagina host, por tanto no pueden quedarse solo dentro del Shadow DOM.

Estrategia:

- montar la UI del panel en un root independiente: `talia-accessibility-root`;
- aplicar estado visual al documento host mediante clases en `document.documentElement`;
- inyectar una hoja de estilos global con `id="talia-accessibility-styles"`;
- limitar los estilos a clases prefijadas `talia-a11y-*`;
- guardar preferencias en `localStorage`.

Clases propuestas:

```txt
talia-a11y-text-lg
talia-a11y-text-xl
talia-a11y-contrast
talia-a11y-grayscale
talia-a11y-highlight-links
talia-a11y-pause-animations
talia-a11y-line-spacing
talia-a11y-readable-font
```

Persistencia:

```txt
localStorage key: talia-a11y-{tenantId}
```

Ejemplo de estado:

```json
{
  "textScale": 1,
  "contrast": true,
  "grayscale": false,
  "highlightLinks": true,
  "pauseAnimations": false,
  "lineSpacing": false,
  "readableFont": false,
  "lowStimulation": false,
  "readingMask": false,
  "readingLine": false,
  "highlightContent": false
}
```

## Implementacion de controles

### Texto

Debe usar un enfoque conservador:

- no tocar elementos dentro del widget TALIA;
- aplicar `font-size` relativo a elementos comunes;
- maximo dos pasos de aumento;
- permitir volver atras.

### Contraste

Debe priorizar legibilidad:

- fondo claro/oscuro consistente;
- texto con contraste alto;
- evitar romper imagenes y logos.

### Escala de grises

Aplicar:

```css
filter: grayscale(1);
```

con cuidado de excluir el panel TALIA para mantener controles claros.

### Resaltar enlaces

Aplicar:

- subrayado visible;
- outline o fondo suave;
- sin cambiar layout de forma agresiva.

### Pausar animaciones

Aplicar:

```css
animation-duration: 0.001ms !important;
animation-iteration-count: 1 !important;
transition-duration: 0.001ms !important;
scroll-behavior: auto !important;
```

### Espaciado

Aumentar:

- `line-height`;
- `letter-spacing` solo si no rompe demasiado;
- separacion entre parrafos.

### Fuente legible

Aplicar stack del sistema:

```css
font-family: Arial, Helvetica, system-ui, sans-serif;
```

## Accesibilidad del propio panel

Requisitos:

- boton launcher con `aria-label`;
- `aria-expanded`;
- panel con `role="dialog"` o region etiquetada;
- titulo asociado mediante `aria-labelledby`;
- cierre con Escape;
- foco inicial en el panel o primer control;
- foco visible;
- controles como botones reales;
- estados con `aria-pressed`;
- no depender solo de color.

## Seguridad y privacidad

El modulo MVP:

- no envia datos personales;
- no lee contenido sensible;
- no usa cookies;
- no hace fingerprinting;
- no envia eventos hasta que exista base legal y configuracion clara.

Si se instrumenta analytics mas adelante, deben ser eventos agregados:

- panel abierto;
- control activado/desactivado;
- reset;
- tenant;
- pagina normalizada sin query params sensibles.

## Riesgos

- Romper estilos de la web cliente.
- Crear falsa sensacion de cumplimiento.
- Hacer que el propio panel sea inaccesible.
- Afectar rendimiento por CSS global excesivo.
- Conflictos con themes, builders y plugins externos.

Mitigaciones:

- estilos prefijados;
- controles reversibles;
- pruebas en paginas reales;
- copy legal prudente;
- no prometer certificacion;
- activar por tenant, no globalmente.

## Criterios de aceptacion MVP

- El modulo solo aparece cuando esta activado.
- El panel abre/cierra con raton y teclado.
- Escape cierra el panel.
- Los controles tienen estado visible y `aria-pressed`.
- Los ajustes persisten al recargar.
- Reset elimina clases y preferencias.
- El chatbot sigue funcionando.
- No se rompe `public/olympia.html`.
- No hay errores en consola al cargar sin configuracion.
- El modulo no bloquea el contenido principal.

## Plan de Desarrollo

### Fase 1: prototipo en `public/accessibility-widget.js` - completada

- Crear archivo separado `public/accessibility-widget.js`.
- Crear configuracion local por atributos del script.
- Crear launcher y panel dentro del Shadow DOM.
- Inyectar CSS global prefijado.
- Implementar estado local.
- Implementar controles MVP.
- Probar en `public/olympia.html` junto al chatbot sin interferencias.

### Fase 2: configuracion desde TALIA - completada

- Ampliar `widget_config`.
- Exponer activacion en settings/backstage.
- Mostrar preview en configuracion del widget.
- Guardar idioma y color.

### Fase 3: producto - en curso

- Endurecer Clear View con proteccion de coste.
- Cubrir contrato y sanitizado con tests.
- Definir pricing/add-on.
- Documentar limites legales.
- Crear checklist comercial.
- Preparar demo para venues culturales.

### Fase 4: reporting opcional

- Eventos agregados.
- Dashboard basico de uso.
- Informe mensual.

## Preguntas Abiertas

- Se vendera como add-on o incluido en planes superiores?
- Que separacion visual exacta debe tener respecto al boton del chatbot?
- Debemos permitir marca blanca desde el primer MVP?
- Que clientes usaremos como piloto?
- Activamos analytics desde el inicio o lo dejamos fuera?
- Se necesitara declaracion de accesibilidad editable mas adelante?

## Decision Recomendada

Mantener el modulo como producto independiente del chatbot y pasar a piloto
controlado con venues culturales. Antes de venta amplia, cerrar pricing,
politica de limites de IA y pruebas visuales en webs reales.

---

# Auditoria de Accesibilidad y Cumplimiento (julio 2026)

Auditoria del modulo tal como esta implementado en `public/accessibility-widget.js`
(1.451 lineas), el backend de Clear View (`src/lib/accessibility/*`) y su encaje
normativo, con OneTap (https://wponetap.com/modules/) como referencia de mercado.

El foco de esta auditoria es doble:

1. Si el modulo **sirve de verdad a los usuarios finales con dificultades** (los que
   deberian beneficiarse), por perfil.
2. Si el **propio widget** cumple WCAG 2.2 AA (una herramienta de accesibilidad
   inaccesible falla a su propio publico).

## 1. Realidad normativa (leer antes de vender)

Normativa relevante para venues culturales (muchos son entidades publicas/municipales):

- **WCAG 2.2 AA** (W3C, oct 2023): estandar tecnico de referencia.
- **EAA - European Accessibility Act**, Directiva (UE) 2019/882, aplicable desde el
  **28 jun 2025** a productos/servicios a consumidores. Se apoya en **EN 301 549**
  (que referencia WCAG 2.1 AA).
- **Directiva (UE) 2016/2102** (sector publico web): exige conformidad EN 301 549 **y**
  publicar una **declaracion de accesibilidad** con mecanismo de feedback. Aplica a
  teatros municipales/publicos.
- **ADA** (EEUU, Titulo III) y **Section 508**: referencian WCAG 2.x AA.

**Verdad central, no negociable:** ningun widget/overlay "hace cumplir" la normativa.
La conformidad WCAG depende del HTML/ARIA/semantica de la propia web, no de una barra
superpuesta. El consenso experto (overlayfalseclaims.com, +900 firmantes) y las demandas
contra overlays tipo accessiBe/UserWay lo confirman. **Vender el widget como "cumplimiento
automatico" expone legalmente a TALIA y a sus clientes.** El posicionamiento actual de este
documento (secciones "Posicionamiento" y "Riesgos") es correcto y debe mantenerse.

Conclusion sobre "cumplir todas las normativas posibles": no es alcanzable con un widget.
Lo alcanzable y lo que TALIA debe perseguir es:

1. Que el **propio widget** sea WCAG 2.2 AA conforme.
2. Que **ayude de verdad** a los perfiles que un overlay si puede ayudar (ver §2).
3. Ofrecer un **generador de declaracion de accesibilidad** editable (artefacto que la
   Directiva 2016/2102 exige al sector publico) como ayuda real de cumplimiento, sin
   prometer conformidad.
4. Copy prudente y guia de remediacion del sitio host.

## 2. Eficacia real por perfil de usuario final

Leyenda: ✅ bien servido · 🟡 parcial · ❌ no servido / no puede

| Perfil | Estado | Detalle |
|--------|:------:|---------|
| **Dislexia / dificultad lectora** | ✅ | Fuente legible, mas espaciado (line-height 1.75 + letter-spacing, alineado a WCAG 1.4.12), **mascara y linea de lectura**, y Clear View. Es de los perfiles mejor servidos. Falta fuente especifica de dislexia (OpenDyslexic). |
| **TDAH / atencion** | ✅ | **Baja estimulacion** (quita animaciones, gradientes, urgencia, lineariza layout), pausar animaciones, mascara/linea de lectura, Clear View. Buen encaje real. |
| **Neurodivergencia / sensibilidad sensorial** | 🟡 | Baja estimulacion y pausar animaciones ayudan. Falta **silenciar sonidos** (autoplay) y **ocultar imagenes**. |
| **Personas mayores** | ✅ | Combinacion texto + contraste + fuente legible + espaciado. Targets grandes (>=54px) facilitan el uso. |
| **Baja vision** | 🟡 | Alto contraste y fuente legible ayudan. **Debilidad clave: el texto solo escala a 125% (2 pasos)**; WCAG 1.4.4 pide 200%. Falta lupa/magnificador y cursor grande. |
| **Daltonismo** | 🟡 | Escala de grises y "resaltar enlaces" (subrayado + outline, no depende del color, WCAG 1.4.1). Sin filtros especificos por tipo. |
| **Epilepsia / fotosensibilidad** | 🟡 | Pausar animaciones + baja estimulacion (reduce saturacion de medios) mitigan, pero no hay un "modo seguro" de un clic que detenga parpadeos/GIF/video. WCAG 2.3.1 depende del sitio. |
| **Motor / solo teclado / temblor** | 🟡 | Panel operable por teclado y targets grandes (supera WCAG 2.5.8). Pero (a) el widget **no** aporta navegacion por teclado al sitio host, y (b) hay un bug de foco (Hallazgo 1). |
| **Ceguera / lector de pantalla** | ❌ | Un overlay **no puede** mejorar la semantica del sitio host; estos usuarios se benefician del HTML/ARIA propio, no de la barra. No debe comunicarse como solucion para ceguera. TALIA hace bien en **no** inyectar un lector alternativo (los overlays que lo hacen interfieren con la tecnologia asistiva del usuario). |
| **Baja alfabetizacion / audio** | ❌ | **Sin text-to-speech.** Es una de las ayudas de mayor valor para el publico objetivo y hoy esta fuera del MVP. |

Lectura: el widget sirve **bien** a dislexia, TDAH, neurodivergencia y mayores; **parcialmente**
a baja vision, daltonismo, epilepsia y motor; y **no puede** servir a lectores de pantalla
(ni debe pretenderlo). Las dos carencias de mayor impacto para el publico objetivo son el
**escalado de texto limitado (125%)** y la **ausencia de text-to-speech**.

## 3. Hallazgos WCAG 2.2 del propio widget

### Lo que ya cumple (creditar)

- `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`, `tabindex="-1"`.
- **Trampa de foco** correcta (usa `shadowRoot.activeElement`), cierre con **Escape** y
  **retorno de foco** al lanzador.
- `aria-expanded` en el lanzador, `aria-pressed` en controles, tabs con `role="tab"` +
  navegacion por flechas + Home/End.
- Foco visible reforzado (`:focus-visible` con doble outline).
- Botones reales, no divs clicables.
- **Targets grandes**: controles >=54px, lanzador 56px (supera WCAG 2.5.8 AA de 24px).
- **Contraste calculado**: `getReadableTextColor`/luminancia relativa para el color de marca.
- Regiones vivas (`aria-live`) para nivel de texto y para Clear View (`aria-busy`).
- Aislamiento por Shadow DOM y exclusion de los roots de TALIA.
- Sin cookies, sin PII, sin fingerprinting; `localStorage` local (favorable a GDPR).

### Hallazgos a corregir

| # | Sev. | Hallazgo | WCAG | Fix propuesto |
|---|------|----------|------|---------------|
| 1 | **Alta** | Con el panel cerrado, sus controles siguen siendo **focusables** (solo `opacity:0` + `pointer-events:none` + `aria-hidden`, sin `display/visibility/inert`). Un usuario de teclado/lector tabula dentro de controles invisibles. | 1.3.1, 2.4.3, 4.1.2 | `panel.inert = true` al cerrar y `false` al abrir (o `visibility:hidden`). |
| 2 | Media | El widget no respeta `prefers-reduced-motion` en **sus propias** animaciones (panel/lanzador). Ironico para el publico vestibular/epilepsia. | 2.3.3 | `@media (prefers-reduced-motion: reduce)` que anule transiciones. |
| 3 | Media | Escalado de texto tope 125% (2 pasos). Insuficiente para baja vision. | 1.4.4 | Ampliar a 150-200% (3-4 pasos). |
| 4 | Media | Sin **text-to-speech**. Alto valor para el publico objetivo. | — (mejora) | Anadir lectura en voz (Web Speech API o proveedor). |
| 5 | Media | Sin **fuente para dislexia** real (solo Arial). | — (mejora) | Anadir toggle OpenDyslexic/fuente especifica. |
| 6 | Baja | Etiqueta de pestana "IA" poco clara para usuarios con dificultad cognitiva; Clear View poco descubrible. | 3.2.4 | Renombrar a "Lectura facil"/"Vista clara" y subir su visibilidad. |
| 7 | Baja | Preferencias por-tenant/por-navegador en `localStorage`: el usuario debe reconfigurar en cada venue. | — (UX) | Valorar clave compartida por dominio del script. |
| 8 | Baja | Sin atajo de teclado para abrir (paridad OneTap Alt+.). | 2.1.4 si se anade | Atajo configurable con posibilidad de desactivar. |
| 9 | Info | El widget no mejora la semantica del host: los lectores de pantalla no se benefician. | — | Documentar el limite; no comunicar como solucion para ceguera. |
| 10 | Media (priv.) | Clear View envia contenido de la pagina a OpenAI cuando esta configurado (cap 12k chars, rate limit, sin invencion de enlaces). Es una relacion con subprocesador US. | GDPR | Reflejar en DPA y en la declaracion de accesibilidad/privacidad. |

## 4. Comparativa de modulos vs OneTap

Leyenda: ✅ presente · 🟡 parcial · ❌ ausente

| Modulo OneTap | TALIA | Nota |
|---------------|:-----:|------|
| Text Size | 🟡 | Solo 125% (Hallazgo 3) |
| Line Height / Spacing | ✅ | `lineSpacing` combina interlineado + espaciado |
| Readable Font | ✅ | Arial/system |
| Dyslexic Font | ❌ | Hallazgo 5 |
| Letter Spacing (aparte) | 🟡 | Incluido en `lineSpacing`, no separado |
| Font Weight / Align Text | ❌ | — |
| Highlight Links | ✅ | Subrayado + outline |
| Big Cursor | ❌ | Util baja vision/motor |
| Text Magnifier | ❌ | Util baja vision |
| High/Dark/Light Contrast | 🟡 | Solo un alto contraste (negro/blanco) |
| Monochrome / Grayscale | ✅ | `grayscale` |
| Saturation | 🟡 | Solo dentro de baja estimulacion |
| Reading Line / Reading Mask | ✅ | Puntos fuertes propios |
| Keyboard Navigation (host) | ❌ | Un overlay no puede garantizarlo |
| Highlight Titles | 🟡 | Hay `highlightContent`, no titulos aparte |
| Highlight Content | ✅ | Overlay semantico propio |
| Text-to-Speech | ❌ | Hallazgo 4 |
| Mute Sounds | ❌ | Util neurodivergencia |
| Hide Images | ❌ | Util TDAH/cognitivo |
| Stop Animations | ✅ | `pauseAnimations` |
| Perfiles (Vision/Seizure/ADHD/Epilepsy/Blind) | ❌ | TALIA usa toggles sueltos; sin perfiles de 1 clic |
| Baja estimulacion / neurodivergente | ✅⭐ | Diferenciador propio, OneTap no lo tiene igual |
| Clear View (lectura IA) | ✅⭐ | Diferenciador propio |
| +40 idiomas | 🟡 | Solo es/ca/en |
| Generador de declaracion | ❌ | Recomendado por §1 punto 3 |
| Atajo de teclado | ❌ | Hallazgo 8 |
| Sin recopilacion de datos | ✅ | Correcto |

## 5. Roadmap priorizado (cumplimiento + eficacia)

**Bloque 1 - conformidad del propio widget (obligatorio antes de vender) — APLICADO (jul 2026):**

1. Hallazgo 1 (`inert` al cerrar) — hecho: `panel.inert` se activa al cerrar y se
   desactiva al abrir; el panel arranca con atributo `inert`.
2. Hallazgo 2 (`prefers-reduced-motion`) — hecho: media query que anula transiciones
   del lanzador, panel y Clear View.
3. Hallazgo 3 (escalado a 200%) — hecho: 4 pasos (125/150/175/200%) con clases
   `talia-a11y-text-1..4` y etiqueta de nivel en porcentaje.

**Bloque 2 - eficacia para el publico objetivo (alto valor):**

4. Text-to-speech (Hallazgo 4).
5. Fuente de dislexia (Hallazgo 5).
6. Perfiles de 1 clic (dislexia, TDAH, baja vision, seguro para epilepsia) agrupando
   toggles existentes; mejora la usabilidad para quien no sabe que ajuste necesita.

**Bloque 3 - paridad y cumplimiento comercial:**

7. Silenciar sonidos, ocultar imagenes, cursor grande, magnificador.
8. Generador de declaracion de accesibilidad editable (§1 punto 3).
9. Reflejar Clear View/OpenAI en DPA y politica (Hallazgo 10).
10. Copy y checklist comercial que separen "ayuda" de "cumplimiento".

**No hacer:** perfiles que simulen un lector de pantalla o prometan conformidad
automatica. Es contraproducente para usuarios de tecnologia asistiva y legalmente arriesgado.
