import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardNav, getChatbotConfigurationHref } from './dashboard-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/tenant-1/overview',
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

const labels = {
  main: 'Main navigation',
  expand: 'Expand',
  collapse: 'Collapse',
  overview: 'Overview',
  attention: 'Attention',
  webChatbot: 'Web Agent',
  accessibility: 'Accessibility',
  emailAgent: 'Email agent',
  whatsappAgent: 'WhatsApp agent',
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
        modules={{ web: 'active', data: 'active' }}
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

  it('shows WhatsApp as an independent attention agent when its module is active', () => {
    const html = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="operator"
        modules={{ whatsapp: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted={false}
        emailAgentPreviewEnabled={false}
      />,
    )

    expect(html).toContain('WhatsApp agent')
    expect(html).toContain('href="/tenant-1/whatsapp"')
    expect(html).not.toContain('Web Agent')
  })

  it('collapses each agent instead of the whole attention section', () => {
    const html = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="owner"
        modules={{ web: 'active', data: 'active', email: 'active', whatsapp: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted
        emailAgentPreviewEnabled
      />,
    )

    expect(html).toContain('aria-label="Collapse: Web Agent"')
    expect(html).toContain('aria-label="Collapse: Email agent"')
    expect(html).toContain('aria-label="Collapse: WhatsApp agent"')
    expect(html).not.toContain('aria-label="Collapse: Attention"')
  })

  it('keeps the initial disclosure markup stable when the browser stored it as collapsed', () => {
    const navigation = (
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="owner"
        modules={{ web: 'active', data: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted
        emailAgentPreviewEnabled={false}
      />
    )
    const serverMarkup = renderToStaticMarkup(navigation)

    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn().mockReturnValue('false'),
        setItem: vi.fn(),
      },
    })
    const firstBrowserMarkup = renderToStaticMarkup(navigation)

    expect(firstBrowserMarkup).toBe(serverMarkup)
  })
})
