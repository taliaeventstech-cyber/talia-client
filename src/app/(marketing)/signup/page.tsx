import { AuthSplineBackground } from '@/components/auth-spline-background'
import { AuthLanguageSelect } from '@/components/auth-language-select'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { SignupForm } from './signup-form'

type Props = {
  searchParams: Promise<{ next?: string | string[] }>
}

function getInternalRedirect(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

export default async function SignupPage({ searchParams }: Props) {
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const params = await searchParams
  const next = Array.isArray(params.next) ? params.next[0] : params.next

  return (
    <main className="auth-shell auth-marketing-shell">
      <AuthSplineBackground sceneUrl={process.env.NEXT_PUBLIC_AUTH_SPLINE_SCENE_URL} />
      <section className="auth-card">
        <AuthLanguageSelect locale={locale} labels={dictionary.language} />
        <SignupForm copy={dictionary.auth.signup} redirectTo={getInternalRedirect(next)} />
      </section>
    </main>
  )
}
