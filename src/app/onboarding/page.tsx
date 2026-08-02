import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthRedirectPath } from '@/lib/auth/post-auth-redirect'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { redirect } from 'next/navigation'
import { OnboardingForm, type OnboardingFormCopy } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const postAuthRedirectPath = await getPostAuthRedirectPath(admin, user.id)
  if (postAuthRedirectPath !== '/onboarding') redirect(postAuthRedirectPath)
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const formCopy = getFormCopy(dictionary.onboarding)

  return (
    <main className="auth-shell onboarding-shell">
      <div className="onboarding-global-controls" aria-label={dictionary.language.label}>
        <LanguageToggle
          locale={locale}
          labels={{
            label: dictionary.language.label,
            es: dictionary.language.es,
            ca: dictionary.language.ca,
            en: dictionary.language.en,
            ptBR: dictionary.language.ptBR,
          }}
        />
        <ThemeToggle />
      </div>
      <section className="auth-card onboarding-card">
        <OnboardingForm copy={formCopy} email={user.email ?? ''} defaultLanguage={locale} />
      </section>
    </main>
  )
}

function getFormCopy(copy: Awaited<ReturnType<typeof getDictionary>>['onboarding']): OnboardingFormCopy {
  const { stepLabel, useCases, ...serializableCopy } = copy
  const { selectedCount, ...serializableUseCases } = useCases

  return {
    ...serializableCopy,
    stepLabels: [
      stepLabel(1, 3),
      stepLabel(2, 3),
      stepLabel(3, 3),
    ],
    useCases: {
      ...serializableUseCases,
      selectedCountLabels: {
        0: selectedCount(0, 3),
        1: selectedCount(1, 3),
        2: selectedCount(2, 3),
        3: selectedCount(3, 3),
      },
    },
  }
}
