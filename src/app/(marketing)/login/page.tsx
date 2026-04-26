'use client'

import { Suspense, useState } from 'react'
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
      <h1 style={{ marginBottom: '0.5rem' }}>TALIA</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Accede a tu dashboard</p>
      {(error ?? errorParam) && (
        <p style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '0.75rem', fontSize: '0.85rem', color: '#b91c1c', marginBottom: '1rem' }}>
          {error ?? errorParam}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          style={{ padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          required
          style={{ padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '0.75rem', fontSize: '1rem', background: '#000', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </>
  )
}

export default function LoginPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: 400, margin: '10vh auto', fontFamily: 'sans-serif' }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
