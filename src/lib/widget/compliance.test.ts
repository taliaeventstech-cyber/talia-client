import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  DEFAULT_PRIVACY_URL,
  getWidgetComplianceCopy,
  normalizePrivacyUrl,
} from './compliance'

describe('widget compliance', () => {
  it('provides localized mandatory disclosure copy', () => {
    expect(getWidgetComplianceCopy('es').aiLabel).toBe('Agente web')
    expect(getWidgetComplianceCopy('ca-ES').aiLabel).toBe('Agent web')
    expect(getWidgetComplianceCopy('en-GB').aiLabel).toBe('Web agent')
    expect(getWidgetComplianceCopy('pt-BR').aiLabel).toBe('Agente web')
    expect(getWidgetComplianceCopy('es').privacySummary).toContain('90 días')
    expect(getWidgetComplianceCopy('pt-BR').privacyQuestion).toBe('Como vocês tratam meus dados?')
  })

  it('only exposes secure privacy links', () => {
    expect(normalizePrivacyUrl('https://venue.example/privacy#chat')).toBe('https://venue.example/privacy')
    expect(normalizePrivacyUrl('http://venue.example/privacy')).toBe(DEFAULT_PRIVACY_URL)
    expect(normalizePrivacyUrl('javascript:alert(1)')).toBe(DEFAULT_PRIVACY_URL)
  })

  it('keeps AI disclosure and machine-readable markers in the public widget', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')
    const chatRouteSource = await readFile(
      resolve(process.cwd(), 'src/app/api/chat/[tenantId]/route.ts'),
      'utf8',
    )

    expect(widgetSource).toContain('header-ai-label')
    expect(widgetSource).toContain('talia-ai-disclosure')
    expect(widgetSource).toContain('talia-privacy-notice')
    expect(widgetSource).toContain('data-privacy')
    expect(widgetSource).toContain("appendMessage(messages, compliance.privacyQuestion, 'user')")
    expect(widgetSource).toContain("compliance.privacySummary + '\\n\\n' + compliance.privacyMore")
    expect(widgetSource).not.toContain('Conservamos esta conversación durante 30 días')
    expect(widgetSource).toContain("item.setAttribute('data-ai-generated', 'true')")
    expect(chatRouteSource.match(/ai_generated: true/g)).toHaveLength(3)
  })

  it('keeps the published retention wording aligned with the 90-day deletion policy', async () => {
    const [privacyPolicy, retentionMigration] = await Promise.all([
      readFile(resolve(process.cwd(), 'docs/legal/privacy-policy-google-en.md'), 'utf8'),
      readFile(
        resolve(
          process.cwd(),
          'supabase/migrations/20260802170000_chatbot_content_retention_90_days.sql',
        ),
        'utf8',
      ),
    ])

    expect(privacyPolicy).toContain(
      'Chatbot conversations: 90 days after the last activity, unless the customer deletes them earlier.',
    )
    expect(privacyPolicy).toContain(
      'Chatbot usage metrics: up to 12 months in de-identified form',
    )
    expect(privacyPolicy).not.toContain(
      'Chatbot conversations: up to 12 months after the conversation date',
    )
    expect(privacyPolicy).not.toContain(
      'Chatbot conversations: 30 days after the last activity',
    )
    expect(retentionMigration).toContain("v_chatbot_content_cutoff timestamptz := now() - interval '90 days'")
    expect(retentionMigration).not.toContain("interval '30 days'")
  })
})

describe('widget privacy copy for voice mode', () => {
  it.each(['es', 'ca', 'en', 'pt-BR'] as const)('discloses voice processing and that audio is not kept (%s)', (language) => {
    const summary = getWidgetComplianceCopy(language).privacySummary

    expect(summary).toContain('OpenAI')
    expect(summary).toMatch(/grabaciones de audio|enregistraments d’àudio|audio recordings|gravações de áudio/)
    expect(summary).toContain('TALIA')
    expect(summary).toMatch(/Hola TALIA|Hello TALIA|Olá TALIA/)
  })
})
