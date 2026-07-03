import { AuthSplineBackground } from '@/components/auth-spline-background'
import { AuthLanguageSelect } from '@/components/auth-language-select'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { ForgotPasswordForm } from './forgot-password-form'

type Props = {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const params = await searchParams
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error

  return (
    <main className="auth-shell auth-marketing-shell">
      <AuthSplineBackground sceneUrl={process.env.NEXT_PUBLIC_AUTH_SPLINE_SCENE_URL} />
      <section className="auth-card">
        <AuthLanguageSelect locale={locale} labels={dictionary.language} />
        <ForgotPasswordForm copy={dictionary.auth.forgotPassword} errorParam={errorParam} />
      </section>
    </main>
  )
}
