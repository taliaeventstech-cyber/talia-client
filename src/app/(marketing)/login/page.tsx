import { AuthSplineBackground } from '@/components/auth-spline-background'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { LoginForm } from './login-form'

type Props = {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>
}

function getInternalRedirect(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

export default async function LoginPage({ searchParams }: Props) {
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const params = await searchParams
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error
  const next = Array.isArray(params.next) ? params.next[0] : params.next

  return (
    <main className="auth-shell auth-marketing-shell">
      <AuthSplineBackground sceneUrl={process.env.NEXT_PUBLIC_AUTH_SPLINE_SCENE_URL} />
      <section className="auth-card">
        <LoginForm copy={dictionary.auth.login} errorParam={errorParam} redirectTo={getInternalRedirect(next)} />
      </section>
    </main>
  )
}
