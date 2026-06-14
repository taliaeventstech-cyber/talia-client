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
