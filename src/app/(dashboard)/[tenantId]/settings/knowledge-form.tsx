'use client'

import { ChevronDown, FileText, Link as LinkIcon, Table2, Trash2 } from 'lucide-react'
import { useActionState, useState, useTransition, useEffect, useRef } from 'react'
import type { ClipboardEvent, ReactNode } from 'react'
import { createKnowledgeItem, uploadKnowledgeExcel, uploadKnowledgePdf, updateScrapeUrls, updateKnowledgeItem, deleteKnowledgeItem, deleteKnowledgeSource, retryKnowledgeSourceEmbeddings, type SettingsFormState, type ExcelUploadState, type PdfUploadState } from './actions'

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
  config: unknown
  sourceUrl: string | null
  captureUrl?: string | null
  lastSyncedAt: string | null
  lastError: string | null
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
  activeTab: 'links' | 'installed' | 'files' | 'faqs' | 'apps' | 'spreadsheets'
  sources: KnowledgeSource[]
  items: KnowledgeItem[]
  pagination?: ReactNode
  scrapeUrls: string[]
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
    scrapeUrls: string
    scrapeHelp: string
    deleteUrl: string
    addUrl: string
    saveUrls: string
    saving: string
    urlIndexed: string
    urlProcessing: string
    urlNotIndexed: string
    installedWeb: string
    installedWebHelp: string
    noInstalledPages: string
    capturePage: string
    capturedPageReady: string
    capturedPageConnected: string
    capturedPageError: string
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

export function KnowledgeForm({ tenantId, activeTab, sources, items, pagination, scrapeUrls, labels }: KnowledgeFormProps) {
  const [state, formAction, pending] = useActionState(createKnowledgeItem.bind(null, tenantId), initialState)
  const [excelState, excelFormAction, excelPending] = useActionState(uploadKnowledgeExcel.bind(null, tenantId), excelInitialState)
  const [pdfState, pdfFormAction, pdfPending] = useActionState(uploadKnowledgePdf.bind(null, tenantId), pdfInitialState)
  const [urlsState, urlsFormAction, urlsPending] = useActionState(updateScrapeUrls.bind(null, tenantId), initialState)
  const [urls, setUrls] = useState<string[]>(scrapeUrls.length ? scrapeUrls : [''])
  const fileSources = sources.filter((source) => source.type === 'pdf')
  const spreadsheetSources = sources.filter((source) => source.type === 'xlsx' || source.type === 'csv')
  const installedWebSources = sources.filter((source) => source.type === 'web_snapshot')
  const urlSources = new Map(
    sources
      .filter((source) => source.type === 'url' && source.sourceUrl)
      .map((source) => [source.sourceUrl as string, source])
  )

  function updateUrl(index: number, value: string) {
    setUrls((current) => current.map((url, i) => (i === index ? value : url)))
  }

  function addUrl() {
    setUrls((current) => [...current, ''])
  }

  function removeUrl(index: number) {
    setUrls((current) => {
      const next = current.filter((_, i) => i !== index)
      return next.length ? next : ['']
    })
  }

  function handleUrlPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    const pastedUrls = event.clipboardData
      .getData('text')
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean)

    if (pastedUrls.length <= 1) return

    event.preventDefault()
    setUrls((current) => {
      const next = [...current]
      next.splice(index, 1, ...pastedUrls)
      return next
    })
  }

  return (
    <>
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

      {activeTab === 'links' ? (
        <section className="card stack">
          <div className="section-heading-row">
            <div>
              <h2>{labels.scrapeUrls}</h2>
              <p className="muted">{labels.scrapeHelp}</p>
            </div>
          </div>
          <form action={urlsFormAction} className="stack">
            {urlsState.message ? (
              <p role="status" className={`notice ${urlsState.ok ? 'notice-success' : 'notice-error'}`}>
                {urlsState.message}
              </p>
            ) : null}

            <div className="stack" style={{ gap: 8 }}>
              {urls.map((url, index) => (
                <div
                  key={index}
                  className={getUrlSourceStatus(urlSources.get(url)) === 'error' ? 'knowledge-url-row knowledge-url-row-error' : 'knowledge-url-row'}
                >
                  <div className="knowledge-url-input-row">
                    <input
                      name="scrape_urls"
                      value={url}
                      onChange={(e) => updateUrl(index, e.target.value)}
                      onPaste={(event) => handleUrlPaste(event, index)}
                      placeholder="https://..."
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeUrl(index)}
                      className="knowledge-url-delete-button"
                      aria-label={labels.deleteUrl}
                      title={labels.deleteUrl}
                    >
                      ×
                    </button>
                  </div>
                  <UrlSourceStatus source={urlSources.get(url)} labels={labels} />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                className="button-outline"
                onClick={addUrl}
              >
                {labels.addUrl}
              </button>
              <button className="button-primary" type="submit" disabled={urlsPending} style={{ opacity: urlsPending ? 0.7 : 1 }}>
                {urlsPending ? labels.saving : labels.saveUrls}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === 'installed' ? (
        <section className="card stack">
          <div className="section-heading-row">
            <div>
              <h2>{labels.installedWeb}</h2>
              <p className="muted">{labels.installedWebHelp}</p>
            </div>
          </div>

          {installedWebSources.length ? (
            <div className="knowledge-files-list">
              {installedWebSources.map((source) => (
                <InstalledWebSourceRow key={source.id} source={source} labels={labels} />
              ))}
            </div>
          ) : (
            <p className="muted">{labels.noInstalledPages}</p>
          )}
        </section>
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

const SPRING = '600ms cubic-bezier(0.16, 1, 0.3, 1)'

function UrlSourceStatus({
  source,
  labels,
}: {
  source?: KnowledgeSource
  labels: KnowledgeFormProps['labels']
}) {
  const status = getUrlSourceStatus(source)
  if (!status) return null

  if (status === 'error') {
    return (
      <p className="knowledge-url-status knowledge-url-status-error">
        {labels.urlNotIndexed}
      </p>
    )
  }

  if (status === 'processing') {
    return (
      <p className="knowledge-url-status knowledge-url-status-processing">
        {labels.urlProcessing}
      </p>
    )
  }

  return (
    <p className="knowledge-url-status knowledge-url-status-ready">
      {labels.urlIndexed}
    </p>
  )
}

function getUrlSourceStatus(source?: KnowledgeSource) {
  if (!source) return null
  if (source.status === 'error') return 'error'
  if (source.status === 'processing' || source.status === 'pending') return 'processing'
  if (source.status === 'ready' || source.status === 'connected') return 'ready'
  return null
}

function InstalledWebSourceRow({
  source,
  labels,
}: {
  source: KnowledgeSource
  labels: KnowledgeFormProps['labels']
}) {
  return (
    <article className="knowledge-file-item">
      <div className="knowledge-file-icon" aria-hidden="true">
        <LinkIcon size={20} strokeWidth={2} />
      </div>
      <div className="knowledge-file-main">
        <div className="knowledge-file-title-row">
          <h3>{source.name}</h3>
          <span className={`knowledge-file-status knowledge-file-status-${source.status}`}>
            {getInstalledWebStatusLabel(source.status, labels)}
          </span>
        </div>
        <div className="knowledge-file-meta">
          {source.sourceUrl ? <span>{source.sourceUrl}</span> : null}
          {source.lastSyncedAt ? <span>Actualizado {formatDate(source.lastSyncedAt)}</span> : null}
        </div>
      </div>
      <div className="knowledge-file-actions">
        {source.captureUrl ? (
          <a className="button-outline button-fit" href={source.captureUrl} target="_blank" rel="noreferrer">
            {labels.capturePage}
          </a>
        ) : null}
      </div>
    </article>
  )
}

function getInstalledWebStatusLabel(status: string, labels: KnowledgeFormProps['labels']) {
  if (status === 'ready') return labels.capturedPageReady
  if (status === 'error') return labels.capturedPageError
  if (status === 'processing' || status === 'pending') return labels.urlProcessing
  return labels.capturedPageConnected
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
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
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

function DeleteKnowledgeSourceButton({ tenantId, sourceId, sourceName }: { tenantId: string; sourceId: string; sourceName: string }) {
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
          {isPending ? 'Eliminando...' : 'Confirmar'}
        </button>
      </div>
      <button
        type="button"
        className="knowledge-delete-icon"
        onClick={() => setConfirming(true)}
        aria-label={`Eliminar ${sourceName}`}
      >
        <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
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
