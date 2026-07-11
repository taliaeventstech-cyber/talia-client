import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { SettingsForm } from './settings-form'
import { normalizeChatbotAiSettings } from '@/lib/chatbot/ai-settings'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { tenantId } = await params
  const dictionary = await getDictionary(await getLocale())
  const access = await requireTenantProductAccess(tenantId, 'manage_chatbot', 'chatbot')
  const hasScriptAccess = access.billingAccess.hasProductAccess && access.chatbotSetupCompleted

  const admin = createAdminClient()

  const { data: theatre } = await admin
    .from('theatres')
    .select('name, slug, plan, primary_language, system_prompt, fallback_email, fallback_phone, website_url, widget_config, n8n_webhook_url')
    .eq('id', tenantId)
    .single()

  const widgetConfig = getWidgetConfig(theatre?.widget_config)
  const aiSettings = getAiSettings(theatre?.widget_config)

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
            plan: theatre.plan,
            system_prompt: theatre.system_prompt,
            fallback_email: theatre.fallback_email,
            fallback_phone: theatre.fallback_phone,
            primary_language: theatre.primary_language ?? 'es',
          }}
          widgetConfig={{
            initialMessage: widgetConfig.initialMessage,
            primaryColor: widgetConfig.primaryColor,
            position: widgetConfig.position,
            widgetSize: widgetConfig.widgetSize,
            inlineOffset: widgetConfig.inlineOffset,
            blockOffset: widgetConfig.blockOffset,
            collisionStrategy: widgetConfig.collisionStrategy,
            autoOpen: widgetConfig.autoOpen,
            autoOpenDelay: widgetConfig.autoOpenDelay,
            allowedDomains: widgetConfig.allowedDomains,
            fallbackMessage: aiSettings.fallbackMessage,
            fallbackWhatsApp: aiSettings.fallbackWhatsApp,
          }}
          labels={dictionary.settings.form}
          previewLabel={dictionary.settings.preview}
          integration={{
            title: dictionary.settings.integrationCode,
            help: dictionary.settings.integrationHelp,
            copyScript: dictionary.settings.copyScript,
            copiedScript: dictionary.settings.copiedScript,
            embedCode: getEmbedCode(tenantId, theatre.website_url),
            hasScriptAccess,
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

function getWidgetConfig(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {
      assistantName: 'TALIA',
      initialMessage: 'Hola, soc TALIA. En què et puc ajudar?',
      primaryColor: '#000000',
      position: 'bottom-right',
      widgetSize: 'medium' as const,
      inlineOffset: 20,
      blockOffset: 20,
      collisionStrategy: 'auto' as const,
      autoOpen: false,
      autoOpenDelay: 3,
      allowedDomains: [],
    }
  }

  const config = value as {
    assistantName?: unknown
    initialMessage?: unknown
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
    autoOpen?: unknown
    autoOpenDelay?: unknown
    allowedDomains?: unknown
    allowed_domains?: unknown
  }

  return {
    assistantName: typeof config.assistantName === 'string' ? config.assistantName : 'TALIA',
    initialMessage: typeof config.initialMessage === 'string' ? config.initialMessage : 'Hola, soc TALIA. En què et puc ajudar?',
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : '#000000',
    position: getWidgetPosition(config.position),
    widgetSize: getWidgetSize(config.widgetSize ?? config.widget_size ?? config.size),
    inlineOffset: getPixelOffset(config.inlineOffset ?? config.inline_offset, 20),
    blockOffset: getPixelOffset(config.blockOffset ?? config.block_offset, 20),
    collisionStrategy: config.collisionStrategy === 'none' || config.collision_strategy === 'none' ? 'none' as const : 'auto' as const,
    autoOpen: config.autoOpen === true,
    autoOpenDelay: typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3,
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

function getEmbedCode(tenantId: string, websiteUrl: string | null) {
  const appUrl = getAppUrl()
  const siteOrigin = getSiteOrigin(websiteUrl)
  const siteOriginAttribute = siteOrigin ? `\n  data-site-origin="${siteOrigin}"` : ''

  return `<script
  src="${appUrl}/widget.js"
  crossorigin="anonymous"
  data-tenant="${tenantId}"
  data-api-base="${appUrl}"${siteOriginAttribute}
></script>`
}

function getSiteOrigin(value: string | null) {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}
