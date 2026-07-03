'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { PasswordInput } from '@/components/password-input'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

type LoginCopy = Dictionary['auth']['login']

export function LoginForm({
  copy,
  errorParam,
  redirectTo,
}: {
  copy: LoginCopy
  errorParam?: string
  redirectTo?: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signupHref = redirectTo ? `/signup?next=${encodeURIComponent(redirectTo)}` : '/signup'

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
        body: JSON.stringify({ email, password, redirectTo }),
      })
      result = await response.json()
    } catch {
      setError(copy.connectionError)
      setLoading(false)
      return
    }

    if (!response.ok) {
      setError(getLoginError(copy, result.error))
      setLoading(false)
      return
    }

    window.location.assign(result.redirectTo || '/')
  }

  return (
    <>
      <h1 className="sr-only">{copy.title}</h1>
      <Image className="auth-logo" src="/talia-logo-marble.png" alt="Talía" width={132} height={36} priority />
      <p className="muted" style={{ marginBottom: 24 }}>{copy.description}</p>
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
          placeholder={copy.emailPlaceholder}
          autoComplete="email"
          required
        />
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder={copy.passwordPlaceholder}
          autoComplete="current-password"
          showLabel={copy.showPassword}
          hideLabel={copy.hidePassword}
        />
        <button
          className="button-primary"
          type="submit"
          disabled={loading}
        >
          {loading ? copy.submitting : copy.submit}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        <Link className="link-accent" href="/forgot-password">{copy.forgotPassword}</Link>
      </p>
      <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
        {copy.noAccount} <Link className="link-accent" href={signupHref}>{copy.createAccount}</Link>
      </p>
    </>
  )
}

function getLoginError(copy: LoginCopy, error?: string) {
  if (error === 'too_many_attempts') return copy.tooManyAttempts
  return copy.invalidCredentials
}
