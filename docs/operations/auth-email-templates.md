# Auth email templates (multi-language)

How TALIA localizes Supabase authentication emails (account confirmation,
password recovery) based on the language the user selected in the UI.

## How it works

Supabase Auth has **one global template per email type**; it does not localize based on
the browser language. To localize it:

1. **Code (already implemented):** on signup we save the locale chosen in the UI as
   user metadata. See `src/app/auth/signup/route.ts`:

   ```ts
   const lang = await getLocale()           // read LOCALE_COOKIE
   await supabase.auth.signUp({
     email, password,
     options: { emailRedirectTo, data: { lang } },
   })
   ```

   This leaves `lang` (`es` | `ca` | `en`) in `raw_user_meta_data`, accessible in the
   templates as `{{ .Data.lang }}`.

2. **Template (this document):** a single template per type that branches with Go
   templating on `{{ .Data.lang }}`. The `resend` email automatically reuses this metadata.

## Where it's configured

Supabase Dashboard → **Authentication → Emails → Templates**. Edit *Subject* and *Message body*.
It does not live in the repo; this document is the versioned source to copy/paste from.

Also, under **Authentication → URL Configuration → Redirect URLs**, add:

```
https://<your-domain>/auth/callback
https://<your-domain>/auth/reset-callback
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

## Notes and limitations

- **Users without `lang`:** users created before this change do not have `lang` in metadata;
  the `{{ else }}` branch (Spanish) acts as the fallback. Correct by design.
- **Reset in the signup language:** the recovery email is sent to a user without a
  session, so the template can only read the `lang` **saved at signup**, not the
  current tab's language. If a "live" language is desired in the future, the user's metadata
  would need to be updated before sending (via admin) or the **Send Email Hook** would need to be used.
- **Invitations:** the *Invite user* email uses its own template and a different flow
  (`src/app/auth/accept-invite`). Not covered here; if localization is desired, `lang` is saved
  when the invitation is generated and the same pattern is applied.
- **Related flow:** password recovery implemented in `/auth/forgot-password`,
  `/auth/reset-callback`, `/auth/update-password`, and the `(marketing)/forgot-password`
  and `(marketing)/reset-password` pages.
