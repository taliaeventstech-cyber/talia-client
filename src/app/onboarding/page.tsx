import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthRedirectPath } from '@/lib/auth/post-auth-redirect'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { redirect } from 'next/navigation'
import { OnboardingForm, type OnboardingFormCopy } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const postAuthRedirectPath = await getPostAuthRedirectPath(admin, user.id)
  if (postAuthRedirectPath !== '/onboarding') redirect(postAuthRedirectPath)
  const dictionary = await getDictionary(await getLocale())
  const formCopy = getFormCopy(dictionary.onboarding)

  return (
    <main className="auth-shell onboarding-shell">
      <section className="auth-card onboarding-card">
        <OnboardingForm copy={formCopy} email={user.email ?? ''} />
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
