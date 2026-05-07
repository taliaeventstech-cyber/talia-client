import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { LoginForm } from './login-form'

type Props = {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function LoginPage({ searchParams }: Props) {
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const params = await searchParams
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <LoginForm copy={dictionary.auth.login} errorParam={errorParam} />
      </section>
    </main>
  )
}
