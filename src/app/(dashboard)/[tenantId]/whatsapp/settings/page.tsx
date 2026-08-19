import { LocalDateTime } from '@/components/local-date-time'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getWhatsappConnectionCopy } from '@/lib/i18n/whatsapp-connection-copy'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappConnectionSummary } from '@/lib/whatsapp/connection-service'
import { WhatsappEmbeddedSignupButton } from './embedded-signup-button'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function WhatsappSettingsPage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const copy = getWhatsappConnectionCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'manage_whatsapp', 'whatsapp')
  const connection = await getWhatsappConnectionSummary(createAdminClient(), {
    tenantId,
    actorUserId: access.userId,
  })

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.description}</p>
      </header>

      <section className="card stack whatsapp-connection-card">
        <div className="whatsapp-connection-heading">
          <strong>{copy.status}</strong>
          <span className={`status-pill ${getConnectionStatusClass(connection?.status)}`}>
            {getConnectionStatusLabel(connection, copy)}
          </span>
        </div>

        {connection ? (
          <dl className="whatsapp-handoff-metadata">
            {connection.display_phone_number ? (
              <><dt>{copy.phone}</dt><dd>{connection.display_phone_number}</dd></>
            ) : null}
            {connection.verified_name ? (
              <><dt>{copy.name}</dt><dd>{connection.verified_name}</dd></>
            ) : null}
            {connection.token_expires_at ? (
              <>
                <dt>{copy.expires}</dt>
                <dd><LocalDateTime value={connection.token_expires_at} locale={getIntlLocale(locale)} /></dd>
              </>
            ) : null}
          </dl>
        ) : null}

        {connection?.status !== 'connected' || connection.credential_source === 'environment' ? (
          <WhatsappEmbeddedSignupButton
            appId={process.env.NEXT_PUBLIC_META_APP_ID ?? null}
            configId={process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID ?? null}
            copy={copy}
            graphApiVersion={normalizeGraphApiVersion(process.env.META_WHATSAPP_GRAPH_API_VERSION)}
            replacingPilot={connection?.credential_source === 'environment'}
            tenantId={tenantId}
          />
        ) : null}
        <p className="muted whatsapp-connection-permissions">{copy.permissions}</p>
      </section>
    </main>
  )
}

function getConnectionStatusLabel(
  connection: Awaited<ReturnType<typeof getWhatsappConnectionSummary>>,
  copy: ReturnType<typeof getWhatsappConnectionCopy>,
) {
  if (!connection) return copy.disconnected
  if (connection.credential_source === 'environment' && connection.status === 'connected') return copy.pilot
  if (connection.status === 'connected') return copy.connected
  if (connection.status === 'error') return copy.error
  return copy.pending
}

function getConnectionStatusClass(status: string | undefined) {
  if (status === 'connected') return 'status-pill-active'
  if (status === 'error' || status === 'revoked') return 'status-pill-danger'
  return 'status-pill-muted'
}

function normalizeGraphApiVersion(value: string | undefined) {
  return /^v\d+\.\d+$/.test(value ?? '') ? value! : 'v26.0'
}
