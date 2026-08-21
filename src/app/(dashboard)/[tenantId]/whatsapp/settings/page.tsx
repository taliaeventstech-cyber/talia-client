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
  const presentation = getConnectionPresentation(connection, copy)

  return (
    <main className="page-shell">
      <header className="page-header whatsapp-settings-header">
        <p className="section-label">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.description}</p>
      </header>

      <section className="card stack whatsapp-connection-card">
        <div className="whatsapp-connection-heading">
          <strong>{copy.status}</strong>
          <span className={`status-pill ${getConnectionStatusClass(connection?.status)}`}>
            {presentation.label}
          </span>
        </div>

        <p className="muted whatsapp-connection-state-description">{presentation.description}</p>

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
            retryingConnection={Boolean(connection && connection.status !== 'connected')}
            tenantId={tenantId}
          />
        ) : null}
        <p className="muted whatsapp-connection-permissions">{copy.permissions}</p>
      </section>
    </main>
  )
}

function getConnectionPresentation(
  connection: Awaited<ReturnType<typeof getWhatsappConnectionSummary>>,
  copy: ReturnType<typeof getWhatsappConnectionCopy>,
) {
  if (!connection) return { label: copy.disconnected, description: copy.disconnectedDescription }
  if (connection.credential_source === 'environment' && connection.status === 'connected') {
    return { label: copy.pilot, description: copy.pilotDescription }
  }
  if (connection.status === 'connected') {
    return { label: copy.connected, description: copy.connectedDescription }
  }
  if (connection.status === 'error') {
    return { label: copy.error, description: copy.errorDescription }
  }
  if (connection.status === 'revoked') {
    return { label: copy.revoked, description: copy.revokedDescription }
  }
  if (connection.status === 'disabled') {
    return { label: copy.disabled, description: copy.disabledDescription }
  }
  return { label: copy.pending, description: copy.pendingDescription }
}

function getConnectionStatusClass(status: string | undefined) {
  if (status === 'connected') return 'status-pill-active'
  if (status === 'error' || status === 'revoked') return 'status-pill-danger'
  return 'status-pill-muted'
}

function normalizeGraphApiVersion(value: string | undefined) {
  return /^v\d+\.\d+$/.test(value ?? '') ? value! : 'v26.0'
}
