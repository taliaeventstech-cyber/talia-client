'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteToken, setInviteToken] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('invite') ?? ''
  })
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    let response: Response
    let result: { error?: string; message?: string; redirectTo?: string }

    try {
      response = await fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, inviteToken }),
      })
      result = await response.json()
    } catch {
      setError('No se pudo conectar con el servidor.')
      setLoading(false)
      return
    }

    if (!response.ok) {
      setError(result.error ?? 'No se pudo crear la cuenta.')
      setLoading(false)
      return
    }

    if (result.redirectTo) {
      window.location.assign(result.redirectTo)
      return
    }

    setPendingEmail(email)
    setMessage(result.message ?? 'Cuenta creada. Revisa tu email para continuar.')
    setLoading(false)
  }

  async function handleResendConfirmation() {
    const targetEmail = pendingEmail || email
    if (!targetEmail) return

    setResending(true)
    setError(null)
    setMessage(null)

    let response: Response
    let result: { error?: string; message?: string }

    try {
      response = await fetch('/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      })
      result = await response.json()
    } catch {
      setError('No se pudo conectar con el servidor.')
      setResending(false)
      return
    }

    if (!response.ok) {
      setError(result.error ?? 'No se pudo reenviar el email de confirmación.')
      setResending(false)
      return
    }

    setMessage(result.message ?? 'Email reenviado.')
    setResending(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Crear cuenta Talía</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Talía es un servicio privado para entidades culturales. Usa la invitación que te hemos enviado para activar tu cuenta.
        </p>

        {error ? (
          <p className="notice notice-error" style={{ marginBottom: 16 }}>
            {error}
          </p>
        ) : null}

        {message ? (
          <div className="notice notice-success" style={{ marginBottom: 16 }}>
            <p>{message}</p>
            {pendingEmail ? (
              <button
                className="button-link"
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
              >
                {resending ? 'Reenviando...' : 'Reenviar email de confirmación'}
              </button>
            ) : null}
          </div>
        ) : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="tu@email.com"
            />
          </label>

          <label className="field">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          <label className="field">
            Invitación
            <input
              type="text"
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              required
              placeholder="Token de invitación"
              autoComplete="off"
            />
          </label>

          <button
            className="button-primary"
            type="submit"
            disabled={loading || !inviteToken}
          >
            {loading ? 'Activando cuenta...' : 'Activar cuenta'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          ¿Ya tienes cuenta? <Link className="link-accent" href="/login">Entrar</Link>
        </p>
      </section>
    </main>
  )
}
