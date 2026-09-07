import { createAdminClient } from '@/lib/supabase/admin'
import { getKnowledgeWebOperationalAlerts } from '@/lib/knowledge/web-source-alerts'
import { getActiveSubscription, getTenantUsageHistory } from '@/lib/usage/service'
import { getManagedWebQuotaUsage } from '@/lib/knowledge/web-source-quotas'
import { canReprocessKnowledgeSourceFromBackstage, getBackstageSyncRunPresentation } from '@/lib/knowledge/backstage-sources'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { hasPlatformPermission } from '@/lib/platform/permissions'
import { ChevronLeft, ChevronRight, FileText, LayoutDashboard, LifeBuoy, ScanHeart, TextSearch } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { EditClientForm } from './edit-client-form'
import { BackstageDeleteKnowledgeSourceButton, BackstageManagedWebSyncToggle, BackstageProgrammeExtractionToggle, BackstageReindexTenantKnowledgeButton, BackstageReprocessSourceButton, BackstageRetryEmbeddingsButton } from './knowledge-source-actions'
import { KnowledgeWebAlerts } from '../../knowledge-web-alerts'
import { KnowledgeSyncRealtime } from '@/components/knowledge-sync-realtime'
import { getKnowledgeSyncActivity } from '@/lib/knowledge/sync-activity'
import { BackstagePageSizeSelect } from '../../backstage-page-size-select'
import { SubscriptionCancellationPanel } from './subscription-cancellation-panel'
import { VenueDetailsPanel } from './venue-details-panel'
import { KnowledgeSourceTypeFilter } from './knowledge-source-type-filter'
import { buildResponseTraceExport, buildResponseTraceFilename } from '@/lib/knowledge/response-trace-export'
import { ResponseTraceDownloadButton } from './response-trace-download-button'
import { getResponseFeedbackMetrics } from '@/lib/knowledge/response-feedback-metrics'
import { buildBackstageKnowledgeHealth, loadBackstageKnowledgeChunks, loadBackstageKnowledgeHealth } from '@/lib/knowledge/backstage-knowledge-health'
import { summarizeRetrievalTrace, type RetrievalTraceAttempt } from '@/lib/chat/retrieval-trace'
import { hasKnowledgeSourceDebugData, type DebuggableSource } from '@/lib/knowledge/source-debug'
import { BackstageKnowledgeSourceDebugDownloadButton } from './knowledge-source-debug-download-button'
import { BackstageAiDiagnosticPanel } from './ai-diagnostic-panel'
import { shouldOfferResponseDiagnostic } from '@/lib/diagnostics/report'
import {
  backstageResponseTraceChannels,
  getBackstageResponseTraces,
  type BackstageResponseTraceChannel,
} from '@/lib/attention/backstage-response-traces'
import { isProgrammeExtractionEnabled, summarizeProgrammeExtractionBySource } from '@/lib/knowledge/programme'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams?: Promise<{
    tab?: string
    page?: string
    page_size?: string
    trace_channel?: string
    source_page?: string
    source_page_size?: string
    source_type?: string
    source_status?: string
  }>
}

const TRACE_PAGE_SIZES = [10, 25, 50] as const
const KNOWLEDGE_SOURCE_PAGE_SIZES = [10, 25, 50, 100] as const
type VenueTabKey = 'overview' | 'knowledge' | 'traceability'

export default async function BackstageClientPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = await searchParams
  const activeTab = normalizeVenueTab(query?.tab)
  const tracePageSize = normalizeTracePageSize(query?.page_size)
  const tracePage = normalizePositiveInteger(query?.page, 1)
  const traceChannelFilter = normalizeTraceChannel(query?.trace_channel)
  const traceQueryChannel = activeTab === 'traceability' ? traceChannelFilter : null
  const traceFrom = (tracePage - 1) * tracePageSize
  const sourcePageSize = normalizeKnowledgeSourcePageSize(query?.source_page_size)
  const sourcePage = normalizePositiveInteger(query?.source_page, 1)
  const sourceTypeFilter = normalizeKnowledgeSourceTypeFilter(query?.source_type)
  const sourceStatusFilter = normalizeKnowledgeSourceStatusFilter(query?.source_status)
  const sourceFrom = (sourcePage - 1) * sourcePageSize
  const admin = createAdminClient()
  const [{ data: client }, { data: modules }, { data: emailConnections }, { data: emailTraceThreads }, subscriptionResult, traceResult, knowledgeSourcesResult, knowledgeSourceSummaries, knowledgeHealthResult, activeKnowledgeSyncResult, managedWebQuota, webAlerts, { data: knowledgeSupportRequests }] = await Promise.all([
    admin
      .from('theatres')
      .select('id, account_id, name, slug, entity_type, primary_language, plan, website_url, fallback_email, fallback_phone, n8n_webhook_url, system_prompt, widget_config, voice_phone_number, voice_phone_provider, voice_phone_mode, voice_public_phone_number, voice_forwarding_notes, voice_operational_status')
      .eq('id', tenantId)
      .single(),
    admin
      .from('tenant_modules')
      .select('module_key, status')
      .eq('theatre_id', tenantId),
    admin
      .from('email_connections')
      .select('id, provider, mailbox_email, status, sync_mode, draft_mode, error_message, metadata')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1),
    admin
      .from('email_threads')
      .select('id, subject, status, metadata, updated_at')
      .eq('theatre_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(25),
    getActiveSubscription(admin, tenantId),
    getBackstageResponseTraces(admin, {
      tenantId,
      channel: traceQueryChannel,
      limit: tracePageSize,
      offset: traceFrom,
    }),
    getKnowledgeSourcesPage(admin, {
      tenantId,
      sourceType: sourceTypeFilter,
      sourceStatus: sourceStatusFilter,
      from: sourceFrom,
      pageSize: sourcePageSize,
    }),
    getAllKnowledgeSourceSummaries(admin, tenantId),
    loadBackstageKnowledgeHealth(admin, tenantId),
    admin
      .from('knowledge_sync_runs')
      .select('source_id, status, discovered_count, checked_count, metadata')
      .eq('theatre_id', tenantId)
      .in('status', ['queued', 'running']),
    getManagedWebQuotaUsage(admin, tenantId),
    getKnowledgeWebOperationalAlerts(admin, { tenantId }),
    admin
      .from('knowledge_source_support_requests')
      .select('id, source_id, sync_run_id, requested_by, customer_message, error_code, status, delivery_status, delivery_error, created_at')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!client) notFound()

  const traceMessages = traceResult.items
  const traceCount = traceResult.count
  const responseFeedbackMetrics = getResponseFeedbackMetrics({
    positiveCount: traceResult.metrics.responsePositive,
    negativeCount: traceResult.metrics.responseNegative,
    totalCount: traceCount,
  })
  const tracePageCount = Math.max(1, Math.ceil(traceCount / tracePageSize))
  if (activeTab === 'traceability' && tracePage > tracePageCount) {
    redirect(buildTraceabilityHref({
      tenantId,
      page: tracePageCount,
      pageSize: tracePageSize,
      channel: traceChannelFilter,
    }))
  }
  const knowledgeSources = knowledgeSourcesResult.data ?? []
  const knowledgeSourceCount = knowledgeSourcesResult.count ?? 0
  const sourcePageCount = Math.max(1, Math.ceil(knowledgeSourceCount / sourcePageSize))
  if (activeTab === 'knowledge' && sourcePage > sourcePageCount) {
    redirect(buildKnowledgeSourcesHref({
      tenantId,
      page: sourcePageCount,
      pageSize: sourcePageSize,
      sourceType: sourceTypeFilter,
      sourceStatus: sourceStatusFilter,
    }))
  }

  const subscription = subscriptionResult.ok ? subscriptionResult.subscription : null
  const usageHistoryResult = await getTenantUsageHistory(admin, tenantId)
  const usageHistory = usageHistoryResult.ok ? usageHistoryResult.history : []
  const currentUsage = usageHistory.find((entry) => entry.subscriptionId === subscription?.id)
    ?? usageHistory.find((entry) => entry.isCurrent)
  const usage = currentUsage?.usage ?? null
  const chatLimit = subscription?.included_chat_conversations ?? 0
  const chatUsed = currentUsage?.billableChatMessages ?? 0
  const chatPercent = chatLimit > 0 ? Math.min(100, Math.round((chatUsed / chatLimit) * 100)) : 0
  const totalTokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)
  const traceSourceIds = Array.from(new Set(traceMessages
    .flatMap((message) => getAgentSources(message.metadata))
    .map((source) => source.source_id)
    .filter((sourceId): sourceId is string => Boolean(sourceId))))
  const visibleKnowledgeSourceIds = knowledgeSources.map((source) => source.id)
  const [{ data: traceSources }, knowledgeChunksResult, { data: knowledgeDocuments }, { data: knowledgeSyncRuns }] = await Promise.all([
    traceSourceIds.length
      ? admin
        .from('knowledge_sources')
        .select('id, name, type, config')
        .in('id', traceSourceIds)
        .eq('theatre_id', tenantId)
      : Promise.resolve({ data: [] }),
    loadBackstageKnowledgeChunks(admin, {
      tenantId,
      sourceIds: visibleKnowledgeSourceIds,
    }),
    visibleKnowledgeSourceIds.length
      ? admin
        .from('knowledge_documents')
        .select('source_id, status, metadata')
        .eq('theatre_id', tenantId)
        .in('source_id', visibleKnowledgeSourceIds)
      : Promise.resolve({ data: [] }),
    visibleKnowledgeSourceIds.length
      ? admin
        .from('knowledge_sync_runs')
        .select('source_id, status, trigger, discovered_count, checked_count, changed_count, unchanged_count, failed_count, blocked_count, metadata, created_at, finished_at, error_code, error_details')
        .eq('theatre_id', tenantId)
        .in('source_id', visibleKnowledgeSourceIds)
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])
  const [{ data: account }, platformAccess] = await Promise.all([
    client.account_id
      ? admin
        .from('accounts')
        .select('id, name, billing_email, status, metadata, created_at')
        .eq('id', client.account_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    requirePlatformAdmin(),
  ])
  const sourceById = new Map((traceSources ?? []).map((source) => [source.id, source]))
  const chunkStatsAvailable = knowledgeChunksResult.error === null
  const chunkStatsBySource = getChunkStatsBySource(knowledgeChunksResult.data ?? [])
  const documentCountsBySource = getDocumentCountsBySource(knowledgeDocuments ?? [])
  const programmeExtractionBySource = summarizeProgrammeExtractionBySource(knowledgeDocuments ?? [])
  const latestSyncRunBySource = getLatestSyncRunBySource(knowledgeSyncRuns ?? [])
  const activeSyncRunBySource = new Map(
    (activeKnowledgeSyncResult.data ?? []).map((run) => [run.source_id, run]),
  )
  const knowledgeSyncActivity = getKnowledgeSyncActivity(
    knowledgeSourceSummaries
      .filter((source) => isManagedWebSource(source.type))
      .map((source) => {
        const stats = chunkStatsBySource.get(source.id) ?? createEmptyChunkStats()
        const activeRun = activeSyncRunBySource.get(source.id)
        const hasPendingEmbeddings = source.status === 'ready' && stats.pending + stats.processing > 0
        return {
          name: getKnowledgeSourceName(source),
          syncEnabled: source.sync_enabled,
          latestSyncRun: activeRun ?? (hasPendingEmbeddings
            ? {
              status: 'succeeded',
              discovered_count: 0,
              checked_count: 0,
              metadata: {},
            }
            : null),
          embeddingCounts: {
            ready: stats.ready,
            pending: stats.pending,
            processing: stats.processing,
            error: stats.error,
          },
        }
      }),
  )
  const knowledgeSourceNameById = new Map(knowledgeSourceSummaries.map((source) => [source.id, getKnowledgeSourceName(source)]))
  const knowledgeSourceTypeOptions = getKnowledgeSourceTypeOptions(knowledgeSourceSummaries)
  const ragHealth = buildBackstageKnowledgeHealth(knowledgeHealthResult.counts)
  const traceStats = traceResult.metrics
  const feedbackStats = traceResult.metrics
  const accountBilling = getAccountBillingMetadata(account?.metadata)
  const canManageCustomerBilling = hasPlatformPermission(platformAccess.permissions, 'manage_customer_billing')

  return (
    <div className="stack">
      <nav className="backstage-venue-breadcrumbs" aria-label="Navegación del cliente">
        <Link href="/backstage/clients">Clientes</Link>
        <ChevronRight aria-hidden="true" size={14} strokeWidth={2} />
        {activeTab === 'overview' ? (
          <span aria-current="page">{client.name}</span>
        ) : (
          <>
            <Link href={`/backstage/tenants/${tenantId}`}>{client.name}</Link>
            <ChevronRight aria-hidden="true" size={14} strokeWidth={2} />
            <span aria-current="page">{activeTab === 'knowledge' ? 'Salud del conocimiento' : 'Trazabilidad de respuestas'}</span>
          </>
        )}
      </nav>

      <header className="page-header backstage-venue-header">
        <div>
          <p className="eyebrow">Venue</p>
          <h2>{client.name}</h2>
          <p className="muted mono">{client.id}</p>
        </div>
        <div className="header-actions">
          <IconAction href={`/${client.id}/overview`} label="Ver dashboard" newTab>
            <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
          </IconAction>
          <VenueDetailsPanel venueName={client.name}>
            <section className="backstage-venue-context-summary">
              <div>
                <span>Cuenta</span>
                <strong>{account?.name ?? client.name}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{account?.status ?? 'active'}</strong>
              </div>
              <div>
                <span>Alta</span>
                <strong>{account?.created_at ? new Date(account.created_at).toLocaleDateString('es-ES') : '—'}</strong>
              </div>
              <div>
                <span>Facturación</span>
                <strong>{account?.billing_email ?? 'Sin email'}</strong>
              </div>
            </section>

            <section className="card stack backstage-venue-plan-panel">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Consumo</p>
                  <h2>Uso del plan</h2>
                </div>
                <span className="status-pill status-pill-active">{subscription?.status ?? 'sin periodo'}</span>
              </div>

              <div className="usage-plan-compact-card">
                <div className="usage-plan-main">
                  <div className="usage-plan-main-row">
                    <div>
                      <p className="eyebrow">Chatbot</p>
                      <strong className="usage-value usage-value-compact">
                        {chatLimit > 0 ? `${chatUsed} / ${chatLimit}` : `${chatUsed}`}
                      </strong>
                    </div>
                    <span className="plan-usage-percent">{chatPercent}%</span>
                  </div>
                  <div className="progress-track plan-usage-track">
                    <div className="progress-fill" style={{ width: `${chatPercent}%` }} />
                  </div>
                  <p className="muted">Plan {subscription?.plan ?? client.plan} · periodo {subscription?.billing_period_start ?? '—'} → {subscription?.billing_period_end ?? '—'}</p>
                </div>

                <dl className="usage-plan-side">
                  <div>
                    <dt>Coste IA estimado</dt>
                    <dd>{formatCurrency(usage?.estimatedCostCents ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Tokens IA</dt>
                    <dd>{formatTokens(totalTokens)}</dd>
                    <small>{formatTokens(usage?.inputTokens ?? 0)} entrada · {formatTokens(usage?.outputTokens ?? 0)} salida</small>
                  </div>
                </dl>
              </div>

              <div className="usage-history-backstage">
                <div>
                  <h3>Historial mensual</h3>
                  <p className="muted">Últimos periodos de facturación disponibles para este cliente.</p>
                </div>
                {usageHistory.length === 0 ? (
                  <p className="muted">Todavía no hay periodos de uso disponibles.</p>
                ) : (
                  <div className="table-scroll usage-history-table-wrap">
                    <table className="usage-history-table">
                      <thead>
                        <tr>
                          <th>Periodo</th>
                          <th>Respuestas TALIA / límite</th>
                          <th>Mensajes visitante</th>
                          <th>Mensajes totales</th>
                          <th>Sin respuesta</th>
                          <th>Conversaciones</th>
                          <th>Coste IA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageHistory.map((entry) => (
                          <tr key={entry.subscriptionId}>
                            <td>
                              <div className="usage-history-period">
                                <strong>{formatBackstageUsagePeriod(entry.periodStartAt, entry.periodEndAt)}</strong>
                                {entry.isCurrent ? <span className="status-pill status-pill-active">Actual</span> : null}
                              </div>
                            </td>
                            <td className="mono">
                              {entry.includedChatMessages > 0
                                ? `${entry.billableChatMessages} / ${entry.includedChatMessages}`
                                : entry.billableChatMessages}
                            </td>
                            <td className="mono">{entry.visitorChatMessages}</td>
                            <td className="mono">{entry.totalChatMessages}</td>
                            <td className="mono">{entry.unansweredChatMessages}</td>
                            <td className="mono">{entry.usage.conversations}</td>
                            <td className="mono">{formatCurrency(entry.usage.estimatedCostCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <EditClientForm
              client={client}
              modules={modules ?? []}
              emailConnection={emailConnections?.[0] ?? null}
              emailTrace={emailTraceThreads?.[0] ?? null}
              emailCanaryStats={getEmailCanaryStats(emailTraceThreads ?? [])}
            />

            {account ? (
              <SubscriptionCancellationPanel
                accountId={account.id}
                billingEmail={account.billing_email}
                canManageBilling={canManageCustomerBilling}
                cancellationScheduled={accountBilling.cancellationScheduled}
                currentPeriodEnd={accountBilling.currentPeriodEnd}
                subscriptionId={accountBilling.subscriptionId}
              />
            ) : null}
          </VenueDetailsPanel>
        </div>
      </header>

      {activeTab === 'overview' ? (
        <section className="backstage-venue-overview" aria-label="Resumen operativo del cliente">
          <Link className="backstage-venue-overview-card" href={`/backstage/tenants/${tenantId}?tab=knowledge`}>
            <div className="backstage-venue-overview-card-header">
              <div>
                <p className="eyebrow">RAG</p>
                <h2 className="backstage-knowledge-title"><ScanHeart aria-hidden="true" size={20} strokeWidth={2} />Salud del conocimiento</h2>
              </div>
              <span className={`status-pill ${ragHealth.statusClass}`}>{ragHealth.statusLabel}</span>
            </div>
            <p className="muted">El estado de las fuentes y de los fragmentos que TALIA puede usar para responder.</p>
            <dl className="backstage-venue-overview-metrics">
              <div><dt>Fuentes</dt><dd>{formatKnowledgeMetric(ragHealth.sourceCount)}</dd></div>
              <div><dt>Preparado</dt><dd>{ragHealth.readinessPercent === null ? '—' : `${ragHealth.readinessPercent}%`}</dd></div>
              <div><dt>Errores</dt><dd>{formatKnowledgeMetric(ragHealth.errorCount)}</dd></div>
            </dl>
            <span className="backstage-venue-overview-link">Ver salud del conocimiento <ChevronRight aria-hidden="true" size={16} strokeWidth={2} /></span>
          </Link>
          <Link className="backstage-venue-overview-card" href={`/backstage/tenants/${tenantId}?tab=traceability`}>
            <div className="backstage-venue-overview-card-header">
              <div>
                <p className="eyebrow">Respuestas</p>
                <h2 className="backstage-traceability-title"><TextSearch aria-hidden="true" size={20} strokeWidth={2} />Trazabilidad de respuestas</h2>
              </div>
              <span className="status-pill status-pill-muted">{traceCount} respuestas</span>
            </div>
            <p className="muted">Consulta la evidencia, los fallbacks y las valoraciones de las respuestas de Web, Email y WhatsApp.</p>
            <dl className="backstage-venue-overview-metrics">
              <div><dt>Accuracy</dt><dd>{responseFeedbackMetrics.accuracyPercent === null ? '—' : `${responseFeedbackMetrics.accuracyPercent}%`}</dd></div>
              <div><dt>Valoradas</dt><dd>{responseFeedbackMetrics.ratedCount}</dd></div>
              <div><dt>Cobertura</dt><dd>{responseFeedbackMetrics.coveragePercent}%</dd></div>
            </dl>
            <span className="backstage-venue-overview-link">Ver trazabilidad <ChevronRight aria-hidden="true" size={16} strokeWidth={2} /></span>
          </Link>
        </section>
      ) : null}

      {activeTab === 'knowledge' ? (
      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Atención</p>
            <h2 className="backstage-knowledge-title"><ScanHeart aria-hidden="true" size={20} strokeWidth={2} />Salud del conocimiento</h2>
          </div>
          <div className="header-actions">
            <BackstageReindexTenantKnowledgeButton tenantId={tenantId} />
            <span className={`status-pill ${ragHealth.statusClass}`}>{ragHealth.statusLabel}</span>
          </div>
        </div>

        <div className="rag-health-grid">
          <div className="rag-health-card">
            <span>Fuentes</span>
            <strong>{formatKnowledgeMetric(ragHealth.sourceCount)}</strong>
            <small>{formatKnowledgeMetric(ragHealth.readySources)} listos · {formatKnowledgeMetric(ragHealth.errorSources)} con error</small>
          </div>
          <div className="rag-health-card">
            <span>Fragmentos</span>
            <strong>{formatKnowledgeMetric(ragHealth.totalChunks)}</strong>
            <small>{formatKnowledgeMetric(ragHealth.readyChunks)} con embeddings listos</small>
          </div>
          <div className="rag-health-card">
            <span>Pendientes</span>
            <strong>{formatKnowledgeMetric(sumKnowledgeMetrics(ragHealth.pendingChunks, ragHealth.processingChunks))}</strong>
            <small>{formatKnowledgeMetric(ragHealth.pendingChunks)} pendientes · {formatKnowledgeMetric(ragHealth.processingChunks)} procesando</small>
          </div>
          <div className="rag-health-card">
            <span>Errores</span>
            <strong>{formatKnowledgeMetric(ragHealth.errorCount)}</strong>
            <small>
              {formatKnowledgeMetric(ragHealth.errorSources)} fuentes · {formatKnowledgeMetric(ragHealth.errorChunks)} embeddings
              {ragHealth.readinessPercent === null ? '' : ` · ${ragHealth.readinessPercent}% preparado`}
            </small>
          </div>
        </div>

        {ragHealth.notice ? (
          <div className={`rag-health-notice ${ragHealth.noticeTone}`}>
            <span>{ragHealth.notice}</span>
            {ragHealth.errorSources !== null && ragHealth.errorSources > 0 ? (
              <Link
                href={buildKnowledgeSourcesHref({
                  tenantId,
                  page: 1,
                  pageSize: sourcePageSize,
                  sourceType: sourceTypeFilter,
                  sourceStatus: 'error',
                })}
              >
                Ver fuentes con error
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}

      {activeTab === 'traceability' ? (
      <section className="card stack" id="traceability">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">RAG</p>
            <h2 className="backstage-traceability-title"><TextSearch aria-hidden="true" size={20} strokeWidth={2} />Trazabilidad de respuestas</h2>
          </div>
          <span className="status-pill status-pill-muted">{traceCount} respuestas</span>
        </div>

        <p className="muted traceability-summary-caption">
          Respuestas generadas por el agente de {getTraceChannelLabel(traceChannelFilter)}.
        </p>

        <nav className="backstage-tabs traceability-channel-tabs" aria-label="Filtrar respuestas por canal">
          {backstageResponseTraceChannels.map((channel) => (
            <Link
              className={`backstage-tab ${traceChannelFilter === channel ? 'backstage-tab-active' : ''}`}
              href={buildTraceabilityHref({ tenantId, page: 1, pageSize: tracePageSize, channel })}
              key={channel}
              scroll={false}
            >
              {getTraceChannelLabel(channel)} ({traceResult.channelCounts[channel]})
            </Link>
          ))}
        </nav>

        <div className="rag-feedback-accuracy-card" aria-label="Resumen de valoración de respuestas">
          <div>
            <span>Respuestas útiles</span>
            <strong>
              {responseFeedbackMetrics.accuracyPercent === null
                ? 'Sin datos'
                : `${responseFeedbackMetrics.accuracyPercent}%`}
            </strong>
          </div>
          <div className="rag-feedback-accuracy-meta">
            <p>
              <strong>{responseFeedbackMetrics.ratedCount}</strong> respuestas valoradas
            </p>
            <span>
              {responseFeedbackMetrics.positiveCount} útiles ·{' '}
              {responseFeedbackMetrics.negativeCount} no útiles ·{' '}
              {responseFeedbackMetrics.coveragePercent}% de cobertura
            </span>
          </div>
        </div>

        <details className="rag-trace-diagnostics">
          <summary>
            <span>
              <strong>Diagnóstico técnico</strong>
              Fuentes, confianza, fallbacks y resolución
            </span>
            <span className="rag-trace-diagnostics-action" aria-hidden="true">Ver métricas</span>
          </summary>
          <div className="rag-trace-diagnostics-grid" aria-label="Diagnóstico técnico de las respuestas">
            <div><span>Con fuentes</span><strong>{traceStats.withSources}</strong></div>
            <div><span>Sin fuentes</span><strong>{traceStats.withoutSources}</strong></div>
            <div><span>Baja confianza</span><strong>{traceStats.lowConfidence}</strong></div>
            <div><span>Fallback</span><strong>{traceStats.fallbacks}</strong></div>
            <div><span>Sesiones resueltas</span><strong>{feedbackStats.sessionResolved}</strong></div>
            <div><span>Sesiones no resueltas</span><strong>{feedbackStats.sessionUnresolved}</strong></div>
          </div>
        </details>

        {traceMessages.length ? (
          <div className="backstage-table-scroll traceability-table-scroll">
            <table className="data-table traceability-table">
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Estado</th>
                  <th>Consulta</th>
                  <th>Proveedor</th>
                  <th>Feedback</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              {traceMessages.map((message) => {
              const metadata = isRecord(message.metadata) ? message.metadata : {}
              const sources = getAgentSources(message.metadata)
              const responseFeedback = getResponseFeedback(metadata)
              const sessionFeedback = getSessionFeedback(message.conversationMetadata)
              const provider = typeof metadata.source === 'string' ? metadata.source : 'unknown'
              const requestedProvider = typeof metadata.requested_provider === 'string' ? metadata.requested_provider : null
              const model = typeof metadata.model === 'string' ? metadata.model : null
              const language = typeof metadata.response_language === 'string' ? metadata.response_language : null
              const userMessage = typeof metadata.user_message === 'string' ? metadata.user_message : null
              const retrievalStatus = typeof metadata.retrieval_status === 'string' ? metadata.retrieval_status : null
              const retrievalTrace = summarizeRetrievalTrace(metadata)
              const retrievalChunks = (retrievalTrace?.chunks ?? []).map((chunk) => ({
                id: chunk.id,
                source_id: chunk.source_id,
                source_type: chunk.source_type,
                score: chunk.score,
                rank: chunk.rank,
                language: chunk.language,
                preview: chunk.preview,
              }))
              const retrievalAttempts = retrievalTrace?.attempts ?? []
              const contextAssembly = getContextAssembly(metadata)
              const languageTrace = getLanguageTrace(metadata)
              const fallbackTrace = getFallbackTrace(metadata)
              const fallbackReason = typeof metadata.fallback_reason === 'string' ? metadata.fallback_reason : null
              const lowConfidence = metadata.low_confidence === true
              const traceSummary = getTraceSummary({
                provider,
                requestedProvider,
                retrievalStatus,
                lowConfidence,
                fallbackReason,
                sources,
                retrievalChunks,
              })
              const traceExport = buildResponseTraceExport({
                venue: {
                  id: tenantId,
                  name: client.name,
                },
                response: {
                  message_id: message.id,
                  conversation_id: message.conversationId,
                  created_at: message.createdAt,
                  question: userMessage,
                  answer: message.content,
                },
                provider: {
                  requested: requestedProvider,
                  used: provider,
                  model,
                },
                language: {
                  response_language: language,
                  agent: languageTrace,
                },
                retrieval: {
                  status: retrievalStatus,
                  retrieval_query: retrievalTrace?.retrieval_query ?? null,
                  refinement_used: retrievalTrace?.refinement_used ?? false,
                  low_confidence: lowConfidence,
                  fallback_reason: fallbackReason,
                  sources: sources.map((source) => ({
                    ...source,
                    name: source.source_id
                      ? getKnowledgeSourceName(sourceById.get(source.source_id) ?? {
                        name: source.source_type ?? 'Fuente',
                        config: {},
                      })
                      : source.source_type,
                  })),
                  chunks: retrievalChunks.map((chunk) => ({
                    ...chunk,
                    source_name: chunk.source_id
                      ? getKnowledgeSourceName(sourceById.get(chunk.source_id) ?? {
                        name: chunk.source_type ?? 'Fuente',
                        config: {},
                      })
                      : chunk.source_type,
                  })),
                  attempts: retrievalAttempts,
                  context_assembly: contextAssembly,
                },
                feedback: {
                  response: responseFeedback,
                  session: sessionFeedback,
                },
                metadata: message.metadata ?? {},
              })

              return (
                <tbody className={`traceability-table-group traceability-table-group-${traceSummary.tone}`} key={message.id}>
                  <tr className="traceability-entry-header">
                    <td>
                      <span className={`traceability-channel-pill traceability-channel-${message.channel}`}>
                        {getTraceChannelLabel(message.channel)}
                      </span>
                    </td>
                    <td><span className={`rag-trace-state rag-trace-state-${traceSummary.tone}`}>{traceSummary.label}</span></td>
                    <td>
                      <strong className="traceability-question">
                        {truncate(userMessage ?? message.content, 120)}
                      </strong>
                      <small>{traceSummary.description}</small>
                    </td>
                    <td>
                      <strong>{getProviderLabel(provider)}</strong>
                      <small>{model ?? language ?? '—'}</small>
                    </td>
                    <td>
                      {responseFeedback ? (
                        <span className={`rag-trace-feedback-pill rag-trace-feedback-${responseFeedback.rating}`}>
                          {getResponseFeedbackLabel(responseFeedback.rating)}
                        </span>
                      ) : <span className="muted">Sin valorar</span>}
                      {sessionFeedback ? (
                        <small className={`rag-trace-feedback-${getSessionFeedbackTone(sessionFeedback)}`}>
                          Sesión: {getSessionFeedbackLabel(sessionFeedback)}
                        </small>
                      ) : null}
                    </td>
                    <td><time>{new Date(message.createdAt).toLocaleString('es-ES')}</time></td>
                  </tr>
                  <tr className="traceability-detail-row">
                    <td colSpan={6}>
                      <div className="traceability-detail-shell">
                        <div className="traceability-export-row">
                          <span>Acciones de esta respuesta</span>
                          <ResponseTraceDownloadButton
                            filename={buildResponseTraceFilename(message.createdAt, message.id)}
                            trace={traceExport}
                          />
                        </div>
                        {message.channel === 'web' && shouldOfferResponseDiagnostic(responseFeedback?.rating ?? null) ? (
                          <BackstageAiDiagnosticPanel
                            tenantId={tenantId}
                            artifactType="response_trace"
                            artifactId={message.id}
                          />
                        ) : null}
                        <details className="rag-trace-details traceability-details">
                          <summary>Ver respuesta y trazabilidad</summary>
                          <div className="rag-trace-detail-body">
                          <div className="rag-trace-answer traceability-answer">
                            <span>Respuesta</span>
                            <p>{message.content}</p>
                          </div>

                      {userMessage ? (
                        <div className="rag-trace-question">
                          <span>Pregunta original</span>
                          <p>{userMessage}</p>
                        </div>
                      ) : null}

                      {contextAssembly ? (
                        <ContextAssemblyTrace contextAssembly={contextAssembly} />
                      ) : null}

                      {languageTrace ? <LanguageAgentTrace language={languageTrace} responseLanguage={language} /> : null}

                      {retrievalAttempts.length ? (
                        <RetrievalAttemptsTrace
                          attempts={retrievalAttempts}
                          refinementUsed={retrievalTrace?.refinement_used ?? false}
                        />
                      ) : null}

                      {fallbackTrace ? <FallbackTrace fallback={fallbackTrace} /> : null}

                      {sources.length ? (
                        <ConversationSourceList sources={sources} sourceById={sourceById} />
                      ) : (
                        <p className="muted">Sin fuentes RAG registradas para esta respuesta.</p>
                      )}

                      {retrievalChunks.length ? (
                        <RetrievalChunkList chunks={retrievalChunks} sourceById={sourceById} />
                      ) : null}
                          <div className="rag-trace-foot">
                            <p className="muted mono">
                              {message.conversationLabel
                                ? `${getTraceChannelConversationLabel(message.channel)} ${truncate(message.conversationLabel, 48)}`
                                : `conversation ${message.conversationId.slice(0, 8)}...`}
                            </p>
                            <div>
                              {requestedProvider && requestedProvider !== provider ? <span>pedido {requestedProvider}</span> : null}
                              {language ? <span>{language}</span> : null}
                              {retrievalStatus ? <span>{getRetrievalStatusLabel(retrievalStatus)}</span> : null}
                              {retrievalAttempts.length ? <span>{retrievalAttempts.length} búsquedas</span> : null}
                              {contextAssembly ? <span>{getContextAssemblyModeLabel(contextAssembly.mode)}</span> : null}
                              {languageTrace ? <span>idioma {languageTrace.mode}</span> : null}
                              {fallbackTrace ? <span>{fallbackTrace.strategy}</span> : null}
                              {typeof traceSummary.topScore === 'number' ? <span>score {traceSummary.topScore.toFixed(2)}</span> : null}
                            </div>
                          </div>

                          {sessionFeedback?.comments ? <p>{sessionFeedback.comments}</p> : null}
                          {lowConfidence || fallbackReason || isNoSourcesStatus(retrievalStatus) ? (
                            <div className="rag-trace-alerts">
                              {lowConfidence ? <span>Confianza baja</span> : null}
                              {fallbackReason ? <span>{getFallbackReasonLabel(fallbackReason)}</span> : null}
                              {isNoSourcesStatus(retrievalStatus) ? <span>Sin fuentes usadas</span> : null}
                            </div>
                          ) : null}
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                </tbody>
              )
            })}
            </table>
          </div>
        ) : (
          <p className="muted">
            Todavía no hay respuestas del agente de {getTraceChannelLabel(traceChannelFilter)}.
          </p>
        )}
        <TracePagination
          page={tracePage}
          pageCount={tracePageCount}
          pageSize={tracePageSize}
          tenantId={tenantId}
          total={traceCount}
          channel={traceChannelFilter}
        />
      </section>
      ) : null}

      {activeTab === 'knowledge' ? (
      <>
      <section className="card stack" id="knowledge-web-sources">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Conocimiento</p>
            <h2>Fuentes procesadas</h2>
          </div>
          <div className="section-heading-actions">
            {knowledgeSyncActivity ? (
              <KnowledgeSyncRealtime activity={knowledgeSyncActivity} />
            ) : null}
            <KnowledgeSourceTypeFilter options={knowledgeSourceTypeOptions} value={sourceTypeFilter ?? 'all'} />
          </div>
        </div>

        <dl className="backstage-knowledge-usage" aria-label="Resumen del conocimiento">
          <div>
            <dt>Fuentes registradas</dt>
            <dd>{formatKnowledgeMetric(ragHealth.sourceCount)}</dd>
          </div>
          <div>
            <dt>Fuentes web gestionadas</dt>
            <dd>{managedWebQuota.sources}<span> / {managedWebQuota.limits.maxSources}</span></dd>
          </div>
          <div>
            <dt>Páginas web activas</dt>
            <dd>{managedWebQuota.documents}<span> / {managedWebQuota.limits.maxDocuments}</span></dd>
          </div>
          <div>
            <dt>Actualizaciones manuales hoy</dt>
            <dd>{managedWebQuota.manualSyncsToday}<span> / {managedWebQuota.limits.maxManualSyncsPerDay}</span></dd>
          </div>
        </dl>

        {webAlerts.error || webAlerts.alerts.length > 0 ? (
          <KnowledgeWebAlerts
            alerts={webAlerts.alerts}
            error={webAlerts.error}
            showTenant={false}
            title="Alertas de actualización web"
          />
        ) : null}

        {sourceStatusFilter ? (
          <div className="knowledge-source-filter-notice">
            <span>Mostrando fuentes con estado: {getSourceStatusLabel(sourceStatusFilter)}.</span>
            <Link
              href={buildKnowledgeSourcesHref({
                tenantId,
                page: 1,
                pageSize: sourcePageSize,
                sourceType: sourceTypeFilter,
                sourceStatus: null,
              })}
            >
              Ver todas
            </Link>
          </div>
        ) : null}

        {knowledgeSources.length ? (
          <div className="knowledge-files-list">
            {knowledgeSources.map((source) => {
              const stats = chunkStatsBySource.get(source.id) ?? createEmptyChunkStats()
              const documentCount = documentCountsBySource.get(source.id) ?? 0
              const latestSyncRun = latestSyncRunBySource.get(source.id)
              const programmeExtraction = programmeExtractionBySource.get(source.id)
              const syncPresentation = getBackstageSyncRunPresentation({
                run: latestSyncRun,
                sourceLastError: source.last_error,
              })
              const fileName = getKnowledgeSourceName(source)
              const debugSource: DebuggableSource = {
                id: source.id,
                type: source.type,
                name: fileName,
                status: source.status,
                syncEnabled: source.sync_enabled,
                sourceUrl: source.source_url,
                refreshInterval: source.refresh_interval,
                nextSyncAt: source.next_sync_at,
                lastSyncedAt: source.last_synced_at,
                lastError: source.last_error,
                documentCount,
                chunkCount: stats.total,
                embeddingCounts: stats,
                latestSyncRun: latestSyncRun ?? null,
              }

              return (
                <article className="knowledge-file-item" id={`source-${source.id}`} key={source.id}>
                  <div className="knowledge-file-icon" aria-hidden="true">
                    <FileText size={20} strokeWidth={2} />
                  </div>
                  <div className="knowledge-file-main">
                    <div className="knowledge-file-title-row">
                      <h3>{fileName}</h3>
                      <div className="knowledge-file-title-statuses">
                        {isManagedWebSource(source.type) ? (
                          <span className={`knowledge-file-status ${source.sync_enabled ? 'knowledge-file-status-ready' : 'knowledge-file-status-paused'}`}>
                            {source.sync_enabled ? 'Fuente habilitada' : 'Fuente pausada'}
                          </span>
                        ) : null}
                        {isManagedWebSource(source.type) && isProgrammeExtractionEnabled(source.config) ? (
                          <span className={`knowledge-file-status ${programmeExtraction?.errorDocuments ? 'knowledge-file-status-error' : 'knowledge-file-status-ready'}`}>
                            {programmeExtraction?.errorDocuments
                              ? 'Extracción con incidencias'
                              : programmeExtraction?.extractedDocuments
                                ? `${programmeExtraction.eventCount} eventos estructurados`
                                : 'Extracción pendiente'}
                          </span>
                        ) : null}
                        <span className={`knowledge-file-status knowledge-file-status-${source.status}`}>
                          {getSourceStatusLabel(source.status)}
                        </span>
                      </div>
                    </div>
                    <div className="knowledge-file-meta">
                      <span>{getSourceTypeLabel(source.type)}</span>
                      <span>{chunkStatsAvailable ? `${stats.total} fragmentos` : 'Fragmentos no disponibles'}</span>
                      {source.source_url ? <span>{source.source_url}</span> : null}
                      {source.last_synced_at ? <span>Actualizado {formatDate(source.last_synced_at)}</span> : null}
                      {isManagedWebSource(source.type) ? (
                        <>
                          <span>{documentCount} páginas</span>
                          <span>Frecuencia: {getRefreshIntervalLabel(source.refresh_interval)}</span>
                          {source.next_sync_at ? <span>Próxima: {formatDate(source.next_sync_at)}</span> : null}
                        </>
                      ) : null}
                      <span className="mono">{shortId(source.id)}</span>
                    </div>
                    {latestSyncRun ? (
                      <div className="knowledge-installed-signals" aria-label="Última sincronización web">
                        <span className="knowledge-installed-signal">
                          {latestSyncRun.status === 'succeeded' && stats.pending + stats.processing > 0
                            ? 'Preparando conocimiento'
                            : syncPresentation.statusLabel}
                        </span>
                        {latestSyncRun.status === 'running' ? (
                          <span className="knowledge-installed-signal knowledge-installed-signal-ok">
                            {getBackstageSyncPhase(latestSyncRun.metadata)}
                            {latestSyncRun.discovered_count > 0 ? ` · ${latestSyncRun.checked_count}/${latestSyncRun.discovered_count}` : ''}
                          </span>
                        ) : null}
                        {syncPresentation.showCounters ? (
                          <>
                            <span className="knowledge-installed-signal">{latestSyncRun.checked_count} revisadas</span>
                            <span className="knowledge-installed-signal knowledge-installed-signal-ok">{latestSyncRun.changed_count} cambiadas</span>
                            {latestSyncRun.failed_count + latestSyncRun.blocked_count > 0 ? (
                              <span className="knowledge-installed-signal">{latestSyncRun.failed_count + latestSyncRun.blocked_count} incidencias</span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {isProgrammeExtractionEnabled(source.config) ? (
                      <div className="knowledge-installed-signals" aria-label="Extracción estructurada de programación">
                        <span className="knowledge-installed-signal">
                          {programmeExtraction?.extractedDocuments
                            ? `${programmeExtraction.extractedDocuments} páginas analizadas`
                            : 'Pendiente de la primera extracción'}
                        </span>
                        {programmeExtraction?.requestCount ? (
                          <span className="knowledge-installed-signal">
                            {programmeExtraction.requestCount} peticiones ·{' '}
                            {programmeExtraction.inputTokens + programmeExtraction.outputTokens} tokens
                          </span>
                        ) : null}
                        {programmeExtraction?.models.length ? (
                          <span className="knowledge-installed-signal">{programmeExtraction.models.join(', ')}</span>
                        ) : null}
                        {programmeExtraction?.lastExtractedAt ? (
                          <span className="knowledge-installed-signal">
                            Última extracción: {formatDate(programmeExtraction.lastExtractedAt)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {syncPresentation.issue ? (
                      <p className={`knowledge-file-issue knowledge-file-issue-${syncPresentation.issueTone}`}>
                        {syncPresentation.issue}
                      </p>
                    ) : null}
                    {hasKnowledgeSourceDebugData(debugSource) ? (
                      <>
                        <BackstageKnowledgeSourceErrorDetails source={debugSource} />
                        <BackstageAiDiagnosticPanel
                          tenantId={tenantId}
                          artifactType="knowledge_source"
                          artifactId={source.id}
                        />
                      </>
                    ) : null}
                    {chunkStatsAvailable && stats.total > 0 ? (
                      <div className="knowledge-embedding-stats" aria-label="Estado de embeddings">
                        <span className="knowledge-embedding-stat knowledge-embedding-stat-ready">{stats.ready} listos</span>
                        {stats.processing > 0 ? <span className="knowledge-embedding-stat">{stats.processing} procesando</span> : null}
                        {stats.pending > 0 ? <span className="knowledge-embedding-stat knowledge-embedding-stat-pending">{stats.pending} pendientes</span> : null}
                        {stats.error > 0 ? <span className="knowledge-embedding-stat knowledge-embedding-stat-error">{stats.error} error</span> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="knowledge-file-actions">
                    {hasKnowledgeSourceDebugData(debugSource) ? (
                      <BackstageKnowledgeSourceDebugDownloadButton source={debugSource} />
                    ) : null}
                    {isManagedWebSource(source.type) ? (
                      <>
                        <BackstageProgrammeExtractionToggle
                          tenantId={tenantId}
                          sourceId={source.id}
                          enabled={isProgrammeExtractionEnabled(source.config)}
                        />
                        <BackstageManagedWebSyncToggle
                          tenantId={tenantId}
                          sourceId={source.id}
                          enabled={source.sync_enabled}
                        />
                      </>
                    ) : null}
                    {stats.pending + stats.error > 0 ? (
                      <BackstageRetryEmbeddingsButton tenantId={tenantId} sourceId={source.id} />
                    ) : null}
                    {canReprocessKnowledgeSourceFromBackstage(source.type) && (!isManagedWebSource(source.type) || source.sync_enabled) ? (
                      <BackstageReprocessSourceButton tenantId={tenantId} sourceId={source.id} sourceType={source.type} />
                    ) : null}
                    <BackstageDeleteKnowledgeSourceButton
                      tenantId={tenantId}
                      sourceId={source.id}
                      sourceName={fileName}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="muted">Este venue todavía no tiene fuentes cargadas como base de conocimiento.</p>
        )}
        <KnowledgeSourcePagination
          page={sourcePage}
          pageCount={sourcePageCount}
          pageSize={sourcePageSize}
          sourceType={sourceTypeFilter}
          sourceStatus={sourceStatusFilter}
          tenantId={tenantId}
          total={knowledgeSourceCount}
        />
      </section>

      {(knowledgeSupportRequests ?? []).length ? (
        <section className="card stack">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Soporte</p>
              <h2>Solicitudes sobre fuentes web</h2>
            </div>
            <span className="status-pill status-pill-muted">{knowledgeSupportRequests?.length ?? 0} recientes</span>
          </div>
          <div className="knowledge-files-list">
            {(knowledgeSupportRequests ?? []).map((request) => (
              <article className="knowledge-file-item" key={request.id}>
                <div className="knowledge-file-icon" aria-hidden="true">
                  <LifeBuoy size={20} strokeWidth={2} />
                </div>
                <div className="knowledge-file-main">
                  <div className="knowledge-file-title-row">
                    <h3>{knowledgeSourceNameById.get(request.source_id) ?? 'Fuente web'}</h3>
                    <div className="knowledge-file-title-statuses">
                      <span className="knowledge-file-status knowledge-file-status-pending">{request.status}</span>
                      <span className={`knowledge-file-status knowledge-file-status-${request.delivery_status === 'sent' ? 'ready' : 'partial'}`}>
                        Email {request.delivery_status}
                      </span>
                    </div>
                  </div>
                  <p>{request.customer_message}</p>
                  <div className="knowledge-file-meta">
                    <span>{formatDate(request.created_at)}</span>
                    <span className="mono">request {shortId(request.id)}</span>
                    <span className="mono">source {shortId(request.source_id)}</span>
                    {request.sync_run_id ? <span className="mono">run {shortId(request.sync_run_id)}</span> : null}
                    {request.error_code ? <span className="mono">{request.error_code}</span> : null}
                  </div>
                  {request.delivery_error ? <p className="knowledge-file-error">{request.delivery_error}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      </>
      ) : null}
    </div>
  )
}

function KnowledgeSourcePagination({
  page,
  pageCount,
  pageSize,
  sourceType,
  sourceStatus,
  tenantId,
  total,
}: {
  page: number
  pageCount: number
  pageSize: number
  sourceType: string | null
  sourceStatus: string | null
  tenantId: string
  total: number
}) {
  if (total === 0) return null

  const firstResult = (page - 1) * pageSize + 1
  const lastResult = Math.min(total, page * pageSize)
  const hrefForPage = (targetPage: number) => buildKnowledgeSourcesHref({
    tenantId,
    page: targetPage,
    pageSize,
    sourceType,
    sourceStatus,
  })

  return (
    <nav className="table-pagination" aria-label="Paginación de fuentes procesadas">
      <p>Mostrando {firstResult}-{lastResult} de {total} fuentes · Página {page} de {pageCount}</p>
      <div className="table-pagination-actions">
        <BackstagePageSizeSelect
          value={pageSize}
          pageParam="source_page"
          pageSizeParam="source_page_size"
          anchor="knowledge-web-sources"
          ariaLabel="Fuentes por página"
          options={KNOWLEDGE_SOURCE_PAGE_SIZES}
        />
        {page > 1 ? (
          <Link className="pagination-icon-button" href={hrefForPage(page - 1)} aria-label="Página anterior de fuentes" scroll={false}>
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label="Página anterior de fuentes">
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
          </span>
        )}
        {page < pageCount ? (
          <Link className="pagination-icon-button" href={hrefForPage(page + 1)} aria-label="Página siguiente de fuentes" scroll={false}>
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label="Página siguiente de fuentes">
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
          </span>
        )}
      </div>
    </nav>
  )
}

function TracePagination({
  page,
  pageCount,
  pageSize,
  tenantId,
  total,
  channel,
}: {
  page: number
  pageCount: number
  pageSize: number
  tenantId: string
  total: number
  channel: BackstageResponseTraceChannel
}) {
  if (total === 0) return null

  const firstResult = (page - 1) * pageSize + 1
  const lastResult = Math.min(total, page * pageSize)
  const hrefForPage = (targetPage: number) => buildTraceabilityHref({
    tenantId,
    page: targetPage,
    pageSize,
    channel,
  })

  return (
    <nav className="table-pagination" aria-label="Paginación de respuestas">
      <p>Mostrando {firstResult}-{lastResult} de {total} respuestas · Página {page} de {pageCount}</p>
      <div className="table-pagination-actions">
        <BackstagePageSizeSelect value={pageSize} anchor="traceability" ariaLabel="Respuestas por página" />
        {page > 1 ? (
          <Link className="pagination-icon-button" href={hrefForPage(page - 1)} aria-label="Página anterior" scroll={false}>
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label="Página anterior">
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
          </span>
        )}
        {page < pageCount ? (
          <Link className="pagination-icon-button" href={hrefForPage(page + 1)} aria-label="Página siguiente" scroll={false}>
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label="Página siguiente">
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
          </span>
        )}
      </div>
    </nav>
  )
}

function normalizeVenueTab(value: string | undefined): VenueTabKey {
  if (value === 'knowledge' || value === 'traceability') return value
  return 'overview'
}

function normalizeTracePageSize(value: string | undefined) {
  const parsed = Number(value)
  return TRACE_PAGE_SIZES.includes(parsed as (typeof TRACE_PAGE_SIZES)[number]) ? parsed : 10
}

function normalizeTraceChannel(value: string | undefined): BackstageResponseTraceChannel {
  return backstageResponseTraceChannels.find((channel) => channel === value) ?? 'web'
}

function normalizeKnowledgeSourcePageSize(value: string | undefined) {
  const parsed = Number(value)
  return KNOWLEDGE_SOURCE_PAGE_SIZES.includes(parsed as (typeof KNOWLEDGE_SOURCE_PAGE_SIZES)[number]) ? parsed : 10
}

function normalizeKnowledgeSourceTypeFilter(value: string | undefined) {
  if (!value || !/^[a-z][a-z0-9_]{0,39}$/.test(value)) return null
  return value
}

function normalizeKnowledgeSourceStatusFilter(value: string | undefined) {
  return value === 'connected' || value === 'processing' || value === 'ready' || value === 'error'
    ? value
    : null
}

function buildKnowledgeSourcesHref({
  tenantId,
  page,
  pageSize,
  sourceType,
  sourceStatus,
}: {
  tenantId: string
  page: number
  pageSize: number
  sourceType: string | null
  sourceStatus: string | null
}) {
  const params = new URLSearchParams({
    tab: 'knowledge',
    source_page: String(page),
    source_page_size: String(pageSize),
  })
  if (sourceType) params.set('source_type', sourceType)
  if (sourceStatus) params.set('source_status', sourceStatus)
  return `/backstage/tenants/${tenantId}?${params.toString()}#knowledge-web-sources`
}

function buildTraceabilityHref({
  tenantId,
  page,
  pageSize,
  channel,
}: {
  tenantId: string
  page: number
  pageSize: number
  channel: BackstageResponseTraceChannel
}) {
  const params = new URLSearchParams({
    tab: 'traceability',
    page: String(page),
    page_size: String(pageSize),
  })
  params.set('trace_channel', channel)
  return `/backstage/tenants/${tenantId}?${params.toString()}#traceability`
}

function getTraceChannelLabel(channel: BackstageResponseTraceChannel) {
  if (channel === 'web') return 'Web'
  if (channel === 'email') return 'Email'
  return 'WhatsApp'
}

function getTraceChannelConversationLabel(channel: BackstageResponseTraceChannel) {
  if (channel === 'web') return 'sesión'
  if (channel === 'email') return 'hilo'
  return 'contacto'
}

function getKnowledgeSourceTypeOptions(sources: Array<{ type: string }>) {
  const counts = new Map<string, number>()
  for (const source of sources) counts.set(source.type, (counts.get(source.type) ?? 0) + 1)

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count, label: getSourceTypeLabel(value) }))
    .sort((left, right) => left.label.localeCompare(right.label, 'es'))
}

async function getAllKnowledgeSourceSummaries(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
) {
  const sources: Array<{
    id: string
    name: string
    type: string
    status: string
    config: unknown
    sync_enabled: boolean
  }> = []
  const pageSize = 1_000

  for (let from = 0; ; from += pageSize) {
    const result = await admin
      .from('knowledge_sources')
      .select('id, name, type, status, config, sync_enabled')
      .eq('theatre_id', tenantId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (result.error) {
      throw new Error(`No se pudieron consultar las fuentes de conocimiento: ${result.error.message}`)
    }

    const page = result.data ?? []
    sources.push(...page)
    if (page.length < pageSize) break
  }

  return sources
}

function getKnowledgeSourcesPage(
  admin: ReturnType<typeof createAdminClient>,
  {
    tenantId,
    sourceType,
    sourceStatus,
    from,
    pageSize,
  }: {
    tenantId: string
    sourceType: string | null
    sourceStatus: string | null
    from: number
    pageSize: number
  },
) {
  let request = admin
    .from('knowledge_sources')
    .select('id, name, type, status, sync_enabled, config, source_url, refresh_interval, next_sync_at, last_synced_at, last_error, created_at', { count: 'exact' })
    .eq('theatre_id', tenantId)

  if (sourceType) request = request.eq('type', sourceType)
  if (sourceStatus) request = request.eq('status', sourceStatus)

  return request
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)
}

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function getAccountBillingMetadata(value: unknown) {
  const metadata = isRecord(value) ? value : {}
  const periodEnd = typeof metadata.stripe_current_period_end === 'number'
    ? new Date(metadata.stripe_current_period_end * 1000).toISOString()
    : null

  return {
    subscriptionId: typeof metadata.stripe_subscription_id === 'string' ? metadata.stripe_subscription_id : null,
    cancellationScheduled: metadata.stripe_cancel_at_period_end === true,
    currentPeriodEnd: periodEnd,
  }
}

type AgentSource = {
  id: string | null
  source_id: string | null
  source_type: string | null
  score: number | null
}

type RetrievalChunk = {
  id: string | null
  source_id: string | null
  source_type: string | null
  score: number | null
  rank: number | null
  language: string | null
  preview: string | null
}

function RetrievalAttemptsTrace({
  attempts,
  refinementUsed,
}: {
  attempts: RetrievalTraceAttempt[]
  refinementUsed: boolean
}) {
  return (
    <div className="context-assembly-trace">
      <div className="context-assembly-header">
        <div className="trace-agent-identity">
          <span>Retrieval</span>
          <strong>Búsqueda conversacional</strong>
        </div>
        <div className="context-assembly-meta">
          <span>{attempts.length} {attempts.length === 1 ? 'intento' : 'intentos'}</span>
          {refinementUsed ? <span>reformulada</span> : <span>directa</span>}
        </div>
      </div>
      <div className="context-assembly-rejections">
        <span>Consultas ejecutadas</span>
        {attempts.map((attempt) => (
          <p key={`${attempt.attempt}-${attempt.query}`}>
            <strong>#{attempt.attempt + 1} · {getRetrievalAttemptReasonLabel(attempt.reason)}</strong>
            {' — '}{truncate(attempt.query, 500)}
            {' · '}{attempt.retrieved_count} recuperados
            {' · '}{attempt.selected_count} seleccionados
            {typeof attempt.top_score === 'number' ? ` · score ${attempt.top_score.toFixed(2)}` : ''}
            {attempt.status !== 'completed' ? ` · ${attempt.status}` : ''}
          </p>
        ))}
      </div>
    </div>
  )
}

function getRetrievalAttemptReasonLabel(reason: string) {
  if (reason === 'initial') return 'búsqueda inicial'
  if (reason === 'missing_evidence') return 'faltaba evidencia'
  if (reason === 'incomplete_evidence') return 'evidencia incompleta'
  if (reason === 'follow_up_context') return 'contexto conversacional'
  return reason
}

type ContextAssembly = {
  mode: string
  focus: string | null
  reason: string | null
  confidence: number | null
  selected_count: number | null
  rejected_count: number | null
  rejected: ContextAssemblyRejection[]
}

type ContextAssemblyRejection = {
  id: string | null
  score: number | null
  reason: string | null
}

type FallbackTraceData = {
  reason: string
  strategy: string
  language: string | null
  channels: string[]
  template_source: string | null
  whatsapp_link_used: boolean
  trigger: string | null
}

type LanguageTraceData = {
  requested_language: string | null
  fallback_language: string
  confidence: number | null
  mode: 'deterministic' | 'llm'
  query_expansions: string[]
}

type ResponseFeedback = {
  rating: 'positive' | 'negative'
  submittedAt: string | null
}

type SessionFeedback = {
  resolved: boolean | null
  skipped: boolean
  comments: string | null
  submittedAt: string | null
}

function LanguageAgentTrace({
  language,
  responseLanguage,
}: {
  language: LanguageTraceData
  responseLanguage: string | null
}) {
  return (
    <div className="context-assembly-trace">
      <div className="context-assembly-header">
        <div className="trace-agent-identity">
          <span>Agente</span>
          <strong>Language Agent</strong>
        </div>
        <div className="context-assembly-meta">
          <span>{language.mode}</span>
          {typeof language.confidence === 'number' ? <span>confianza {language.confidence.toFixed(2)}</span> : null}
        </div>
      </div>
      <dl className="context-assembly-stats">
        <div>
          <dt>Detectado</dt>
          <dd>{language.requested_language ?? '-'}</dd>
        </div>
        <div>
          <dt>Respuesta</dt>
          <dd>{responseLanguage ?? '-'}</dd>
        </div>
        <div>
          <dt>Fallback tenant</dt>
          <dd>{language.fallback_language}</dd>
        </div>
        <div>
          <dt>Expansiones</dt>
          <dd>{language.query_expansions.join(', ') || 'ninguna'}</dd>
        </div>
      </dl>
    </div>
  )
}

function FallbackTrace({ fallback }: { fallback: FallbackTraceData }) {
  return (
    <div className="context-assembly-trace">
      <div className="context-assembly-header">
        <div className="trace-agent-identity">
          <span>Política</span>
          <strong>Fallback Policy</strong>
        </div>
        <div className="context-assembly-meta">
          <span>{fallback.strategy}</span>
          {fallback.language ? <span>{fallback.language}</span> : null}
        </div>
      </div>
      <dl className="context-assembly-stats">
        <div>
          <dt>Motivo</dt>
          <dd>{fallback.reason}</dd>
        </div>
        <div>
          <dt>Canales</dt>
          <dd>{fallback.channels.join(', ') || 'ninguno'}</dd>
        </div>
        <div>
          <dt>Plantilla</dt>
          <dd>{fallback.template_source ?? '-'}</dd>
        </div>
        <div>
          <dt>Decisión</dt>
          <dd>{fallback.trigger ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}

function ContextAssemblyTrace({
  contextAssembly,
}: {
  contextAssembly: ContextAssembly
}) {
  return (
    <div className="context-assembly-trace">
      <div className="context-assembly-header">
        <div className="trace-agent-identity">
          <span>Agente</span>
          <strong>Context Assembler</strong>
        </div>
        <div className="context-assembly-meta">
          <span>{getContextAssemblyModeLabel(contextAssembly.mode)}</span>
          {contextAssembly.focus ? <span>{getContextAssemblyFocusLabel(contextAssembly.focus)}</span> : null}
          {typeof contextAssembly.confidence === 'number' ? <span>confianza {contextAssembly.confidence.toFixed(2)}</span> : null}
        </div>
      </div>
      <dl className="context-assembly-stats">
        <div>
          <dt>Motivo</dt>
          <dd>{contextAssembly.reason ? getContextAssemblyReasonLabel(contextAssembly.reason) : '-'}</dd>
        </div>
        <div>
          <dt>Seleccionados</dt>
          <dd>{contextAssembly.selected_count ?? '-'}</dd>
        </div>
        <div>
          <dt>Descartados</dt>
          <dd>{contextAssembly.rejected_count ?? '-'}</dd>
        </div>
      </dl>
      {contextAssembly.rejected.length ? (
        <div className="context-assembly-rejections">
          <span>Contexto descartado</span>
          {contextAssembly.rejected.map((rejection, index) => (
            <p className="mono" key={`${rejection.id ?? 'rejected'}-${index}`}>
              {rejection.id ? shortId(rejection.id) : '-'}
              {typeof rejection.score === 'number' ? ` · score ${rejection.score.toFixed(2)}` : ''}
              {rejection.reason ? ` · ${getContextAssemblyReasonLabel(rejection.reason)}` : ''}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ConversationSourceList({
  sources,
  sourceById,
}: {
  sources: AgentSource[]
  sourceById: Map<string, { name: string; type: string; config: unknown }>
}) {
  return (
    <div className="conversation-source-list">
      {sources.map((source, index) => {
        const linkedSource = source.source_id ? sourceById.get(source.source_id) : null
        const sourceName = linkedSource ? getKnowledgeSourceName(linkedSource) : source.source_type ?? 'Fuente'
        const sourceType = linkedSource?.type ?? source.source_type ?? 'unknown'

        return (
          <article className="conversation-source-item" key={`${source.id ?? source.source_id ?? 'source'}-${index}`}>
            <span className="conversation-source-type">{sourceType}</span>
            <strong>{sourceName}</strong>
            <span className="mono">{source.id ? shortId(source.id) : source.source_id ? shortId(source.source_id) : '-'}</span>
            {typeof source.score === 'number' ? <span>score {source.score.toFixed(2)}</span> : null}
          </article>
        )
      })}
    </div>
  )
}

function RetrievalChunkList({
  chunks,
  sourceById,
}: {
  chunks: RetrievalChunk[]
  sourceById: Map<string, { name: string; type: string; config: unknown }>
}) {
  return (
    <div className="retrieval-chunk-list">
      <span>Chunks recuperados</span>
      {chunks.map((chunk, index) => {
        const linkedSource = chunk.source_id ? sourceById.get(chunk.source_id) : null
        const sourceName = linkedSource ? getKnowledgeSourceName(linkedSource) : chunk.source_type ?? 'Fuente'

        return (
          <article className="retrieval-chunk-item" key={`${chunk.id ?? chunk.source_id ?? 'chunk'}-${index}`}>
            <div className="retrieval-chunk-header">
              <strong>#{chunk.rank ?? index + 1} · {sourceName}</strong>
              <div className="retrieval-chunk-meta">
                {chunk.language ? <span>{chunk.language}</span> : null}
                {typeof chunk.score === 'number' ? (
                  <span className="retrieval-chunk-score" aria-label={`Score de recuperación ${chunk.score.toFixed(2)}`}>
                    <small>Score</small>
                    <strong>{chunk.score.toFixed(2)}</strong>
                  </span>
                ) : null}
              </div>
            </div>
            {chunk.preview ? <p>{chunk.preview}</p> : <p className="muted">Sin preview de contenido.</p>}
            <small className="mono">{chunk.id ? shortId(chunk.id) : chunk.source_id ? shortId(chunk.source_id) : '-'}</small>
          </article>
        )
      })}
    </div>
  )
}

function getResponseFeedback(metadata: unknown): ResponseFeedback | null {
  if (!isRecord(metadata) || !isRecord(metadata.feedback)) return null
  const rating = metadata.feedback.rating
  if (rating !== 'positive' && rating !== 'negative') return null

  return {
    rating,
    submittedAt: typeof metadata.feedback.submitted_at === 'string' ? metadata.feedback.submitted_at : null,
  }
}

function getSessionFeedback(metadata: unknown): SessionFeedback | null {
  if (!isRecord(metadata) || !isRecord(metadata.session_feedback)) return null
  const feedback = metadata.session_feedback
  const resolved = typeof feedback.resolved === 'boolean' ? feedback.resolved : null
  const skipped = feedback.skipped === true
  const comments = typeof feedback.comments === 'string' && feedback.comments.trim()
    ? feedback.comments.trim()
    : null

  if (!skipped && resolved === null && !comments) return null

  return {
    resolved,
    skipped,
    comments,
    submittedAt: typeof feedback.submitted_at === 'string' ? feedback.submitted_at : null,
  }
}

function getResponseFeedbackLabel(rating: ResponseFeedback['rating']) {
  return rating === 'positive' ? 'útil' : 'no útil'
}

function getSessionFeedbackLabel(feedback: SessionFeedback) {
  if (feedback.skipped) return 'saltada'
  if (feedback.resolved === true) return 'resuelta'
  if (feedback.resolved === false) return 'no resuelta'
  return 'sin decisión'
}

function getSessionFeedbackTone(feedback: SessionFeedback) {
  if (feedback.skipped) return 'skipped'
  if (feedback.resolved === true) return 'positive'
  if (feedback.resolved === false) return 'negative'
  return 'skipped'
}

function getTraceSummary({
  provider,
  requestedProvider,
  retrievalStatus,
  lowConfidence,
  fallbackReason,
  sources,
  retrievalChunks,
}: {
  provider: string
  requestedProvider: string | null
  retrievalStatus: string | null
  lowConfidence: boolean
  fallbackReason: string | null
  sources: AgentSource[]
  retrievalChunks: RetrievalChunk[]
}) {
  const topScore = getTopScore(sources, retrievalChunks)

  if (fallbackReason || (requestedProvider && requestedProvider !== provider)) {
    return {
      tone: 'danger' as const,
      label: 'Fallback',
      description: fallbackReason
        ? `Respondió ${getProviderLabel(provider)} por ${getFallbackReasonLabel(fallbackReason)}.`
        : `Respondió ${getProviderLabel(provider)} aunque se pidió ${requestedProvider}.`,
      topScore,
    }
  }

  if (lowConfidence) {
    return {
      tone: 'warning' as const,
      label: 'Baja confianza',
      description: sources.length || retrievalChunks.length
        ? 'Hay fuentes, pero la confianza o el score son bajos. Conviene revisar la respuesta.'
        : 'No hay evidencia suficiente para confiar en esta respuesta.',
      topScore,
    }
  }

  if (sources.length || retrievalChunks.length || retrievalStatus === 'sources_used' || retrievalStatus === 'direct_match') {
    return {
      tone: 'ok' as const,
      label: 'Con fuentes',
      description: retrievalChunks.length
        ? `${retrievalChunks.length} chunks recuperados desde la base de conocimiento.`
        : 'La respuesta usó conocimiento registrado.',
      topScore,
    }
  }

  if (isNoSourcesStatus(retrievalStatus)) {
    return {
      tone: 'warning' as const,
      label: 'Sin fuentes',
      description: 'TALIA respondió sin usar fuentes RAG. Revisa si falta conocimiento o si el umbral es demasiado estricto.',
      topScore,
    }
  }

  return {
    tone: 'muted' as const,
    label: 'Legacy',
    description: 'Respuesta sin trazabilidad completa. Probablemente fue generada antes de activar metadata RAG.',
    topScore,
  }
}

function getTopScore(sources: AgentSource[], chunks: RetrievalChunk[]) {
  const scores = [...sources, ...chunks]
    .map((item) => item.score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))

  return scores.length ? Math.max(...scores) : null
}

function getAgentSources(metadata: unknown): AgentSource[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.agent_sources)) return []

  return metadata.agent_sources
    .map((source) => {
      if (!isRecord(source)) return null
      const id = typeof source.id === 'string' ? source.id : null
      const sourceId = typeof source.source_id === 'string' ? source.source_id : null
      const sourceType = typeof source.source_type === 'string' ? source.source_type : null
      const score = typeof source.score === 'number' && Number.isFinite(source.score) ? source.score : null
      if (!id && !sourceId && !sourceType) return null
      return { id, source_id: sourceId, source_type: sourceType, score }
    })
    .filter((source): source is AgentSource => Boolean(source))
}

function getContextAssembly(metadata: unknown): ContextAssembly | null {
  if (!isRecord(metadata)) return null
  const agentMetadata = isRecord(metadata.agent_metadata) ? metadata.agent_metadata : metadata
  const contextAssembly = isRecord(agentMetadata.context_assembly) ? agentMetadata.context_assembly : null
  if (!contextAssembly) return null

  const mode = typeof contextAssembly.mode === 'string' ? contextAssembly.mode : null
  if (!mode) return null

  const rejected = Array.isArray(contextAssembly.rejected)
    ? contextAssembly.rejected
      .map((item) => {
        if (!isRecord(item)) return null
        const id = typeof item.id === 'string' ? item.id : null
        const score = typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : null
        const reason = typeof item.reason === 'string' ? item.reason : null
        if (!id && !reason) return null
        return { id, score, reason }
      })
      .filter((item): item is ContextAssemblyRejection => Boolean(item))
    : []

  return {
    mode,
    focus: typeof contextAssembly.focus === 'string' ? contextAssembly.focus : null,
    reason: typeof contextAssembly.reason === 'string' ? contextAssembly.reason : null,
    confidence: typeof contextAssembly.confidence === 'number' && Number.isFinite(contextAssembly.confidence)
      ? contextAssembly.confidence
      : null,
    selected_count: typeof contextAssembly.selected_count === 'number' && Number.isFinite(contextAssembly.selected_count)
      ? contextAssembly.selected_count
      : null,
    rejected_count: typeof contextAssembly.rejected_count === 'number' && Number.isFinite(contextAssembly.rejected_count)
      ? contextAssembly.rejected_count
      : rejected.length,
    rejected,
  }
}

function getLanguageTrace(metadata: unknown): LanguageTraceData | null {
  if (!isRecord(metadata)) return null
  const agentMetadata = isRecord(metadata.agent_metadata) ? metadata.agent_metadata : metadata
  const languageAgent = isRecord(agentMetadata.language_agent) ? agentMetadata.language_agent : null
  if (!languageAgent) return null

  const mode = languageAgent.mode === 'deterministic' || languageAgent.mode === 'llm'
    ? languageAgent.mode
    : null
  const fallbackLanguage = typeof languageAgent.fallback_language === 'string'
    ? languageAgent.fallback_language
    : null
  if (!mode || !fallbackLanguage) return null

  return {
    requested_language: typeof languageAgent.requested_language === 'string'
      ? languageAgent.requested_language
      : null,
    fallback_language: fallbackLanguage,
    confidence: typeof languageAgent.confidence === 'number' && Number.isFinite(languageAgent.confidence)
      ? languageAgent.confidence
      : null,
    mode,
    query_expansions: Array.isArray(languageAgent.query_expansions)
      ? languageAgent.query_expansions.filter((item): item is string => typeof item === 'string').slice(0, 36)
      : [],
  }
}

function getFallbackTrace(metadata: unknown): FallbackTraceData | null {
  if (!isRecord(metadata)) return null
  const agentMetadata = isRecord(metadata.agent_metadata) ? metadata.agent_metadata : metadata
  const fallback = isRecord(agentMetadata.fallback) ? agentMetadata.fallback : null
  if (!fallback) return null

  const reason = typeof fallback.reason === 'string' ? fallback.reason : null
  const strategy = typeof fallback.strategy === 'string' ? fallback.strategy : null
  if (!reason || !strategy) return null

  return {
    reason,
    strategy,
    language: typeof fallback.language === 'string' ? fallback.language : null,
    channels: Array.isArray(fallback.channels)
      ? fallback.channels.filter((channel): channel is string => typeof channel === 'string')
      : [],
    template_source: typeof fallback.template_source === 'string' ? fallback.template_source : null,
    whatsapp_link_used: fallback.whatsapp_link_used === true,
    trigger: typeof fallback.trigger === 'string' ? fallback.trigger : null,
  }
}

function getKnowledgeSourceName(source: { name: string; config: unknown }) {
  if (isRecord(source.config) && typeof source.config.file_name === 'string') return source.config.file_name
  return source.name
}

type ChunkStats = {
  total: number
  ready: number
  pending: number
  processing: number
  error: number
}

function createEmptyChunkStats(): ChunkStats {
  return {
    total: 0,
    ready: 0,
    pending: 0,
    processing: 0,
    error: 0,
  }
}

function formatKnowledgeMetric(value: number | null) {
  return value === null ? '—' : value.toLocaleString('es-ES')
}

function sumKnowledgeMetrics(left: number | null, right: number | null) {
  return left === null || right === null ? null : left + right
}

function getChunkStatsBySource(chunks: Array<{ source_id: string | null; embedding_status: string; active: boolean }>) {
  const statsBySource = new Map<string, ChunkStats>()

  for (const chunk of chunks) {
    if (!chunk.source_id || !chunk.active) continue
    const stats = statsBySource.get(chunk.source_id) ?? createEmptyChunkStats()
    stats.total += 1

    if (chunk.embedding_status === 'ready') stats.ready += 1
    else if (chunk.embedding_status === 'processing') stats.processing += 1
    else if (chunk.embedding_status === 'error') stats.error += 1
    else stats.pending += 1

    statsBySource.set(chunk.source_id, stats)
  }

  return statsBySource
}

function getSourceStatusLabel(status: string) {
  if (status === 'ready') return 'Listo'
  if (status === 'processing') return 'Procesando'
  if (status === 'error') return 'Error'
  return 'Pendiente'
}

function getBackstageSyncPhase(metadata: unknown) {
  const phase = metadata && typeof metadata === 'object' && 'phase' in metadata
    ? (metadata as { phase?: unknown }).phase
    : null
  if (phase === 'discovering') return 'Descubriendo páginas'
  if (phase === 'fetching') return 'Revisando contenido'
  if (phase === 'chunking') return 'Preparando conocimiento'
  return 'Finalizando actualización'
}

function getSourceTypeLabel(type: string) {
  if (type === 'pdf') return 'PDF'
  if (type === 'manual') return 'FAQs'
  if (type === 'xlsx') return 'Excel'
  if (type === 'csv') return 'CSV'
  if (type === 'url') return 'URL'
  if (type === 'sitemap') return 'Sitemap'
  if (type === 'website') return 'Web completa'
  if (type === 'web_snapshot') return 'Página web capturada'
  return type
}

function isManagedWebSource(type: string) {
  return type === 'url' || type === 'sitemap' || type === 'website'
}

function getRefreshIntervalLabel(interval: string) {
  if (interval === 'daily') return 'cada 24 horas'
  if (interval === 'weekly') return 'semanal'
  if (interval === 'monthly') return 'mensual'
  return 'manual'
}

function getDocumentCountsBySource(documents: Array<{ source_id: string; status: string }>) {
  const counts = new Map<string, number>()
  for (const document of documents) {
    if (document.status === 'removed') continue
    counts.set(document.source_id, (counts.get(document.source_id) ?? 0) + 1)
  }
  return counts
}

function getLatestSyncRunBySource<T extends { source_id: string }>(runs: T[]) {
  const latest = new Map<string, T>()
  for (const run of runs) {
    if (!latest.has(run.source_id)) latest.set(run.source_id, run)
  }
  return latest
}

function BackstageKnowledgeSourceErrorDetails({ source }: { source: DebuggableSource }) {
  const run = source.latestSyncRun
  const errorDetail = run?.error_details ?? source.lastError
  const sourceErrorIsDifferent = Boolean(source.lastError && source.lastError !== errorDetail)
  const incidents = (run?.failed_count ?? 0) + (run?.blocked_count ?? 0)

  return (
    <details className="backstage-source-error-details">
      <summary>Ver detalle del error</summary>
      <div className="backstage-source-error-panel">
        <dl className="backstage-source-error-facts">
          <div>
            <dt>Estado de la fuente</dt>
            <dd>{getSourceStatusLabel(source.status)}</dd>
          </div>
          <div>
            <dt>Última ejecución</dt>
            <dd>{run ? `${run.status} · ${formatDate(run.created_at)}` : 'Sin ejecución registrada'}</dd>
          </div>
          <div>
            <dt>Código</dt>
            <dd className="mono">{run?.error_code ?? '—'}</dd>
          </div>
          <div>
            <dt>Incidencias</dt>
            <dd>{incidents}</dd>
          </div>
          <div>
            <dt>Embeddings con error</dt>
            <dd>{source.embeddingCounts.error}</dd>
          </div>
        </dl>
        {errorDetail ? (
          <div className="backstage-source-error-message">
            <span>Detalle técnico</span>
            <pre>{errorDetail}</pre>
          </div>
        ) : source.embeddingCounts.error > 0 ? (
          <p className="muted">Hay fragmentos con error de embeddings, pero la fuente no registró un mensaje técnico adicional.</p>
        ) : null}
        {sourceErrorIsDifferent ? (
          <div className="backstage-source-error-message">
            <span>Último error de la fuente</span>
            <pre>{source.lastError}</pre>
          </div>
        ) : null}
      </div>
    </details>
  )
}

function getRetrievalStatusLabel(status: string) {
  if (status === 'sources_used') return 'RAG usado'
  if (status === 'filtered_no_sources') return 'sin fuentes fiables'
  if (status === 'direct_match') return 'match directo'
  if (status === 'delegated_no_sources') return 'sin fuentes'
  if (status === 'local_matches_not_used') return 'matches locales'
  if (status === 'no_sources') return 'sin fuentes'
  if (status === 'not_run') return 'sin retrieval'
  return status
}

function getContextAssemblyModeLabel(mode: string) {
  if (mode === 'focused') return 'contexto enfocado'
  if (mode === 'pass_through') return 'contexto completo'
  return mode
}

function getContextAssemblyFocusLabel(focus: string) {
  if (focus === 'top_relevant_source') return 'fuente dominante'
  return focus
}

function getContextAssemblyReasonLabel(reason: string) {
  if (reason === 'dominant_relevant_source') return 'fuente dominante relevante'
  if (reason === 'topic_mismatch') return 'tema no alineado'
  if (reason === 'no_focus_needed') return 'sin enfoque necesario'
  if (reason === 'no_context') return 'sin contexto'
  return reason
}

function getFallbackReasonLabel(reason: string) {
  if (reason === 'primary_provider_failed') return 'fallback provider'
  if (reason === 'usage_limit_reached') return 'limite alcanzado'
  return reason
}

function getProviderLabel(provider: string) {
  if (provider === 'talia-ai') return 'TALIA AI'
  if (provider === 'n8n') return 'n8n'
  if (provider === 'knowledge_retrieval') return 'FAQ'
  return provider
}

function isNoSourcesStatus(status: string | null) {
  return status === 'delegated_no_sources'
    || status === 'filtered_no_sources'
    || status === 'no_sources'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getEmailCanaryStats(threads: Array<{ status: string; metadata: unknown }>) {
  let sampleSize = 0
  let taliaAiRequested = 0
  let taliaAiCompleted = 0
  let fallbackRuns = 0
  let errorRuns = 0

  for (const thread of threads) {
    if (!isRecord(thread.metadata)) continue
    const metadata = thread.metadata
    const execution = isRecord(metadata.agent_trace) ? metadata.agent_trace : {}
    const classifier = isRecord(execution.classifier) ? execution.classifier : null
    const drafter = isRecord(execution.drafter) ? execution.drafter : null
    const processing = isRecord(metadata.email_processing) ? metadata.email_processing : null
    const requestedProvider = getEmailTraceProvider(metadata.requested_provider)
      ?? getEmailTraceProvider(classifier?.requested_provider)
      ?? getEmailTraceProvider(drafter?.requested_provider)
      ?? getEmailTraceProvider(processing?.provider)
    if (!requestedProvider) continue

    sampleSize += 1
    if (requestedProvider === 'talia-ai') taliaAiRequested += 1

    const actualProviders = [
      getEmailTraceProvider(classifier?.provider),
      getEmailTraceProvider(drafter?.provider),
      getEmailTraceProvider(metadata.provider),
    ].filter((provider): provider is 'talia-ai' | 'n8n' => Boolean(provider))

    const fallbackUsed = metadata.fallback_used === true
      || classifier?.fallback_used === true
      || drafter?.fallback_used === true
    if (fallbackUsed) fallbackRuns += 1

    const hasError = thread.status === 'escalated' || typeof processing?.last_error === 'string'
    if (hasError) errorRuns += 1

    if (
      requestedProvider === 'talia-ai'
      && actualProviders.length > 0
      && actualProviders.every((provider) => provider === 'talia-ai')
      && !fallbackUsed
      && !hasError
    ) {
      taliaAiCompleted += 1
    }
  }

  return { sampleSize, taliaAiRequested, taliaAiCompleted, fallbackRuns, errorRuns }
}

function getEmailTraceProvider(value: unknown) {
  return value === 'talia-ai' || value === 'n8n' ? value : null
}

function shortId(value: string) {
  return value.length > 8 ? `${value.slice(0, 8)}...` : value
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatBackstageUsagePeriod(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(new Date(end).getTime() - 1)
  const formatter = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`
}

function formatTokens(tokens: number) {
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function IconAction({ href, label, children, newTab = false }: { href: string; label: string; children: React.ReactNode; newTab?: boolean }) {
  return (
    <span className="tooltip-wrap">
      <Link className="icon-button" href={href} aria-label={label} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
        {children}
      </Link>
      <span className="tooltip-tip">{label}</span>
    </span>
  )
}
