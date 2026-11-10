import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { getManagedWebQuotaUsage } from '@/lib/knowledge/web-source-quotas'
import { Bot, ChevronLeft, ChevronRight, FileText, Globe2 } from 'lucide-react'
import Link from 'next/link'
import { KnowledgeForm } from '../settings/knowledge-form'
import { KnowledgePageSizeSelect } from './page-size-select'
import { getInstalledWebCaptureSettingsFromWidgetConfig } from '@/lib/knowledge/installed-web-capture-settings'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams?: Promise<{ page?: string | string[]; page_size?: string | string[]; tab?: string | string[] }>
}

const DEFAULT_INSTALLED_ITEMS_PER_PAGE = 5
const DEFAULT_ITEMS_PER_PAGE = 20
const PAGE_SIZE_OPTIONS = [5, 10, 20]
type KnowledgeTab = 'installed' | 'files' | 'faqs' | 'apps' | 'spreadsheets'
const visibleTabs = ['installed', 'files', 'faqs'] as const satisfies readonly KnowledgeTab[]
type VisibleKnowledgeTab = typeof visibleTabs[number]
type SourceType = 'pdf' | 'xlsx' | 'csv' | 'web_snapshot' | 'url' | 'sitemap' | 'website'

const sourceTypes = [
  { key: 'installed', label: 'Web', icon: Globe2 },
  { key: 'files', label: 'Files', icon: FileText },
  { key: 'faqs', label: 'FAQs', icon: Bot },
] satisfies Array<{ key: VisibleKnowledgeTab; label: string; icon: typeof Globe2 }>

export default async function KnowledgePage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = searchParams ? await searchParams : {}
  const pageParam = Array.isArray(query.page) ? query.page[0] : query.page
  const pageSizeParam = Array.isArray(query.page_size) ? query.page_size[0] : query.page_size
  const tabParam = Array.isArray(query.tab) ? query.tab[0] : query.tab
  const activeTab = visibleTabs.includes(tabParam as VisibleKnowledgeTab)
    ? tabParam as VisibleKnowledgeTab
    : 'installed'
  const pageSize = getPageSize(pageSizeParam, activeTab)
  const requestedPage = Number.parseInt(pageParam ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const dictionary = await getDictionary(await getLocale())
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')

  const admin = createAdminClient()
  const sourceTypesForTab = getSourceTypesForTab(activeTab)
  const shouldLoadSources = sourceTypesForTab.length > 0
  const sourcesQuery = shouldLoadSources
    ? admin
      .from('knowledge_sources')
      .select('id, type, name, status, sync_enabled, config, source_url, refresh_interval, next_sync_at, last_synced_at, last_error, created_at', { count: 'exact' })
      .eq('theatre_id', tenantId)
      .in('type', sourceTypesForTab)
      .order('created_at', { ascending: false })
    : null
  const pagedSourcesQuery = sourcesQuery && activeTab !== 'installed'
    ? sourcesQuery.range(from, to)
    : sourcesQuery

  const [
    { data: manualSources },
    sourcesResult,
    managedWebQuota,
    { data: theatreSettings },
    { data: installedPageRows },
    { data: widgetInstallations },
  ] = await Promise.all([
    admin
      .from('knowledge_sources')
      .select('id')
      .eq('theatre_id', tenantId)
      .eq('type', 'manual'),
    pagedSourcesQuery ?? Promise.resolve({ data: [], count: 0 }),
    activeTab === 'installed' ? getManagedWebQuotaUsage(admin, tenantId) : Promise.resolve(null),
    admin
      .from('theatres')
      .select('widget_config')
      .eq('id', tenantId)
      .maybeSingle(),
    activeTab === 'installed'
      ? admin
        .from('knowledge_documents')
        .select('id, canonical_url, title, status, metadata, last_discovered_at, last_fetched_at, last_error, created_at, knowledge_sources!inner(type)')
        .eq('theatre_id', tenantId)
        .eq('knowledge_sources.type', 'web_snapshot')
        .neq('status', 'removed')
      : Promise.resolve({ data: [] }),
    activeTab === 'installed'
      ? admin
        .from('widget_installations')
        .select('origin, last_seen_at')
        .eq('theatre_id', tenantId)
        .order('last_seen_at', { ascending: false })
        .limit(25)
      : Promise.resolve({ data: [] }),
  ])
  const manualSourceIds = (manualSources ?? []).map((source) => source.id)
  const knowledgeItemsQuery = admin
    .from('knowledge_items')
    .select('id, question, answer, category, language, priority', { count: 'exact' })
    .eq('theatre_id', tenantId)
    .eq('active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data: knowledgeItems, count: knowledgeCount } = activeTab === 'faqs'
    ? await (manualSourceIds.length
      ? knowledgeItemsQuery.or(`source_id.is.null,source_id.in.(${manualSourceIds.join(',')})`)
      : knowledgeItemsQuery.is('source_id', null))
    : { data: [], count: 0 }

  // Installed-widget captures are one logical source with one document per
  // page; Agora keeps listing them page by page.
  const installedPages = (installedPageRows ?? []).map(toInstalledPageRow)
  const installedPageIds = new Set(installedPages.map((page) => page.id))
  const rawKnowledgeSources = [
    ...(sourcesResult.data ?? []).filter((source) => source.type !== 'web_snapshot'),
    ...installedPages,
  ]
  const dedupedInstalledSources = activeTab === 'installed'
    ? [
      ...rawKnowledgeSources.filter((source) => source.type !== 'web_snapshot'),
      ...dedupeInstalledSources(rawKnowledgeSources.filter((source) => source.type === 'web_snapshot')),
    ].sort((a, b) => getInstalledSourceActivityTime(b) - getInstalledSourceActivityTime(a))
    : rawKnowledgeSources
  const totalItems = activeTab === 'faqs'
    ? knowledgeCount ?? 0
    : activeTab === 'installed'
      ? dedupedInstalledSources.length
      : sourcesResult.count ?? 0
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, pageCount)
  const currentFrom = (currentPage - 1) * pageSize
  const knowledgeSources = activeTab === 'installed'
    ? dedupedInstalledSources.slice(currentFrom, currentFrom + pageSize)
    : rawKnowledgeSources
  const sourceIds = knowledgeSources
    .filter((source) => !installedPageIds.has(source.id))
    .map((source) => source.id)
  const visiblePageIds = knowledgeSources
    .filter((source) => installedPageIds.has(source.id))
    .map((source) => source.id)
  const { data: pageChunks } = visiblePageIds.length
    ? await admin
      .from('knowledge_chunks')
      .select('document_id, embedding_status')
      .in('document_id', visiblePageIds)
      .eq('active', true)
    : { data: [] }
  const [{ data: sourceChunks }, { data: sourceDocuments }, { data: sourceSyncRuns }] = sourceIds.length
    ? await Promise.all([
      admin
        .from('knowledge_chunks')
        .select('source_id, embedding_status')
        .in('source_id', sourceIds)
        .eq('active', true),
      admin
        .from('knowledge_documents')
        .select('source_id, status')
        .in('source_id', sourceIds),
      admin
        .from('knowledge_sync_runs')
        .select('source_id, status, discovered_count, checked_count, changed_count, unchanged_count, failed_count, blocked_count, error_code, error_details, metadata, created_at, finished_at')
        .in('source_id', sourceIds)
        .order('created_at', { ascending: false }),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const chunkCounts = new Map<string, number>()
  const embeddingCounts = new Map<string, { ready: number; pending: number; processing: number; error: number }>()
  const chunkRows = [
    ...(sourceChunks ?? []).map((chunk) => ({ key: chunk.source_id, status: chunk.embedding_status })),
    ...(pageChunks ?? []).map((chunk) => ({ key: chunk.document_id, status: chunk.embedding_status })),
  ]
  for (const chunk of chunkRows) {
    if (!chunk.key) continue
    chunkCounts.set(chunk.key, (chunkCounts.get(chunk.key) ?? 0) + 1)
    const current = embeddingCounts.get(chunk.key) ?? { ready: 0, pending: 0, processing: 0, error: 0 }
    if (chunk.status === 'ready') current.ready += 1
    else if (chunk.status === 'processing') current.processing += 1
    else if (chunk.status === 'error') current.error += 1
    else current.pending += 1
    embeddingCounts.set(chunk.key, current)
  }
  const documentCounts = new Map<string, number>()
  for (const document of sourceDocuments ?? []) {
    if (document.status === 'removed') continue
    documentCounts.set(document.source_id, (documentCounts.get(document.source_id) ?? 0) + 1)
  }
  const latestSyncRuns = new Map<string, NonNullable<typeof sourceSyncRuns>[number]>()
  for (const run of sourceSyncRuns ?? []) {
    if (!latestSyncRuns.has(run.source_id)) latestSyncRuns.set(run.source_id, run)
  }

  return (
    <main className="page-shell">
      <section className="stack">
        <div className="knowledge-source-tabs" aria-label="Tipos de fuentes">
          {sourceTypes.map((source) => {
            const Icon = source.icon
            return (
              <Link
                key={source.key}
                className={activeTab === source.key ? 'knowledge-source-tab knowledge-source-tab-active' : 'knowledge-source-tab'}
                href={`/${tenantId}/knowledge?tab=${source.key}`}
                scroll={false}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                {source.label}
              </Link>
            )
          })}
        </div>

        <KnowledgeForm
          tenantId={tenantId}
          activeTab={activeTab}
          sources={(knowledgeSources ?? []).map((source) => ({
            id: source.id,
            type: source.type,
            name: source.name,
            status: source.status,
            syncEnabled: source.sync_enabled,
            config: source.config,
            sourceUrl: source.source_url,
            refreshInterval: source.refresh_interval,
            nextSyncAt: source.next_sync_at,
            lastSyncedAt: source.last_synced_at,
            lastError: source.last_error,
            documentCount: documentCounts.get(source.id) ?? 0,
            latestSyncRun: latestSyncRuns.get(source.id) ?? null,
            chunkCount: chunkCounts.get(source.id) ?? 0,
            embeddingCounts: embeddingCounts.get(source.id) ?? { ready: 0, pending: 0, processing: 0, error: 0 },
          }))}
          items={knowledgeItems ?? []}
          managedWebQuota={managedWebQuota}
          installedWebCapture={getInstalledWebCaptureSettingsFromWidgetConfig(theatreSettings?.widget_config)}
          widgetInstallations={(widgetInstallations ?? []).map((installation) => ({
            origin: installation.origin,
            lastSeenAt: installation.last_seen_at,
          }))}
          pagination={
            <KnowledgePagination
              tenantId={tenantId}
              tab={activeTab}
              page={currentPage}
              pageCount={pageCount}
              total={totalItems}
              pageSize={pageSize}
            />
          }
          labels={dictionary.settings.knowledge}
        />
      </section>
    </main>
  )
}

function toInstalledPageRow(page: {
  id: string
  canonical_url: string
  title: string | null
  status: string
  metadata: unknown
  last_discovered_at: string | null
  last_fetched_at: string | null
  last_error: string | null
  created_at: string
}) {
  const metadata = isRecord(page.metadata) ? page.metadata : {}
  return {
    id: page.id,
    type: 'web_snapshot' as const,
    name: page.title || page.canonical_url,
    // Documents use pending/blocked; the installed-page UI speaks in source terms.
    status: page.status === 'pending' ? 'connected' : page.status === 'blocked' ? 'error' : page.status,
    sync_enabled: false,
    config: {
      ...metadata,
      capture_url: page.canonical_url,
      page_title: page.title,
      last_seen_at: page.last_discovered_at,
    },
    source_url: page.canonical_url,
    refresh_interval: 'manual',
    next_sync_at: null,
    last_synced_at: page.last_fetched_at,
    last_error: page.last_error,
    created_at: page.created_at,
  }
}

function getSourceTypesForTab(tab: KnowledgeTab): SourceType[] {
  if (tab === 'installed') return ['web_snapshot', 'url', 'sitemap', 'website']
  if (tab === 'files') return ['pdf']
  if (tab === 'spreadsheets') return ['xlsx', 'csv']
  return []
}

function KnowledgePagination({
  tenantId,
  tab,
  page,
  pageCount,
  total,
  pageSize,
}: {
  tenantId: string
  tab: string
  page: number
  pageCount: number
  total: number
  pageSize: number
}) {
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const hrefForPage = (targetPage: number) => `/${tenantId}/knowledge?tab=${tab}&page=${targetPage}&page_size=${pageSize}`

  return (
    <nav className="table-pagination" aria-label="Paginación de conocimiento">
      <p>
        Mostrando {from}-{to} de {total} entradas · Página {page} de {pageCount}
      </p>
      <div className="table-pagination-actions">
        <KnowledgePageSizeSelect value={pageSize} />
        {page > 1 ? (
          <Link className="pagination-icon-button" href={hrefForPage(page - 1)} aria-label="Página anterior" scroll={false}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label="Página anterior">
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        {page < pageCount ? (
          <Link className="pagination-icon-button" href={hrefForPage(page + 1)} aria-label="Página siguiente" scroll={false}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label="Página siguiente">
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  )
}

function getPageSize(value: string | undefined, tab: KnowledgeTab) {
  const fallback = tab === 'installed' ? DEFAULT_INSTALLED_ITEMS_PER_PAGE : DEFAULT_ITEMS_PER_PAGE
  const parsed = Number.parseInt(value ?? '', 10)
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : fallback
}

function dedupeInstalledSources<T extends {
  id: string
  source_url: string | null
  last_synced_at: string | null
  created_at?: string | null
  config: unknown
}>(sources: T[]) {
  const byUrl = new Map<string, T>()

  for (const source of sources) {
    const key = getCanonicalInstalledUrlKey(source.source_url) ?? source.id
    const current = byUrl.get(key)
    if (!current || getInstalledSourceActivityTime(source) > getInstalledSourceActivityTime(current)) {
      byUrl.set(key, source)
    }
  }

  return [...byUrl.values()].sort((a, b) => getInstalledSourceActivityTime(b) - getInstalledSourceActivityTime(a))
}

function getCanonicalInstalledUrlKey(value: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    url.hash = ''
    url.protocol = 'https:'
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    url.searchParams.sort()
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '') || null
  }
}

function getInstalledSourceActivityTime(source: { last_synced_at: string | null; created_at?: string | null; config: unknown }) {
  const config = isRecord(source.config) ? source.config : {}
  return Math.max(
    getTime(source.last_synced_at),
    getTime(typeof config.last_seen_at === 'string' ? config.last_seen_at : null),
    getTime(typeof config.registered_at === 'string' ? config.registered_at : null),
    getTime(source.created_at ?? null),
  )
}

function getTime(value: string | null) {
  if (!value) return 0
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
