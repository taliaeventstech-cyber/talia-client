import { AuthSplineBackground } from '@/components/auth-spline-background'
import { AuthLanguageSelect } from '@/components/auth-language-select'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from './reset-password-form'

export default async function ResetPasswordPage() {
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)

  // Reaching this page requires the recovery session set by /auth/reset-callback.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/forgot-password?error=recovery_link_invalid')

  return (
    <main className="auth-shell auth-marketing-shell">
      <AuthSplineBackground sceneUrl={process.env.NEXT_PUBLIC_AUTH_SPLINE_SCENE_URL} />
      <section className="auth-card">
        <AuthLanguageSelect locale={locale} labels={dictionary.language} />
        <ResetPasswordForm copy={dictionary.auth.resetPassword} />
      </section>
    </main>
  )
}
