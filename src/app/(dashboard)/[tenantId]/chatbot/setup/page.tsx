import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { normalizeKnowledgeSourceUrl } from '@/lib/knowledge/source-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { getWidgetComplianceCopy } from '@/lib/widget/compliance'
import { normalizeWidgetLauncherIcon, type WidgetLauncherIcon } from '@/lib/widget/launcher-icon'
import { ChatbotSetupForm, type ChatbotSetupFormCopy } from './setup-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

type WidgetConfig = {
  initialMessage: string
  primaryColor: string
  launcherIcon: WidgetLauncherIcon
  tone: 'close' | 'formal' | 'brief'
  fallbackBehavior: 'contact' | 'human' | 'unknown'
}

export default async function ChatbotSetupPage({ params }: Props) {
  const { tenantId } = await params
  const access = await requireTenantProductAccess(tenantId, 'manage_chatbot', 'web')

  const admin = createAdminClient()
  const { data: theatre } = await admin
    .from('theatres')
    .select('name, website_url, system_prompt, widget_config, primary_language')
    .eq('id', tenantId)
    .single()

  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.chatbotSetup
  const formCopy = getFormCopy(copy)
  const widgetConfig = getWidgetConfig(theatre?.widget_config, copy.defaultInitialMessage)
  const isOnboardingFlow = !access.chatbotSetupCompleted
  const normalizedWebsiteUrl = theatre?.website_url
    ? normalizeKnowledgeSourceUrl(theatre.website_url)
    : null
  const existingWebsiteSource = normalizedWebsiteUrl
    ? await admin
      .from('knowledge_sources')
      .select('id')
      .eq('theatre_id', tenantId)
      .in('type', ['url', 'sitemap', 'website'])
      .eq('source_url', normalizedWebsiteUrl)
      .limit(1)
      .maybeSingle()
    : null

  return (
    <main className={isOnboardingFlow ? 'page-shell chatbot-setup-shell chatbot-onboarding-shell' : 'page-shell chatbot-setup-shell'}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title(theatre?.name ?? 'TALIA')}</h1>
          <p className="muted">
            {copy.description}
          </p>
        </div>
        {isOnboardingFlow ? (
          <div className="onboarding-header-controls" aria-label={dictionary.language.label}>
            <LanguageToggle
              locale={locale}
              labels={{
                label: dictionary.language.label,
                es: dictionary.language.es,
                ca: dictionary.language.ca,
                en: dictionary.language.en,
                ptBR: dictionary.language.ptBR,
              }}
            />
            <ThemeToggle />
          </div>
        ) : null}
      </header>

      <ChatbotSetupForm
        copy={formCopy}
        compliance={getWidgetComplianceCopy(theatre?.primary_language)}
        tenantId={tenantId}
        skipHref={isOnboardingFlow ? `/${tenantId}/overview` : null}
        showWebsiteSource={isOnboardingFlow}
        initialSourceConfigured={Boolean(existingWebsiteSource?.data)}
        initialValues={{
          initialMessage: widgetConfig.initialMessage,
          primaryColor: widgetConfig.primaryColor,
          launcherIcon: widgetConfig.launcherIcon,
          tone: widgetConfig.tone,
          fallbackBehavior: widgetConfig.fallbackBehavior,
          sourceUrl: theatre?.website_url ?? '',
          systemPrompt: theatre?.system_prompt ?? '',
        }}
      />
    </main>
  )
}

function getFormCopy(copy: Awaited<ReturnType<typeof getDictionary>>['chatbotSetup']): ChatbotSetupFormCopy {
  const { title, stepLabel, ...serializableCopy } = copy
  void title

  return {
    ...serializableCopy,
    stepLabels: [
      stepLabel(1, 3),
      stepLabel(2, 3),
      stepLabel(3, 3),
    ],
  }
}

function getWidgetConfig(value: unknown, defaultInitialMessage: string): WidgetConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      initialMessage: defaultInitialMessage,
      primaryColor: '#00e5c8',
      launcherIcon: normalizeWidgetLauncherIcon(undefined),
      tone: 'close',
      fallbackBehavior: 'contact',
    }
  }

  const config = value as {
    initialMessage?: unknown
    primaryColor?: unknown
    launcherIcon?: unknown
    launcher_icon?: unknown
    tone?: unknown
    fallbackBehavior?: unknown
  }

  return {
    initialMessage: typeof config.initialMessage === 'string'
      ? config.initialMessage
      : defaultInitialMessage,
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : '#00e5c8',
    launcherIcon: normalizeWidgetLauncherIcon(config.launcherIcon ?? config.launcher_icon),
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
