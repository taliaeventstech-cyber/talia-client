import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { ChatbotSetupForm } from './setup-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

type WidgetConfig = {
  initialMessage: string
  primaryColor: string
  tone: 'close' | 'formal' | 'brief'
  fallbackBehavior: 'contact' | 'human' | 'unknown'
}

export default async function ChatbotSetupPage({ params }: Props) {
  const { tenantId } = await params
  const access = await requireTenantProductAccess(tenantId, 'manage_chatbot', 'chatbot')

  const admin = createAdminClient()
  const { data: theatre } = await admin
    .from('theatres')
    .select('name, system_prompt, scrape_urls, widget_config')
    .eq('id', tenantId)
    .single()

  const dictionary = await getDictionary(await getLocale())
  const copy = dictionary.chatbotSetup
  const widgetConfig = getWidgetConfig(theatre?.widget_config, copy.defaultInitialMessage)
  const scrapeUrls = Array.isArray(theatre?.scrape_urls)
    ? theatre.scrape_urls.filter((url): url is string => typeof url === 'string')
    : []

  return (
    <main className={access.chatbotSetupCompleted ? 'page-shell chatbot-setup-shell' : 'page-shell chatbot-setup-shell chatbot-onboarding-shell'}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title(theatre?.name ?? 'TALIA')}</h1>
          <p className="muted">
            {copy.description}
          </p>
        </div>
      </header>

      <ChatbotSetupForm
        copy={copy}
        tenantId={tenantId}
        initialValues={{
          initialMessage: widgetConfig.initialMessage,
          primaryColor: widgetConfig.primaryColor,
          tone: widgetConfig.tone,
          fallbackBehavior: widgetConfig.fallbackBehavior,
          sourceUrl: scrapeUrls[0] ?? '',
          systemPrompt: theatre?.system_prompt ?? '',
        }}
      />
    </main>
  )
}

function getWidgetConfig(value: unknown, defaultInitialMessage: string): WidgetConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      initialMessage: defaultInitialMessage,
      primaryColor: '#00e5c8',
      tone: 'close',
      fallbackBehavior: 'contact',
    }
  }

  const config = value as {
    initialMessage?: unknown
    primaryColor?: unknown
    tone?: unknown
    fallbackBehavior?: unknown
  }

  return {
    initialMessage: typeof config.initialMessage === 'string'
      ? config.initialMessage
      : defaultInitialMessage,
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : '#00e5c8',
    tone: isTone(config.tone) ? config.tone : 'close',
    fallbackBehavior: isFallbackBehavior(config.fallbackBehavior) ? config.fallbackBehavior : 'contact',
  }
}

function isTone(value: unknown): value is 'close' | 'formal' | 'brief' {
  return value === 'close' || value === 'formal' || value === 'brief'
}

function isFallbackBehavior(value: unknown): value is 'contact' | 'human' | 'unknown' {
  return value === 'contact' || value === 'human' || value === 'unknown'
}
