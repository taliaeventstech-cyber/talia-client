import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { Bot, ChevronLeft, ChevronRight, FileText, Link as LinkIcon, Plug, Table2 } from 'lucide-react'
import Link from 'next/link'
import { KnowledgeForm } from '../settings/knowledge-form'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams?: Promise<{ page?: string | string[] }>
}

const ITEMS_PER_PAGE = 20

const sourceTypes = [
  { label: 'Links', icon: LinkIcon, active: true },
  { label: 'Files', icon: FileText },
  { label: 'FAQs', icon: Bot },
  { label: 'Apps', icon: Plug },
  { label: 'Spreadsheets', icon: Table2 },
] satisfies Array<{ label: string; icon: typeof LinkIcon; active?: boolean }>

export default async function KnowledgePage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = searchParams ? await searchParams : {}
  const pageParam = Array.isArray(query.page) ? query.page[0] : query.page
  const requestedPage = Number.parseInt(pageParam ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1
  const dictionary = await getDictionary(await getLocale())
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')

  const admin = createAdminClient()
  const [{ data: theatre }, { data: knowledgeItems, count: knowledgeCount }] = await Promise.all([
    admin
      .from('theatres')
      .select('scrape_urls')
      .eq('id', tenantId)
      .single(),
    admin
      .from('knowledge_items')
      .select('id, question, answer, category, language, priority', { count: 'exact' })
      .eq('theatre_id', tenantId)
      .eq('active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to),
  ])
  const totalItems = knowledgeCount ?? 0
  const pageCount = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))

  const scrapeUrls = Array.isArray(theatre?.scrape_urls)
    ? theatre.scrape_urls.filter((url): url is string => typeof url === 'string')
    : []

  return (
    <main className="page-shell">
      <section className="stack">
        <div className="knowledge-source-tabs" aria-label="Tipos de fuentes">
          {sourceTypes.map((source) => {
            const Icon = source.icon
            return (
              <button
                key={source.label}
                className={source.active ? 'knowledge-source-tab knowledge-source-tab-active' : 'knowledge-source-tab'}
                type="button"
                disabled={!source.active}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                {source.label}
              </button>
            )
          })}
        </div>

        <KnowledgeForm
          tenantId={tenantId}
          items={knowledgeItems ?? []}
          pagination={
            <KnowledgePagination
              tenantId={tenantId}
              page={Math.min(page, pageCount)}
              pageCount={pageCount}
              total={totalItems}
              pageSize={ITEMS_PER_PAGE}
            />
          }
          scrapeUrls={scrapeUrls}
          labels={dictionary.settings.knowledge}
        />
      </section>
    </main>
  )
}

function KnowledgePagination({
  tenantId,
  page,
  pageCount,
  total,
  pageSize,
}: {
  tenantId: string
  page: number
  pageCount: number
  total: number
  pageSize: number
}) {
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const hrefForPage = (targetPage: number) => `/${tenantId}/knowledge?page=${targetPage}`

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
