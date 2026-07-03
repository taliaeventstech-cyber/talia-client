'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

type ForgotPasswordCopy = Dictionary['auth']['forgotPassword']

export function ForgotPasswordForm({
  copy,
  errorParam,
}: {
  copy: ForgotPasswordCopy
  errorParam?: string
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(errorParam === 'recovery_link_invalid' ? copy.linkInvalid : null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    let response: Response

    try {
      response = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      setError(copy.connectionError)
      setLoading(false)
      return
    }

    if (response.status === 429) {
      setError(copy.tooManyAttempts)
      setLoading(false)
      return
    }

    // The endpoint always answers neutrally, so any non-rate-limited response
    // confirms the request was accepted.
    setSent(true)
    setLoading(false)
  }

  return (
    <>
      <Image className="auth-logo" src="/talia-logo-marble.png" alt="Talía" width={132} height={36} priority />
      <h1 style={{ marginBottom: 8 }}>{copy.title}</h1>
      <p className="muted" style={{ marginBottom: 24 }}>{copy.description}</p>

      {sent ? (
        <div className="notice notice-success" style={{ marginBottom: 16 }}>
          <p className="section-label">{copy.sentTitle}</p>
          <p>{copy.sentDescription}</p>
        </div>
      ) : (
        <>
          {error ? (
            <p className="notice notice-error" style={{ marginBottom: 16 }}>{error}</p>
          ) : null}
          <form className="form-grid" onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={copy.emailPlaceholder}
              autoComplete="email"
              required
            />
            <button className="button-primary" type="submit" disabled={loading}>
              {loading ? copy.submitting : copy.submit}
            </button>
          </form>
        </>
      )}

      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        <Link className="link-accent" href="/login">{copy.backToLogin}</Link>
      </p>
    </>
  )
}
