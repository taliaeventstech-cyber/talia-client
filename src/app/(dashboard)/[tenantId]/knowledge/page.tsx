import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createWebCaptureToken } from '@/lib/knowledge/web-capture-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { Bot, ChevronLeft, ChevronRight, FileText, Globe2, Plug, Table2 } from 'lucide-react'
import Link from 'next/link'
import { KnowledgeForm } from '../settings/knowledge-form'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams?: Promise<{ page?: string | string[]; tab?: string | string[] }>
}

const ITEMS_PER_PAGE = 20
const tabs = ['installed', 'files', 'faqs', 'apps', 'spreadsheets'] as const
type KnowledgeTab = typeof tabs[number]
type SourceType = 'pdf' | 'xlsx' | 'csv' | 'web_snapshot'

const sourceTypes = [
  { key: 'installed', label: 'Web instalada', icon: Globe2 },
  { key: 'files', label: 'Files', icon: FileText },
  { key: 'faqs', label: 'FAQs', icon: Bot },
  { key: 'apps', label: 'Apps', icon: Plug },
  { key: 'spreadsheets', label: 'Spreadsheets', icon: Table2 },
] satisfies Array<{ key: KnowledgeTab; label: string; icon: typeof Globe2 }>

export default async function KnowledgePage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = searchParams ? await searchParams : {}
  const pageParam = Array.isArray(query.page) ? query.page[0] : query.page
  const tabParam = Array.isArray(query.tab) ? query.tab[0] : query.tab
  const activeTab = tabs.includes(tabParam as KnowledgeTab) ? tabParam as KnowledgeTab : 'installed'
  const requestedPage = Number.parseInt(pageParam ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1
  const dictionary = await getDictionary(await getLocale())
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')

  const admin = createAdminClient()
  const sourceTypesForTab = getSourceTypesForTab(activeTab)
  const shouldLoadSources = sourceTypesForTab.length > 0
  const sourcesQuery = shouldLoadSources
    ? admin
      .from('knowledge_sources')
      .select('id, type, name, status, config, source_url, last_synced_at, last_error, created_at', { count: 'exact' })
      .eq('theatre_id', tenantId)
      .in('type', sourceTypesForTab)
      .order('created_at', { ascending: false })
    : null

  const [{ data: manualSources }, sourcesResult] = await Promise.all([
    admin
      .from('knowledge_sources')
      .select('id')
      .eq('theatre_id', tenantId)
      .eq('type', 'manual'),
    sourcesQuery ? sourcesQuery.range(from, to) : Promise.resolve({ data: [], count: 0 }),
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

  const knowledgeSources = sourcesResult.data ?? []
  const totalItems = activeTab === 'faqs' ? knowledgeCount ?? 0 : sourcesResult.count ?? 0
  const pageCount = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))
  const sourceIds = (knowledgeSources ?? []).map((source) => source.id)
  const { data: sourceChunks } = sourceIds.length
    ? await admin
      .from('knowledge_chunks')
      .select('source_id, embedding_status')
      .in('source_id', sourceIds)
      .eq('active', true)
    : { data: [] }
  const chunkCounts = new Map<string, number>()
  const embeddingCounts = new Map<string, { ready: number; pending: number; processing: number; error: number }>()
  for (const chunk of sourceChunks ?? []) {
    if (!chunk.source_id) continue
    chunkCounts.set(chunk.source_id, (chunkCounts.get(chunk.source_id) ?? 0) + 1)
    const current = embeddingCounts.get(chunk.source_id) ?? { ready: 0, pending: 0, processing: 0, error: 0 }
    if (chunk.embedding_status === 'ready') current.ready += 1
    else if (chunk.embedding_status === 'processing') current.processing += 1
    else if (chunk.embedding_status === 'error') current.error += 1
    else current.pending += 1
    embeddingCounts.set(chunk.source_id, current)
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
            config: source.config,
            sourceUrl: source.source_url,
            captureUrl: source.type === 'web_snapshot' && source.source_url
              ? getCaptureUrl({
                tenantId,
                sourceId: source.id,
                sourceUrl: source.source_url,
              })
              : null,
            lastSyncedAt: source.last_synced_at,
            lastError: source.last_error,
            chunkCount: chunkCounts.get(source.id) ?? 0,
            embeddingCounts: embeddingCounts.get(source.id) ?? { ready: 0, pending: 0, processing: 0, error: 0 },
          }))}
          items={knowledgeItems ?? []}
          pagination={
            <KnowledgePagination
              tenantId={tenantId}
              tab={activeTab}
              page={Math.min(page, pageCount)}
              pageCount={pageCount}
              total={totalItems}
              pageSize={ITEMS_PER_PAGE}
            />
          }
          labels={dictionary.settings.knowledge}
        />
      </section>
    </main>
  )
}

function getSourceTypesForTab(tab: KnowledgeTab): SourceType[] {
  if (tab === 'installed') return ['web_snapshot']
  if (tab === 'files') return ['pdf']
  if (tab === 'spreadsheets') return ['xlsx', 'csv']
  return []
}

function getCaptureUrl({
  tenantId,
  sourceId,
  sourceUrl,
}: {
  tenantId: string
  sourceId: string
  sourceUrl: string
}) {
  const url = new URL(sourceUrl)
  url.hash = ''
  const signedUrl = url.toString()
  url.searchParams.set('talia_capture', '1')
  url.searchParams.set('talia_capture_token', createWebCaptureToken({
    tenantId,
    sourceId,
    url: signedUrl,
  }))
  return url.toString()
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
  const hrefForPage = (targetPage: number) => `/${tenantId}/knowledge?tab=${tab}&page=${targetPage}`

  return (
    <nav className="table-pagination" aria-label="Paginación de conocimiento">
      <p>
        Mostrando {from}-{to} de {total} respuestas · Página {page} de {pageCount}
      </p>
      <div className="table-pagination-actions">
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
