'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { PasswordInput } from '@/components/password-input'
import Link from 'next/link'
import { useState } from 'react'

type SignupCopy = Dictionary['auth']['signup']

export function SignupForm({ copy, redirectTo }: { copy: SignupCopy; redirectTo?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loginHref = redirectTo ? `/login?next=${encodeURIComponent(redirectTo)}` : '/login'

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
        body: JSON.stringify({ email, password, redirectTo }),
      })
      result = await response.json()
    } catch {
      setError(copy.connectionError)
      setLoading(false)
      return
    }

    if (!response.ok) {
      setError(getSignupError(copy, result.error))
      setLoading(false)
      return
    }

    if (result.redirectTo) {
      window.location.assign(result.redirectTo)
      return
    }

    setPendingEmail(email)
    setMessage(copy.created)
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
      setError(copy.connectionError)
      setResending(false)
      return
    }

    if (!response.ok) {
      setError(getSignupError(copy, result.error))
      setResending(false)
      return
    }

    setMessage(copy.resent)
    setResending(false)
  }

  return (
    <>
      <h1>{copy.title}</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        {copy.description}
      </p>

      {pendingEmail ? (
        <div className="auth-confirmation-state">
          <div className="notice notice-success">
            <p>{message ?? copy.created}</p>
          </div>
          <div className="auth-confirmation-panel">
            <p className="section-label">{copy.confirmationTitle}</p>
            <h2>{pendingEmail}</h2>
            <p className="muted">{copy.confirmationDescription}</p>
            {error ? (
              <p className="notice notice-error">
                {error}
              </p>
            ) : null}
            <button
              className="button-secondary"
              type="button"
              onClick={handleResendConfirmation}
              disabled={resending}
            >
              {resending ? copy.resending : copy.resend}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            {copy.haveAccount} <Link className="link-accent" href={loginHref}>{copy.login}</Link>
          </p>
        </div>
      ) : (
        <>
      {error ? (
        <p className="notice notice-error" style={{ marginBottom: 16 }}>
          {error}
        </p>
      ) : null}

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          {copy.email}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder={copy.emailPlaceholder}
          />
        </label>

        <label className="field">
          {copy.password}
          <PasswordInput
            value={password}
            onChange={setPassword}
            minLength={12}
            autoComplete="new-password"
            placeholder={copy.passwordPlaceholder}
            showLabel={copy.showPassword}
            hideLabel={copy.hidePassword}
          />
        </label>

        <button
          className="button-primary"
          type="submit"
          disabled={loading}
        >
          {loading ? copy.submitting : copy.submit}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        {copy.haveAccount} <Link className="link-accent" href={loginHref}>{copy.login}</Link>
      </p>
        </>
      )}
    </>
  )
}

function getSignupError(copy: SignupCopy, error?: string) {
  if (error === 'too_many_attempts') return copy.tooManyAttempts
  if (error === 'email_rate_limited') return copy.emailRateLimited
  if (error === 'weak_password') return copy.passwordPolicy
  if (error === 'invalid_email' || error === 'invalid_signup') return copy.invalidData
  if (error === 'resend_failed') return copy.resendError
  return copy.createError
}
