# Plantillas de email de Auth (multi-idioma)

Cómo TALIA localiza los emails de autenticación de Supabase (confirmación de cuenta,
recuperación de contraseña) según el idioma que el usuario eligió en la UI.

## Cómo funciona

Supabase Auth tiene **una plantilla global por tipo de email**; no localiza por el idioma
del navegador. Para localizarla:

1. **Código (ya implementado):** en el signup guardamos el locale elegido en la UI como
   metadata del usuario. Ver `src/app/auth/signup/route.ts`:

   ```ts
   const lang = await getLocale()           // lee LOCALE_COOKIE
   await supabase.auth.signUp({
     email, password,
     options: { emailRedirectTo, data: { lang } },
   })
   ```

   Esto deja `lang` (`es` | `ca` | `en`) en `raw_user_meta_data`, accesible en las
   plantillas como `{{ .Data.lang }}`.

2. **Plantilla (este documento):** una sola plantilla por tipo que ramifica con Go
   templating sobre `{{ .Data.lang }}`. El email `resend` reutiliza este metadata
   automáticamente.

## Dónde se configura

Supabase Dashboard → **Authentication → Emails → Templates**. Editar *Subject* y *Message body*.
No vive en el repo; este documento es la fuente versionada para copiar/pegar.

También, en **Authentication → URL Configuration → Redirect URLs**, añadir:

```
https://<tu-dominio>/auth/callback
https://<tu-dominio>/auth/reset-callback
```

## Confirm signup

**Subject:**

```
{{ if eq .Data.lang "ca" }}Confirma el teu compte a TALIA{{ else if eq .Data.lang "en" }}Confirm your TALIA account{{ else }}Confirma tu cuenta en TALIA{{ end }}
```

**Message body:**

```html
{{ if eq .Data.lang "ca" }}
<h2>Confirma el teu compte</h2>
<p>Gràcies per crear un compte a TALIA. Confirma la teva adreça per començar.</p>
<p><a href="{{ .ConfirmationURL }}">Activa el compte</a></p>
<p>Si no has estat tu, ignora aquest correu.</p>
{{ else if eq .Data.lang "en" }}
<h2>Confirm your account</h2>
<p>Thanks for creating a TALIA account. Confirm your email address to get started.</p>
<p><a href="{{ .ConfirmationURL }}">Activate account</a></p>
<p>If this wasn't you, you can ignore this email.</p>
{{ else }}
<h2>Confirma tu cuenta</h2>
<p>Gracias por crear una cuenta en TALIA. Confirma tu dirección para empezar.</p>
<p><a href="{{ .ConfirmationURL }}">Activar cuenta</a></p>
<p>Si no has sido tú, ignora este correo.</p>
{{ end }}
```

## Reset password

**Subject:**

```
{{ if eq .Data.lang "ca" }}Restableix la teva contrasenya de TALIA{{ else if eq .Data.lang "en" }}Reset your TALIA password{{ else }}Restablece tu contraseña de TALIA{{ end }}
```

**Message body:**

```html
{{ if eq .Data.lang "ca" }}
<h2>Restableix la contrasenya</h2>
<p>Has demanat restablir la contrasenya del teu compte de TALIA.</p>
<p><a href="{{ .ConfirmationURL }}">Crea una contrasenya nova</a></p>
<p>Si no ho has demanat tu, ignora aquest correu; la contrasenya no canviarà.</p>
{{ else if eq .Data.lang "en" }}
<h2>Reset your password</h2>
<p>You requested to reset the password for your TALIA account.</p>
<p><a href="{{ .ConfirmationURL }}">Set a new password</a></p>
<p>If you didn't request this, ignore this email; your password won't change.</p>
{{ else }}
<h2>Restablece tu contraseña</h2>
<p>Has solicitado restablecer la contraseña de tu cuenta de TALIA.</p>
<p><a href="{{ .ConfirmationURL }}">Crear una contraseña nueva</a></p>
<p>Si no lo has solicitado, ignora este correo; tu contraseña no cambiará.</p>
{{ end }}
```

## Notas y límites

- **Usuarios sin `lang`:** los creados antes de este cambio no tienen `lang` en metadata;
  la rama `{{ else }}` (castellano) actúa como fallback. Correcto por diseño.
- **Reset en el idioma del signup:** el email de recuperación se envía a un usuario sin
  sesión, así que la plantilla solo puede leer el `lang` **guardado en el signup**, no el
  idioma actual de la pestaña. Si en el futuro se quiere el idioma "en vivo", habría que
  actualizar el metadata del usuario antes de enviar (vía admin) o pasar al **Send Email Hook**.
- **Invitaciones:** el email de *Invite user* usa su propia plantilla y un flujo distinto
  (`src/app/auth/accept-invite`). No se cubre aquí; si se quiere localizar, se guarda `lang`
  al generar la invitación y se aplica el mismo patrón.
- **Flujo relacionado:** recuperación de contraseña implementada en `/auth/forgot-password`,
  `/auth/reset-callback`, `/auth/update-password` y las páginas `(marketing)/forgot-password`
  y `(marketing)/reset-password`.
