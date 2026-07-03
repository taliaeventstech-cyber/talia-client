'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { PasswordInput } from '@/components/password-input'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

type ResetPasswordCopy = Dictionary['auth']['resetPassword']

export function ResetPasswordForm({ copy }: { copy: ResetPasswordCopy }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    let response: Response
    let result: { error?: string; redirectTo?: string }

    try {
      response = await fetch('/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      result = await response.json()
    } catch {
      setError(copy.connectionError)
      setLoading(false)
      return
    }

    if (!response.ok) {
      setError(getResetError(copy, result.error))
      setLoading(false)
      return
    }

    window.location.assign(result.redirectTo || '/')
  }

  return (
    <>
      <Image className="auth-logo" src="/talia-logo-marble.png" alt="Talía" width={132} height={36} priority />
      <h1 style={{ marginBottom: 8 }}>{copy.title}</h1>
      <p className="muted" style={{ marginBottom: 24 }}>{copy.description}</p>

      {error ? (
        <p className="notice notice-error" style={{ marginBottom: 16 }}>{error}</p>
      ) : null}

      <form className="form-grid" onSubmit={handleSubmit}>
        <PasswordInput
          value={password}
          onChange={setPassword}
          minLength={12}
          autoComplete="new-password"
          placeholder={copy.passwordPlaceholder}
          showLabel={copy.showPassword}
          hideLabel={copy.hidePassword}
        />
        <button className="button-primary" type="submit" disabled={loading}>
          {loading ? copy.submitting : copy.submit}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        <Link className="link-accent" href="/login">{copy.backToLogin}</Link>
      </p>
    </>
  )
}

function getResetError(copy: ResetPasswordCopy, error?: string) {
  if (error === 'weak_password') return copy.weakPassword
  if (error === 'same_password') return copy.samePassword
  if (error === 'session_expired') return copy.sessionExpired
  return copy.updateFailed
}
