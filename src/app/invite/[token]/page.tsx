import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hashInviteToken } from '@/lib/auth/invite-token'
import Link from 'next/link'

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string | string[] }>
}

function getInviteLink(token: string) {
  return `/invite/${encodeURIComponent(token)}`
}

function getAuthLink(path: '/login' | '/signup', token: string) {
  return `${path}?next=${encodeURIComponent(getInviteLink(token))}`
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { token } = await params
  const query = await searchParams
  const error = Array.isArray(query.error) ? query.error[0] : query.error
  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('signup_invites')
    .select('id, account_id, theatre_id, email, role, expires_at, accepted_at, revoked_at')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const invalidInvite = !invite ||
    invite.accepted_at ||
    invite.revoked_at
  const userEmail = user?.email?.toLowerCase()
  const emailMismatch = Boolean(userEmail && invite && invite.email !== userEmail)

  return (
    <main className="auth-shell">
      <section className="auth-card stack">
        <p className="section-label">Invitación de equipo</p>
        <h1>Acceso a TALIA</h1>

        {invalidInvite ? (
          <p className="notice notice-error">
            Esta invitación no es válida, ya se ha usado o ha caducado.
          </p>
        ) : null}

        {!invalidInvite && error ? (
          <p className="notice notice-error">
            No se pudo aceptar la invitación. Inténtalo de nuevo.
          </p>
        ) : null}

        {!invalidInvite && !user ? (
          <>
            <p className="muted">
              Has sido invitado con el email <strong>{invite.email}</strong>. Crea una cuenta o entra
              con ese mismo email para aceptar el acceso.
            </p>
            <div className="action-row">
              <Link className="button-primary" href={getAuthLink('/signup', token)}>Crear cuenta</Link>
              <Link className="button-secondary" href={getAuthLink('/login', token)}>Entrar</Link>
            </div>
          </>
        ) : null}

        {!invalidInvite && user && emailMismatch ? (
          <>
            <p className="notice notice-error">
              Esta invitación es para <strong>{invite.email}</strong>, pero has entrado como{' '}
              <strong>{userEmail}</strong>.
            </p>
            <form action="/auth/logout" method="post">
              <button className="button-secondary" type="submit">Cambiar cuenta</button>
            </form>
          </>
        ) : null}

        {!invalidInvite && user && !emailMismatch ? (
          <>
            <p className="muted">
              Acepta la invitación para acceder al espacio de trabajo de esta entidad.
            </p>
            <form action="/auth/accept-invite" method="post">
              <input type="hidden" name="token" value={token} />
              <button className="button-primary" type="submit">Aceptar invitación</button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  )
}
