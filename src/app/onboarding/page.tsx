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
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', fontFamily: 'sans-serif', background: '#f7f7f7' }}>
      <section style={{ width: '100%', maxWidth: 760, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '2rem' }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', marginBottom: '0.75rem' }}>
          Onboarding TALIA
        </p>
        <h1 style={{ fontSize: '2.25rem', lineHeight: 1, marginBottom: '0.75rem' }}>Crea el perfil de tu teatro</h1>
        <p style={{ color: '#666', lineHeight: 1.6, marginBottom: '2rem', maxWidth: 620 }}>
          Esta información alimenta el widget, el prompt inicial y la configuración base del tenant.
          Podrás editarla después desde Settings.
        </p>

        <OnboardingForm email={user.email ?? ''} />
      </section>
    </main>
  )
}
