'use client'

import type { SVGProps } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Database, Inbox, LayoutDashboard, Mail, MessageCircle, MessageSquare, Network, SlidersHorizontal, Zap } from 'lucide-react'
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
  const showChatbot = hasProductAccess && chatbotEnabled && (canManageChatbot || canViewConversations || (dataEnabled && canViewAnalytics))
  const showAccessibility = hasProductAccess && chatbotEnabled && canManageChatbot
  const showKnowledge = hasProductAccess && dataEnabled && canManageKnowledge
  const showEmail = emailAgentPreviewEnabled && hasProductAccess && emailEnabled && canManageEmail
  const showWhatsapp = hasProductAccess && whatsappEnabled && canViewConversations
  const showAttention = showChatbot || showAccessibility || showEmail || showWhatsapp
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
        <div className="nav-section">
          <p className="nav-section-label">{labels.intelligence}</p>
          <Link
            className={`nav-link ${active(`/${tenantId}/knowledge`) ? 'nav-link-active' : ''}`}
            href={`/${tenantId}/knowledge`}
          >
            <Database size={14} strokeWidth={2} aria-hidden="true" />
            {labels.knowledge}
          </Link>
        </div>
      ) : null}

      {showAttention ? (
        <div className="nav-section nav-section-first">
          <p className="nav-section-label">{labels.attention}</p>

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

          {showAccessibility ? (
            <div className="nav-channel">
              <div className="nav-channel-title">
                <span className="nav-channel-title-main">
                  <WebAccessibilityIcon size={16} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span>{labels.accessibility}</span>
                </span>
                <span className="nav-channel-status">
                  {labels.active}
                </span>
              </div>
              <div className="nav-subnav">
                <Link
                  className={`nav-link nav-link-nested ${active(`/${tenantId}/accessibility`) ? 'nav-link-active' : ''}`}
                  href={`/${tenantId}/accessibility/settings`}
                >
                  <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
                  {labels.settings}
                </Link>
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
                  className={`nav-link nav-link-nested ${active(`/${tenantId}/whatsapp`) ? 'nav-link-active' : ''}`}
                  href={`/${tenantId}/whatsapp`}
                >
                  <MessageSquare size={14} strokeWidth={2} aria-hidden="true" />
                  {labels.conversations}
                </Link>
              </div>
            </div>
          ) : null}

        </div>
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
