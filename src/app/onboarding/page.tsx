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

  if (process.env.ENABLE_SELF_SERVE_ONBOARDING !== 'true') {
    return (
      <main className="auth-shell">
        <section className="auth-card stack">
          <p className="section-label">Acceso privado</p>
          <h1>Talía funciona por invitación</h1>
          <p className="muted">
            Esta cuenta no está vinculada a ningún cliente. Si ya eres cliente, usa el enlace de invitación
            que te ha enviado el equipo de Talía.
          </p>
          <form action="/auth/logout" method="post">
            <button className="button-primary" type="submit">Cerrar sesión</button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell">
      <section className="auth-card onboarding-card stack">
        <p className="section-label">Onboarding Talía</p>
        <h1>Prepara TALIA para tu entidad cultural</h1>
        <p className="muted" style={{ maxWidth: 620 }}>
          Te haremos unas pocas preguntas para crear el espacio inicial. Lo técnico, como fuentes,
          Excel o instalación del snippet, podrás completarlo después desde el dashboard.
        </p>

        <OnboardingForm email={user.email ?? ''} />
      </section>
    </main>
  )
}
