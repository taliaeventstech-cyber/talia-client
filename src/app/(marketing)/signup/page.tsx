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
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', fontFamily: 'sans-serif', background: '#f7f7f7' }}>
      <section style={{ width: '100%', maxWidth: 440, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Crear cuenta TALIA</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Registra tu teatro y configura tu asistente para instalarlo en tu web.
        </p>

        {error ? (
          <p style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '0.75rem', fontSize: '0.9rem', color: '#b91c1c', marginBottom: '1rem' }}>
            {error}
          </p>
        ) : null}

        {message ? (
          <p style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '0.75rem', fontSize: '0.9rem', color: '#166534', marginBottom: '1rem' }}>
            {message}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="tu@email.com"
              style={{ padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: 6 }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              style={{ padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: 6 }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '0.8rem', fontSize: '1rem', fontWeight: 700, background: '#000', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
          ¿Ya tienes cuenta? <Link href="/login" style={{ color: '#000', fontWeight: 700 }}>Entrar</Link>
        </p>
      </section>
    </main>
  )
}
