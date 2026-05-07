import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { SignupForm } from './signup-form'

type Props = {
  searchParams: Promise<{ invite?: string | string[] }>
}

export default async function SignupPage({ searchParams }: Props) {
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const params = await searchParams
  const invite = Array.isArray(params.invite) ? params.invite[0] : params.invite

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <SignupForm copy={dictionary.auth.signup} initialInviteToken={invite ?? ''} />
      </section>
    </main>
  )
}
