import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('users')
    .select('theatre_id')
    .eq('id', user.id)
    .maybeSingle()

  if (member) redirect(`/${member.theatre_id}/overview`)

  return (
    <main className="auth-shell">
      <section className="auth-card onboarding-card stack">
        <p className="section-label">Onboarding Talía</p>
        <h1>Crea el perfil de tu teatro</h1>
        <p className="muted" style={{ maxWidth: 620 }}>
          Esta información alimenta el widget, el prompt inicial y la configuración base del tenant.
          Podrás editarla después desde Settings.
        </p>

        <OnboardingForm email={user.email ?? ''} />
      </section>
    </main>
  )
}
