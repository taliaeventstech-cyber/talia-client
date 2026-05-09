'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Mail, MessageCircle, MessageSquare, Network, SlidersHorizontal, Megaphone } from 'lucide-react'
import {
  hasTenantPermission,
  isTenantModuleEnabled,
  type TenantModuleKey,
  type TenantRole,
} from '@/lib/auth/permissions'

type DashboardNavLabels = {
  main: string
  overview: string
  attention: string
  webChatbot: string
  voiceAgent: string
  emailAgent: string
  whatsapp: string
  marketing: string
  campaigns: string
  active: string
  soon: string
  conversations: string
  analysis: string
  settings: string
}

export function DashboardNav({
  tenantId,
  labels,
  role,
  modules,
}: {
  tenantId: string
  labels: DashboardNavLabels
  role: TenantRole
  modules: Partial<Record<TenantModuleKey, string>>
}) {
  const pathname = usePathname()
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const chatbotEnabled = isTenantModuleEnabled(modules.chatbot)
  const dataEnabled = isTenantModuleEnabled(modules.data)
  const voiceEnabled = isTenantModuleEnabled(modules.voice)
  const emailEnabled = isTenantModuleEnabled(modules.email)
  const whatsappEnabled = isTenantModuleEnabled(modules.whatsapp)
  const marketingEnabled = isTenantModuleEnabled(modules.marketing)
  const canViewConversations = hasTenantPermission(role, 'view_conversations')
  const canViewAnalytics = hasTenantPermission(role, 'view_analytics')
  const canManageChatbot = hasTenantPermission(role, 'manage_chatbot')
  const canManageVoice = hasTenantPermission(role, 'manage_voice')
  const canManageEmail = hasTenantPermission(role, 'manage_email')
  const showChatbot = chatbotEnabled && (canViewConversations || canManageChatbot || (dataEnabled && canViewAnalytics))
  const showVoice = voiceEnabled && canManageVoice
  const showEmail = emailEnabled && canManageEmail
  const showAttention = showChatbot || showVoice || showEmail || whatsappEnabled
  const showMarketing = marketingEnabled

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

      {showAttention ? (
        <div className="nav-section nav-section-first">
          <p className="nav-section-label">{labels.attention}</p>

          {showChatbot ? (
            <div className="nav-channel">
              <div className="nav-channel-title">
                <span>{labels.webChatbot}</span>
                <span className="nav-channel-status">{labels.active}</span>
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
                    className={`nav-link nav-link-nested ${active(`/${tenantId}/settings`) ? 'nav-link-active' : ''}`}
                    href={`/${tenantId}/settings`}
                  >
                    <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
                    {labels.settings}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {showVoice ? (
            <div className="nav-channel">
              <div className="nav-channel-title">
                <span>{labels.voiceAgent}</span>
              </div>
              <div className="nav-subnav">
                <Link
                  className={`nav-link nav-link-nested ${active(`/${tenantId}/voice/settings`) ? 'nav-link-active' : ''}`}
                  href={`/${tenantId}/voice/settings`}
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
                <Mail size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>{labels.emailAgent}</span>
                <span className="nav-channel-status">{labels.active}</span>
              </div>
              <div className="nav-subnav">
                <Link
                  className={`nav-link nav-link-nested ${active(`/${tenantId}/email`) ? 'nav-link-active' : ''}`}
                  href={`/${tenantId}/email`}
                >
                  <Mail size={14} strokeWidth={2} aria-hidden="true" />
                  {labels.settings}
                </Link>
              </div>
            </div>
          ) : null}

          {whatsappEnabled ? (
            <div className="nav-channel nav-channel-disabled" aria-disabled="true">
              <div className="nav-channel-title">
                <MessageCircle size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>{labels.whatsapp}</span>
                <span className="nav-channel-status">{labels.soon}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showMarketing ? (
        <div className="nav-section">
          <p className="nav-section-label">{labels.marketing}</p>
          <div className="nav-channel nav-channel-disabled" aria-disabled="true">
            <div className="nav-channel-title">
              <Megaphone size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>{labels.campaigns}</span>
              <span className="nav-channel-status">{labels.soon}</span>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  )
}
