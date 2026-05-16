import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { KnowledgeForm } from '../settings/knowledge-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function KnowledgePage({ params }: Props) {
  const { tenantId } = await params
  const dictionary = await getDictionary(await getLocale())
  await requireTenantPermission(tenantId, 'manage_knowledge', 'data')

  const admin = createAdminClient()
  const [{ data: theatre }, { data: knowledgeItems }] = await Promise.all([
    admin
      .from('theatres')
      .select('scrape_urls')
      .eq('id', tenantId)
      .single(),
    admin
      .from('knowledge_items')
      .select('id, question, answer, category, language, priority')
      .eq('theatre_id', tenantId)
      .eq('active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const scrapeUrls = Array.isArray(theatre?.scrape_urls)
    ? theatre.scrape_urls.filter((url): url is string => typeof url === 'string')
    : []

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">{dictionary.knowledge.section}</p>
          <h1>{dictionary.knowledge.title}</h1>
          <p className="muted">{dictionary.knowledge.description}</p>
        </div>
      </header>

      <KnowledgeForm
        tenantId={tenantId}
        items={knowledgeItems ?? []}
        scrapeUrls={scrapeUrls}
        labels={dictionary.settings.knowledge}
      />
    </main>
  )
}
