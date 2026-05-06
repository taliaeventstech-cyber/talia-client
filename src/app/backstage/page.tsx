import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { CreateTenantForm } from './create-tenant-form'

export default async function BackstageHomePage() {
  const admin = createAdminClient()
  const [{ data: tenants }, { data: invites }] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, slug, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('signup_invites')
      .select('theatre_id, accepted_at, revoked_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const inviteCounts = new Map<string, { pending: number; accepted: number }>()
  ;(invites ?? []).forEach((invite) => {
    const current = inviteCounts.get(invite.theatre_id) ?? { pending: 0, accepted: 0 }
    if (invite.accepted_at) current.accepted += 1
    else if (!invite.revoked_at) current.pending += 1
    inviteCounts.set(invite.theatre_id, current)
  })

  return (
    <div className="stack">
      <CreateTenantForm />

      <div className="section-title-row">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Clientes</h2>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Plan</th>
            <th>Invitaciones</th>
            <th>Creado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {(tenants ?? []).map((tenant) => {
            const counts = inviteCounts.get(tenant.id) ?? { pending: 0, accepted: 0 }
            return (
              <tr key={tenant.id}>
                <td>
                  <strong>{tenant.name}</strong>
                  <p className="muted mono">{tenant.slug}</p>
                </td>
                <td>{tenant.plan}</td>
                <td>{counts.pending} pendientes · {counts.accepted} aceptadas</td>
                <td>{new Date(tenant.created_at).toLocaleDateString('es-ES')}</td>
                <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <Link className="link-accent" href={`/${tenant.id}/overview`}>
                    Ver perfil
                  </Link>
                  <Link className="link-accent" href={`/backstage/tenants/${tenant.id}`}>
                    Editar
                  </Link>
                  <Link className="link-accent" href={`/backstage/tenants/${tenant.id}/invites`}>
                    Invitaciones
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
