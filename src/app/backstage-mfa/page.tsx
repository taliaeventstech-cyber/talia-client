import { requirePlatformAdminIdentity } from '@/lib/platform/auth'
import {
  getVerifiedTotpFactor,
  isPlatformMfaSatisfied,
  normalizePlatformMfaNextPath,
} from '@/lib/platform/mfa'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { MfaForm } from './mfa-form'

type Props = {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function BackstageMfaPage({ searchParams }: Props) {
  const access = await requirePlatformAdminIdentity()
  const params = await searchParams
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next
  const nextPath = normalizePlatformMfaNextPath(nextValue)
  const supabase = await createClient()
  const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ])

  if (!assuranceError && isPlatformMfaSatisfied(assurance.currentLevel)) redirect(nextPath)

  const verifiedFactor = factorsError ? null : getVerifiedTotpFactor(factors.all)

  return (
    <main className="auth-shell">
      <section className="auth-card backstage-mfa-card">
        <Image className="auth-logo" src="/talia-logo-marble.png" alt="Talía" width={132} height={36} priority />
        <span className="backstage-mfa-eyebrow">Acceso administrativo protegido</span>
        <h1>Verificación en dos pasos</h1>
        {(assuranceError || factorsError) ? (
          <>
            <p className="notice notice-error">
              No se ha podido comprobar la configuración MFA. Cierra sesión e inténtalo de nuevo.
            </p>
            <form action="/auth/logout" method="post" className="backstage-mfa-logout">
              <button className="button-outline" type="submit">Cerrar sesión</button>
            </form>
          </>
        ) : (
          <MfaForm
            email={access.user.email ?? 'Administrador de plataforma'}
            nextPath={nextPath}
            verifiedFactorId={verifiedFactor?.id ?? null}
          />
        )}
      </section>
    </main>
  )
}
