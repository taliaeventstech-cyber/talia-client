import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { Bot, FileText, GitBranch, Link as LinkIcon, ListChecks, Plug, Table2 } from 'lucide-react'
import Link from 'next/link'
import { KnowledgeForm } from '../settings/knowledge-form'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams?: Promise<{ tab?: string }>
}

type KnowledgeTab = 'sources' | 'guidelines' | 'workflows' | 'actions'

const knowledgeTabs = [
  { value: 'sources', label: 'Sources', icon: LinkIcon },
  { value: 'guidelines', label: 'Guidelines', icon: ListChecks },
  { value: 'workflows', label: 'Workflows', icon: GitBranch },
  { value: 'actions', label: 'Actions', icon: Plug },
] satisfies Array<{ value: KnowledgeTab; label: string; icon: typeof LinkIcon }>

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
  const dictionary = await getDictionary(await getLocale())
  await requireTenantProductAccess(tenantId, 'manage_knowledge', 'data')
  const activeTab = getKnowledgeTab(query.tab)

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
          <p className="section-label">Training</p>
          <h1>{dictionary.knowledge.title}</h1>
          <p className="muted">{dictionary.knowledge.description}</p>
        </div>
      </header>

      <nav className="knowledge-training-tabs" aria-label="Secciones de entrenamiento">
        {knowledgeTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.value}
              className={activeTab === tab.value ? 'knowledge-training-tab knowledge-training-tab-active' : 'knowledge-training-tab'}
              href={`/${tenantId}/knowledge?tab=${tab.value}`}
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {activeTab === 'sources' ? (
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
            scrapeUrls={scrapeUrls}
            labels={dictionary.settings.knowledge}
          />
        </section>
      ) : (
        <KnowledgeFuturePanel tab={activeTab} />
      )}
    </main>
  )
}

function getKnowledgeTab(value: string | undefined): KnowledgeTab {
  if (value === 'guidelines' || value === 'workflows' || value === 'actions') return value
  return 'sources'
}

function KnowledgeFuturePanel({ tab }: { tab: Exclude<KnowledgeTab, 'sources'> }) {
  const copy = {
    guidelines: {
      title: 'Guidelines',
      description: 'Reglas operativas para controlar tono, límites, derivaciones y respuestas que TALIA debe evitar.',
      items: ['Tono y estilo', 'Políticas de derivación', 'Respuestas prohibidas', 'Criterios de revisión humana'],
    },
    workflows: {
      title: 'Workflows',
      description: 'Flujos automatizados para convertir intención del visitante en acciones internas supervisadas.',
      items: ['Solicitud de contacto', 'Incidencias de entradas', 'Consultas de accesibilidad', 'Seguimiento comercial'],
    },
    actions: {
      title: 'Actions',
      description: 'Herramientas conectadas que TALIA podrá ejecutar con permisos controlados.',
      items: ['Consultar agenda', 'Crear lead', 'Enviar resumen', 'Escalar a equipo humano'],
    },
  }[tab]

  return (
    <section className="card knowledge-future-panel">
      <div>
        <p className="eyebrow">Más adelante</p>
        <h2>{copy.title}</h2>
        <p className="muted">{copy.description}</p>
      </div>
      <div className="knowledge-future-grid">
        {copy.items.map((item) => (
          <div key={item} className="knowledge-future-item">
            <strong>{item}</strong>
            <span>Planificado</span>
          </div>
        ))}
      </div>
    </section>
  )
}
