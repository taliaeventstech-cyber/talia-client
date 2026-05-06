import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EditClientForm } from './edit-client-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function BackstageClientPage({ params }: Props) {
  const { tenantId } = await params
  const admin = createAdminClient()
  const [{ data: client }, { data: modules }] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, slug, entity_type, primary_language, plan, website_url, fallback_email, fallback_phone')
      .eq('id', tenantId)
      .single(),
    admin
      .from('tenant_modules')
      .select('module_key, status')
      .eq('theatre_id', tenantId),
  ])

  if (!client) notFound()

  return (
    <div className="stack">
      <Link className="back-link" href="/backstage">Volver a clientes</Link>

      <header className="page-header">
        <p className="eyebrow">Cliente</p>
        <h2>{client.name}</h2>
        <p className="muted mono">{client.slug}</p>
      </header>

      <div className="internal-nav">
        <Link className="link-accent" href={`/${client.id}/overview`}>
          Ver perfil
        </Link>
        <Link className="link-accent" href={`/backstage/tenants/${client.id}/invites`}>
          Invitaciones
        </Link>
      </div>

      <EditClientForm client={client} modules={modules ?? []} />
    </div>
  )
}
