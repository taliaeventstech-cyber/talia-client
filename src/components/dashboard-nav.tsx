'use client'

import { useState, type ReactNode, type SVGProps } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, ChevronDown, Database, Inbox, LayoutDashboard, Mail, MessageCircle, MessageSquare, Network, SlidersHorizontal, Zap } from 'lucide-react'
import { FREE_TRIAL_DAYS } from '@/lib/billing/plans'
import {
  hasTenantPermission,
  isTenantModuleEnabled,
  type TenantModuleKey,
  type TenantRole,
} from '@/lib/auth/permissions'

function WebAccessibilityIcon({
  size = 14,
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M7.5 10.5h9" />
      <path d="M12 10.5v4" />
      <path d="m9 19 3-4.5 3 4.5" />
    </svg>
  )
}

type DashboardNavLabels = {
  main: string
  overview: string
  attention: string
  webChatbot: string
  accessibility: string
  emailAgent: string
  whatsappAgent: string
  inbox: string
  intelligence: string
  knowledge: string
  active: string
  conversations: string
  analysis: string
  settings: string
  upgrade: string
  trialEndsIn: string
  expand: string
  collapse: string
}

export function getChatbotConfigurationHref(tenantId: string, setupCompleted: boolean) {
  return setupCompleted
    ? `/${tenantId}/settings`
    : `/${tenantId}/chatbot/setup`
}

export function DashboardNav({
  tenantId,
  labels,
  role,
  modules,
  hasProductAccess,
  needsUpgrade,
  isTrialExpired,
  trialDaysRemaining,
  chatbotSetupCompleted,
  emailAgentPreviewEnabled,
}: {
  tenantId: string
  labels: DashboardNavLabels
  role: TenantRole
  modules: Partial<Record<TenantModuleKey, string>>
  hasProductAccess: boolean
  needsUpgrade: boolean
  isTrialExpired: boolean
  trialDaysRemaining: number | null
  chatbotSetupCompleted: boolean
  emailAgentPreviewEnabled: boolean
}) {
  const pathname = usePathname()
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const chatbotEnabled = isTenantModuleEnabled(modules.web)
  const dataEnabled = isTenantModuleEnabled(modules.data)
  const emailEnabled = isTenantModuleEnabled(modules.email)
  const whatsappEnabled = isTenantModuleEnabled(modules.whatsapp)
  const canViewConversations = hasTenantPermission(role, 'view_conversations')
  const canViewAnalytics = hasTenantPermission(role, 'view_analytics')
  const canManageChatbot = hasTenantPermission(role, 'manage_chatbot')
  const canManageKnowledge = hasTenantPermission(role, 'manage_knowledge')
  const canManageEmail = hasTenantPermission(role, 'manage_email')
  const canManageWhatsapp = hasTenantPermission(role, 'manage_whatsapp')
  const showChatbot = hasProductAccess && chatbotEnabled && (canManageChatbot || canViewConversations || (dataEnabled && canViewAnalytics))
  const showAccessibility = hasProductAccess && chatbotEnabled && canManageChatbot
  const showKnowledge = hasProductAccess && dataEnabled && canManageKnowledge
  const showEmail = emailAgentPreviewEnabled && hasProductAccess && emailEnabled && canManageEmail
  const showWhatsapp = hasProductAccess && whatsappEnabled && canViewConversations
  const showAttention = showChatbot || showEmail || showWhatsapp
  const chatbotConfigurationHref = getChatbotConfigurationHref(tenantId, chatbotSetupCompleted)
  const trialProgress = trialDaysRemaining === null
    ? 0
    : Math.max(0, Math.min(100, Math.round((trialDaysRemaining / FREE_TRIAL_DAYS) * 100)))

  return (
    <nav className="dashboard-nav" aria-label={labels.main}>
      <div className="nav-section nav-section-first nav-section-home">
        <Link
          className={`nav-link ${active(`/${tenantId}/overview`) ? 'nav-link-active' : ''}`}
          href={`/${tenantId}/overview`}
        >
          <LayoutDashboard size={14} strokeWidth={2} aria-hidden="true" />
          {labels.overview}
        </Link>
      </div>

      {showKnowledge ? (
        <CollapsibleNavSection
          storageKey={`talia:dashboard-nav:${tenantId}:intelligence`}
          label={labels.intelligence}
          isActive={active(`/${tenantId}/knowledge`)}
          expandLabel={labels.expand}
          collapseLabel={labels.collapse}
        >
          <Link
            className={`nav-link ${active(`/${tenantId}/knowledge`) ? 'nav-link-active' : ''}`}
            href={`/${tenantId}/knowledge`}
          >
            <Database size={14} strokeWidth={2} aria-hidden="true" />
            {labels.knowledge}
          </Link>
        </CollapsibleNavSection>
      ) : null}

      {showAttention ? (
        <CollapsibleNavSection
          storageKey={`talia:dashboard-nav:${tenantId}:attention`}
          label={labels.attention}
          isActive={isAttentionPath(pathname, tenantId)}
          expandLabel={labels.expand}
          collapseLabel={labels.collapse}
        >

          {showChatbot ? (
            <div className="nav-channel">
              <div className="nav-channel-title">
                <span className="nav-channel-title-main">
                  <Bot size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span>{labels.webChatbot}</span>
                </span>
                <span className="nav-channel-status">
                  {labels.active}
                </span>
              </div>
              <div className="nav-subnav">
                {canViewConversations ? (
                  <Link
                    className={`nav-link nav-link-nested ${active(`/${tenantId}/conversations`) ? 'nav-link-active' : ''}`}
                    href={`/${tenantId}/conversations`}
                  >
                    <MessageSquare size={14} strokeWidth={2} aria-hidden="true" />
                    {labels.conversations}
                  </Link>
                ) : null}
                {dataEnabled && canViewAnalytics ? (
                  <Link
                    className={`nav-link nav-link-nested ${active(`/${tenantId}/analytics`) ? 'nav-link-active' : ''}`}
                    href={`/${tenantId}/analytics`}
                  >
                    <Network size={14} strokeWidth={2} aria-hidden="true" />
                    {labels.analysis}
                  </Link>
                ) : null}
                {canManageChatbot ? (
                  <Link
                    className={`nav-link nav-link-nested ${active(chatbotConfigurationHref) ? 'nav-link-active' : ''}`}
                    href={chatbotConfigurationHref}
                  >
                    <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
                    {labels.settings}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {showEmail ? (
            <div className="nav-channel">
              <div className="nav-channel-title">
                <span className="nav-channel-title-main">
                  <Mail size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span>{labels.emailAgent}</span>
                </span>
                <span className="nav-channel-status">{labels.active}</span>
              </div>
              <div className="nav-subnav">
                <Link
                  className={`nav-link nav-link-nested ${pathname === `/${tenantId}/email` ? 'nav-link-active' : ''}`}
                  href={`/${tenantId}/email`}
                >
                  <Inbox size={14} strokeWidth={2} aria-hidden="true" />
                  {labels.inbox}
                </Link>
                <Link
                  className={`nav-link nav-link-nested ${active(`/${tenantId}/email/analysis`) ? 'nav-link-active' : ''}`}
                  href={`/${tenantId}/email/analysis`}
                >
                  <Network size={14} strokeWidth={2} aria-hidden="true" />
                  {labels.analysis}
                </Link>
              </div>
            </div>
          ) : null}

          {showWhatsapp ? (
            <div className="nav-channel">
              <div className="nav-channel-title">
                <span className="nav-channel-title-main">
                  <MessageCircle size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span>{labels.whatsappAgent}</span>
                </span>
                <span className="nav-channel-status">{labels.active}</span>
              </div>
              <div className="nav-subnav">
                <Link
                  className={`nav-link nav-link-nested ${isWhatsappConversationPath(pathname, tenantId) ? 'nav-link-active' : ''}`}
                  href={`/${tenantId}/whatsapp`}
                >
                  <MessageSquare size={14} strokeWidth={2} aria-hidden="true" />
                  {labels.conversations}
                </Link>
                {canManageWhatsapp ? (
                  <Link
                    className={`nav-link nav-link-nested ${active(`/${tenantId}/whatsapp/settings`) ? 'nav-link-active' : ''}`}
                    href={`/${tenantId}/whatsapp/settings`}
                  >
                    <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
                    {labels.settings}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

        </CollapsibleNavSection>
      ) : null}

      {showAccessibility ? (
        <CollapsibleNavSection
          storageKey={`talia:dashboard-nav:${tenantId}:accessibility`}
          label={labels.accessibility}
          isActive={active(`/${tenantId}/accessibility`)}
          expandLabel={labels.expand}
          collapseLabel={labels.collapse}
        >
          <Link
            className={`nav-link nav-link-nested ${active(`/${tenantId}/accessibility`) ? 'nav-link-active' : ''}`}
            href={`/${tenantId}/accessibility/settings`}
          >
            <WebAccessibilityIcon size={16} strokeWidth={2} aria-hidden="true" />
            {labels.settings}
            <span className="nav-channel-status">{labels.active}</span>
          </Link>
        </CollapsibleNavSection>
      ) : null}

      {needsUpgrade ? (
        <div className="nav-trial-panel">
          {isTrialExpired ? (
            <div className="nav-expired-card">
              <span>Trial finalizado</span>
              <strong>Activa un plan para continuar</strong>
            </div>
          ) : null}
          <Link
            className={`nav-upgrade-button ${active(`/${tenantId}/upgrade`) ? 'nav-upgrade-button-active' : ''}`}
            href={`/${tenantId}/upgrade`}
          >
            <Zap size={24} strokeWidth={2.4} fill="currentColor" aria-hidden="true" />
            {labels.upgrade}
          </Link>
        </div>
      ) : trialDaysRemaining !== null && trialDaysRemaining > 0 ? (
        <div className="nav-trial-panel">
          <div className="nav-trial-card">
            <strong>{labels.trialEndsIn.replace('{days}', String(trialDaysRemaining))}</strong>
            <span className="nav-trial-progress" aria-hidden="true">
              <span style={{ width: `${trialProgress}%` }} />
            </span>
          </div>
          <Link
            className={`nav-upgrade-button ${active(`/${tenantId}/upgrade`) ? 'nav-upgrade-button-active' : ''}`}
            href={`/${tenantId}/upgrade`}
          >
            <Zap size={24} strokeWidth={2.4} fill="currentColor" aria-hidden="true" />
            {labels.upgrade}
          </Link>
        </div>
      ) : null}
    </nav>
  )
}

function CollapsibleNavSection({
  children,
  className,
  collapseLabel,
  expandLabel,
  isActive,
  label,
  storageKey,
}: {
  children: ReactNode
  className?: string
  collapseLabel: string
  expandLabel: string
  isActive: boolean
  label: string
  storageKey: string
}) {
  const [isOpen, setIsOpen] = useStoredDisclosure(storageKey, isActive)
  const contentId = `${storageKey}-content`

  return (
    <section className={['nav-section', className].filter(Boolean).join(' ')}>
      <button
        className="nav-section-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-label={`${isOpen ? collapseLabel : expandLabel}: ${label}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{label}</span>
        <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
      </button>
      {isOpen ? <div id={contentId} className="nav-section-content">{children}</div> : null}
    </section>
  )
}

function useStoredDisclosure(storageKey: string, isActive: boolean) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined' || isActive) return true

    const storedValue = window.localStorage.getItem(storageKey)
    return storedValue === null || storedValue === 'true'
  })

  const updateIsOpen = (updater: (current: boolean) => boolean) => {
    setIsOpen((current) => {
      const next = updater(current)
      window.localStorage.setItem(storageKey, String(next))
      return next
    })
  }

  return [isOpen, updateIsOpen] as const
}

function isAttentionPath(pathname: string, tenantId: string) {
  return [
    `/${tenantId}/conversations`,
    `/${tenantId}/analytics`,
    `/${tenantId}/settings`,
    `/${tenantId}/chatbot/setup`,
    `/${tenantId}/email`,
    `/${tenantId}/whatsapp`,
  ].some((href) => pathname === href || pathname.startsWith(`${href}/`))
}

function isWhatsappConversationPath(pathname: string, tenantId: string) {
  const root = `/${tenantId}/whatsapp`
  return pathname === root || (pathname.startsWith(`${root}/`) && pathname !== `${root}/settings`)
}
