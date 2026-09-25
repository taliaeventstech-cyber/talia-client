import { QueryToastNotice } from '@/components/ui/query-toast-notice'
import { getEmailSyncConfig } from '@/lib/email/sync'
import { requireEmailAgentPreviewProductAccess } from '@/lib/email/legacy-access'
import { getDictionary, getLocale, type Dictionary } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { disconnectGoogleEmailAction, updateEmailDraftAutomationAction } from '../actions'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams?: Promise<{
    email_connected?: string
    email_disconnected?: string
    email_error?: string
    email_settings_saved?: string
    email_settings_error?: string
  }>
}

type EmailCopy = Dictionary['email']

export default async function EmailSettingsPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = searchParams ? await searchParams : {}
  await requireEmailAgentPreviewProductAccess(tenantId)
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.email
  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('email_connections')
    .select('id, provider, mailbox_email, status, metadata')
    .eq('theatre_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const isConnected = connection?.status === 'connected' || connection?.status === 'syncing'
  const autoDraftEnabled = isConnected
    ? getEmailSyncConfig(connection.metadata).autoDraftAfterSync
    : false
  const successToast = query.email_connected === '1'
    ? copy.toasts.connected
    : query.email_disconnected === '1'
      ? copy.toasts.disconnected
      : query.email_settings_saved === '1'
        ? copy.settings.saved
        : null
  const errorToast = getOAuthErrorMessage(copy, query.email_error)
    ?? (query.email_settings_error ? getSettingsErrorMessage(copy, query.email_settings_error) : null)
  const disconnectAction = disconnectGoogleEmailAction.bind(null, tenantId)
  const updateAutomationAction = updateEmailDraftAutomationAction.bind(null, tenantId)

  return (
    <main className="page-shell">
      {successToast ? <QueryToastNotice message={successToast} tone="success" clearParamPrefix="email_" /> : null}
      {errorToast ? <QueryToastNotice message={errorToast} tone="error" clearParamPrefix="email_" /> : null}

      <header className="page-header email-settings-header">
        <p className="section-label">{copy.section}</p>
        <h1>{copy.settings.title}</h1>
        <p className="muted">{copy.settings.description}</p>
      </header>

      <section className="card stack email-settings-card">
        <div className="email-settings-heading">
          <h2>{copy.settings.connectionTitle}</h2>
          <span className={`status-pill ${getConnectionStatusClass(connection?.status)}`}>
            {formatConnectionStatus(copy, connection?.status)}
          </span>
        </div>

        {isConnected ? (
          <dl className="email-settings-metadata">
            <dt>{copy.settings.mailbox}</dt>
            <dd>{connection.mailbox_email}</dd>
            <dt>{copy.settings.provider}</dt>
            <dd>{formatProvider(copy, connection.provider)}</dd>
          </dl>
        ) : null}

        <div className="email-settings-actions">
          <a className="button-primary button-fit" href={getProviderConnectUrl(tenantId, isConnected ? connection.provider : 'google')}>
            {isConnected ? copy.header.reconnect : copy.settings.connectAccount}
          </a>
          {isConnected ? (
            <form action={disconnectAction}>
              <button className="button-outline button-danger button-fit" type="submit">
                {copy.header.disconnect}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {isConnected ? (
        <section className="card stack email-settings-card">
          <div className="email-settings-heading">
            <h2>{copy.settings.automationTitle}</h2>
          </div>
          <form className="email-automation-form" action={updateAutomationAction}>
            <label className="checkbox-row checkbox-row-card">
              <input
                defaultChecked={autoDraftEnabled}
                name="auto_draft_after_sync"
                type="checkbox"
              />
              <span>
                <strong>{copy.settings.autoDraftLabel}</strong>
                <small>{copy.settings.autoDraftDescription}</small>
              </span>
            </label>
            <button className="button-primary button-fit" type="submit">
              {copy.settings.save}
            </button>
          </form>
        </section>
      ) : null}

    </main>
  )
}

function getConnectionStatusClass(status?: string) {
  if (status === 'connected' || status === 'syncing') return 'status-pill-active'
  if (status === 'error' || status === 'revoked') return 'status-pill-danger'
  return 'status-pill-muted'
}

function formatConnectionStatus(copy: EmailCopy, status?: string) {
  if (!status) return copy.statuses.revoked
  if (status === 'connected') return copy.statuses.connected
  if (status === 'syncing') return copy.statuses.syncing
  if (status === 'error') return copy.statuses.error
  if (status === 'revoked') return copy.statuses.revoked
  if (status === 'disabled') return copy.statuses.disabled
  return copy.statuses.pending
}

function formatProvider(copy: EmailCopy, provider?: string) {
  if (provider === 'google') return copy.provider.google
  if (provider === 'microsoft') return copy.provider.microsoft
  if (provider === 'imap') return copy.provider.imap
  if (provider === 'forwarding') return copy.provider.forwarding
  return copy.provider.unknown
}

function getProviderConnectUrl(tenantId: string, provider?: string) {
  return provider === 'microsoft'
    ? `/api/email/microsoft/connect?tenantId=${tenantId}`
    : `/api/email/google/connect?tenantId=${tenantId}`
}

function getOAuthErrorMessage(copy: EmailCopy, error?: string) {
  if (!error) return null
  if (error === 'oauth_config') return copy.toasts.oauthConfig
  if (error === 'oauth_callback') return copy.toasts.oauthCallback
  if (error === 'missing_code') return copy.toasts.missingCode
  if (error === 'access_denied') return copy.toasts.accessDenied
  if (error === 'no_connection') return copy.toasts.noConnection
  if (error === 'disconnect_failed') return copy.toasts.disconnectFailed
  return copy.toasts.connectFailed(error)
}

function getSettingsErrorMessage(copy: EmailCopy, error: string) {
  return error === 'no_connection'
    ? copy.settings.connectionRequired
    : copy.settings.saveError
}
