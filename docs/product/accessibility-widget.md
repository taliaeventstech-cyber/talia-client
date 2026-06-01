# Widget de Accesibilidad

Nota inicial para explorar un producto similar a OneTap, adaptado a TALIA y pensado para una fase posterior.

## Referencia

OneTap vende un plugin de accesibilidad para WordPress con instalación rápida, widget flotante, módulos activables, perfiles preconfigurados, personalización visual, soporte multidioma, generador de declaración de accesibilidad y pricing por número de webs o agencia.

En su comunicación destacan:

- Widget personalizable con icono, colores, etiquetas e idiomas.
- Módulos de accesibilidad para texto, contraste, cursor, lectura, navegación y animaciones.
- Perfiles listos para necesidades concretas: visión reducida, ADHD, epilepsia, navegación sin distracciones, etc.
- Generador de declaración de accesibilidad.
- Enfoque comercial asociado a WCAG, EAA, EN 301 549, ADA y reducción de riesgo legal.
- Licenciamiento por web, por varios sites o por agencia.

Referencias:

- https://wponetap.com/pricing/
- https://wponetap.com/features/
- https://wponetap.com/modules/

## Oportunidad para TALIA

TALIA ya tiene un widget web y una relación natural con venues culturales. Un widget de accesibilidad podría ser una extensión del módulo Atención o un módulo propio orientado a:

- Mejorar la experiencia de visitantes en webs de teatros, museos, cines, festivales y venues.
- Ayudar a clientes a reducir fricción y riesgo normativo.
- Ofrecer una funcionalidad visible y fácil de entender durante demos.
- Diferenciar TALIA frente a chatbots genéricos.

No debe venderse como garantía de cumplimiento legal automático. El posicionamiento correcto sería "herramientas de mejora de accesibilidad y soporte a cumplimiento", no "cumplimiento certificado".

## MVP Recomendado

El primer MVP debería ser pequeño, robusto y fácil de probar dentro del widget existente.

### Funciones MVP

- Botón flotante de accesibilidad junto al widget de TALIA o integrado en el mismo launcher.
- Panel con controles básicos:
  - aumentar y reducir tamaño de texto;
  - aumentar contraste;
  - modo escala de grises;
  - resaltar enlaces;
  - pausar animaciones;
  - aumentar espaciado de líneas;
  - fuente legible;
  - reset de ajustes.
- Persistencia por navegador con `localStorage`.
- Configuración por venue:
  - activar o desactivar el módulo;
  - color principal;
  - posición del botón;
  - idioma por defecto;
  - mostrar u ocultar marca TALIA.
- Instrumentación básica:
  - aperturas del panel;
  - controles activados;
  - resets;
  - venue y página.

### No Incluir en el MVP

- Text-to-speech.
- Generador legal de declaración de accesibilidad.
- Auditoría automática WCAG.
- Promesas de compliance.
- Plugin WordPress independiente.
- Marketplace o sistema de licencias separado.

## Fase 2

Si el MVP funciona, se podría ampliar con:

- Perfiles preconfigurados:
  - visión reducida;
  - lectura cómoda;
  - foco/ADHD;
  - reducción de movimiento;
  - alto contraste.
- Text-to-speech usando APIs del navegador como primera aproximación.
- Declaración de accesibilidad editable por el cliente.
- Recomendaciones automáticas desde crawling o análisis de páginas.
- Informe mensual de uso de accesibilidad dentro de Àgora.
- Checklist de accesibilidad por venue.

## Encaje Comercial

Opciones posibles:

- Incluirlo en Professional y Enterprise como parte del widget TALIA.
- Venderlo como add-on por venue.
- Ofrecerlo como "Accessibility Pack" junto con chatbot y knowledge base.
- Usarlo como elemento de entrada para clientes que todavía no necesitan voz o email.

Pricing orientativo para explorar:

| Opción | Encaje | Precio orientativo |
| --- | --- | ---: |
| Incluido | Professional/Enterprise | 0 € extra |
| Add-on venue | Cliente que ya usa chatbot | 49-99 €/mes |
| Pack accesibilidad | Widget + setup + reporte | 149-299 €/mes |

## Riesgos

- Riesgo legal si se promete cumplimiento total.
- Riesgo técnico si el widget aplica estilos globales que rompen la web del cliente.
- Riesgo de rendimiento si se inyecta demasiado JavaScript.
- Riesgo de accesibilidad real si el propio panel no es usable con teclado y lectores de pantalla.
- Riesgo de soporte por diferencias entre webs, CMS, themes y builders.

## Criterios de Calidad

- El panel debe ser completamente usable con teclado.
- Debe tener foco visible, roles ARIA correctos y etiquetas claras.
- Los cambios visuales deben ser reversibles.
- No debe bloquear navegación ni contenido.
- Debe funcionar sin cookies y sin recopilar datos personales.
- Debe degradar bien si una función no está soportada por el navegador.
- Debe probarse en páginas reales de clientes o demos, no solo en una página interna.

## Propuesta Técnica Inicial

La vía más pragmática es implementarlo como parte del widget TALIA existente, no como producto separado.

Componentes probables:

- UI del panel en el widget.
- Estado local de preferencias.
- Aplicación de clases CSS al `document.documentElement`.
- Variables CSS para escalas de texto, contraste y espaciado.
- Configuración remota por venue.
- Eventos de analytics agregados.

Para evitar romper webs externas, cada control debe tener una implementación conservadora y una lista clara de selectores o propiedades afectadas.

## Preguntas Abiertas

- ¿Se quiere vender como módulo TALIA o como herramienta independiente?
- ¿El target inicial son webs propias de clientes culturales o también agencias?
- ¿Debe convivir con el chatbot en el mismo launcher o tener botón separado?
- ¿Queremos priorizar EAA/WCAG en Europa como argumento comercial?
- ¿Qué nivel de responsabilidad legal estamos dispuestos a asumir?
- ¿Hay clientes actuales que lo pedirían como piloto?

## Siguiente Paso

Antes de diseñar o implementar, conviene hacer una mini discovery:

1. Revisar 3-5 webs de clientes objetivo y ver problemas de accesibilidad frecuentes.
2. Comparar OneTap con 2-3 alternativas.
3. Definir si el MVP vive dentro del widget actual.
4. Escribir requirements técnicos y UX del panel.
5. Decidir cómo se comercializa sin prometer compliance total.
