# Borrador de politica de privacidad

> Documento de trabajo. Debe revisarlo asesoria legal antes de publicarlo. El objetivo es cubrir RGPD/LOPDGDD y los requisitos de Google OAuth para el agente de email de TALIA.

Ultima actualizacion: [DD/MM/AAAA]

## 1. Responsable del tratamiento

El responsable del tratamiento de los datos personales tratados a traves de TALIA es:

- Responsable: [Nombre legal de la empresa/autonomo]
- NIF/CIF: [NIF/CIF]
- Domicilio: [Direccion completa]
- Email de contacto: [email de contacto]
- Email privacidad: [privacy@dominio]
- Delegado de Proteccion de Datos, si aplica: [datos DPO/DPD]

## 2. Que es TALIA

TALIA es una plataforma SaaS para entidades culturales que permite gestionar asistentes de IA, chatbots web, agentes de email, analitica operativa y herramientas de soporte para la relacion con visitantes, clientes y usuarios.

Cuando una entidad contrata o utiliza TALIA, puede configurar un chatbot web y, si activa el agente de email, conectar una cuenta de Gmail o Microsoft Outlook para que TALIA pueda leer mensajes autorizados y preparar borradores supervisados.

## 3. Datos personales que tratamos

TALIA puede tratar las siguientes categorias de datos:

### 3.1 Datos de cuenta y administracion

- Nombre y apellidos.
- Email.
- Empresa, entidad cultural o espacio de trabajo.
- Cargo, rol o permisos dentro de la plataforma.
- Credenciales tecnicas de acceso y sesiones.
- Preferencias de idioma y configuracion.

### 3.2 Datos de la entidad cultural

- Nombre del teatro, museo, sala, festival, cine, galeria u otra entidad.
- Sitio web.
- Direccion, telefono, email de contacto y enlaces publicos.
- Informacion operativa necesaria para configurar el asistente.
- Fuentes de conocimiento proporcionadas por el cliente.

### 3.3 Datos del chatbot web

- Mensajes enviados por usuarios al chatbot.
- Respuestas generadas.
- Intenciones, categorias y metricas de conversacion.
- Fechas, horas, identificadores tecnicos y metadatos de uso.
- Informacion necesaria para supervisar, mejorar y auditar el servicio.

### 3.4 Datos del agente de email

Cuando el cliente conecta Gmail u Outlook, TALIA puede tratar:

- Direccion de email conectada.
- Tokens OAuth cifrados.
- Metadatos de mensajes, como remitente, destinatarios, asunto, fecha, identificadores de hilo y etiquetas.
- Contenido de emails necesario para clasificar mensajes y preparar respuestas.
- Borradores creados por TALIA.
- Estado de sincronizacion y logs tecnicos de integracion.

### 3.5 Datos de facturacion y pagos

- Datos identificativos y fiscales del cliente.
- Plan contratado.
- Historial de pagos.
- Identificadores de cliente, suscripcion o checkout del proveedor de pagos.

TALIA no almacena datos completos de tarjetas de pago. Los pagos se procesan mediante proveedores externos como Stripe.

### 3.6 Datos tecnicos y de seguridad

- Direccion IP.
- Navegador, dispositivo y sistema operativo.
- Logs de acceso, eventos de seguridad y errores.
- Identificadores tecnicos de sesion.

## 4. Finalidades del tratamiento

Tratamos los datos personales para las siguientes finalidades:

1. Crear y administrar cuentas de usuario.
2. Gestionar espacios de trabajo, permisos y roles.
3. Prestar el servicio de chatbot web.
4. Prestar el servicio de agente de email.
5. Leer emails autorizados para clasificarlos y preparar respuestas.
6. Crear borradores supervisados en Gmail u Outlook.
7. Generar analitica, informes y metricas de actividad.
8. Prestar soporte tecnico y resolver incidencias.
9. Gestionar facturacion, pagos, suscripciones y obligaciones contables.
10. Proteger la seguridad de la plataforma, prevenir abusos y mantener logs tecnicos.
11. Cumplir obligaciones legales.
12. Mejorar el producto, siempre dentro de los limites contractuales y legales aplicables.

TALIA no envia emails automaticamente con los permisos actuales del agente de email. Los borradores preparados por TALIA deben ser revisados y enviados por el usuario desde su cuenta de email.

## 5. Base juridica

Las bases juridicas aplicables son:

- Ejecucion de un contrato: para crear la cuenta, prestar el SaaS, gestionar usuarios, activar modulos y mantener el servicio.
- Consentimiento: para conectar cuentas de Google, Gmail, Microsoft Outlook u otros proveedores mediante OAuth.
- Obligacion legal: para facturacion, contabilidad, obligaciones fiscales y cumplimiento normativo.
- Interes legitimo: para seguridad, prevencion de fraude, logs tecnicos, mejora operativa y soporte.
- Consentimiento especifico: para comunicaciones comerciales o cookies no tecnicas, cuando sean aplicables.

El usuario puede retirar el consentimiento para la integracion de Gmail u Outlook desconectando la cuenta desde TALIA o revocando el acceso desde la configuracion de seguridad de Google o Microsoft.

## 6. Uso de datos de Google y Gmail

TALIA utiliza las APIs de Google solo cuando el usuario conecta voluntariamente su cuenta de Google mediante OAuth.

Los scopes solicitados actualmente son:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.compose`

TALIA usa estos permisos para:

- leer mensajes autorizados de Gmail;
- clasificar solicitudes entrantes;
- preparar respuestas sugeridas;
- crear borradores en Gmail para revision humana.

TALIA no utiliza datos de Gmail para publicidad. TALIA no vende datos de Gmail. TALIA no envia emails automaticamente con los permisos actuales. TALIA no transfiere datos de Gmail a terceros salvo cuando sea estrictamente necesario para prestar el servicio contratado, bajo las garantias contractuales y de seguridad correspondientes.

El uso y transferencia por parte de TALIA de informacion recibida de las APIs de Google se ajustara a la Google API Services User Data Policy, incluyendo los requisitos de Limited Use.

Referencia: https://developers.google.com/terms/api-services-user-data-policy

## 7. Uso de proveedores de inteligencia artificial

TALIA puede utilizar proveedores de modelos de inteligencia artificial para analizar mensajes, clasificar conversaciones y generar borradores o respuestas sugeridas.

Cuando se utilicen estos proveedores, TALIA procurara aplicar medidas de minimizacion, seguridad y control de acceso. Los datos se trataran exclusivamente para prestar el servicio contratado y conforme a los acuerdos aplicables con cada proveedor.

Proveedores previstos o actuales:

- [OpenAI / proveedor IA]
- [Otros proveedores, si aplica]

Debe verificarse contractualmente si estos proveedores actuan como encargados del tratamiento y si realizan transferencias internacionales de datos.

## 8. Proveedores y subencargados

Para prestar el servicio, TALIA puede utilizar proveedores externos, entre otros:

- Hosting e infraestructura cloud.
- Base de datos y autenticacion.
- Procesamiento de pagos.
- Proveedores de email y APIs de Google/Microsoft.
- Proveedores de inteligencia artificial.
- Herramientas de automatizacion, observabilidad, soporte o analitica.

Lista operativa de subencargados a completar:

| Proveedor | Servicio | Pais/region | Finalidad |
| --- | --- | --- | --- |
| [Supabase] | Base de datos/autenticacion | [Region] | Persistencia y auth |
| [Stripe] | Pagos | [Region] | Facturacion y suscripciones |
| [Google] | Gmail API | [Region] | Integracion Gmail |
| [Microsoft] | Graph API | [Region] | Integracion Outlook |
| [OpenAI] | IA generativa | [Region] | Clasificacion y borradores |
| [n8n] | Automatizacion | [Region] | Workflows internos |

## 9. Transferencias internacionales

Algunos proveedores pueden estar ubicados fuera del Espacio Economico Europeo o tratar datos desde terceros paises.

Cuando se produzcan transferencias internacionales, TALIA aplicara las garantias correspondientes, como decisiones de adecuacion, clausulas contractuales tipo, Data Privacy Framework cuando aplique, medidas suplementarias o cualquier otro mecanismo reconocido por la normativa vigente.

## 10. Conservacion de datos

Los datos se conservaran durante el tiempo necesario para prestar el servicio y cumplir obligaciones legales.

Criterios orientativos:

- Datos de cuenta: mientras la cuenta permanezca activa y durante el plazo necesario para atender responsabilidades legales.
- Datos de facturacion: durante los plazos legales contables y fiscales aplicables.
- Conversaciones de chatbot: [definir plazo, por ejemplo 12 meses], salvo que el cliente solicite eliminacion antes.
- Emails sincronizados: [definir plazo, por ejemplo 30/90/180 dias], salvo que el cliente configure otro periodo o solicite eliminacion.
- Borradores: mientras sean necesarios para prestar el servicio o hasta que se eliminen en TALIA o en el proveedor de email.
- Logs tecnicos: [definir plazo, por ejemplo 6/12 meses], salvo necesidad de investigacion de seguridad.
- Tokens OAuth: hasta que el usuario desconecte la cuenta, revoque el acceso o se elimine la cuenta.

## 11. Seguridad

TALIA aplica medidas tecnicas y organizativas destinadas a proteger los datos personales, incluyendo:

- Cifrado de tokens OAuth.
- Control de acceso por usuario, rol y tenant.
- Separacion logica de datos por cliente.
- Uso de HTTPS.
- Minimizacion de permisos OAuth.
- Registro de eventos tecnicos y de seguridad.
- Acceso interno limitado a personal autorizado.
- Procedimientos de desconexion y revocacion de integraciones.
- Copias de seguridad y medidas de continuidad, cuando aplique.

Ningun sistema es completamente infalible. Si se detecta una brecha de seguridad que afecte a datos personales, TALIA actuara conforme a la normativa aplicable.

## 12. Derechos de las personas

Las personas pueden ejercer los derechos reconocidos por el RGPD y la LOPDGDD:

- Acceso.
- Rectificacion.
- Supresion.
- Oposicion.
- Limitacion del tratamiento.
- Portabilidad.
- Retirada del consentimiento.
- Derecho a no ser objeto de decisiones automatizadas, cuando aplique.

Para ejercer estos derechos, se puede escribir a:

```text
[privacy@dominio]
```

La solicitud debe indicar el derecho que se desea ejercer y permitir verificar la identidad del solicitante.

Tambien se puede presentar una reclamacion ante la Agencia Espanola de Proteccion de Datos:

https://www.aepd.es

## 13. Desconexion de Gmail u Outlook

El usuario puede desconectar Gmail u Outlook desde la configuracion de TALIA.

Adicionalmente, puede revocar el acceso desde:

- Google Account > Security > Third-party apps and services.
- Microsoft Account / Entra ID > aplicaciones autorizadas.

Al desconectar la cuenta, TALIA dejara de sincronizar nuevos mensajes. Los datos ya tratados se conservaran o eliminaran conforme a esta politica, la configuracion del cliente y las obligaciones legales aplicables.

## 14. Comunicaciones comerciales

TALIA solo enviara comunicaciones comerciales cuando exista una base juridica valida, como consentimiento del usuario o interes legitimo en los casos permitidos por la ley.

El usuario podra darse de baja de comunicaciones comerciales mediante el mecanismo incluido en cada comunicacion o escribiendo a [email de contacto].

## 15. Cookies y tecnologias similares

TALIA puede utilizar cookies tecnicas necesarias para autenticacion, seguridad y funcionamiento de la plataforma.

Si se usan cookies analiticas, publicitarias o de seguimiento no necesarias, se solicitara consentimiento cuando sea obligatorio y se ofrecera informacion adicional en una politica de cookies.

Politica de cookies: [URL politica cookies]

## 16. Menores

TALIA esta dirigida a entidades, profesionales y usuarios autorizados por clientes B2B. No esta dirigida a menores de edad.

Si se detecta que se han tratado datos de menores sin base legitima suficiente, se adoptaran medidas para eliminarlos o regularizar el tratamiento.

## 17. Cambios en esta politica

TALIA puede actualizar esta politica para reflejar cambios legales, tecnicos u operativos.

Cuando los cambios sean relevantes, se notificaran a los usuarios o clientes por medios razonables.

## 18. Checklist antes de publicar

- [ ] Completar datos legales del responsable.
- [ ] Confirmar dominio publico final.
- [ ] Crear URL publica de politica de privacidad.
- [ ] Crear URL publica de terminos del servicio.
- [ ] Crear o enlazar politica de cookies.
- [ ] Completar lista real de subencargados.
- [ ] Definir plazos reales de conservacion.
- [ ] Confirmar proveedores IA y condiciones de tratamiento.
- [ ] Validar transferencias internacionales.
- [ ] Revisar texto con asesoria legal.
- [ ] Confirmar que la seccion Google API Limited Use aparece de forma clara.
- [ ] Usar esta URL en Google Auth Platform.

## 19. Referencias

- AEPD - Derecho de informacion: https://www.aepd.es/derechos-y-deberes/conoce-tus-derechos/derecho-de-informacion
- Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy
- Google Workspace API User Data and Developer Policy: https://developers.google.com/gmail/api/policy
- Gmail API scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
