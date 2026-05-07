'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import Link from 'next/link'
import { useState } from 'react'

type SignupCopy = Dictionary['auth']['signup']

export function SignupForm({
  copy,
  initialInviteToken,
}: {
  copy: SignupCopy
  initialInviteToken: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteToken, setInviteToken] = useState(initialInviteToken)
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
      setError(copy.connectionError)
      setLoading(false)
      return
    }

    if (!response.ok) {
      setError(result.error ?? copy.createError)
      setLoading(false)
      return
    }

    if (result.redirectTo) {
      window.location.assign(result.redirectTo)
      return
    }

    setPendingEmail(email)
    setMessage(result.message ?? copy.created)
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
      setError(result.error ?? copy.resendError)
      setResending(false)
      return
    }

    setMessage(result.message ?? copy.resent)
    setResending(false)
  }

  return (
    <>
      <h1>{copy.title}</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        {copy.description}
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
              {resending ? copy.resending : copy.resend}
            </button>
          ) : null}
        </div>
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
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            placeholder={copy.passwordPlaceholder}
          />
        </label>

        <label className="field">
          {copy.invite}
          <input
            type="text"
            value={inviteToken}
            onChange={(event) => setInviteToken(event.target.value)}
            required
            placeholder={copy.invitePlaceholder}
            autoComplete="off"
          />
        </label>

        <button
          className="button-primary"
          type="submit"
          disabled={loading || !inviteToken}
        >
          {loading ? copy.submitting : copy.submit}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        {copy.haveAccount} <Link className="link-accent" href="/login">{copy.login}</Link>
      </p>
    </>
  )
}
