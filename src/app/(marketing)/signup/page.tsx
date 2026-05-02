'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
        body: JSON.stringify({ email, password }),
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

    setMessage(result.message ?? 'Cuenta creada. Revisa tu email para continuar.')
    setLoading(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Crear cuenta Talía</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Registra tu teatro y configura tu asistente para instalarlo en tu web.
        </p>

        {error ? (
          <p className="notice notice-error" style={{ marginBottom: 16 }}>
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="notice notice-success" style={{ marginBottom: 16 }}>
            {message}
          </p>
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

          <button
            className="button-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          ¿Ya tienes cuenta? <Link className="link-accent" href="/login">Entrar</Link>
        </p>
      </section>
    </main>
  )
}
