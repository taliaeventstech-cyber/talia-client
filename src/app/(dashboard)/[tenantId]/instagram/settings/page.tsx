import { LocalDateTime } from '@/components/local-date-time'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getIntlLocale } from '@/lib/i18n/config'
import { getInstagramConnectionCopy } from '@/lib/i18n/instagram-connection-copy'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getInstagramConnectionSummary } from '@/lib/instagram/connection-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { DisconnectInstagramConnectionButton } from './disconnect-connection-button'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ instagram_connected?: string; instagram_error?: string }>
}

export default async function InstagramSettingsPage({ params, searchParams }: Props) {
  const [{ tenantId }, query] = await Promise.all([params, searchParams])
  const locale = await getLocale()
  const copy = getInstagramConnectionCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'manage_instagram', 'instagram')
  const connection = await getInstagramConnectionSummary(createAdminClient(), {
    tenantId,
    actorUserId: access.userId,
  })
  const presentation = getConnectionPresentation(connection, copy)

  return (
    <main className="page-shell">
      <header className="page-header instagram-settings-header">
        <p className="section-label">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.description}</p>
      </header>

      <section className="card stack instagram-connection-card">
        <div className="instagram-connection-heading">
          <strong>{copy.status}</strong>
          <span className={`status-pill ${getConnectionStatusClass(connection?.status)}`}>
            {presentation.label}
          </span>
        </div>

        {query.instagram_connected === '1' ? <p className="notice notice-success" role="status">{copy.connectedNotice}</p> : null}
        {query.instagram_error ? (
          <p className="notice notice-error" role="alert">
            {query.instagram_error === 'webhook_subscription'
              ? copy.subscriptionFailedNotice
              : copy.failedNotice}
          </p>
        ) : null}
        <p className="muted instagram-connection-state-description">{presentation.description}</p>

        {connection ? (
          <dl className="instagram-connection-metadata">
            <dt>{copy.account}</dt><dd>@{connection.username}</dd>
            <dt>{copy.accountType}</dt><dd>{connection.account_type}</dd>
            {connection.token_expires_at ? (
              <><dt>{copy.expires}</dt><dd><LocalDateTime value={connection.token_expires_at} locale={getIntlLocale(locale)} /></dd></>
            ) : null}
          </dl>
        ) : null}

        <a className="button-primary button-fit" href={`/api/instagram/connect?tenantId=${tenantId}`}>
          {connection ? copy.replace : copy.connect}
        </a>
        {connection?.status === 'connected' ? (
          <DisconnectInstagramConnectionButton
            connectionId={connection.id}
            copy={copy}
            tenantId={tenantId}
          />
        ) : null}
        <p className="muted instagram-connection-pilot-notice">{copy.pilotNotice}</p>
        <p className="muted instagram-connection-permissions">{copy.permissions}</p>
      </section>
    </main>
  )
}

function getConnectionPresentation(
  connection: Awaited<ReturnType<typeof getInstagramConnectionSummary>>,
  copy: ReturnType<typeof getInstagramConnectionCopy>,
) {
  if (!connection) return { label: copy.disconnected, description: copy.disconnectedDescription }
  if (connection.status === 'connected') return { label: copy.connected, description: copy.connectedDescription }
  if (connection.status === 'error') return { label: copy.error, description: copy.errorDescription }
  if (connection.status === 'revoked') return { label: copy.revoked, description: copy.revokedDescription }
  return { label: copy.disabled, description: copy.disabledDescription }
}

function getConnectionStatusClass(status: string | undefined) {
  if (status === 'connected') return 'status-pill-active'
  if (status === 'error' || status === 'revoked') return 'status-pill-danger'
  return 'status-pill-muted'
}
