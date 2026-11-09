# Activación operativa del canal telefónico

Estado de partida: **pausado; no apto todavía para clientes**. Este runbook
convierte la reactivación en un piloto controlado por venue. No sustituye la
revisión legal de la locución, la grabación ni el tratamiento de datos.

Objetivo de producto: cada cliente de TALIA puede vincular un número desde
Àgora para que conteste el agente telefónico del venue. La conexión pertenece
al **venue**, no al usuario individual que la creó. Solo un `owner` o `admin`
con permiso `manage_voice` puede administrarla; cambiar o eliminar a esa persona
del equipo no desconecta la línea.

En este documento, **operador humano** es la persona que recibe una llamada
transferida y **operador de telefonía** es Twilio, el carrier o la centralita
SIP. Hay que configurar ambos.

## Decisión recomendada para el primer piloto

Usar un **número de Twilio provisionado por TALIA en un subaccount aislado para
el cliente e importado mediante la integración nativa de ElevenLabs**, asignado
a un único agente y venue.

El cliente puede publicar ese número o desviar su número actual hacia él. Esta
opción simplifica el piloto, conserva control operativo y permite transferir la
llamada a una persona. No usar el modo avanzado `register call` para este caso:
ElevenLabs indica que ese modo no admite transferencias.

Alternativas:

| Modelo | Cuándo usarlo | Limitación principal |
|---|---|---|
| Número Twilio importado en ElevenLabs | Piloto recomendado y transferencia humana | Requiere cuenta, facturación y registro regulatorio en Twilio |
| Número nativo de ElevenLabs | Prueba muy simple sin necesidades especiales de centralita | Menos control y portabilidad operativa |
| SIP trunk | El cliente ya tiene PBX/carrier y debe conservarlo | Mayor coordinación técnica con el operador del cliente |
| Portabilidad del número público | Despliegue estable posterior | No es una primera prueba reversible |

## Experiencia de conexión en Àgora

La pantalla `Voice → Vincular número` debe ofrecer tres caminos claros:

1. **Obtener un número con TALIA** — recomendado y autoservicio. El cliente
   elige país/región, aporta los datos regulatorios necesarios, acepta el coste
   y TALIA provisiona el número.
2. **Mantener mi número actual mediante desvío** — TALIA entrega un número de
   destino y muestra instrucciones. El cliente configura el desvío con su
   operador y TALIA verifica una llamada de prueba.
3. **Ya tengo Twilio, SIP o quiero portar el número** — flujo asistido. No se
   deben pedir credenciales de carrier en un formulario ordinario.

Para v1 hay un solo número entrante activo por venue. Una cuenta con varios
venues puede tener un número por cada venue. La interfaz muestra estado,
número, método, precio/uso, resultado de la última prueba, destino humano y
acción de pausa/desconexión; no muestra Agent IDs ni secretos del proveedor.

Estados visibles recomendados:

```text
Sin conectar → Datos pendientes → Revisión regulatoria → Provisionando
→ Prueba pendiente → Activo → Pausado/Error
```

El proceso es asíncrono y reanudable. Repetir un clic o recargar la pantalla no
puede comprar dos números ni crear dos agentes.

## Responsables que deben quedar nombrados

No activar la línea hasta tener una persona y un suplente para cada función:

| Función | Responsabilidad | Titular | Suplente |
|---|---|---|---|
| Dueño de producto TALIA | Autoriza alcance, venue y go-live | Por asignar | Por asignar |
| Responsable técnico | TALIA, webhooks, despliegue y rollback | Por asignar | Por asignar |
| Administrador Twilio | Número, regulación, saldo, permisos y carrier | Por asignar | Por asignar |
| Administrador ElevenLabs | Agente, voz, herramientas, privacidad y logs | Por asignar | Por asignar |
| Operador humano | Recibe transferencias en el horario acordado | Por asignar | Por asignar |
| Responsable del venue | Valida conocimiento, horarios y experiencia | Por asignar | Por asignar |
| Privacidad/legal | Aprueba locución, retención y subencargados | Por asignar | Por asignar |
| Soporte de guardia | Decide pausa ante una incidencia | Por asignar | Por asignar |

## Orden exacto de configuración

### 1. Fijar el piloto

Registrar:

- un único account y venue;
- idioma principal y posibles idiomas secundarios;
- zona horaria;
- fecha y ventana de prueba;
- llamadas entrantes únicamente para la primera fase;
- volumen máximo diario y presupuesto máximo;
- número público que verá el cliente y número técnico que atenderá TALIA;
- criterio de éxito y persona con autoridad para parar el piloto.

Para el canary, crear el flujo con un `owner/admin` real del venue y comprobar
que un `operator` o `viewer` no puede iniciarlo ni modificarlo.

### 2. Configurar operadores humanos

Antes de crear el agente, acordar:

- número E.164 al que se transferirá, distinto del número público de entrada;
- quién contesta y desde qué dispositivo/cola;
- horario y zona horaria, incluidos festivos y excepciones;
- motivos que permiten transferencia: petición expresa, baja confianza,
  accesibilidad, incidencia de compra, reclamación u otro caso aprobado;
- tiempo máximo de espera;
- comportamiento si está ocupado, no contesta o la transferencia falla;
- destino fuera de horario: mensaje, buzón, devolución de llamada o email;
- frase que oirá el usuario antes de la transferencia y contexto mínimo que
  recibirá el operador;
- casos que nunca debe gestionar el agente, por ejemplo emergencias, pagos o
  datos especialmente sensibles si no hay un flujo aprobado;
- procedimiento de identificación del operador y registro de la resolución.

Para el canary basta un destino humano y un fallback. Una cola multicanal o un
contact center completo queda fuera de alcance.

### 3. Configurar Twilio y el operador de telefonía

1. Crear o elegir la cuenta principal de empresa de TALIA que será propietaria
   de la facturación. Evitar cuentas personales compartidas.
2. Activar MFA, roles de mínimo privilegio, alertas de gasto y un límite de
   consumo apropiado al piloto.
3. Crear o reutilizar un **subaccount por account de TALIA**. Twilio recomienda
   subaccounts para aislar recursos y uso por cliente de un ISV. Los números se
   mapean después a sus respectivos venues.
4. Para un número español o de otro país no estadounidense, completar primero
   el registro regulatorio aplicable en Trust Hub. Twilio exige registro de
   cumplimiento para números no estadounidenses antes del aprovisionamiento.
5. Comprar un número con capacidad de voz dentro del subaccount correcto.
6. Crear una API key del subaccount para la integración; no compartir el Auth
   Token principal si puede evitarse.
7. Anotar en el gestor de secretos, nunca en este documento: subaccount SID o
   API Key SID, secreto de la key, número E.164 y account propietario.
8. Confirmar llamadas entrantes, regiones permitidas, restricciones de salida,
   saldo, logs y política de grabación. El piloto no necesita llamadas
   salientes.
9. Si el cliente desvía su número, pedir a su operador una prueba de desvío,
   conservación del caller ID, tratamiento de ocupado/no respuesta y coste.

No iniciar portabilidad durante el canary. El número debe poder desasignarse o
redirigirse en minutos como rollback.

### 4. Configurar el agente en ElevenLabs

1. Usar un workspace de empresa, MFA y acceso limitado a las personas de la
   tabla de responsables.
2. Crear una API key de entorno con el mínimo acceso necesario y guardarla como
   `ELEVENLABS_API_KEY` en el gestor de secretos de TALIA.
3. Crear un agente nombrado de forma inequívoca, por ejemplo
   `talia__<venue>__pilot`.
4. Configurar idioma, voz, modelo de conversación, primera frase, latencia,
   interrupciones y límites de llamada. No clonar una voz real sin base legal y
   autorización.
5. La primera frase debe informar, antes de la interacción sustantiva, que se
   trata de una IA y describir con precisión si la conversación se graba,
   almacena o comparte con proveedores. El texto final requiere aprobación
   legal.
6. En privacidad, desactivar el guardado de audio para el piloto salvo una
   necesidad aprobada. Configurar la retención del transcript a un máximo de 90
   días, o menor si operaciones lo permite. ElevenLabs documenta actualmente
   una retención predeterminada de dos años, por lo que no debe dejarse el
   valor por defecto.
7. Importar el número de Twilio desde `Phone Numbers` usando la API key de
   Twilio y asignarlo al agente. Un número comprado en Twilio admite entrada y
   salida; un caller ID verificado solo sirve para salida.
8. Hacer una llamada de humo antes de añadir herramientas o conocimiento.

### 5. Configurar transferencia a operador

1. Añadir la herramienta de sistema `transfer_to_number`.
2. Introducir el destino humano en E.164.
3. Escribir reglas explícitas por motivo y horario; no permitir que el modelo
   construya números libremente.
4. Usar la integración nativa de Twilio si se necesita transferencia ciega o
   mensaje de transferencia cálida. Probar el modo elegido con un teléfono
   real.
5. Definir el fallback cuando la herramienta, Twilio o el operador fallen.
6. Verificar qué parte del contexto se comparte con la persona y evitar datos
   innecesarios.

### 6. Configurar webhooks de ElevenLabs hacia TALIA

Configurar al menos el post-call webhook en:

```text
https://<dominio-produccion>/api/voice/conversations
```

En ElevenLabs:

- activar el evento de transcripción post-call;
- activar el evento de fallo de iniciación si el diseño final lo procesa;
- copiar el secreto HMAC al gestor de secretos de TALIA como
  `ELEVENLABS_WEBHOOK_SECRET`;
- comprobar que el endpoint responde `2xx` solo cuando acepta el evento;
- observar reintentos y alertas: ElevenLabs reintenta fallos y puede desactivar
  un endpoint que falla de forma repetida;
- usar un override por agente para aislar el canary si el workspace contiene
  otros agentes.

La personalización por llamada debe usar un conversation-initiation webhook o
un límite equivalente autenticado. No exponer los endpoints internos de TALIA
sin una autenticación específica del proveedor.

### 7. Configurar TALIA Backstage

Para el venue piloto:

- contratar/activar el módulo `voice` solo cuando el entorno esté listo;
- `voice_phone_provider`: `twilio`;
- `voice_phone_mode`: `talia_number` o `client_forwarding`;
- `voice_phone_number`: número técnico asignado al agente;
- `voice_public_phone_number`: número que publicará o conservará el cliente;
- `voice_forwarding_notes`: contacto, estado y prueba del desvío;
- `voice_operational_status`: empezar en `provisioning`;
- `elevenlabs_agent_id` y `voice_id` correctos;
- idioma, tono, temperatura, prompt y máximo de turnos;
- teléfono de fallback del venue;
- plan, minutos incluidos y límite del piloto.

No poner `voice_enabled=true` ni `voice_operational_status=active` antes de
superar la checklist de aceptación. Los secretos nunca se pegan en Backstage.

La configuración manual de Backstage es el mecanismo temporal del canary, no
el producto final. El flujo Àgora debe crear una conexión durable por venue y
orquestar en servidor:

1. autorización y entitlement;
2. subaccount y estado regulatorio;
3. búsqueda/compra o asignación del número;
4. creación/actualización del agente ElevenLabs;
5. importación y asignación del número;
6. llamada de prueba;
7. activación o error recuperable.

Escribir un número no prueba su propiedad. TALIA solo puede activarlo si fue
provisionado en el subaccount correcto, portado, verificado mediante el flujo
del proveedor o desviado y probado.

### 8. Configurar conocimiento y política del agente

- Aprobar las fuentes de horarios, precios, accesibilidad, localización,
  contacto y políticas de entradas.
- Definir quién actualiza cada fuente y cuál manda cuando hay conflicto.
- Preparar preguntas de referencia con respuesta verificable.
- Prohibir que el agente invente disponibilidad, precios o condiciones.
- Si no encuentra evidencia suficiente, debe reconocerlo y ofrecer la
  transferencia/fallback permitido.
- La salida a producción requiere el retrieval compartido de `talia-ai` o una
  herramienta autenticada y tenant-scoped; el prompt estático de 50 elementos
  sirve solo como deuda temporal, no como base comercial.

### 9. Pruebas obligatorias

| Área | Prueba mínima | Evidencia |
|---|---|---|
| Telefonía | llamada real entra al venue correcto | Call SID + hora, sin secreto |
| Transparencia | aviso de IA/almacenamiento antes de conversar | texto aprobado + llamada |
| Conocimiento | set aprobado de preguntas y variantes orales | resultado firmado por venue |
| Seguridad | agente/venue desconocido o desactivado falla cerrado | test automatizado |
| Webhook | firma inválida, timestamp antiguo y replay rechazados | suite automatizada |
| Idempotencia | webhook duplicado no duplica llamada, tema ni uso | suite automatizada |
| Operador | transferencia correcta en horario | llamada real |
| Fallback | ocupado, no respuesta, fuera de horario y caída de proveedor | llamada real/simulación |
| Facturación | una llamada genera una sola medición de minutos | registro de uso |
| Privacidad | no hay secretos, transcript ni teléfono completo en logs | revisión de logs |
| Retención | dry-run y borrado eliminan contenido Voice a los 90 días | test de integración |
| Rollback | pausar agente/desasignar número corta nuevas llamadas | ensayo documentado |

### 10. Go-live y rollback

Go-live:

1. Poner `voice_operational_status=active`.
2. Activar el módulo y `voice_enabled` únicamente para el venue piloto.
3. Abrir una ventana supervisada de bajo tráfico.
4. Revisar las primeras llamadas y transferencias en tiempo real.
5. Cerrar la ventana con una decisión explícita: continuar, corregir o pausar.

Rollback inmediato ante enrutamiento incorrecto, divulgación de datos,
respuestas peligrosas, transferencia fallida repetida o coste anómalo:

1. Pausar/desasignar el agente del número en ElevenLabs.
2. Redirigir el número en Twilio al fallback humano o mensaje aprobado.
3. Poner el venue en `paused` y desactivar `voice_enabled`.
4. Conservar IDs y auditoría; no borrar evidencia de la incidencia.
5. Abrir incidente si existe impacto de seguridad o privacidad.

## Tablero de preparación

| Bloque | Estado inicial | Responsable | Evidencia requerida |
|---|---|---|---|
| Venue y ventana de piloto | Pendiente | — | ficha aprobada |
| Permisos owner/admin | Pendiente | — | prueba de autorización |
| Operador humano y horario | Pendiente | — | número + prueba |
| Cuenta Twilio y regulación | Pendiente | — | registro aprobado |
| Subaccount Twilio del cliente | Pendiente | — | Account SID sin secreto |
| Número de voz | Pendiente | — | E.164 + Voice capability |
| Agente ElevenLabs | Pendiente | — | Agent ID |
| Aviso legal | Pendiente | — | texto aprobado |
| Privacidad/retención | Pendiente | — | captura de configuración |
| Transferencia | Pendiente | — | prueba en/fuera de horario |
| Webhooks | Parcial en código | — | tests + evento real |
| Conocimiento | Parcial/deuda | — | test set aprobado |
| Minutos/usage | Pendiente | — | evento idempotente |
| Retención TALIA | Pendiente | — | dry-run + borrado |
| Observabilidad/alertas | Pendiente | — | dashboard/alerta |
| Rollback | Pendiente | — | ensayo firmado |
| Desconexión/reasignación | Pendiente | — | prueba sin liberar número accidentalmente |

## Siguiente dato que hay que cerrar

El primer dato operativo que desbloquea todo lo demás es:

> Venue piloto + país del número + teléfono E.164 del operador humano + horario
> y zona horaria de transferencia.

Con esos cuatro datos se puede iniciar el registro regulatorio, comprar el
número correcto y construir la configuración del agente sin rehacer el flujo.

## Referencias oficiales vigentes al redactar este runbook

- [Integración nativa Twilio–ElevenLabs](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration/)
- [Webhooks post-call](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)
- [Transferencia a un número](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number)
- [SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking)
- [Privacidad y retención en ElevenLabs](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention)
- [Requisito de transparencia de ElevenLabs](https://elevenlabs.io/docs/eleven-agents/legal/disclosure-requirement)
- [Cumplimiento regulatorio de números en Twilio](https://www.twilio.com/docs/trust-hub/registrations/regulatory-compliance)
- [Subaccounts de Twilio](https://www.twilio.com/docs/iam/api/subaccounts)
- [Portabilidad y hosting de números](https://www.twilio.com/docs/numbers-and-senders/port-host)
