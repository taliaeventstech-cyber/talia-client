import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CreateInviteForm } from './create-invite-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function BackstageClientInvitesPage({ params }: Props) {
  const { tenantId } = await params
  const admin = createAdminClient()
  const [{ data: tenant }, { data: invites }] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, slug')
      .eq('id', tenantId)
      .single(),
    admin
      .from('signup_invites')
      .select('id, email, role, expires_at, accepted_at, revoked_at, created_at')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false }),
  ])

  if (!tenant) notFound()

  return (
    <div className="stack">
      <Link className="back-link" href="/backstage">Volver a clientes</Link>
      <header className="page-header">
        <p className="eyebrow">Invitaciones</p>
        <h2>{tenant.name}</h2>
        <p className="muted mono">{tenant.slug}</p>
        <Link className="link-accent" href={`/${tenant.id}/overview`}>
          Ver perfil del cliente
        </Link>
        <Link className="link-accent" href={`/backstage/tenants/${tenant.id}`}>
          Editar cliente
        </Link>
      </header>

      <CreateInviteForm tenantId={tenant.id} />

      <section className="card stack">
        <h2>Historial</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Caduca</th>
            </tr>
          </thead>
          <tbody>
            {(invites ?? []).map((invite) => (
              <tr key={invite.id}>
                <td>{invite.email}</td>
                <td>{invite.role}</td>
                <td>{getInviteStatus(invite)}</td>
                <td>{new Date(invite.expires_at).toLocaleDateString('es-ES')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function getInviteStatus(invite: { accepted_at: string | null; revoked_at: string | null; expires_at: string }) {
  if (invite.accepted_at) return 'Aceptada'
  if (invite.revoked_at) return 'Revocada'
  if (new Date(invite.expires_at).getTime() < Date.now()) return 'Caducada'
  return 'Pendiente'
}
