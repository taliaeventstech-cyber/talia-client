# Checklist de Lanzamiento de Cliente

Checklist interno para activar un cliente en TALIA.

## 1. Account

- Crear account en Backstage.
- Validar nombre comercial.
- Añadir email de facturación.
- Definir estado: trialing o active.

## 2. Venues

Por cada venue:

- Crear venue.
- Definir tipo.
- Definir idioma principal.
- Definir web oficial.
- Definir email fallback.
- Definir teléfono fallback.
- Seleccionar plan.
- Activar módulos contratados.

## 3. Chatbot

- Configurar color del widget.
- Configurar mensaje inicial.
- Definir prompt base.
- Añadir URLs permitidas.
- Cargar FAQs o fuentes.
- Probar demo local/landing.
- Insertar script en la web del cliente.
- Verificar CORS y respuesta.

## 4. Voz

Si aplica:

- Activar módulo voz.
- Crear agente ElevenLabs.
- Guardar `elevenlabs_agent_id`.
- Guardar `voice_id`.
- Elegir modelo de telefonía.
- Configurar número TALIA o desvío.
- Guardar notas operativas.
- Hacer llamada de prueba.
- Verificar transcript y uso.

## 5. Email

Si aplica:

- Confirmar proveedor: Google o Microsoft.
- Validar buzón a conectar.
- Definir modo: borradores o revisión en Àgora.
- Revisar permisos OAuth.
- Hacer prueba con email entrante.
- Confirmar que aparece borrador.

## 6. Accesos

- Crear invitación por account si el cliente tiene varias venues.
- Crear invitación por venue si solo necesita una venue.
- Asignar rol correcto.
- Confirmar que el usuario entra al dashboard correcto.
- Revocar invitaciones sobrantes.

## 7. Validación Final

- Conversaciones guardan correctamente.
- Temas/intenciones clasifican.
- Uso del plan registra eventos.
- Cliente ve solo módulos contratados.
- Backstage puede editar y desactivar.
- Documentar configuración final.
