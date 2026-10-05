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
  instagramAgent: 'Instagram agent',
  inbox: 'Inbox',
  intelligence: 'Intelligence',
  knowledge: 'Knowledge',
  marketing: 'Marketing',
  campaigns: 'Campaigns',
  active: 'Active',
  pilot: 'Pilot',
  conversations: 'Conversations',
  analysis: 'Analysis',
  settings: 'Configuration',
  connection: 'Connection',
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

  it('shows Instagram as an independent pilot with conversations and connection settings', () => {
    const html = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="owner"
        modules={{ instagram: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted={false}
        emailAgentPreviewEnabled={false}
      />,
    )

    expect(html).toContain('Instagram agent')
    expect(html).toContain('Pilot')
    expect(html).toContain('href="/tenant-1/instagram"')
    expect(html).toContain('href="/tenant-1/instagram/settings"')
    expect(html).toContain('Connection')
    expect(html.indexOf('href="/tenant-1/instagram/settings"'))
      .toBeLessThan(html.indexOf('href="/tenant-1/instagram"'))
  })

  it('shows Marketing only to managers when the module is active', () => {
    const managerHtml = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="owner"
        modules={{ marketing: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted={false}
        emailAgentPreviewEnabled={false}
      />,
    )
    const viewerHtml = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="viewer"
        modules={{ marketing: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted={false}
        emailAgentPreviewEnabled={false}
      />,
    )

    expect(managerHtml).toContain('href="/tenant-1/marketing"')
    expect(managerHtml).toContain('Campaigns')
    expect(managerHtml).toContain('Pilot')
    expect(viewerHtml).not.toContain('href="/tenant-1/marketing"')
  })

  it('puts connection before conversations in the manageable messaging agents', () => {
    const html = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="owner"
        modules={{ whatsapp: 'active', instagram: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted={false}
        emailAgentPreviewEnabled={false}
      />,
    )

    expect(html.indexOf('href="/tenant-1/whatsapp/settings"'))
      .toBeLessThan(html.indexOf('href="/tenant-1/whatsapp"'))
    expect(html.indexOf('href="/tenant-1/instagram/settings"'))
      .toBeLessThan(html.indexOf('href="/tenant-1/instagram"'))
  })

  it('puts email configuration after its inbox and analysis sections', () => {
    const html = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="owner"
        modules={{ email: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted={false}
        emailAgentPreviewEnabled
      />,
    )

    expect(html.indexOf('href="/tenant-1/email"'))
      .toBeLessThan(html.indexOf('href="/tenant-1/email/analysis"'))
    expect(html.indexOf('href="/tenant-1/email/analysis"'))
      .toBeLessThan(html.indexOf('href="/tenant-1/email/settings"'))
  })

  it('lets read-only venue members see Instagram conversations without connection settings', () => {
    const html = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="viewer"
        modules={{ instagram: 'active' }}
        hasProductAccess
        needsUpgrade={false}
        isTrialExpired={false}
        trialDaysRemaining={null}
        chatbotSetupCompleted={false}
        emailAgentPreviewEnabled={false}
      />,
    )

    expect(html).toContain('href="/tenant-1/instagram"')
    expect(html).not.toContain('href="/tenant-1/instagram/settings"')
  })

  it('collapses each agent instead of the whole attention section', () => {
    const html = renderToStaticMarkup(
      <DashboardNav
        tenantId="tenant-1"
        labels={labels}
        role="owner"
        modules={{ web: 'active', data: 'active', email: 'active', whatsapp: 'active', instagram: 'active' }}
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
    expect(html).toContain('aria-label="Collapse: Instagram agent"')
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
