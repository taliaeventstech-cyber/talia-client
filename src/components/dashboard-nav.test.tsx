import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DashboardNav, getChatbotConfigurationHref } from './dashboard-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/tenant-1/overview',
}))

const labels = {
  main: 'Main navigation',
  overview: 'Overview',
  attention: 'Attention',
  webChatbot: 'AI assistant',
  accessibility: 'Accessibility',
  emailAgent: 'Email agent',
  inbox: 'Inbox',
  intelligence: 'Intelligence',
  knowledge: 'Knowledge',
  active: 'Active',
  conversations: 'Conversations',
  analysis: 'Analysis',
  settings: 'Configuration',
  upgrade: 'Upgrade',
  trialEndsIn: '{days} days left',
}

describe('getChatbotConfigurationHref', () => {
  it('returns to chatbot onboarding when the initial setup was skipped', () => {
    expect(getChatbotConfigurationHref('tenant-1', false))
      .toBe('/tenant-1/chatbot/setup')
  })

  it('opens the full settings after chatbot onboarding is completed', () => {
    expect(getChatbotConfigurationHref('tenant-1', true))
      .toBe('/tenant-1/settings')
  })

  it('keeps configuration visible after the user skips chatbot onboarding', () => {
    const html = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="owner"
        modules={{ chatbot: 'active', data: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted={false}
        emailAgentPreviewEnabled={false}
      />,
    )

    expect(html).toContain('href="/tenant-1/chatbot/setup"')
    expect(html).toContain('Configuration')
  })
})
