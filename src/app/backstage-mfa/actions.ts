'use server'

import { requirePlatformAdminIdentity } from '@/lib/platform/auth'
import { normalizePlatformMfaNextPath } from '@/lib/platform/mfa'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type MfaEnrollmentState = {
  error?: string
  factorId?: string
  qrCode?: string
  secret?: string
}

export type MfaVerificationState = {
  error?: string
}

export async function startMfaEnrollment(
  previousState: MfaEnrollmentState,
): Promise<MfaEnrollmentState> {
  void previousState
  const access = await requirePlatformAdminIdentity()
  const supabase = await createClient()
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()

  if (factorsError) return { error: 'No se ha podido consultar la configuración MFA.' }
  if (factors.totp.length > 0) {
    return { error: 'Ya existe un autenticador verificado. Introduce su código para continuar.' }
  }

  const staleFactors = factors.all.filter(
    (factor) => factor.factor_type === 'totp' && factor.status === 'unverified',
  )
  for (const factor of staleFactors) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'TALIA Backstage',
    issuer: 'TALIA',
  })

  if (error) return { error: 'No se ha podido iniciar el alta del autenticador.' }

  await recordMfaEvent(access.user.id, 'platform.mfa_enrollment_started', 'aal1')

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  }
}

export async function verifyMfaChallenge(
  previousState: MfaVerificationState,
  formData: FormData,
): Promise<MfaVerificationState> {
  void previousState
  const access = await requirePlatformAdminIdentity()
  const factorId = getFormValue(formData, 'factorId')
  const code = getFormValue(formData, 'code').replaceAll(' ', '')
  const nextPath = normalizePlatformMfaNextPath(getFormValue(formData, 'next'))

  if (!factorId || !/^\d{6}$/.test(code)) {
    return { error: 'Introduce el código de seis dígitos de tu autenticador.' }
  }

  const supabase = await createClient()
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
  const ownedFactor = factors?.all.some(
    (factor) => factor.id === factorId && factor.factor_type === 'totp',
  )

  if (factorsError || !ownedFactor) {
    return { error: 'El factor de autenticación no es válido para esta cuenta.' }
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) return { error: 'El código no es válido o ha caducado. Inténtalo de nuevo.' }

  await recordMfaEvent(access.user.id, 'platform.mfa_verified', 'aal2')

  redirect(nextPath)
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function recordMfaEvent(userId: string, action: string, assuranceLevel: 'aal1' | 'aal2') {
  const admin = createAdminClient()
  const { error } = await admin.from('audit_events').insert({
    actor_user_id: userId,
    action,
    target_type: 'platform_admin',
    target_id: userId,
    metadata: { factor_type: 'totp', assurance_level: assuranceLevel },
  })

  if (error) {
    console.error('[platform-mfa] failed to record audit event', {
      action,
      error: error.message,
    })
  }
}
