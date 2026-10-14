# Gestión y tratamiento de datos en TALIA

> Dosier tecnológico para diligencia de inversores

| Campo | Valor |
| --- | --- |
| Versión | 14 de octubre de 2026 |
| Audiencia | CEO, equipo técnico y business angels |
| Ámbito | Plataforma, canales, IA, seguridad, retención y derechos |

> [!IMPORTANT]
> Documento de preparación y diligencia. No sustituye asesoramiento jurídico ni una auditoría independiente.

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Roles y gobierno](#2-roles-y-gobierno)
3. [Inventario de datos](#3-inventario-de-datos)
4. [Ciclo de vida y flujo](#4-ciclo-de-vida-y-flujo)
5. [Seguridad y aislamiento](#5-seguridad-y-aislamiento)
6. [IA, proveedores y transferencias](#6-ia-proveedores-y-transferencias)
7. [Conservación, borrado y derechos](#7-conservación-borrado-y-derechos)
8. [Incidentes y continuidad](#8-incidentes-y-continuidad)
9. [Preguntas de inversores y respuestas](#9-preguntas-de-inversores-y-respuestas)
10. [Preguntas difíciles y límites](#10-preguntas-difíciles-y-límites)
11. [Hoja de cierre de diligencia](#11-hoja-de-cierre-de-diligencia)
12. [Hoja de defensa oral](#12-hoja-de-defensa-oral)
13. [Fuentes y notas](#13-fuentes-y-notas)

## 1. Resumen ejecutivo

TALIA trata datos para prestar asistentes y flujos supervisados a organizaciones culturales. El principio rector es reducir el contenido procesado, mantenerlo dentro del ámbito correcto de cliente y sede, limitar quién puede acceder y eliminarlo con plazos definidos.

### Mensaje de 30 segundos

> El cliente controla los datos de sus visitantes y TALIA los procesa para prestar el servicio. Separamos cada tenant y canal, ciframos credenciales sensibles, no vendemos datos ni autorizamos su uso para entrenar modelos generalistas, aplicamos retención limitada y mantenemos supervisión humana en los flujos sensibles. Somos transparentes con lo que ya está implantado y con las evidencias que aún debemos cerrar antes de escalar.

### Principios de diseño

- **Minimización:** solo se envía a cada servicio el contexto necesario para responder, clasificar o redactar.
- **Aislamiento:** cuentas, sedes, membresías, conocimiento y conversaciones se resuelven con ámbito de tenant.
- **Identidades separadas por canal:** no se fusiona automáticamente una persona de Web, WhatsApp, Instagram o Email.
- **Acceso restringido:** las credenciales y las tablas de email viven en el backend; el soporte privilegiado es auditable.
- **Supervisión humana:** Email crea borradores, no envía; los canales tienen handoff y fallback.
- **Conservación limitada:** 90 días para contenido conversacional y de email; hasta 12 meses para uso y auditoría sin identificadores conversacionales cuando corresponda.
- **Transparencia:** el asistente se identifica como IA y enlaza a la información de privacidad del cliente.

### Lectura honesta del estado

| Nivel | Qué significa | Ejemplos |
| --- | --- | --- |
| **Implantado** | Control descrito y respaldado por diseño, código, pruebas o migraciones del repositorio. | Ámbito de tenant; cifrado de tokens; webhooks firmados; no autoenvío de email. |
| **Política** | Compromiso contractual u operativo documentado que debe mantenerse alineado con producción. | DPA; privacidad; lista de subencargados; prohibición de entrenamiento generalista. |
| **Parcial** | Existe el control base, pero falta evidencia de despliegue, ejercicio o cobertura completa. | Retención multicanal; restauración; acceso humano a Gmail; prueba integral de revocación. |
| **Pendiente** | No debe presentarse como certificación o garantía hasta cerrar el hito. | Validación externa CASA; región exacta por proveedor; ejercicio de restore y tabletop. |

> [!WARNING]
> **Regla para el foro:** no afirmar ISO 27001, SOC 2, residencia íntegra en la UE, validación CASA completada ni recuperación probada si no existe evidencia vigente. La formulación correcta es: control implantado, evidencia disponible y siguiente hito fechado.

## 2. Roles y gobierno

El rol legal cambia según el propósito. Esta separación evita presentar a TALIA como dueño de todos los datos o trasladar indebidamente al cliente obligaciones que corresponden a TALIA.

| Tratamiento | Rol habitual del cliente | Rol habitual de TALIA | Responsabilidad práctica |
| --- | --- | --- | --- |
| Chat, email, conocimiento y workflows del cliente | Responsable | Encargada | El cliente define finalidad, base jurídica y avisos. TALIA sigue instrucciones documentadas y presta el servicio. |
| Usuarios de Agora, administración de cuenta y soporte | Interesado o cliente contractual | Responsable independiente | TALIA gestiona autenticación, cuenta, comunicaciones y operación. |
| Facturación, obligaciones fiscales y defensa jurídica | Cliente | Responsable independiente | TALIA conserva lo exigido por ley y los proveedores de pago procesan el cobro. |
| Seguridad, prevención de abuso y registros operativos | Cliente y TALIA según el dato | Responsable independiente o encargada según contexto | Minimización, controles de acceso, trazabilidad e investigación proporcional. |

### Instrumentos de gobierno

- DPA incorporable al contrato: instrucciones, confidencialidad, asistencia, devolución o supresión, auditoría proporcionada y transferencias.
- Política de privacidad: datos de cuenta, canales, email, IA, proveedores, retención, derechos y contactos.
- Lista de subencargados: proveedor, finalidad y región esperada.
- Avisos regionales: anexos para Brasil y México, además del marco europeo.
- Modelos operativos: autorización, retención, incidentes, vulnerabilidades, continuidad y contratos entre canales.

### Responsabilidades del cliente

- Aportar una base jurídica válida, avisos adecuados y una URL de privacidad visible en el chatbot.
- No introducir datos sensibles innecesarios ni usar TALIA para decisiones prohibidas, discriminatorias o críticas.
- Administrar sus usuarios, permisos, fuentes de conocimiento y solicitudes de derechos.
- Revisar borradores y respuestas cuando el canal o el caso requiera supervisión.

### Contacto de privacidad

Solicitudes relativas a TALIA: `legal@talia.events`.

Las solicitudes sobre contenido de visitantes deben coordinarse con la entidad cultural responsable.

## 3. Inventario de datos

El inventario siguiente resume qué entra en la plataforma, para qué se usa y qué no debería recogerse. Es una herramienta de diligencia, no un registro de actividades definitivo.

| Categoría | Datos | Finalidad | Conservación o control |
| --- | --- | --- | --- |
| Cuenta y acceso | Nombre, email, organización, rol, membresías, sesión y preferencias. | Autenticación, autorización, administración y soporte. | Mientras la cuenta esté activa y el tiempo necesario para obligaciones legales. |
| Web Agent | Mensajes, respuesta, sesión técnica, timestamps, intención, feedback, fuentes y trazas acotadas. | Responder, supervisar calidad, investigar y medir uso. | Contenido: 90 días desde última actividad. Uso desidentificado: hasta 12 meses. |
| Knowledge | FAQ, documentos, CSV, páginas autorizadas, eventos, chunks y metadatos de sincronización. | Grounding y respuestas verificables por sede. | Hasta sustitución, baja de fuente o terminación, sujeto al contrato y borrado. |
| Email | Cuenta conectada, metadatos, mensajes sincronizados, borradores, estado de sync y tokens OAuth cifrados. | Clasificar y crear borradores supervisados. | Contenido y borradores: hasta 90 días. Tokens: hasta desconexión, revocación o baja. |
| WhatsApp e Instagram | Identificador local del canal, mensajes, estado, handoff y metadatos operativos. | Atención conversacional y escalado a humano. | Política: 90 días. La automatización completa por canal debe cerrarse antes de escalar. |
| Uso e IA | Unidades, modelo, tokens, precios internos, latencia y resultado operativo. | Facturación, capacidad, calidad y coste. | Hasta 12 meses; sin texto del visitante ni identificadores crudos en eventos operativos. |
| Facturación | Datos de cliente y referencias de Stripe, suscripción, checkout, factura e historial. | Cobro, contabilidad y soporte contractual. | Plazo fiscal y contable aplicable. TALIA no guarda números completos de tarjeta. |
| Seguridad y auditoría | IP o digest, dispositivo, accesos, eventos, errores y acciones privilegiadas. | Prevención de abuso, investigación y trazabilidad. | Hasta 12 meses, salvo necesidad justificada por incidente u obligación legal. |

> [!CAUTION]
> **Datos que no se buscan:** TALIA no está diseñada para recibir categorías especiales o datos sensibles. El contrato exige no enviarlos sin acuerdo y salvaguardas específicos. Esto es una limitación de uso, no una afirmación de que un visitante nunca pueda escribirlos espontáneamente.

### Qué no se conserva por diseño

- Los payloads crudos de webhooks de WhatsApp e Instagram no se persisten como registro operativo.
- Los eventos operativos compartidos no deben contener texto del visitante ni identificadores personales crudos.
- Los tokens OAuth no se envían a `talia-ai` ni al proveedor de IA.
- Los adjuntos de Gmail no forman parte del flujo actual salvo que se habilite una función específica.

## 4. Ciclo de vida y flujo

La frontera principal está en el backend de TALIA. El navegador o el canal no habla directamente con el runtime de IA; la aplicación valida identidad, tenant, límites y configuración antes de preparar una solicitud acotada.

| Paso | Qué ocurre | Control defendible |
| --- | --- | --- |
| 1. Entrada | Un visitante escribe en Web, WhatsApp o Instagram; o se sincroniza un correo autorizado. | Aviso de IA y privacidad; OAuth o webhook; firma cuando aplica; límites y validación. |
| 2. Resolución de ámbito | TALIA determina cuenta, sede, canal, sesión y permisos. | Membresías, autorización servidor, referencias compuestas y fail-closed en rutas internas. |
| 3. Preparación | Se toma el mensaje actual, contexto reciente limitado y conocimiento relevante. | Minimización; separación por canal; no usar conversaciones como base de conocimiento. |
| 4. IA y recuperación | `talia-ai` recupera conocimiento y llama al modelo para generar, clasificar o resumir. | Solo contexto necesario; herramientas y fuentes acotadas; contratos de respuesta. |
| 5. Salida | Se entrega respuesta, borrador o handoff. | Fallback; supervisión humana en email; el usuario envía el borrador. |
| 6. Registro | Se guardan contenido necesario, fuentes, estados, feedback, uso y auditoría. | Eventos operativos sin contenido ni identificadores crudos; accesos y soporte auditables. |
| 7. Retención y borrado | Un cron o procedimiento elimina contenido vencido; el cliente puede solicitar borrado antes. | 90 días de contenido; desidentificación de uso; excepción legal documentada. |

### Separación entre conversación y conocimiento

Los mensajes de visitantes no alimentan automáticamente la base de conocimiento. Una corrección o una fuente debe seguir un flujo supervisado, con ámbito de sede y trazabilidad. Esta separación evita que contenido no fiable o malicioso se convierta en verdad compartida.

### Separación entre canales

La identidad y el historial son locales a sede y canal. TALIA no declara que una persona de Instagram sea la misma que una persona de Email o Web sin un mecanismo explícito y autorizado. Esto reduce la correlación innecesaria.

### Carga de fuentes

Las fuentes de Knowledge se guardan en almacenamiento privado y se procesan en el runtime de IA. La captura web gestionada excluye por defecto rutas privadas, autenticadas, de checkout y formularios, aplica defensas de red y conserva la última versión válida ante fallos.

> [!NOTE]
> **Idea clave para inversores:** la ventaja no es solo generar texto; es controlar qué contexto entra, para qué tenant, con qué fuente, bajo qué política y durante cuánto tiempo.

## 5. Seguridad y aislamiento

La defensa se distribuye entre autenticación, autorización, separación de datos, secretos, integraciones, registro y respuesta. No debe resumirse como una única barrera.

| Área | Control | Estado o evidencia |
| --- | --- | --- |
| Autenticación | Supabase Auth; verificación de email y políticas de contraseña; TOTP aal2 obligatorio para Backstage. | **Implantado** según arquitectura y pruebas. Verificar ajustes exactos de producción. |
| Autorización | Roles globales separados de membresías de cuenta y sede; soporte privilegiado auditado. | **Implantado** con modelo de autorización documentado. |
| Tenant | Comprobaciones servidor, RLS cuando aplica y claves foráneas compuestas para impedir relaciones cruzadas. | **Implantado** en diseño y migraciones; archivar evidencia de producción. |
| Email | Tablas sin acceso de navegador; tokens AES-256-GCM; estado OAuth firmado y con caducidad; scopes readonly y compose. | **Implantado** en código. Refresh, revocación y borrado E2E: **Parcial**. |
| Webhooks | Firma verificada, secretos de aplicación, idempotencia y jobs durables. | **Implantado** para canales habilitados. |
| Red y navegador | HTTPS, CSP, HSTS en producción y cabeceras de aislamiento; allowlists y defensas SSRF en captura web. | **Implantado** con verificación de despliegue recomendada. |
| Abuso | Límites atómicos compartidos; identificadores HMAC; fallo cerrado en producción. | **Implantado** en baseline; conservar pgTAP y muestras `429` saneadas. |
| Secretos | Variables servidor, claves dedicadas y rotación documentada; nunca exponer valores en evidencia. | **Política** más controles de arranque. La rotación real debe registrarse. |
| Dependencias | Instalación bloqueada, auditoría, typecheck, lint, tests, build y pruebas SQL en CI. | **Implantado** como proceso; no equivale a certificación. |

### Acceso humano

- El acceso del personal debe ser excepcional: instrucción del cliente, seguridad, obligación legal u operación mínima necesaria.
- Siempre que sea viable se trabaja con metadatos, logs saneados, contenido redactado o ejemplos aportados por el cliente.
- El acceso de soporte debe tener motivo, alcance, caducidad y evento de auditoría.

> [!NOTE]
> **Respuesta si preguntan por cifrado:** en tránsito, HTTPS. En reposo, cifrado gestionado por proveedor donde esté disponible. Credenciales OAuth, cifrado específico AES-256-GCM antes de persistir. No decir "cifrado end-to-end": no lo es, porque el servicio debe procesar el contenido.

## 6. IA, proveedores y transferencias

TALIA usa proveedores para infraestructura, autenticación, pagos, integraciones y modelos. El punto defendible no es que no existan terceros, sino que están inventariados, sujetos a finalidad, minimización y salvaguardas contractuales.

| Proveedor | Finalidad | Región esperada según documentación |
| --- | --- | --- |
| Supabase | Base de datos, autenticación, almacenamiento y PostgreSQL. | Unión Europea, según configuración del proyecto. |
| Vercel | Aplicación web y API del servidor. | Unión Europea y Estados Unidos, según routing. |
| Fly.io | Runtime `talia-ai` y servicios operativos. | Unión Europea, según región configurada. |
| OpenAI | Generación, clasificación y embeddings. | Unión Europea o Estados Unidos, según cuenta y endpoint. |
| Stripe | Suscripciones, checkout, facturas e identificadores de pago. | Unión Europea y Estados Unidos. |
| Google | Gmail cuando lo habilita el cliente. | Global, incluida la UE y Estados Unidos. |
| Microsoft | Microsoft 365 y Outlook cuando lo habilita el cliente. | Global, incluida la UE y Estados Unidos. |

### Uso de IA

- La IA se utiliza para generar, clasificar, recuperar y resumir dentro del flujo contratado.
- El DPA y la política de TALIA no autorizan usar contenido del cliente para entrenar modelos de propósito general.
- En Gmail y Outlook, el contenido se usa para la función solicitada; los tokens OAuth permanecen fuera del runtime de IA.
- Cada afirmación sobre no entrenamiento debe respaldarse con la configuración real de la cuenta y el contrato vigente de cada proveedor.

### Transferencias internacionales

Cuando hay transferencias fuera del EEE, el DPA prevé Cláusulas Contractuales Tipo u otro mecanismo válido, y anexos específicos para Brasil y México. La lista de regiones es esperada; la diligencia debe capturar la región real, el contrato y el mecanismo aplicable de cada servicio en producción.

> [!WARNING]
> **No prometer residencia total en la UE:** la respuesta correcta es: "preferimos y configuramos regiones UE cuando el servicio lo permite; algunos proveedores operan globalmente o en EE. UU.; aplicamos salvaguardas y documentamos el flujo exacto".

### Google y scopes restringidos

Gmail solicita solo `gmail.readonly` y `gmail.compose`: leer mensajes autorizados y crear borradores. No hay permiso de envío automático.

La documentación interna registra una evaluación CASA Tier 2 asignada, con controles parcialmente evidenciados. Antes de afirmar que está completada debe confirmarse la carta de evaluación y el estado actual de Google.

## 7. Conservación, borrado y derechos

La política define plazos cortos para contenido y plazos más largos para registros desidentificados, facturación y seguridad. El reto de diligencia es demostrar que la política se ejecuta de forma consistente en cada canal.

| Dato | Plazo por defecto | Al borrar o vencer | Estado |
| --- | --- | --- | --- |
| Conversaciones Web | 90 días desde última actividad. | Se elimina contenido; el uso se conserva sin identificador conversacional cuando corresponde. | **Implantado** en job general Web. |
| Email sincronizado y borradores | Hasta 90 días. | Eliminación programada o anticipada; desconectar detiene nueva sincronización. | **Parcial** hasta evidenciar despliegue y prueba controlada. |
| WhatsApp e Instagram | Política de 90 días. | Eliminación de contenido e identificadores; mantener solo uso o auditoría necesario. | **Parcial**: automatización por canal pendiente antes de expansión. |
| Uso, coste y auditoría | Hasta 12 meses. | Sin contenido ni identificadores conversacionales tras el plazo de contenido. | **Política** y controles de desidentificación. |
| Tokens OAuth | Hasta desconexión, revocación o baja. | Revocar cuando sea posible y detener sync; el contenido previo sigue su plazo. | Base **Implantada**; prueba E2E: **Parcial**. |
| Facturación | Plazo legal fiscal y contable. | Se conserva lo exigido, separado del contenido operativo. | **Política**. |
| Backups | Ciclo ordinario del proveedor. | Los datos restaurados vuelven a quedar sujetos a la política de borrado. | **Parcial**: validar backup, PITR y restore. |

### Solicitudes de derechos

- Acceso, rectificación, supresión, oposición, limitación, portabilidad y retirada de consentimiento según jurisdicción.
- Si el dato pertenece al cliente, TALIA ayuda al responsable a localizar, exportar, corregir o borrar según el DPA.
- Si el dato pertenece a la relación directa con TALIA, la solicitud se tramita en `legal@talia.events`.
- La identidad del solicitante y el ámbito deben verificarse antes de revelar o eliminar información.
- Toda excepción de conservación por obligación legal o incidente debe justificarse, limitarse y documentarse.

### Secuencia operativa recomendada

| Paso | Acción |
| --- | --- |
| 1. Recibir | Registrar canal, fecha e identidad. |
| 2. Clasificar | Determinar rol, cliente, sede, canal y tipo de derecho. |
| 3. Ejecutar | Buscar, exportar, rectificar o borrar con el mínimo acceso necesario. |
| 4. Verificar | Confirmar alcance, logs y desidentificación. |
| 5. Cerrar | Responder y conservar evidencia mínima. |

## 8. Incidentes y continuidad

TALIA cuenta con procedimientos de respuesta y recuperación. Para inversores, la diferencia importante es entre tener un plan y haberlo ejercitado con evidencia reciente.

### Respuesta a incidentes

- Roles definidos: coordinación, técnica, privacidad/legal, comunicación y registro.
- Clasificación por severidad; objetivos internos de acuse y contención, no SLA contractuales.
- Ante riesgo entre tenants: desactivar la ruta o el módulo afectado hasta restablecer seguridad.
- Revocar tokens, rotar credenciales, preservar evidencia mínima y evitar copiar contenido innecesario.
- Como encargada, TALIA notifica al cliente sin dilación indebida tras confirmar una brecha que afecte sus datos.

### Continuidad

| Componente | Estrategia | Objetivo interno | Evidencia pendiente |
| --- | --- | --- | --- |
| Agora y widget | Aplicación Vercel sin estado; rollback de despliegue. | RTO 4 h. | Prueba de restauración y runbook ejecutado. |
| Email Agent | Aplicación y jobs recuperables; reconexión y reanudación controlada. | RTO 8 h. | Prueba integral con buzón controlado. |
| Base de datos | Backup diario o PITR según plan Supabase. | RPO 24 h con backup verificado. | Confirmar plan contratado y realizar restore aislado. |
| Storage privado | Separado del backup de base de datos. | Según copia externa acordada. | Definir y probar backup independiente si es necesario. |
| `talia-ai` | Runtime sin estado; redeploy de imagen. | Dentro del RTO del módulo. | Registro de recuperación y dependencias externas. |

> [!WARNING]
> **Respuesta honesta:** tenemos runbooks y objetivos internos. La principal tarea pendiente es convertirlos en evidencia repetible: tabletop, restore aislado, captura de tiempos y acciones correctivas.

## 9. Preguntas de inversores y respuestas

Respuestas pensadas para 20 a 40 segundos. Tras contestar, ofrece una evidencia concreta o un siguiente hito.

### 1. ¿Quién es propietario de los datos?

El cliente mantiene el control de su contenido y determina la finalidad. TALIA lo procesa para prestar el servicio bajo el DPA. TALIA sí decide sobre sus propios datos de cuenta, seguridad, facturación y operación.

### 2. ¿Usáis los datos para entrenar modelos?

No autorizamos el contenido del cliente para entrenar modelos generalistas. La IA se usa para ejecutar la función solicitada. Esa promesa se acompaña de contrato y configuración de proveedor, no solo de una declaración comercial.

### 3. ¿Dónde están alojados los datos?

Priorizamos regiones UE cuando el proveedor lo permite. Supabase y Fly.io se prevén en UE; otros servicios pueden procesar en UE, EE. UU. o globalmente. Documentamos la región real y aplicamos mecanismos de transferencia cuando corresponde.

### 4. ¿Cómo evitáis que un cliente vea datos de otro?

La autorización combina usuario, cuenta y sede. Las APIs resuelven el tenant en servidor; Email es backend-only y las relaciones críticas usan claves compuestas. Conservamos pruebas de aislamiento y fallamos cerrados en rutas internas.

### 5. ¿Qué enviáis al modelo de IA?

El mensaje necesario, contexto reciente limitado y fragmentos relevantes de Knowledge. No enviamos tokens OAuth y no usamos el historial como conocimiento global.

### 6. ¿Cuánto tiempo guardáis conversaciones?

90 días por defecto para contenido conversacional y de email. El uso y la auditoría pueden conservarse hasta 12 meses sin identificadores conversacionales. El cliente puede pedir borrado antes.

### 7. ¿Qué pasa al borrar una conversación?

Se elimina el contenido y se retiran los identificadores de los registros de uso que deban conservarse. Queda evidencia operacional mínima del proceso, no el texto de la conversación.

### 8. ¿El equipo puede leer los correos de clientes?

No como operación normal. El acceso humano está restringido a soporte autorizado, seguridad, obligación legal u operación mínima. Priorizamos metadatos y ejemplos redactados; el acceso privilegiado debe quedar auditado.

### 9. ¿El agente envía emails solo?

No. Solicita lectura y composición, crea un borrador y una persona decide si lo envía. Esta supervisión reduce riesgo operacional y de contenido.

### 10. ¿Qué ocurre si se filtra una credencial?

Contenemos el módulo, revocamos tokens, rotamos secretos, preservamos evidencia mínima y evaluamos el alcance por tenant. El runbook define responsables y comunicación al cliente.

### 11. ¿Tenéis certificaciones?

No debemos presentar certificaciones que no estén obtenidas. Tenemos controles, pruebas y una hoja de evidencia; la validación externa y el cierre de CASA deben confirmarse antes de afirmarlos.

### 12. ¿Cumplís el RGPD?

La arquitectura y los contratos están diseñados para soportar obligaciones de responsable y encargado: minimización, DPA, derechos, seguridad, retención e incidentes. El cumplimiento continuo exige validar configuración, contratos y operación en cada despliegue.

### 13. ¿Cómo gestionáis solicitudes de acceso o supresión?

TALIA tramita sus datos directos y ayuda al cliente con los datos que procesa por su cuenta. Verificamos identidad y ámbito, ejecutamos la acción con mínimo acceso y documentamos el cierre.

### 14. ¿Cómo controláis a OpenAI y otros terceros?

Los mantenemos en una lista de subencargados con finalidad y región esperada, imponemos obligaciones contractuales y revisamos transferencias, retención y uso de datos. La configuración real forma parte de la diligencia.

### 15. ¿Podéis recuperar el servicio tras una caída?

La capa de aplicación es sin estado y desplegable; hay una estrategia de backup para datos. Los objetivos internos son RTO 4 h para Agora y 8 h para Email, con RPO 24 h si el backup diario está verificado. El restore debe ejercitarse.

### 16. ¿Qué queda por cerrar antes de escalar?

Automatizar y evidenciar la retención en todos los canales, completar restore y tabletop, confirmar regiones y acuerdos, cerrar evidencias Google/CASA y formalizar el procedimiento de acceso humano.

## 10. Preguntas difíciles y límites

Estas son las preguntas que pueden intentar convertir una capacidad en una garantía absoluta. La defensa consiste en responder con precisión y controlar el alcance.

| Pregunta | Respuesta defendible | Evitar |
| --- | --- | --- |
| ¿Podéis garantizar que nunca habrá una brecha? | No existe riesgo cero. Reducimos probabilidad e impacto con aislamiento, mínimo privilegio, cifrado de credenciales, monitorización, retención y respuesta. | "Es imposible que ocurra". |
| ¿Todo está cifrado? | HTTPS en tránsito, cifrado del proveedor en reposo y AES-256-GCM para tokens OAuth. | "Cifrado end-to-end" o "todo con nuestra propia clave". |
| ¿Todos los datos están en Europa? | No necesariamente. Preferimos UE y controlamos transferencias y contratos según la configuración real. | Una afirmación global sin inventario de regiones. |
| ¿TALIA cumple el RGPD? | El producto incorpora controles para soportar el cumplimiento y el DPA asigna responsabilidades. Se valida continuamente por despliegue y cliente. | Tratar el cumplimiento como un certificado permanente. |
| ¿Tenéis certificación de seguridad? | Tenemos baseline, CI, políticas y hoja de evidencias. Diremos qué evaluación externa está cerrada cuando exista carta o informe vigente. | Usar CASA, ISO o SOC como si estuvieran obtenidos. |
| ¿Borráis todo al instante? | El contenido operativo puede borrarse anticipadamente; facturación, seguridad y backups siguen plazos justificados. Los datos restaurados vuelven a someterse a la política. | Prometer desaparición inmediata de cada copia. |
| ¿El modelo recuerda a los usuarios? | El contexto reciente es limitado y por sesión o canal. No fusionamos identidades ni convertimos conversaciones en Knowledge automáticamente. | Hablar de memoria personal global. |

### Fórmula de respuesta

> **Control + alcance + evidencia + siguiente hito**
>
> Ejemplo: "Los tokens OAuth se cifran con AES-256-GCM antes de persistir, solo el backend autorizado los usa y tenemos pruebas unitarias. El siguiente hito es archivar la prueba integral de refresh, desconexión y revocación en producción controlada".

## 11. Hoja de cierre de diligencia

Este registro convierte respuestas verbales en pruebas que un inversor o asesor puede revisar sin acceder a datos de clientes.

| Prioridad | Evidencia | Criterio de cierre |
| --- | --- | --- |
| P0 | Retención multicanal | Dry run y borrado controlado para Web, Email, WhatsApp e Instagram; row counts saneados; uso desidentificado verificado. |
| P0 | Backup y restore | Plan Supabase confirmado, restore aislado completado, RPO y RTO medidos; decisión sobre backup de Storage. |
| P0 | Google/CASA | Estado vigente confirmado; hallazgos resueltos; carta o evidencia de Google archivada antes de afirmarlo externamente. |
| P0 | Regiones y transferencias | Captura de región por proveedor, DPA o SCC y configuración OpenAI; inventario con dueño y fecha. |
| P1 | Acceso humano | Aprobación, tiempo límite, motivo, alcance, auditoría y revisión periódica para Gmail y soporte. |
| P1 | Incidentes | Tabletop con escenario cross-tenant o token; tiempos, decisiones, comunicaciones y acciones correctivas. |
| P1 | Autorización | Pruebas tenant positivas y negativas, nombres de constraints, RLS y rutas internas fail-closed en el commit desplegado. |
| P1 | Rotación | Registro sin secretos de rotación de claves OAuth, webhook e internas; prueba de reconexión. |
| P2 | Derechos | Ejercicio de acceso y supresión con dataset sintético; plantilla de respuesta y evidencia mínima. |
| P2 | Gobierno de proveedores | Revisión trimestral de subencargados, cambios, incidentes, regiones y compromisos de no entrenamiento. |

### Paquete para data room

- DPA, privacidad, subencargados y avisos regionales vigentes.
- Diagrama de flujo por canal y matriz de datos, finalidad, retención y proveedor.
- Matriz de autorización y pruebas de aislamiento sin contenido real.
- Último resultado de CI, auditoría de dependencias y pruebas SQL.
- Registros de restore, tabletop, borrado controlado y rotación.
- Estado de evaluaciones externas y remediaciones, sin presentar borradores como certificación.

> [!CAUTION]
> **Cuidado con la data room:** nunca subir secretos, tokens, cuerpos de email, mensajes de visitantes, credenciales, payloads crudos ni capturas con datos reales. La evidencia debe ser sintética o saneada.

## 12. Hoja de defensa oral

Úsala como guion, no como texto para memorizar palabra por palabra.

### Apertura de 60 segundos

> TALIA está diseñada para que una institución cultural pueda usar IA sin perder el control de su información. El cliente decide la finalidad y TALIA procesa el contenido para prestar el servicio. Aislamos por cuenta, sede y canal; enviamos al modelo solo el contexto necesario; ciframos credenciales; limitamos el acceso humano; y retenemos contenido 90 días por defecto. Email genera borradores y nunca envía automáticamente. Además, tenemos DPA, inventario de subencargados, respuesta a incidentes y una hoja explícita de evidencias pendientes. Nuestra prioridad antes de escalar es demostrar en producción la retención multicanal, la recuperación y las validaciones externas.

### Cinco ideas ancla

- El cliente controla el contenido; TALIA lo procesa con finalidad limitada.
- Tenant y canal son fronteras técnicas, no simples etiquetas de interfaz.
- Conversación, Knowledge, uso y auditoría tienen ciclos de vida distintos.
- La supervisión humana es un control de producto, especialmente en Email.
- No confundimos documentación con evidencia: declaramos claramente los hitos pendientes.

### Si no sabes una respuesta

> "No quiero darte una cifra o garantía sin verificarla. El control que tenemos es X; la evidencia disponible es Y; te confirmamos el dato exacto por escrito tras revisar la configuración de producción".

### Preguntas que conviene devolver

- ¿Os preocupa más la exposición entre clientes, el uso por el modelo o la continuidad?
- ¿Qué evidencia necesitaríais para vuestra due diligence: contrato, prueba técnica o evaluación independiente?
- ¿Esperáis una región específica o una restricción sectorial para la inversión o los primeros clientes?
- ¿Queréis ver el mapa de datos por canal o el plan de cierre de evidencias?

## 13. Fuentes y notas

### Fuentes internas revisadas

- [`docs/current-state.md`](../docs/current-state.md): estado funcional y controles activos, actualizado el 12 de octubre de 2026.
- [`docs/legal/data-processing-agreement.md`](../docs/legal/data-processing-agreement.md): roles, obligaciones, retención, subencargados, transferencias y seguridad.
- [`docs/legal/privacy-policy-google-en.md`](../docs/legal/privacy-policy-google-en.md): inventario, bases, Gmail/Outlook, IA, conservación, seguridad y derechos.
- [`docs/legal/subprocessors.md`](../docs/legal/subprocessors.md): proveedor, finalidad y región esperada.
- [`docs/operations/data-retention.md`](../docs/operations/data-retention.md): plazos, función de borrado, cron y borrado manual.
- [`docs/security/authorization-model.md`](../docs/security/authorization-model.md): roles, membresías, soporte y tablas backend-only.
- [`docs/security/casa-readiness.md`](../docs/security/casa-readiness.md): evidencia y gaps de scopes restringidos de Google.
- [`docs/security/incident-response.md`](../docs/security/incident-response.md) y [`docs/operations/disaster-recovery.md`](../docs/operations/disaster-recovery.md): respuesta, RTO, RPO y restauración.
- [`docs/architecture/channel-agent-contracts.md`](../docs/architecture/channel-agent-contracts.md), [`docs/architecture/knowledge-ingestion.md`](../docs/architecture/knowledge-ingestion.md) y [`docs/architecture/usage-billing.md`](../docs/architecture/usage-billing.md): fronteras de canal, Knowledge y uso.

### Referencias oficiales

- [RGPD, texto oficial en EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj): roles, derechos, seguridad y notificación.
- [Agencia Española de Protección de Datos](https://www.aepd.es): guías y ejercicio de derechos.
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy): transparencia, mínimo acceso, Limited Use y seguridad.
- [Google Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification): evaluación aplicable a datos de scopes restringidos.
- [Reglamento de IA, artículo 50](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50): transparencia para sistemas que interactúan con personas.

### Alcance y limitaciones

Este dosier se basa en el repositorio y su documentación a 14 de octubre de 2026. No prueba por sí solo qué versión está desplegada, qué regiones están activas ni qué acuerdos han sido firmados.

Antes de entregarlo externamente conviene sustituir cada estado parcial por evidencia de producción y una revisión legal ajustada a los países y clientes objetivo.

---

Documento preparado para la defensa tecnológica de TALIA ante inversores.
