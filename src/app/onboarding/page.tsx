import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthRedirectPath } from '@/lib/auth/post-auth-redirect'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const postAuthRedirectPath = await getPostAuthRedirectPath(admin, user.id)
  if (postAuthRedirectPath !== '/onboarding') redirect(postAuthRedirectPath)

  return (
    <main className="auth-shell onboarding-shell">
      <section className="auth-card onboarding-card">
        <OnboardingForm email={user.email ?? ''} />
      </section>
    </main>
  )
}
