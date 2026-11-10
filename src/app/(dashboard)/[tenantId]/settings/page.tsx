import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { SettingsForm } from './settings-form'
import { getAgentVoiceFromWidgetConfig, getAgentVoiceOptions, isVoiceInvitationEnabled } from '@/lib/widget/agent-voices'
import { normalizeChatbotAiSettings } from '@/lib/chatbot/ai-settings'
import { normalizeWidgetLauncherIcon } from '@/lib/widget/launcher-icon'
import { normalizeProactiveGreeting } from '@/lib/widget/proactive-greeting'
import { isChatbotEnabled } from '@/lib/widget/availability'
import { normalizeSuggestedQuestions } from '@/lib/widget/suggested-questions'
import { getPublicWidgetAppUrl, getWidgetEmbedCode } from '@/lib/widget/embed-code'
import { getWidgetComplianceCopy, normalizePrivacyUrl } from '@/lib/widget/compliance'
import { hasUsableTenantKnowledge } from '@/lib/knowledge/availability'
import { getWidgetInstallationSecurity } from '@/lib/widget/installation-security'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const access = await requireTenantProductAccess(tenantId, 'manage_chatbot', 'web')
  const hasScriptAccess = access.billingAccess.hasProductAccess && access.chatbotSetupCompleted
  const admin = createAdminClient()

  const [{ data: theatre }, hasUsableKnowledge, { data: installation }] = await Promise.all([
    admin
      .from('theatres')
      .select('name, slug, primary_language, system_prompt, fallback_email, fallback_phone, website_url, widget_config, n8n_webhook_url')
      .eq('id', tenantId)
      .single(),
    hasUsableTenantKnowledge(admin, tenantId),
    admin
      .from('widget_installations')
      .select('origin, last_seen_at')
      .eq('theatre_id', tenantId)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const widgetConfig = getWidgetConfig(theatre?.widget_config, theatre?.primary_language)
  const aiSettings = getAiSettings(theatre?.widget_config)
  const widgetAppUrl = getPublicWidgetAppUrl()
  const installationSecurity = getWidgetInstallationSecurity(widgetAppUrl)

  return (
    <main className="page-shell">
      <header className="page-header chatbot-settings-header">
        <div>
          <h1>{dictionary.settings.section}</h1>
          <p className="muted">{dictionary.settings.title}</p>
        </div>
      </header>

      {theatre ? (
        <SettingsForm
          tenantId={tenantId}
          theatre={{
            system_prompt: theatre.system_prompt,
            fallback_email: theatre.fallback_email,
            fallback_phone: theatre.fallback_phone,
            primary_language: theatre.primary_language ?? 'es',
            website_url: theatre.website_url,
          }}
          widgetConfig={{
            enabled: widgetConfig.enabled,
            initialMessage: widgetConfig.initialMessage,
            privacyUrl: widgetConfig.privacyUrl,
            primaryColor: widgetConfig.primaryColor,
            position: widgetConfig.position,
            widgetSize: widgetConfig.widgetSize,
            inlineOffset: widgetConfig.inlineOffset,
            blockOffset: widgetConfig.blockOffset,
            collisionStrategy: widgetConfig.collisionStrategy,
            widgetTheme: widgetConfig.widgetTheme,
            launcherIcon: widgetConfig.launcherIcon,
            glassBackground: widgetConfig.glassBackground,
            glassBlur: widgetConfig.glassBlur,
            glassTranslucency: widgetConfig.glassTranslucency,
            autoOpen: widgetConfig.autoOpen,
            autoOpenDelay: widgetConfig.autoOpenDelay,
            proactiveMessage: widgetConfig.proactiveMessage,
            suggestedQuestions: widgetConfig.suggestedQuestions,
            allowedDomains: widgetConfig.allowedDomains,
            fallbackMessage: aiSettings.fallbackMessage,
            fallbackWhatsApp: aiSettings.fallbackWhatsApp,
            agentVoice: getAgentVoiceFromWidgetConfig(theatre.widget_config),
            voiceInvitation: isVoiceInvitationEnabled(theatre.widget_config),
          }}
          voiceOptions={getAgentVoiceOptions(locale)}
          hasUsableKnowledge={hasUsableKnowledge}
          labels={dictionary.settings.form}
          compliance={getWidgetComplianceCopy(theatre.primary_language)}
          previewLabel={dictionary.settings.preview}
          integration={{
            title: dictionary.settings.integrationCode,
            help: dictionary.settings.integrationHelp,
            copyScript: dictionary.settings.copyScript,
            copiedScript: dictionary.settings.copiedScript,
            embedCode: getWidgetEmbedCode({ appUrl: widgetAppUrl, tenantId, websiteUrl: theatre.website_url }),
            hasScriptAccess,
            security: {
              title: dictionary.settings.integrationSecurityTitle,
              help: dictionary.settings.integrationSecurityHelp,
              instructions: installationSecurity.cspInstructions,
              copy: dictionary.settings.copySecurityConfig,
              copied: dictionary.settings.copiedSecurityConfig,
            },
            assistant: {
              websiteUrl: theatre.website_url,
              installation: installation
                ? { origin: installation.origin, lastSeenAt: installation.last_seen_at }
                : null,
              labels: dictionary.settings.installationAssistant,
            },
          }}
        />
      ) : null}
    </main>
  )
}

function getAiSettings(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalizeChatbotAiSettings(undefined)
  }
  const config = value as { chatbotAi?: unknown; chatbot_ai?: unknown }
  return normalizeChatbotAiSettings(config.chatbotAi ?? config.chatbot_ai)
}

function getWidgetConfig(value: unknown, language: unknown) {
  if (!value || typeof value !== 'object') {
    return {
      enabled: true,
      assistantName: 'TALIA',
      initialMessage: 'Hola, soc TALIA. En què et puc ajudar?',
      privacyUrl: normalizePrivacyUrl(undefined),
      primaryColor: '#000000',
      position: 'bottom-right',
      widgetSize: 'medium' as const,
      inlineOffset: 20,
      blockOffset: 20,
      collisionStrategy: 'auto' as const,
      widgetTheme: 'solid' as const,
      launcherIcon: normalizeWidgetLauncherIcon(undefined),
      glassBackground: 'light' as const,
      glassBlur: 18,
      glassTranslucency: 58,
      autoOpen: false,
      autoOpenDelay: 3,
      proactiveMessage: normalizeProactiveGreeting(undefined, language),
      suggestedQuestions: [],
      allowedDomains: [],
    }
  }

  const config = value as {
    enabled?: unknown
    assistantName?: unknown
    initialMessage?: unknown
    privacyUrl?: unknown
    privacy_url?: unknown
    primaryColor?: unknown
    position?: unknown
    widgetSize?: unknown
    widget_size?: unknown
    size?: unknown
    inlineOffset?: unknown
    inline_offset?: unknown
    blockOffset?: unknown
    block_offset?: unknown
    collisionStrategy?: unknown
    collision_strategy?: unknown
    widgetTheme?: unknown
    widget_theme?: unknown
    launcherIcon?: unknown
    launcher_icon?: unknown
    glassBackground?: unknown
    glass_background?: unknown
    glassBlur?: unknown
    glass_blur?: unknown
    glassTranslucency?: unknown
    glass_translucency?: unknown
    autoOpen?: unknown
    autoOpenDelay?: unknown
    proactiveMessage?: unknown
    proactive_message?: unknown
    suggestedQuestions?: unknown
    suggested_questions?: unknown
    allowedDomains?: unknown
    allowed_domains?: unknown
  }

  const assistantName = typeof config.assistantName === 'string' ? config.assistantName : 'TALIA'

  return {
    enabled: isChatbotEnabled(config.enabled),
    assistantName,
    initialMessage: typeof config.initialMessage === 'string' ? config.initialMessage : 'Hola, soc TALIA. En què et puc ajudar?',
    privacyUrl: normalizePrivacyUrl(config.privacyUrl ?? config.privacy_url),
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : '#000000',
    position: getWidgetPosition(config.position),
    widgetSize: getWidgetSize(config.widgetSize ?? config.widget_size ?? config.size),
    inlineOffset: getPixelOffset(config.inlineOffset ?? config.inline_offset, 20),
    blockOffset: getPixelOffset(config.blockOffset ?? config.block_offset, 20),
    collisionStrategy: config.collisionStrategy === 'none' || config.collision_strategy === 'none' ? 'none' as const : 'auto' as const,
    widgetTheme: config.widgetTheme === 'glass' || config.widget_theme === 'glass' ? 'glass' as const : 'solid' as const,
    launcherIcon: normalizeWidgetLauncherIcon(config.launcherIcon ?? config.launcher_icon),
    glassBackground: config.glassBackground === 'dark' || config.glass_background === 'dark' ? 'dark' as const : 'light' as const,
    glassBlur: getBoundedNumber(config.glassBlur ?? config.glass_blur, 0, 30, 18),
    glassTranslucency: getBoundedNumber(config.glassTranslucency ?? config.glass_translucency, 15, 85, 58),
    autoOpen: config.autoOpen === true,
    autoOpenDelay: typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3,
    proactiveMessage: normalizeProactiveGreeting(config.proactiveMessage ?? config.proactive_message, language, assistantName),
    suggestedQuestions: normalizeSuggestedQuestions(
      config.suggestedQuestions ?? config.suggested_questions,
      language,
    ),
    allowedDomains: getAllowedDomains(config.allowedDomains ?? config.allowed_domains),
  }
}

function getWidgetSize(value: unknown): 'small' | 'medium' | 'large' {
  if (value === 'small' || value === 'large') return value
  return 'medium'
}

function getPixelOffset(value: unknown, fallback: number) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(320, Math.max(12, Math.round(numericValue)))
}

function getBoundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(max, Math.max(min, Math.round(numericValue)))
}

function getAllowedDomains(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function getWidgetPosition(value: unknown) {
  if (
    value === 'bottom-right' ||
    value === 'bottom-left' ||
    value === 'top-right' ||
    value === 'top-left'
  ) {
    return value
  }

  return 'bottom-right'
}
