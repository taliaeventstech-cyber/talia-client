'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import {
  initialMfaEnrollmentState,
  initialMfaVerificationState,
  startMfaEnrollment,
  verifyMfaChallenge,
} from './actions'

type Props = {
  email: string
  nextPath: string
  verifiedFactorId: string | null
}

export function MfaForm({ email, nextPath, verifiedFactorId }: Props) {
  const [enrollment, enrollmentAction, enrollmentPending] = useActionState(
    startMfaEnrollment,
    initialMfaEnrollmentState,
  )
  const [verification, verificationAction, verificationPending] = useActionState(
    verifyMfaChallenge,
    initialMfaVerificationState,
  )
  const factorId = verifiedFactorId ?? enrollment.factorId ?? null

  return (
    <>
      <p className="muted backstage-mfa-description">
        Confirma el segundo factor para acceder a las funciones administrativas de TALIA.
      </p>
      <p className="backstage-mfa-account">{email}</p>

      {!factorId && (
        <form action={enrollmentAction} className="form-grid">
          <div className="notice">
            Configura una aplicación TOTP como Google Authenticator, Microsoft Authenticator o 1Password.
          </div>
          {enrollment.error && <p className="notice notice-error">{enrollment.error}</p>}
          <button className="button-primary" type="submit" disabled={enrollmentPending}>
            {enrollmentPending ? 'Preparando autenticador...' : 'Configurar autenticador'}
          </button>
        </form>
      )}

      {enrollment.qrCode && enrollment.secret && (
        <div className="backstage-mfa-enrollment">
          <div className="backstage-mfa-qr">
            <Image
              src={enrollment.qrCode}
              alt="Código QR para configurar el autenticador TOTP"
              width={208}
              height={208}
              unoptimized
            />
          </div>
          <div>
            <strong>Escanea el código QR</strong>
            <p className="muted">Después introduce el código de seis dígitos generado por la aplicación.</p>
            <details className="backstage-mfa-secret">
              <summary>No puedo escanear el código</summary>
              <code>{enrollment.secret}</code>
            </details>
          </div>
        </div>
      )}

      {factorId && (
        <form action={verificationAction} className="form-grid backstage-mfa-verify-form">
          <input type="hidden" name="factorId" value={factorId} />
          <input type="hidden" name="next" value={nextPath} />
          <label className="field" htmlFor="mfa-code">
            Código de verificación
            <input
              id="mfa-code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              required
              autoFocus
            />
          </label>
          {verification.error && <p className="notice notice-error">{verification.error}</p>}
          <button className="button-primary" type="submit" disabled={verificationPending}>
            {verificationPending ? 'Verificando...' : 'Verificar y acceder'}
          </button>
        </form>
      )}

      <form action="/auth/logout" method="post" className="backstage-mfa-logout">
        <button className="button-outline" type="submit">Cerrar sesión</button>
      </form>
    </>
  )
}
