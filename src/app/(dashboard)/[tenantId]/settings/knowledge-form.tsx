'use client'

import { ChevronDown, FileText, Globe2, LifeBuoy, Link as LinkIcon, RefreshCw, Table2, Trash2, Workflow } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { KnowledgeSyncRealtime } from '@/components/knowledge-sync-realtime'
import { ToastNotice } from '@/components/ui/toast-notice'
import type { ManagedWebQuotaUsage } from '@/lib/knowledge/web-source-quotas'
import { getManagedWebPresentation, type ManagedWebOutcome } from '@/lib/knowledge/managed-web-presentation'
import { createKnowledgeItem, createManagedWebKnowledgeSource, uploadKnowledgeExcel, uploadKnowledgePdf, updateKnowledgeItem, deleteKnowledgeItem, deleteKnowledgeSource, requestKnowledgeSourceSupport, requestManagedWebSourceSync, retryKnowledgeSourceEmbeddings, updateManagedWebSourceSchedule, type SettingsFormState, type ExcelUploadState, type PdfUploadState, type ManagedWebSourceState } from './actions'

type KnowledgeItem = {
  id: string
  question: string
  answer: string
  category: string | null
  language: string
  priority: number
}

type KnowledgeSource = {
  id: string
  type: string
  name: string
  status: string
  syncEnabled: boolean
  config: unknown
  sourceUrl: string | null
  refreshInterval: string
  nextSyncAt: string | null
  lastSyncedAt: string | null
  lastError: string | null
  documentCount: number
  latestSyncRun: {
    status: string
    discovered_count: number
    checked_count: number
    changed_count: number
    unchanged_count: number
    failed_count: number
    blocked_count: number
    error_code: string | null
    error_details: string | null
    metadata: unknown
    created_at: string
    finished_at: string | null
  } | null
  chunkCount: number
  embeddingCounts: {
    ready: number
    pending: number
    processing: number
    error: number
  }
}

type KnowledgeFormProps = {
  tenantId: string
  activeTab: 'installed' | 'files' | 'faqs' | 'apps' | 'spreadsheets'
  sources: KnowledgeSource[]
  items: KnowledgeItem[]
  managedWebQuota: ManagedWebQuotaUsage | null
  pagination?: ReactNode
  labels: {
    officialAnswers: string
    officialAnswersHelp: string
    visitorQuestion: string
    visitorQuestionPlaceholder: string
    visitorQuestionHint: string
    topic: string
    noSpecificTopic: string
    topicHint: string
    language: string
    languageHint: string
    confidence: string
    confidenceHigh: string
    confidenceNormal: string
    confidenceLow: string
    confidenceHint: string
    officialAnswer: string
    officialAnswerPlaceholder: string
    officialAnswerHint: string
    adding: string
    addFaq: string
    noItems: string
    importExcel: string
    importHelp: string
    importWarning: string
    importing: string
    importButton: string
    importPdf: string
    importPdfHelp: string
    importPdfWarning: string
    importPdfButton: string
    urlProcessing: string
    managedWeb: string
    managedWebHelp: string
    managedWebSourcesUsage: string
    managedWebDocumentsUsage: string
    managedWebQuotaReached: string
    sourceName: string
    sourceNamePlaceholder: string
    sourceType: string
    sourceTypeUrl: string
    sourceTypeSitemap: string
    sourceTypeWebsite: string
    sourceUrl: string
    sourceUrlPlaceholder: string
    refreshInterval: string
    refreshManual: string
    refreshDaily: string
    refreshWeekly: string
    refreshMonthly: string
    addManagedSource: string
    addingManagedSource: string
    noManagedSources: string
    syncNow: string
    syncingNow: string
    sourceDocuments: string
    sourceLastSync: string
    sourceNextSync: string
    sourceNeverSynced: string
    sourceChecked: string
    syncPhaseDiscovering: string
    syncPhaseFetching: string
    syncPhaseChunking: string
    syncPhaseFinishing: string
    sourceChanged: string
    sourceIssues: string
    sourceFragments: string
    sourceOutcomeQueued: string
    sourceOutcomeRunning: string
    sourceOutcomeUpdated: string
    sourceOutcomeUnchanged: string
    sourceOutcomePartialDiscovery: string
    sourceOutcomePartialCapture: string
    sourceOutcomeQuota: string
    sourceOutcomeBlocked: string
    sourceOutcomeFailed: string
    sourceOutcomePending: string
    sourceOutcomePaused: string
    sourceRetry: string
    sourceUseWidget: string
    sourceContactSupport: string
    sourceSupportPrompt: string
    sourceSupportPlaceholder: string
    sourceSupportSend: string
    sourceSupportSending: string
    sourceSupportCancel: string
    sourceQuotaExceeded: string
    sourceStatusQueued: string
    sourceStatusRunning: string
    sourceStatusReady: string
    sourceStatusError: string
    sourceStatusPartial: string
    sourceStatusPending: string
    sourceStatusPaused: string
    sourceSyncPaused: string
    widgetCapturedPages: string
    installedWeb: string
    installedWebHelp: string
    noInstalledPagesTitle: string
    noInstalledPages: string
    refreshInstalled: string
    refreshingInstalled: string
    capturePage: string
    openingCapture: string
    captureAllPages: string
    capturingAllPages: string
    captureBlocked: string
    captureSomeBlocked: string
    captureOpenError: string
    capturedPageReady: string
    capturedPageConnected: string
    capturedPageError: string
    installedScriptDetected: string
    lastVisitDetected: string
    lastCapture: string
    contentReady: string
    contentPending: string
    table: {
      question: string
      topic: string
      language: string
      confidence: string
    }
    topics: {
      agenda: string
      entradas: string
      precios: string
      horarios: string
      ubicacion: string
      accesibilidad: string
      visita: string
    }
  }
}

const initialState: SettingsFormState = {
  ok: false,
  message: '',
}

const excelInitialState: ExcelUploadState = {
  ok: false,
  message: '',
}

const pdfInitialState: PdfUploadState = {
  ok: false,
  message: '',
}

const managedWebInitialState: ManagedWebSourceState = {
  ok: false,
  message: '',
}

export function KnowledgeForm({ tenantId, activeTab, sources, items, managedWebQuota, pagination, labels }: KnowledgeFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createKnowledgeItem.bind(null, tenantId), initialState)
  const [excelState, excelFormAction, excelPending] = useActionState(uploadKnowledgeExcel.bind(null, tenantId), excelInitialState)
  const [pdfState, pdfFormAction, pdfPending] = useActionState(uploadKnowledgePdf.bind(null, tenantId), pdfInitialState)
  const [managedWebState, managedWebFormAction, managedWebPending] = useActionState(
    createManagedWebKnowledgeSource.bind(null, tenantId),
    managedWebInitialState
  )
  const [isRefreshingInstalled, startInstalledRefresh] = useTransition()
  const fileSources = sources.filter((source) => source.type === 'pdf')
  const spreadsheetSources = sources.filter((source) => source.type === 'xlsx' || source.type === 'csv')
  const managedWebQuotaReached = managedWebQuota
    ? managedWebQuota.sources >= managedWebQuota.limits.maxSources
      || managedWebQuota.documents >= managedWebQuota.limits.maxDocuments
    : false
  const installedWebSources = sources.filter((source) => source.type === 'web_snapshot')
  const managedWebSources = sources.filter((source) => source.type === 'url' || source.type === 'sitemap' || source.type === 'website')
  const hasActiveManagedRun = managedWebSources.some((source) => ['queued', 'running'].includes(source.latestSyncRun?.status ?? ''))

  return (
    <>
      {activeTab === 'installed' ? <KnowledgeSyncRealtime tenantId={tenantId} hasActiveRun={hasActiveManagedRun} /> : null}
      {activeTab === 'files' ? (
        <>
          <section className="card stack">
            <div className="section-heading-row">
              <div>
                <h2>Files</h2>
                <p className="muted">Documentos importados que TALIA usa como contexto de respuesta.</p>
              </div>
            </div>

            {fileSources.length ? (
            <div className="knowledge-files-list">
              {fileSources.map((source) => (
                <KnowledgeSourceRow key={source.id} tenantId={tenantId} source={source} />
              ))}
            </div>
          ) : (
            <p className="muted">Aún no hay archivos o fuentes documentales cargadas.</p>
            )}
          </section>

          <section className="card stack">
            <div className="section-heading-row">
              <div>
                <h2>{labels.importPdf}</h2>
                <p className="muted">{labels.importPdfHelp}</p>
              </div>
            </div>

            <form action={pdfFormAction} className="stack">
              {pdfState.message ? (
                <p role="status" className={`notice ${pdfState.ok ? 'notice-success' : 'notice-error'}`}>
                  {pdfState.message}
                </p>
              ) : null}

              <p className="notice notice-warning">
                {labels.importPdfWarning}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="field" style={{ flex: 1, margin: 0 }}>
                  <input type="file" name="file" accept="application/pdf,.pdf" required />
                </label>
                <button className="button-primary" type="submit" disabled={pdfPending} style={{ opacity: pdfPending ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                  {pdfPending ? labels.importing : labels.importPdfButton}
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}

      {activeTab === 'faqs' ? (
        <section className="card stack">
          <div className="section-heading-row">
            <div>
              <h2>{labels.officialAnswers}</h2>
              <p className="muted">{labels.officialAnswersHelp}</p>
            </div>
          </div>
          <>

            <form action={formAction} className="stack">
              {state.message ? (
                <p role="status" className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
                  {state.message}
                </p>
              ) : null}

              <div className="form-grid">
                <label className="field">
                  {labels.visitorQuestion}
                  <input name="question" placeholder={labels.visitorQuestionPlaceholder} required />
                  <span className="field-hint">{labels.visitorQuestionHint}</span>
                </label>

                <label className="field">
                  {labels.topic}
                  <select name="category" defaultValue="">
                    <option value="">{labels.noSpecificTopic}</option>
                    <option value="agenda">{labels.topics.agenda}</option>
                    <option value="entradas">{labels.topics.entradas}</option>
                    <option value="precios">{labels.topics.precios}</option>
                    <option value="horarios">{labels.topics.horarios}</option>
                    <option value="ubicacion">{labels.topics.ubicacion}</option>
                    <option value="accesibilidad">{labels.topics.accesibilidad}</option>
                    <option value="visita">{labels.topics.visita}</option>
                  </select>
                  <span className="field-hint">{labels.topicHint}</span>
                </label>

                <label className="field">
                  {labels.language}
                  <select name="language" defaultValue="ca">
                    <option value="ca">Català</option>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                  <span className="field-hint">{labels.languageHint}</span>
                </label>

                <label className="field">
                  {labels.confidence}
                  <select name="priority" defaultValue="50">
                    <option value="80">{labels.confidenceHigh}</option>
                    <option value="50">{labels.confidenceNormal}</option>
                    <option value="20">{labels.confidenceLow}</option>
                  </select>
                  <span className="field-hint">{labels.confidenceHint}</span>
                </label>
              </div>

              <label className="field">
                {labels.officialAnswer}
                <textarea name="answer" rows={5} placeholder={labels.officialAnswerPlaceholder} required />
                <span className="field-hint">{labels.officialAnswerHint}</span>
              </label>

              <button className="button-primary" type="submit" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
                {pending ? labels.adding : labels.addFaq}
              </button>
            </form>

            {items.length ? (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{labels.table.question}</th>
                      <th>{labels.table.topic}</th>
                      <th>{labels.table.language}</th>
                      <th>{labels.table.confidence}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <KnowledgeItemRow key={item.id} tenantId={tenantId} item={item} />
                    ))}
                  </tbody>
                </table>
                {pagination}
              </>
            ) : (
              <p className="muted">{labels.noItems}</p>
            )}
          </>
        </section>
      ) : null}

      {activeTab === 'spreadsheets' ? (
        <>
          <section className="card stack">
            <div className="section-heading-row">
              <div>
                <h2>Spreadsheets</h2>
                <p className="muted">Archivos Excel o CSV importados como respuestas estructuradas.</p>
              </div>
            </div>
            {spreadsheetSources.length ? (
              <div className="knowledge-files-list">
                {spreadsheetSources.map((source) => (
                  <KnowledgeSourceRow key={source.id} tenantId={tenantId} source={source} />
                ))}
              </div>
            ) : (
              <p className="muted">Aún no hay hojas de cálculo cargadas.</p>
            )}
          </section>

          <section className="card stack">
            <div className="section-heading-row">
              <div>
                <h2>{labels.importExcel}</h2>
                <p className="muted">{labels.importHelp}</p>
              </div>
            </div>
          <form action={excelFormAction} className="stack">
            {excelState.message ? (
              <p role="status" className={`notice ${excelState.ok ? 'notice-success' : 'notice-error'}`}>
                {excelState.message}
              </p>
            ) : null}

            <p className="notice notice-warning">
              {labels.importWarning}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="field" style={{ flex: 1, margin: 0 }}>
                <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
              </label>
              <button className="button-primary" type="submit" disabled={excelPending} style={{ opacity: excelPending ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                {excelPending ? labels.importing : labels.importButton}
              </button>
            </div>
          </form>
          </section>
        </>
      ) : null}

      {activeTab === 'installed' ? (
        <>
          <section className="card stack">
            <div className="section-heading-row">
              <div>
                <h2>{labels.managedWeb}</h2>
                <p className="muted">{labels.managedWebHelp}</p>
              </div>
              {managedWebQuota ? (
                <div className="knowledge-managed-quota">
                  <span>
                    {managedWebQuota.sources}/{managedWebQuota.limits.maxSources} {labels.managedWebSourcesUsage}
                  </span>
                  <span>
                    {managedWebQuota.documents}/{managedWebQuota.limits.maxDocuments} {labels.managedWebDocumentsUsage}
                  </span>
                </div>
              ) : null}
            </div>

            <form action={managedWebFormAction} className="knowledge-managed-create">
              {managedWebState.message ? (
                <p role="status" className={`notice ${managedWebState.ok ? 'notice-success' : 'notice-error'} knowledge-managed-notice`}>
                  {managedWebState.message}
                </p>
              ) : null}
              <label className="field">
                {labels.sourceName}
                <input name="name" placeholder={labels.sourceNamePlaceholder} maxLength={120} required />
              </label>
              <label className="field">
                {labels.sourceType}
                <select name="source_type" defaultValue="website">
                  <option value="url">{labels.sourceTypeUrl}</option>
                  <option value="sitemap">{labels.sourceTypeSitemap}</option>
                  <option value="website">{labels.sourceTypeWebsite}</option>
                </select>
              </label>
              <label className="field knowledge-managed-url-field">
                {labels.sourceUrl}
                <input name="source_url" type="url" placeholder={labels.sourceUrlPlaceholder} maxLength={2048} required />
              </label>
              <label className="field">
                {labels.refreshInterval}
                <select name="refresh_interval" defaultValue="daily">
                  <option value="manual">{labels.refreshManual}</option>
                  <option value="daily">{labels.refreshDaily}</option>
                  <option value="weekly">{labels.refreshWeekly}</option>
                  <option value="monthly">{labels.refreshMonthly}</option>
                </select>
              </label>
              <button
                className="button-primary button-fit knowledge-managed-submit"
                type="submit"
                disabled={managedWebPending || managedWebQuotaReached}
                title={managedWebQuotaReached ? labels.managedWebQuotaReached : undefined}
              >
                {managedWebPending ? labels.addingManagedSource : labels.addManagedSource}
              </button>
            </form>

            {managedWebSources.length ? (
              <div className="knowledge-files-list">
                {managedWebSources.map((source) => (
                  <ManagedWebSourceRow key={source.id} tenantId={tenantId} source={source} labels={labels} />
                ))}
              </div>
            ) : (
              <p className="muted">{labels.noManagedSources}</p>
            )}
          </section>

          <section className="card stack" id="installed-widget-pages">
            <div className="section-heading-row">
              <div>
                <h2>{labels.widgetCapturedPages}</h2>
                <p className="muted">{labels.installedWebHelp}</p>
              </div>
              <div className="section-heading-actions">
                {installedWebSources.length > 1 ? (
                  <a
                    className="button-primary button-fit"
                    href={getCaptureAllHref(tenantId, installedWebSources)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {labels.captureAllPages}
                  </a>
                ) : null}
                <button
                  type="button"
                  className={`button-outline button-fit knowledge-installed-refresh ${isRefreshingInstalled ? 'knowledge-installed-refresh-active' : ''}`}
                  disabled={isRefreshingInstalled}
                  onClick={() => startInstalledRefresh(() => router.refresh())}
                >
                  {isRefreshingInstalled ? (
                    <>
                      <span>{labels.refreshingInstalled}</span>
                      <span className="processing-line" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
                      <span>{labels.refreshInstalled}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {installedWebSources.length ? (
              <div className="knowledge-files-list knowledge-installed-list">
                {installedWebSources.map((source) => (
                  <InstalledWebSourceRow key={source.id} tenantId={tenantId} source={source} labels={labels} />
                ))}
              </div>
            ) : (
              <div className="knowledge-installed-empty">
                <strong>{labels.noInstalledPagesTitle}</strong>
                <p>{labels.noInstalledPages}</p>
              </div>
            )}
          </section>
          {pagination}
        </>
      ) : null}

      {activeTab === 'apps' ? (
        <section className="card stack">
          <div className="section-heading-row">
            <div>
              <h2>Apps</h2>
              <p className="muted">Conectores externos para importar conocimiento desde aplicaciones. Aún no está activo.</p>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}

function ManagedWebSourceRow({
  tenantId,
  source,
  labels,
}: {
  tenantId: string
  source: KnowledgeSource
  labels: KnowledgeFormProps['labels']
}) {
  const router = useRouter()
  const [isSyncing, startSync] = useTransition()
  const [isSavingSchedule, startScheduleSave] = useTransition()
  const [isSendingSupport, startSupport] = useTransition()
  const [refreshInterval, setRefreshInterval] = useState(source.refreshInterval || 'manual')
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'success' | 'error' } | null>(null)
  const [supportOpen, setSupportOpen] = useState(false)
  const [supportMessage, setSupportMessage] = useState('')
  const [supportIdempotencyKey, setSupportIdempotencyKey] = useState<string | null>(null)
  const sourceUrlLabel = source.sourceUrl ? formatInstalledSourceUrl(source.sourceUrl) : null
  const activeRunStatus = source.latestSyncRun?.status === 'queued' || source.latestSyncRun?.status === 'running'
    ? source.latestSyncRun.status
    : null
  const presentation = getManagedWebPresentation({
    syncEnabled: source.syncEnabled,
    sourceStatus: source.status,
    run: source.latestSyncRun,
  })
  const visibleStatus = getManagedOutcomeStatus(presentation.outcome)

  function handleSync() {
    startSync(async () => {
      const result = await requestManagedWebSourceSync(tenantId, source.id)
      setToast({ id: Date.now(), message: result.message, tone: result.ok ? 'success' : 'error' })
      router.refresh()
    })
  }

  function handleScheduleChange(value: string) {
    const previous = refreshInterval
    setRefreshInterval(value)
    startScheduleSave(async () => {
      const result = await updateManagedWebSourceSchedule(tenantId, source.id, value)
      if (!result.ok) setRefreshInterval(previous)
      setToast({ id: Date.now(), message: result.message, tone: result.ok ? 'success' : 'error' })
      router.refresh()
    })
  }

  function handleSupportSubmit() {
    const idempotencyKey = supportIdempotencyKey ?? crypto.randomUUID()
    if (!supportIdempotencyKey) setSupportIdempotencyKey(idempotencyKey)
    startSupport(async () => {
      const result = await requestKnowledgeSourceSupport(tenantId, {
        sourceId: source.id,
        idempotencyKey,
        message: supportMessage,
      })
      setToast({ id: Date.now(), message: result.message, tone: result.ok ? 'success' : 'error' })
      if (result.ok) {
        setSupportMessage('')
        setSupportIdempotencyKey(null)
        setSupportOpen(false)
      }
    })
  }

  function toggleSupport() {
    if (!supportOpen) setSupportIdempotencyKey(crypto.randomUUID())
    setSupportOpen(!supportOpen)
  }

  return (
    <article className="knowledge-file-item knowledge-managed-item">
      {toast ? <ToastNotice key={toast.id} message={toast.message} tone={toast.tone} /> : null}
      <div className="knowledge-file-icon" aria-hidden="true">
        {source.type === 'sitemap' ? (
          <Workflow size={20} strokeWidth={2} />
        ) : source.type === 'website' ? (
          <Globe2 size={20} strokeWidth={2} />
        ) : (
          <LinkIcon size={20} strokeWidth={2} />
        )}
      </div>
      <div className="knowledge-file-main">
        <div className="knowledge-file-title-row">
          <h3>{source.name}</h3>
          <span className={`knowledge-file-status knowledge-file-status-${visibleStatus}`}>
            {getManagedSourceStatusLabel(visibleStatus, labels)}
          </span>
        </div>
        {sourceUrlLabel && source.sourceUrl ? (
          <span className="knowledge-installed-url" title={source.sourceUrl}>{sourceUrlLabel}</span>
        ) : null}
        <div className="knowledge-installed-signals">
          <span className="knowledge-installed-signal">
            {source.documentCount} {labels.sourceDocuments}
          </span>
          {source.lastSyncedAt ? (
            <span className="knowledge-installed-signal">
              {labels.sourceLastSync}: {formatDate(source.lastSyncedAt)}
            </span>
          ) : (
            <span className="knowledge-installed-signal knowledge-installed-signal-muted">
              {labels.sourceNeverSynced}
            </span>
          )}
          {source.nextSyncAt && refreshInterval !== 'manual' ? (
            <span className="knowledge-installed-signal">
              {labels.sourceNextSync}: {formatDate(source.nextSyncAt)}
            </span>
          ) : null}
          {source.latestSyncRun && source.latestSyncRun.status !== 'queued' ? (
            <span className="knowledge-installed-signal knowledge-managed-run-summary">
              {source.latestSyncRun.checked_count} {labels.sourceChecked} · {source.latestSyncRun.changed_count} {labels.sourceChanged}
              {source.latestSyncRun.failed_count + source.latestSyncRun.blocked_count > 0
                ? ` · ${source.latestSyncRun.failed_count + source.latestSyncRun.blocked_count} ${labels.sourceIssues}`
                : ''}
            </span>
          ) : null}
          {source.latestSyncRun?.status === 'running' ? (
            <span className="knowledge-installed-signal knowledge-installed-signal-ok">
              {getSyncPhaseLabel(source.latestSyncRun.metadata, labels)}
              {source.latestSyncRun.discovered_count > 0 ? ` · ${source.latestSyncRun.checked_count}/${source.latestSyncRun.discovered_count}` : ''}
            </span>
          ) : null}
          {source.chunkCount > 0 ? (
            <span className="knowledge-installed-signal">
              {source.chunkCount} {labels.sourceFragments}
            </span>
          ) : null}
        </div>
        <div className={`knowledge-managed-outcome knowledge-managed-outcome-${presentation.tone}`}>
          <strong>{getManagedSourceStatusLabel(visibleStatus, labels)}</strong>
          <p>{getManagedOutcomeDescription(presentation.outcome, labels)}</p>
          {presentation.actions.includes('widget') ? (
            <a className="knowledge-managed-outcome-action" href="#installed-widget-pages">
              {labels.sourceUseWidget}
            </a>
          ) : null}
          {presentation.actions.includes('support') ? (
            <button
              type="button"
              className="knowledge-managed-outcome-action"
              onClick={toggleSupport}
            >
              <LifeBuoy size={14} strokeWidth={2} aria-hidden="true" />
              {labels.sourceContactSupport}
            </button>
          ) : null}
        </div>
        {supportOpen ? (
          <div className="knowledge-managed-support">
            <p>{labels.sourceSupportPrompt}</p>
            <textarea
              rows={3}
              maxLength={2000}
              value={supportMessage}
              placeholder={labels.sourceSupportPlaceholder}
              onChange={(event) => setSupportMessage(event.target.value)}
            />
            <div className="knowledge-managed-support-actions">
              <button type="button" className="button-outline button-fit" disabled={isSendingSupport} onClick={() => setSupportOpen(false)}>
                {labels.sourceSupportCancel}
              </button>
              <button
                type="button"
                className="button-primary button-fit"
                disabled={isSendingSupport || supportMessage.trim().length < 10}
                onClick={handleSupportSubmit}
              >
                {isSendingSupport ? labels.sourceSupportSending : labels.sourceSupportSend}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="knowledge-file-actions knowledge-managed-actions">
        <select
          className="knowledge-managed-schedule"
          aria-label={`${labels.refreshInterval}: ${source.name}`}
          value={refreshInterval}
          disabled={isSavingSchedule}
          onChange={(event) => handleScheduleChange(event.target.value)}
        >
          <option value="manual">{labels.refreshManual}</option>
          <option value="daily">{labels.refreshDaily}</option>
          <option value="weekly">{labels.refreshWeekly}</option>
          <option value="monthly">{labels.refreshMonthly}</option>
        </select>
        <button
          type="button"
          className="button-outline button-fit"
          disabled={!source.syncEnabled || isSyncing || activeRunStatus !== null}
          title={!source.syncEnabled ? labels.sourceSyncPaused : undefined}
          onClick={handleSync}
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
          {isSyncing || activeRunStatus
            ? labels.syncingNow
            : presentation.actions.includes('retry')
              ? labels.sourceRetry
              : labels.syncNow}
        </button>
        <DeleteKnowledgeSourceButton tenantId={tenantId} sourceId={source.id} sourceName={source.name} />
      </div>
    </article>
  )
}

function getSyncPhaseLabel(metadata: unknown, labels: KnowledgeFormProps['labels']) {
  const phase = metadata && typeof metadata === 'object' && 'phase' in metadata
    ? (metadata as { phase?: unknown }).phase
    : null
  if (phase === 'discovering') return labels.syncPhaseDiscovering
  if (phase === 'fetching') return labels.syncPhaseFetching
  if (phase === 'chunking') return labels.syncPhaseChunking
  return labels.syncPhaseFinishing
}

function getManagedOutcomeStatus(outcome: ManagedWebOutcome) {
  if (outcome === 'queued' || outcome === 'running' || outcome === 'paused' || outcome === 'pending') return outcome
  if (outcome === 'updated' || outcome === 'unchanged') return 'ready'
  if (outcome === 'partial_discovery' || outcome === 'partial_capture') return 'partial'
  return 'error'
}

function getManagedOutcomeDescription(outcome: ManagedWebOutcome, labels: KnowledgeFormProps['labels']) {
  if (outcome === 'queued') return labels.sourceOutcomeQueued
  if (outcome === 'running') return labels.sourceOutcomeRunning
  if (outcome === 'updated') return labels.sourceOutcomeUpdated
  if (outcome === 'unchanged') return labels.sourceOutcomeUnchanged
  if (outcome === 'partial_discovery') return labels.sourceOutcomePartialDiscovery
  if (outcome === 'partial_capture') return labels.sourceOutcomePartialCapture
  if (outcome === 'quota') return labels.sourceOutcomeQuota
  if (outcome === 'blocked') return labels.sourceOutcomeBlocked
  if (outcome === 'failed') return labels.sourceOutcomeFailed
  if (outcome === 'paused') return labels.sourceOutcomePaused
  return labels.sourceOutcomePending
}

function getManagedSourceStatusLabel(status: string, labels: KnowledgeFormProps['labels']) {
  if (status === 'paused') return labels.sourceStatusPaused
  if (status === 'queued') return labels.sourceStatusQueued
  if (status === 'running' || status === 'processing') return labels.sourceStatusRunning
  if (status === 'ready') return labels.sourceStatusReady
  if (status === 'error' || status === 'failed') return labels.sourceStatusError
  if (status === 'partial') return labels.sourceStatusPartial
  return labels.sourceStatusPending
}

const SPRING = '600ms cubic-bezier(0.16, 1, 0.3, 1)'

function InstalledWebSourceRow({
  tenantId,
  source,
  labels,
}: {
  tenantId: string
  source: KnowledgeSource
  labels: KnowledgeFormProps['labels']
}) {
  const meta = getInstalledWebMeta(source)
  const sourceUrlLabel = source.sourceUrl ? formatInstalledSourceUrl(source.sourceUrl) : null

  return (
    <article className="knowledge-file-item knowledge-installed-item">
      <div className="knowledge-file-icon" aria-hidden="true">
        <LinkIcon size={20} strokeWidth={2} />
      </div>
      <div className="knowledge-file-main">
        <div className="knowledge-file-title-row">
          <h3>{source.name}</h3>
        </div>
        <div className="knowledge-file-meta">
          {sourceUrlLabel && source.sourceUrl ? (
            <span className="knowledge-installed-url" title={source.sourceUrl}>
              {sourceUrlLabel}
            </span>
          ) : null}
        </div>
        <div className="knowledge-installed-signals" aria-label="Estado de la web instalada">
          {meta.lastSeenAt ? (
            <span className="knowledge-installed-signal">
              {labels.lastVisitDetected}: {formatDate(meta.lastSeenAt)}
            </span>
          ) : null}
          {source.lastSyncedAt ? (
            <span className="knowledge-installed-signal">
              {labels.lastCapture}: {formatDate(source.lastSyncedAt)}
            </span>
          ) : null}
          {source.chunkCount > 0 ? (
            <span className="knowledge-installed-signal knowledge-installed-signal-ok">
              {labels.contentReady}
            </span>
          ) : source.sourceUrl ? (
            <a
              className="button-primary button-fit knowledge-installed-capture-action"
              href={getCaptureHref(tenantId, source.id)}
              target="_blank"
              rel="noreferrer"
            >
              {labels.capturePage}
            </a>
          ) : null}
        </div>
      </div>
      <div className="knowledge-file-actions">
        <DeleteKnowledgeSourceButton
          tenantId={tenantId}
          sourceId={source.id}
          sourceName={source.name}
          actionLabel="Desvincular"
          ariaLabel={`Desvincular ${source.name}`}
        />
      </div>
    </article>
  )
}

function formatInstalledSourceUrl(value: string) {
  try {
    const url = new URL(value)
    const label = `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`.replace(/\/$/, '')
    return truncateMiddle(label || url.hostname, 96)
  } catch {
    return truncateMiddle(value, 96)
  }
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  const edgeLength = Math.floor((maxLength - 3) / 2)
  return `${value.slice(0, edgeLength)}...${value.slice(value.length - edgeLength)}`
}

function getInstalledWebMeta(source: KnowledgeSource) {
  const config = isRecord(source.config) ? source.config : {}
  return {
    lastSeenAt: typeof config.last_seen_at === 'string'
      ? config.last_seen_at
      : typeof config.registered_at === 'string'
        ? config.registered_at
        : null,
  }
}

function getCaptureHref(tenantId: string, sourceId: string) {
  return `/api/knowledge/${tenantId}/capture-url?sourceId=${encodeURIComponent(sourceId)}&redirect=1`
}

function getCaptureAllHref(tenantId: string, sources: KnowledgeSource[]) {
  const sourceIds = sources
    .filter((source) => source.sourceUrl)
    .slice(0, 20)
    .map((source) => source.id)
    .join(',')
  return `/api/knowledge/${tenantId}/capture-url?sourceIds=${encodeURIComponent(sourceIds)}&redirect=1`
}

function KnowledgeSourceRow({ tenantId, source }: { tenantId: string; source: KnowledgeSource }) {
  const fileName = getSourceFileName(source)
  const actionableEmbeddingCount = source.embeddingCounts.pending + source.embeddingCounts.error

  return (
    <article className="knowledge-file-item">
      <div className="knowledge-file-icon" aria-hidden="true">
        {renderSourceIcon(source.type)}
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
          {source.chunkCount > 0 ? <span>{source.chunkCount} fragmentos</span> : null}
          {source.lastSyncedAt ? <span>Actualizado {formatDate(source.lastSyncedAt)}</span> : null}
          {source.sourceUrl ? <span>{source.sourceUrl}</span> : null}
        </div>
        {source.chunkCount > 0 ? (
          <div className="knowledge-embedding-stats" aria-label="Estado de embeddings">
            <span className="knowledge-embedding-stat knowledge-embedding-stat-ready">
              {source.embeddingCounts.ready} listos
            </span>
            {source.embeddingCounts.processing > 0 ? (
              <span className="knowledge-embedding-stat">
                {source.embeddingCounts.processing} procesando
              </span>
            ) : null}
            {source.embeddingCounts.pending > 0 ? (
              <span className="knowledge-embedding-stat knowledge-embedding-stat-pending">
                {source.embeddingCounts.pending} pendientes
              </span>
            ) : null}
            {source.embeddingCounts.error > 0 ? (
              <span className="knowledge-embedding-stat knowledge-embedding-stat-error">
                {source.embeddingCounts.error} error
              </span>
            ) : null}
          </div>
        ) : null}
        {source.lastError ? <p className="knowledge-file-error">{source.lastError}</p> : null}
      </div>
      <div className="knowledge-file-actions">
        {actionableEmbeddingCount > 0 ? (
          <RetryKnowledgeSourceButton tenantId={tenantId} sourceId={source.id} />
        ) : null}
        <DeleteKnowledgeSourceButton tenantId={tenantId} sourceId={source.id} sourceName={fileName} />
      </div>
    </article>
  )
}

function RetryKnowledgeSourceButton({ tenantId, sourceId }: { tenantId: string; sourceId: string }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  function handleRetry() {
    setMessage(null)
    setFailed(false)
    startTransition(async () => {
      const result = await retryKnowledgeSourceEmbeddings(tenantId, sourceId)
      setFailed(!result.ok)
      setMessage(result.message ?? result.error ?? null)
    })
  }

  return (
    <div className="knowledge-retry-control">
      <button
        type="button"
        className="knowledge-retry-button"
        onClick={handleRetry}
        disabled={isPending}
      >
        {isPending ? 'Reintentando...' : 'Reintentar embeddings'}
      </button>
      {message ? (
        <span className={failed ? 'knowledge-retry-message knowledge-retry-message-error' : 'knowledge-retry-message'}>
          {message}
        </span>
      ) : null}
    </div>
  )
}

function renderSourceIcon(type: string) {
  if (type === 'url') return <LinkIcon size={20} strokeWidth={2} />
  if (type === 'xlsx' || type === 'csv') return <Table2 size={20} strokeWidth={2} />
  return <FileText size={20} strokeWidth={2} />
}

function getSourceTypeLabel(type: string) {
  if (type === 'pdf') return 'PDF'
  if (type === 'xlsx') return 'Excel'
  if (type === 'csv') return 'CSV'
  if (type === 'url') return 'URL'
  return type
}

function getSourceStatusLabel(status: string) {
  if (status === 'ready') return 'Listo'
  if (status === 'processing') return 'Procesando'
  if (status === 'error') return 'Error'
  if (status === 'connected') return 'Conectado'
  return 'Pendiente'
}

function getSourceFileName(source: KnowledgeSource) {
  if (isRecord(source.config) && typeof source.config.file_name === 'string') {
    return source.config.file_name
  }
  return source.name
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Madrid',
  }).format(date)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function KnowledgeItemRow({ tenantId, item }: { tenantId: string; item: KnowledgeItem }) {
  const [expanded, setExpanded] = useState(false)
  const [state, formAction, pending] = useActionState(
    updateKnowledgeItem.bind(null, tenantId, item.id),
    { ok: false, message: '' }
  )

  // Key based on current item values so defaultValue resets after server revalidation
  const formKey = `${item.question}|${item.answer}|${item.category}|${item.language}|${item.priority}`

  return (
    <>
      <tr
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <td>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChevronDown
              size={13}
              strokeWidth={2}
              aria-hidden="true"
              style={{
                flexShrink: 0,
                color: 'var(--color-text-tertiary)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 300ms ease',
              }}
            />
            {item.question}
          </span>
        </td>
        <td>{getCategoryLabel(item.category)}</td>
        <td>{getLanguageLabel(item.language)}</td>
        <td>{getPriorityLabel(item.priority)}</td>
        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
          <DeleteKnowledgeItemButton tenantId={tenantId} itemId={item.id} />
        </td>
      </tr>
      <tr>
        <td colSpan={5} style={{ padding: 0, border: 'none' }}>
          <div
            style={{
              maxHeight: expanded ? 640 : 0,
              overflow: 'hidden',
              transition: `max-height ${SPRING}`,
            }}
          >
            <form
              key={formKey}
              action={formAction}
              className="stack"
              style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}
            >
              {state.message ? (
                <p role="status" className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
                  {state.message}
                </p>
              ) : null}

              <div className="form-grid">
                <label className="field">
                  Pregunta del visitante
                  <input name="question" defaultValue={item.question} required />
                </label>

                <label className="field">
                  Tema
                  <select name="category" defaultValue={item.category ?? ''}>
                    <option value="">Sin tema específico</option>
                    <option value="agenda">Programación / cartelera</option>
                    <option value="entradas">Entradas</option>
                    <option value="precios">Precios y descuentos</option>
                    <option value="horarios">Horarios</option>
                    <option value="ubicacion">Ubicación / cómo llegar</option>
                    <option value="accesibilidad">Accesibilidad</option>
                    <option value="visita">Visita / experiencia</option>
                  </select>
                </label>

                <label className="field">
                  Idioma
                  <select name="language" defaultValue={item.language}>
                    <option value="ca">Català</option>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </label>

                <label className="field">
                  Confianza de respuesta
                  <select name="priority" defaultValue={item.priority >= 70 ? '80' : item.priority <= 30 ? '20' : '50'}>
                    <option value="80">Alta: usar casi siempre</option>
                    <option value="50">Normal: usar cuando encaje</option>
                    <option value="20">Baja: usar solo si coincide mucho</option>
                  </select>
                </label>
              </div>

              <label className="field">
                Respuesta oficial
                <textarea name="answer" rows={4} defaultValue={item.answer} required />
              </label>

              <button
                className="button-primary"
                type="submit"
                disabled={pending}
                style={{ opacity: pending ? 0.7 : 1, alignSelf: 'flex-start' }}
              >
                {pending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </td>
      </tr>
    </>
  )
}

function DeleteKnowledgeItemButton({ tenantId, itemId }: { tenantId: string; itemId: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confirming) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setConfirming(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [confirming])

  function handleConfirm() {
    startTransition(async () => {
      await deleteKnowledgeItem(tenantId, itemId)
      setConfirming(false)
    })
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: confirming ? 180 : 0,
          opacity: confirming ? 1 : 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: `max-width ${SPRING}, opacity ${SPRING}`,
        }}
      >
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 13, fontWeight: 500, padding: '4px 4px 4px 2px', whiteSpace: 'nowrap' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: isPending ? 'default' : 'pointer', color: 'var(--color-error)', fontSize: 13, fontWeight: 600, padding: '4px 2px', opacity: isPending ? 0.5 : 1, whiteSpace: 'nowrap' }}
        >
          <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
          {isPending ? 'Eliminando...' : 'Confirmar'}
        </button>
      </div>

      <button
        onClick={() => setConfirming(true)}
        aria-label="Eliminar FAQ"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', borderRadius: 4, display: 'grid', placeItems: 'center', maxWidth: confirming ? 0 : 22, opacity: confirming ? 0 : 1, overflow: 'hidden', padding: confirming ? 0 : 4, transition: `max-width ${SPRING}, opacity ${SPRING}, padding ${SPRING}` }}
        onMouseEnter={(e) => { if (!confirming) e.currentTarget.style.color = 'var(--color-error)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}

function DeleteKnowledgeSourceButton({
  tenantId,
  sourceId,
  sourceName,
  actionLabel,
  confirmLabel = 'Confirmar',
  ariaLabel,
}: {
  tenantId: string
  sourceId: string
  sourceName: string
  actionLabel?: string
  confirmLabel?: string
  ariaLabel?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confirming) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setConfirming(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [confirming])

  function handleConfirm() {
    startTransition(async () => {
      await deleteKnowledgeSource(tenantId, sourceId)
      setConfirming(false)
      router.refresh()
    })
  }

  return (
    <div ref={containerRef} className="knowledge-delete-control">
      <div className={confirming ? 'knowledge-delete-confirm knowledge-delete-confirm-open' : 'knowledge-delete-confirm'}>
        <button
          type="button"
          className="knowledge-delete-secondary"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="knowledge-delete-danger"
          onClick={handleConfirm}
          disabled={isPending}
        >
          {isPending ? 'Eliminando...' : confirmLabel}
        </button>
      </div>
      <button
        type="button"
        className={actionLabel ? 'knowledge-delete-text-button' : 'knowledge-delete-icon'}
        onClick={() => setConfirming(true)}
        aria-label={ariaLabel ?? `Eliminar ${sourceName}`}
      >
        {actionLabel ? actionLabel : <Trash2 size={15} strokeWidth={2} aria-hidden="true" />}
      </button>
    </div>
  )
}

function getCategoryLabel(category: string | null) {
  const labels: Record<string, string> = {
    agenda: 'Programación',
    entradas: 'Entradas',
    precios: 'Precios',
    horarios: 'Horarios',
    ubicacion: 'Ubicación',
    accesibilidad: 'Accesibilidad',
    visita: 'Visita',
  }

  return category ? labels[category] ?? category : '-'
}

function getLanguageLabel(language: string) {
  const labels: Record<string, string> = {
    ca: 'Català',
    es: 'Español',
    en: 'English',
  }

  return labels[language] ?? language
}

function getPriorityLabel(priority: number) {
  if (priority >= 70) return 'Alta'
  if (priority <= 30) return 'Baja'
  return 'Normal'
}
