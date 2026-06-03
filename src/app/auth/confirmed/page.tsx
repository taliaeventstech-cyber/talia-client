import { AuthLanguageSelect } from '@/components/auth-language-select'
import { AuthSplineBackground } from '@/components/auth-spline-background'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthRedirectPath } from '@/lib/auth/post-auth-redirect'
import { getInternalRedirect } from '@/lib/auth/security'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import Link from 'next/link'

type Props = {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function AuthConfirmedPage({ searchParams }: Props) {
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.auth.confirmed
  const params = await searchParams
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let nextPath = getInternalRedirect(nextParam)

  if (!nextPath && user) {
    nextPath = await getPostAuthRedirectPath(createAdminClient(), user.id)
  }

  const primaryHref = user ? nextPath ?? '/onboarding' : '/login'
  const primaryLabel = user
    ? primaryHref === '/onboarding' ? copy.startOnboarding : copy.enterTalia
    : copy.signIn

  return (
    <main className="auth-shell auth-marketing-shell">
      <AuthSplineBackground sceneUrl={process.env.NEXT_PUBLIC_AUTH_SPLINE_SCENE_URL} />
      <section className="auth-card auth-confirmed-card">
        <AuthLanguageSelect locale={locale} labels={dictionary.language} />
        <div className="auth-confirmed-icon" aria-hidden="true">✓</div>
        <p className="section-label">{copy.section}</p>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.description}</p>
        <div className="auth-confirmed-actions">
          <Link className="button-primary" href={primaryHref}>{primaryLabel}</Link>
          <Link className="button-secondary" href="/login">{copy.secondary}</Link>
        </div>
      </section>
    </main>
  )
}
