'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let response: Response
    let result: { error?: string; redirectTo?: string }

    try {
      response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      result = await response.json()
    } catch {
      setError('No se pudo conectar con el servidor')
      setLoading(false)
      return
    }

    if (!response.ok) {
      setError(result.error ?? 'Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    window.location.assign(result.redirectTo || '/')
  }

  return (
    <>
      <h1>Talía</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Accede a tu dashboard</p>
      {(error ?? errorParam) && (
        <p className="notice notice-error" style={{ marginBottom: 16 }}>
          {error ?? errorParam}
        </p>
      )}
      <form className="form-grid" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          required
        />
        <button
          className="button-primary"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        ¿No tienes cuenta? <Link className="link-accent" href="/signup">Crear cuenta</Link>
      </p>
    </>
  )
}

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
      <Suspense>
        <LoginForm />
      </Suspense>
      </section>
    </main>
  )
}
