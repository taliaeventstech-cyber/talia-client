import { createAdminClient } from '@/lib/supabase/admin'
import { getKnowledgeWebOperationalAlerts } from '@/lib/knowledge/web-source-alerts'
import { getActiveSubscription, getTenantUsageForPeriod } from '@/lib/usage/service'
import { getManagedWebQuotaUsage } from '@/lib/knowledge/web-source-quotas'
import { FileText, LayoutDashboard, MailPlus } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EditClientForm } from './edit-client-form'
import { BackstageReindexTenantKnowledgeButton, BackstageReprocessSourceButton, BackstageRetryEmbeddingsButton } from './knowledge-source-actions'
import { KnowledgeWebAlerts } from '../../knowledge-web-alerts'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function BackstageClientPage({ params }: Props) {
  const { tenantId } = await params
  const admin = createAdminClient()
  const [{ data: client }, { data: modules }, { data: emailConnections }, { data: emailTraceThreads }, subscriptionResult, usageResult, { data: traceMessages }, { data: knowledgeSources }, managedWebQuota, webAlerts] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, slug, entity_type, primary_language, plan, website_url, fallback_email, fallback_phone, n8n_webhook_url, system_prompt, widget_config, voice_phone_number, voice_phone_provider, voice_phone_mode, voice_public_phone_number, voice_forwarding_notes, voice_operational_status')
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
    getTenantUsageForPeriod(admin, tenantId),
    admin
      .from('messages')
      .select('id, conversation_id, content, created_at, metadata')
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(8),
    admin
      .from('knowledge_sources')
      .select('id, name, type, status, config, source_url, refresh_interval, next_sync_at, last_synced_at, last_error, created_at')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false }),
    getManagedWebQuotaUsage(admin, tenantId),
    getKnowledgeWebOperationalAlerts(admin, { tenantId }),
  ])

  if (!client) notFound()

  const subscription = subscriptionResult.ok ? subscriptionResult.subscription : null
  const usage = usageResult.ok ? usageResult.usage : null
  const chatLimit = subscription?.included_chat_conversations ?? 0
  const chatUsed = usage?.conversations ?? 0
  const chatPercent = chatLimit > 0 ? Math.min(100, Math.round((chatUsed / chatLimit) * 100)) : 0
  const totalTokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)
  const traceSourceIds = Array.from(new Set((traceMessages ?? [])
    .flatMap((message) => getAgentSources(message.metadata))
    .map((source) => source.source_id)
    .filter((sourceId): sourceId is string => Boolean(sourceId))))
  const knowledgeSourceIds = (knowledgeSources ?? []).map((source) => source.id)
  const [{ data: traceConversations }, { data: traceSources }, { data: knowledgeChunks }, { data: knowledgeDocuments }, { data: knowledgeSyncRuns }] = await Promise.all([
    (traceMessages ?? []).length
      ? admin
        .from('conversations')
        .select('id, session_id, metadata')
        .in('id', (traceMessages ?? []).map((message) => message.conversation_id))
        .eq('theatre_id', tenantId)
      : Promise.resolve({ data: [] }),
    traceSourceIds.length
      ? admin
        .from('knowledge_sources')
        .select('id, name, type, config')
        .in('id', traceSourceIds)
        .eq('theatre_id', tenantId)
      : Promise.resolve({ data: [] }),
    knowledgeSourceIds.length
      ? admin
        .from('knowledge_chunks')
        .select('source_id, embedding_status, active')
        .eq('theatre_id', tenantId)
        .in('source_id', knowledgeSourceIds)
      : Promise.resolve({ data: [] }),
    knowledgeSourceIds.length
      ? admin
        .from('knowledge_documents')
        .select('source_id, status')
        .eq('theatre_id', tenantId)
        .in('source_id', knowledgeSourceIds)
      : Promise.resolve({ data: [] }),
    knowledgeSourceIds.length
      ? admin
        .from('knowledge_sync_runs')
        .select('source_id, status, trigger, checked_count, changed_count, failed_count, blocked_count, created_at, finished_at, error_code, error_details')
        .eq('theatre_id', tenantId)
        .in('source_id', knowledgeSourceIds)
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])
  const conversationById = new Map((traceConversations ?? []).map((conversation) => [conversation.id, conversation]))
  const sourceById = new Map((traceSources ?? []).map((source) => [source.id, source]))
  const chunkStatsBySource = getChunkStatsBySource(knowledgeChunks ?? [])
  const documentCountsBySource = getDocumentCountsBySource(knowledgeDocuments ?? [])
  const latestSyncRunBySource = getLatestSyncRunBySource(knowledgeSyncRuns ?? [])
  const ragHealth = getRagHealth(knowledgeSources ?? [], chunkStatsBySource)
  const traceStats = getTraceStats(traceMessages ?? [])
  const feedbackStats = getTraceFeedbackStats(traceMessages ?? [], traceConversations ?? [])

  return (
    <div className="stack">
      <Link className="back-link" href="/backstage">Volver a clientes</Link>

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
          <IconAction href={`/backstage/tenants/${client.id}/invites`} label="Gestionar invitaciones">
            <MailPlus aria-hidden="true" size={16} strokeWidth={2} />
          </IconAction>
        </div>
      </header>

      <section className="card stack">
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
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">RAG</p>
            <h2>Salud del conocimiento</h2>
          </div>
          <div className="header-actions">
            <BackstageReindexTenantKnowledgeButton tenantId={tenantId} />
            <span className={`status-pill ${ragHealth.statusClass}`}>{ragHealth.statusLabel}</span>
          </div>
        </div>

        <div className="rag-health-grid">
          <div className="rag-health-card">
            <span>Fuentes</span>
            <strong>{ragHealth.sourceCount}</strong>
            <small>{ragHealth.readySources} listos · {ragHealth.errorSources} con error</small>
          </div>
          <div className="rag-health-card">
            <span>Fragmentos</span>
            <strong>{ragHealth.totalChunks}</strong>
            <small>{ragHealth.readyChunks} con embeddings listos</small>
          </div>
          <div className="rag-health-card">
            <span>Pendientes</span>
            <strong>{ragHealth.pendingChunks + ragHealth.processingChunks}</strong>
            <small>{ragHealth.pendingChunks} pendientes · {ragHealth.processingChunks} procesando</small>
          </div>
          <div className="rag-health-card">
            <span>Errores</span>
            <strong>{ragHealth.errorChunks}</strong>
            <small>{ragHealth.readinessPercent}% preparado</small>
          </div>
        </div>

        {ragHealth.notice ? <p className={`rag-health-notice ${ragHealth.noticeTone}`}>{ragHealth.notice}</p> : null}
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">RAG</p>
            <h2>Trazabilidad de respuestas</h2>
          </div>
          <span className="status-pill status-pill-muted">{traceMessages?.length ?? 0} recientes</span>
        </div>

        <div className="rag-trace-summary-grid" aria-label="Resumen de trazabilidad RAG">
          <div className="rag-trace-summary-card rag-trace-summary-card-ok">
            <span>Con fuentes</span>
            <strong>{traceStats.withSources}</strong>
          </div>
          <div className="rag-trace-summary-card rag-trace-summary-card-warning">
            <span>Sin fuentes</span>
            <strong>{traceStats.withoutSources}</strong>
          </div>
          <div className="rag-trace-summary-card rag-trace-summary-card-warning">
            <span>Baja confianza</span>
            <strong>{traceStats.lowConfidence}</strong>
          </div>
          <div className="rag-trace-summary-card rag-trace-summary-card-danger">
            <span>Fallback</span>
            <strong>{traceStats.fallbacks}</strong>
          </div>
        </div>

        <div className="rag-feedback-summary-grid" aria-label="Resumen de feedback del chatbot">
          <div className="rag-feedback-summary-card rag-feedback-summary-card-positive">
            <span>Respuestas útiles</span>
            <strong>{feedbackStats.responsePositive}</strong>
          </div>
          <div className="rag-feedback-summary-card rag-feedback-summary-card-negative">
            <span>Respuestas no útiles</span>
            <strong>{feedbackStats.responseNegative}</strong>
          </div>
          <div className="rag-feedback-summary-card rag-feedback-summary-card-positive">
            <span>Sesiones resueltas</span>
            <strong>{feedbackStats.sessionResolved}</strong>
          </div>
          <div className="rag-feedback-summary-card rag-feedback-summary-card-negative">
            <span>Sesiones no resueltas</span>
            <strong>{feedbackStats.sessionUnresolved}</strong>
          </div>
        </div>

        {(traceMessages ?? []).length ? (
          <div className="rag-trace-list">
            {(traceMessages ?? []).map((message) => {
              const metadata = isRecord(message.metadata) ? message.metadata : {}
              const sources = getAgentSources(message.metadata)
              const conversation = conversationById.get(message.conversation_id)
              const responseFeedback = getResponseFeedback(metadata)
              const sessionFeedback = getSessionFeedback(conversation?.metadata)
              const provider = typeof metadata.source === 'string' ? metadata.source : 'unknown'
              const requestedProvider = typeof metadata.requested_provider === 'string' ? metadata.requested_provider : null
              const model = typeof metadata.model === 'string' ? metadata.model : null
              const language = typeof metadata.response_language === 'string' ? metadata.response_language : null
              const userMessage = typeof metadata.user_message === 'string' ? metadata.user_message : null
              const retrievalStatus = typeof metadata.retrieval_status === 'string' ? metadata.retrieval_status : null
              const retrievalChunks = getRetrievalChunks(metadata.retrieval)
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

              return (
                <article className={`rag-trace-item rag-trace-item-${traceSummary.tone}`} key={message.id}>
                  <div className="rag-trace-header">
                    <div>
                      <div className="rag-trace-title-row">
                        <span className={`rag-trace-state rag-trace-state-${traceSummary.tone}`}>{traceSummary.label}</span>
                        <strong>{userMessage ? truncate(userMessage, 150) : truncate(message.content, 150)}</strong>
                      </div>
                      <p className="muted">{traceSummary.description}</p>
                    </div>
                    <div className="rag-trace-meta">
                      <span>{getProviderLabel(provider)}</span>
                      {requestedProvider && requestedProvider !== provider ? <span>pedido {requestedProvider}</span> : null}
                      {language ? <span>{language}</span> : null}
                      <time>{new Date(message.created_at).toLocaleString('es-ES')}</time>
                    </div>
                  </div>

                  <div className="rag-trace-answer">
                    <span>Respuesta</span>
                    <p>{truncate(message.content, 260)}</p>
                  </div>

                  {responseFeedback || sessionFeedback ? (
                    <div className="rag-trace-feedback">
                      {responseFeedback ? (
                        <span className={`rag-trace-feedback-pill rag-trace-feedback-${responseFeedback.rating}`}>
                          Respuesta: {getResponseFeedbackLabel(responseFeedback.rating)}
                        </span>
                      ) : null}
                      {sessionFeedback ? (
                        <span className={`rag-trace-feedback-pill rag-trace-feedback-${getSessionFeedbackTone(sessionFeedback)}`}>
                          Sesión: {getSessionFeedbackLabel(sessionFeedback)}
                        </span>
                      ) : null}
                      {sessionFeedback?.comments ? <p>{truncate(sessionFeedback.comments, 180)}</p> : null}
                    </div>
                  ) : null}

                  <div className="rag-trace-foot">
                    <p className="muted mono">
                      {conversation ? `session ${conversation.session_id.slice(0, 16)}...` : `conversation ${message.conversation_id.slice(0, 8)}...`}
                    </p>
                    <div>
                      {model ? <span>{model}</span> : null}
                      {retrievalStatus ? <span>{getRetrievalStatusLabel(retrievalStatus)}</span> : null}
                      {contextAssembly ? <span>{getContextAssemblyModeLabel(contextAssembly.mode)}</span> : null}
                      {languageTrace ? <span>idioma {languageTrace.mode}</span> : null}
                      {fallbackTrace ? <span>{fallbackTrace.strategy}</span> : null}
                      {typeof traceSummary.topScore === 'number' ? <span>score {traceSummary.topScore.toFixed(2)}</span> : null}
                    </div>
                  </div>

                  {lowConfidence || fallbackReason || retrievalStatus === 'delegated_no_sources' || retrievalStatus === 'no_sources' ? (
                    <div className="rag-trace-alerts">
                      {lowConfidence ? <span>Confianza baja</span> : null}
                      {fallbackReason ? <span>{getFallbackReasonLabel(fallbackReason)}</span> : null}
                      {isNoSourcesStatus(retrievalStatus) ? <span>Sin fuentes usadas</span> : null}
                    </div>
                  ) : null}

                  <details className="rag-trace-details">
                    <summary>Ver detalle RAG</summary>
                    <div className="rag-trace-detail-body">
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

                      {fallbackTrace ? <FallbackTrace fallback={fallbackTrace} /> : null}

                      {sources.length ? (
                        <ConversationSourceList sources={sources} sourceById={sourceById} />
                      ) : (
                        <p className="muted">Sin fuentes RAG registradas para esta respuesta.</p>
                      )}

                      {retrievalChunks.length ? (
                        <RetrievalChunkList chunks={retrievalChunks} sourceById={sourceById} />
                      ) : null}
                    </div>
                  </details>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="muted">Todavía no hay respuestas del chatbot con trazabilidad registrada.</p>
        )}
      </section>

      <section className="card stack" id="knowledge-web-sources">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Conocimiento</p>
            <h2>Fuentes procesadas</h2>
          </div>
          <div className="section-heading-actions">
            <span className="status-pill status-pill-muted">{knowledgeSources?.length ?? 0} fuentes totales</span>
            <span className="status-pill status-pill-muted">
              Web {managedWebQuota.sources}/{managedWebQuota.limits.maxSources} fuentes
            </span>
            <span className="status-pill status-pill-muted">
              {managedWebQuota.documents}/{managedWebQuota.limits.maxDocuments} páginas
            </span>
            <span className="status-pill status-pill-muted">
              {managedWebQuota.manualSyncsToday}/{managedWebQuota.limits.maxManualSyncsPerDay} sync manual hoy
            </span>
          </div>
        </div>

        <KnowledgeWebAlerts
          alerts={webAlerts.alerts}
          error={webAlerts.error}
          showTenant={false}
          title="Alertas de actualización web"
        />

        {(knowledgeSources ?? []).length ? (
          <div className="knowledge-files-list">
            {(knowledgeSources ?? []).map((source) => {
              const stats = chunkStatsBySource.get(source.id) ?? createEmptyChunkStats()
              const documentCount = documentCountsBySource.get(source.id) ?? 0
              const latestSyncRun = latestSyncRunBySource.get(source.id)
              const fileName = getKnowledgeSourceName(source)

              return (
                <article className="knowledge-file-item" id={`source-${source.id}`} key={source.id}>
                  <div className="knowledge-file-icon" aria-hidden="true">
                    <FileText size={20} strokeWidth={2} />
                  </div>
                  <div className="knowledge-file-main">
                    <div className="knowledge-file-title-row">
                      <h3>{fileName}</h3>
                      <span className={`knowledge-file-status knowledge-file-status-${source.status}`}>
                        {getSourceStatusLabel(source.status)}
                      </span>
                    </div>
                    <div className="knowledge-file-meta">
                      <span>{getSourceTypeLabel(source.type)}</span>
                      <span>{stats.total} fragmentos</span>
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
                        <span className="knowledge-installed-signal">Run {latestSyncRun.status}</span>
                        <span className="knowledge-installed-signal">{latestSyncRun.checked_count} revisadas</span>
                        <span className="knowledge-installed-signal knowledge-installed-signal-ok">{latestSyncRun.changed_count} cambiadas</span>
                        {latestSyncRun.failed_count + latestSyncRun.blocked_count > 0 ? (
                          <span className="knowledge-installed-signal">{latestSyncRun.failed_count + latestSyncRun.blocked_count} incidencias</span>
                        ) : null}
                      </div>
                    ) : null}
                    {latestSyncRun?.error_code ? (
                      <p className="knowledge-file-error">
                        {latestSyncRun.error_code}: {latestSyncRun.error_details ?? 'Sin detalle adicional'}
                      </p>
                    ) : null}
                    {stats.total > 0 ? (
                      <div className="knowledge-embedding-stats" aria-label="Estado de embeddings">
                        <span className="knowledge-embedding-stat knowledge-embedding-stat-ready">{stats.ready} listos</span>
                        {stats.processing > 0 ? <span className="knowledge-embedding-stat">{stats.processing} procesando</span> : null}
                        {stats.pending > 0 ? <span className="knowledge-embedding-stat knowledge-embedding-stat-pending">{stats.pending} pendientes</span> : null}
                        {stats.error > 0 ? <span className="knowledge-embedding-stat knowledge-embedding-stat-error">{stats.error} error</span> : null}
                      </div>
                    ) : null}
                    {source.last_error ? <p className="knowledge-file-error">{source.last_error}</p> : null}
                  </div>
                  <div className="knowledge-file-actions">
                    {stats.pending + stats.error > 0 ? (
                      <BackstageRetryEmbeddingsButton tenantId={tenantId} sourceId={source.id} />
                    ) : null}
                    <BackstageReprocessSourceButton tenantId={tenantId} sourceId={source.id} sourceType={source.type} />
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="muted">Este venue todavía no tiene fuentes cargadas como base de conocimiento.</p>
        )}
      </section>

      <EditClientForm
        client={client}
        modules={modules ?? []}
        emailConnection={emailConnections?.[0] ?? null}
        emailTrace={emailTraceThreads?.[0] ?? null}
        emailCanaryStats={getEmailCanaryStats(emailTraceThreads ?? [])}
      />
    </div>
  )
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
        <span>LanguageAgent</span>
        <div>
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
        <span>FallbackPolicy</span>
        <div>
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
        <span>ContextAssembler</span>
        <div>
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
              <div>
                {chunk.language ? <span>{chunk.language}</span> : null}
                {typeof chunk.score === 'number' ? <span>score {chunk.score.toFixed(2)}</span> : null}
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

function getTraceStats(messages: Array<{ metadata: unknown }>) {
  return messages.reduce((stats, message) => {
    const metadata = isRecord(message.metadata) ? message.metadata : {}
    const sources = getAgentSources(metadata)
    const chunks = getRetrievalChunks(metadata.retrieval)
    const retrievalStatus = typeof metadata.retrieval_status === 'string' ? metadata.retrieval_status : null
    const fallbackReason = typeof metadata.fallback_reason === 'string' ? metadata.fallback_reason : null
    const lowConfidence = metadata.low_confidence === true

    if (sources.length || chunks.length || retrievalStatus === 'sources_used' || retrievalStatus === 'direct_match') {
      stats.withSources += 1
    } else if (isNoSourcesStatus(retrievalStatus)) {
      stats.withoutSources += 1
    }

    if (lowConfidence) stats.lowConfidence += 1
    if (fallbackReason) stats.fallbacks += 1
    return stats
  }, {
    withSources: 0,
    withoutSources: 0,
    lowConfidence: 0,
    fallbacks: 0,
  })
}

function getTraceFeedbackStats(
  messages: Array<{ metadata: unknown }>,
  conversations: Array<{ metadata: unknown }>
) {
  const responseStats = messages.reduce((stats, message) => {
    const feedback = getResponseFeedback(message.metadata)
    if (feedback?.rating === 'positive') stats.responsePositive += 1
    if (feedback?.rating === 'negative') stats.responseNegative += 1
    return stats
  }, {
    responsePositive: 0,
    responseNegative: 0,
  })

  return conversations.reduce((stats, conversation) => {
    const feedback = getSessionFeedback(conversation.metadata)
    if (feedback?.resolved === true) stats.sessionResolved += 1
    if (feedback?.resolved === false) stats.sessionUnresolved += 1
    if (feedback?.skipped) stats.sessionSkipped += 1
    return stats
  }, {
    ...responseStats,
    sessionResolved: 0,
    sessionUnresolved: 0,
    sessionSkipped: 0,
  })
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

function getRetrievalChunks(retrieval: unknown): RetrievalChunk[] {
  if (!isRecord(retrieval) || !Array.isArray(retrieval.chunks)) return []

  return retrieval.chunks
    .map((chunk) => {
      if (!isRecord(chunk)) return null
      const id = typeof chunk.id === 'string' ? chunk.id : null
      const sourceId = typeof chunk.source_id === 'string' ? chunk.source_id : null
      const sourceType = typeof chunk.source_type === 'string' ? chunk.source_type : null
      const score = typeof chunk.score === 'number' && Number.isFinite(chunk.score) ? chunk.score : null
      const rank = typeof chunk.rank === 'number' && Number.isFinite(chunk.rank) ? chunk.rank : null
      const language = typeof chunk.language === 'string' ? chunk.language : null
      const preview = typeof chunk.preview === 'string' ? chunk.preview : null
      if (!id && !sourceId && !sourceType && !preview) return null
      return { id, source_id: sourceId, source_type: sourceType, score, rank, language, preview }
    })
    .filter((chunk): chunk is RetrievalChunk => Boolean(chunk))
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

type KnowledgeSourceSummary = {
  id: string
  status: string
}

function getRagHealth(sources: KnowledgeSourceSummary[], chunkStatsBySource: Map<string, ChunkStats>) {
  const totals = sources.reduce((acc, source) => {
    const stats = chunkStatsBySource.get(source.id) ?? createEmptyChunkStats()
    acc.totalChunks += stats.total
    acc.readyChunks += stats.ready
    acc.pendingChunks += stats.pending
    acc.processingChunks += stats.processing
    acc.errorChunks += stats.error
    if (source.status === 'ready') acc.readySources += 1
    if (source.status === 'error') acc.errorSources += 1
    return acc
  }, {
    totalChunks: 0,
    readyChunks: 0,
    pendingChunks: 0,
    processingChunks: 0,
    errorChunks: 0,
    readySources: 0,
    errorSources: 0,
  })

  const readinessPercent = totals.totalChunks > 0
    ? Math.round((totals.readyChunks / totals.totalChunks) * 100)
    : 0
  const hasErrors = totals.errorChunks > 0 || totals.errorSources > 0
  const hasPending = totals.pendingChunks > 0 || totals.processingChunks > 0

  if (!sources.length) {
    return {
      ...totals,
      sourceCount: 0,
      readinessPercent,
      statusClass: 'status-pill-muted',
      statusLabel: 'sin fuentes',
      notice: 'Este venue todavía no tiene fuentes preparadas para retrieval.',
      noticeTone: 'rag-health-notice-muted',
    }
  }

  if (hasErrors) {
    return {
      ...totals,
      sourceCount: sources.length,
      readinessPercent,
      statusClass: 'status-pill-danger',
      statusLabel: 'revisar',
      notice: 'Hay fuentes o embeddings con error. Reintenta embeddings o reprocesa la fuente desde Backstage.',
      noticeTone: 'rag-health-notice-error',
    }
  }

  if (hasPending) {
    return {
      ...totals,
      sourceCount: sources.length,
      readinessPercent,
      statusClass: 'status-pill-soon',
      statusLabel: 'procesando',
      notice: 'Hay embeddings pendientes o en proceso. Si no avanzan, usa el reintento desde Backstage.',
      noticeTone: 'rag-health-notice-warning',
    }
  }

  return {
    ...totals,
    sourceCount: sources.length,
    readinessPercent,
    statusClass: 'status-pill-active',
    statusLabel: 'operativo',
    notice: null,
    noticeTone: 'rag-health-notice-muted',
  }
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

function getSourceTypeLabel(type: string) {
  if (type === 'pdf') return 'PDF'
  if (type === 'manual') return 'FAQs'
  if (type === 'xlsx') return 'Excel'
  if (type === 'csv') return 'CSV'
  if (type === 'url') return 'URL'
  if (type === 'sitemap') return 'Sitemap'
  if (type === 'website') return 'Web completa'
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
