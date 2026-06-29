import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { ChatbotSetupForm, type ChatbotSetupFormCopy } from './setup-form'

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
    .select('name, system_prompt, widget_config')
    .eq('id', tenantId)
    .single()

  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.chatbotSetup
  const formCopy = getFormCopy(copy)
  const widgetConfig = getWidgetConfig(theatre?.widget_config, copy.defaultInitialMessage)
  const isOnboardingFlow = !access.chatbotSetupCompleted

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
              }}
            />
            <ThemeToggle />
          </div>
        ) : null}
      </header>

      <ChatbotSetupForm
        copy={formCopy}
        tenantId={tenantId}
        skipHref={isOnboardingFlow ? `/${tenantId}/overview` : null}
        initialValues={{
          initialMessage: widgetConfig.initialMessage,
          primaryColor: widgetConfig.primaryColor,
          tone: widgetConfig.tone,
          fallbackBehavior: widgetConfig.fallbackBehavior,
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
