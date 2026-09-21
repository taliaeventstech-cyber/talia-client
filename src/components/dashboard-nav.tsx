'use client'

import { useCallback, useSyncExternalStore, type ReactNode, type SVGProps } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, ChevronDown, Database, Inbox, LayoutDashboard, Mail, MessageSquare, Network, SlidersHorizontal, Zap } from 'lucide-react'
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

function WhatsAppIcon({
  size = 14,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M20.52 3.45A11.86 11.86 0 0 0 12.08 0C5.52 0 .18 5.34.18 11.9c0 2.1.55 4.15 1.6 5.95L.08 24l6.31-1.66a11.91 11.91 0 0 0 5.69 1.45h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.47-8.39ZM12.09 21.78a9.86 9.86 0 0 1-5.03-1.38l-.36-.22-3.75.99 1-3.65-.24-.37a9.85 9.85 0 0 1-1.52-5.25c0-5.44 4.43-9.87 9.88-9.87 2.64 0 5.12 1.03 6.98 2.89a9.8 9.8 0 0 1 2.89 6.98c0 5.45-4.43 9.88-9.87 9.88Zm5.41-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.16c-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.07c.15.2 2.09 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  )
}

function InstagramIcon({
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
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r=".75" fill="currentColor" stroke="none" />
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
  instagramAgent: string
  inbox: string
  intelligence: string
  knowledge: string
  active: string
  pilot: string
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
  const instagramEnabled = isTenantModuleEnabled(modules.instagram)
  const canViewConversations = hasTenantPermission(role, 'view_conversations')
  const canViewAnalytics = hasTenantPermission(role, 'view_analytics')
  const canManageChatbot = hasTenantPermission(role, 'manage_chatbot')
  const canManageKnowledge = hasTenantPermission(role, 'manage_knowledge')
  const canManageEmail = hasTenantPermission(role, 'manage_email')
  const canManageWhatsapp = hasTenantPermission(role, 'manage_whatsapp')
  const canManageInstagram = hasTenantPermission(role, 'manage_instagram')
  const showChatbot = hasProductAccess && chatbotEnabled && (canManageChatbot || canViewConversations || (dataEnabled && canViewAnalytics))
  const showAccessibility = hasProductAccess && chatbotEnabled && canManageChatbot
  const showKnowledge = hasProductAccess && dataEnabled && canManageKnowledge
  const showEmail = emailAgentPreviewEnabled && hasProductAccess && emailEnabled && canManageEmail
  const showWhatsapp = hasProductAccess && whatsappEnabled && canViewConversations
  const showInstagram = hasProductAccess && instagramEnabled && canManageInstagram
  const showAttention = showChatbot || showEmail || showWhatsapp || showInstagram
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
            <CollapsibleNavAgent
              storageKey={`talia:dashboard-nav:${tenantId}:web-agent`}
              label={labels.webChatbot}
              icon={<Bot size={14} strokeWidth={2} aria-hidden="true" />}
              status={labels.active}
              isActive={active(`/${tenantId}/conversations`) || active(`/${tenantId}/analytics`) || active(chatbotConfigurationHref)}
              expandLabel={labels.expand}
              collapseLabel={labels.collapse}
            >
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
            </CollapsibleNavAgent>
          ) : null}

          {showEmail ? (
            <CollapsibleNavAgent
              storageKey={`talia:dashboard-nav:${tenantId}:email-agent`}
              label={labels.emailAgent}
              icon={<Mail size={14} strokeWidth={2} aria-hidden="true" />}
              status={labels.active}
              isActive={active(`/${tenantId}/email`)}
              expandLabel={labels.expand}
              collapseLabel={labels.collapse}
            >
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
            </CollapsibleNavAgent>
          ) : null}

          {showWhatsapp ? (
            <CollapsibleNavAgent
              storageKey={`talia:dashboard-nav:${tenantId}:whatsapp-agent`}
              label={labels.whatsappAgent}
              icon={<WhatsAppIcon size={14} aria-hidden="true" />}
              status={labels.active}
              isActive={isWhatsappConversationPath(pathname, tenantId) || active(`/${tenantId}/whatsapp/settings`)}
              expandLabel={labels.expand}
              collapseLabel={labels.collapse}
            >
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
            </CollapsibleNavAgent>
          ) : null}

          {showInstagram ? (
            <CollapsibleNavAgent
              storageKey={`talia:dashboard-nav:${tenantId}:instagram-agent`}
              label={labels.instagramAgent}
              icon={<InstagramIcon size={14} strokeWidth={2} aria-hidden="true" />}
              status={labels.pilot}
              isActive={active(`/${tenantId}/instagram/settings`)}
              expandLabel={labels.expand}
              collapseLabel={labels.collapse}
            >
              <Link
                className={`nav-link nav-link-nested ${active(`/${tenantId}/instagram/settings`) ? 'nav-link-active' : ''}`}
                href={`/${tenantId}/instagram/settings`}
              >
                <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
                {labels.settings}
              </Link>
            </CollapsibleNavAgent>
          ) : null}
        </div>
      ) : null}

      {showAccessibility ? (
        <div className="nav-section">
          <p className="nav-section-label">{labels.accessibility}</p>
          <Link
            className={`nav-link ${active(`/${tenantId}/accessibility`) ? 'nav-link-active' : ''}`}
            href={`/${tenantId}/accessibility/settings`}
          >
            <WebAccessibilityIcon size={16} strokeWidth={2} aria-hidden="true" />
            {labels.settings}
            <span className="nav-channel-status">{labels.active}</span>
          </Link>
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

function CollapsibleNavAgent({
  children,
  collapseLabel,
  expandLabel,
  icon,
  isActive,
  label,
  status,
  storageKey,
}: {
  children: ReactNode
  collapseLabel: string
  expandLabel: string
  icon: ReactNode
  isActive: boolean
  label: string
  status: string
  storageKey: string
}) {
  const [isOpen, setIsOpen] = useStoredDisclosure(storageKey, isActive)
  const contentId = `${storageKey}-content`

  return (
    <div className="nav-channel">
      <button
        className="nav-channel-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-label={`${isOpen ? collapseLabel : expandLabel}: ${label}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="nav-channel-title-main">
          {icon}
          <span>{label}</span>
        </span>
        <span className="nav-channel-toggle-actions">
          <span className="nav-channel-status">{status}</span>
          <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
        </span>
      </button>
      {isOpen ? <div id={contentId} className="nav-subnav">{children}</div> : null}
    </div>
  )
}

function useStoredDisclosure(storageKey: string, isActive: boolean) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      storedDisclosureMemory.delete(storageKey)
      onStoreChange()
    }
    const handleLocalChange = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail !== storageKey) return
      onStoreChange()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(STORED_DISCLOSURE_EVENT, handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(STORED_DISCLOSURE_EVENT, handleLocalChange)
    }
  }, [storageKey])
  const getSnapshot = useCallback(() => {
    if (isActive) return true
    const inMemoryValue = storedDisclosureMemory.get(storageKey)
    if (inMemoryValue !== undefined) return inMemoryValue
    try {
      const storedValue = window.localStorage.getItem(storageKey)
      return storedValue === null || storedValue === 'true'
    } catch {
      return true
    }
  }, [isActive, storageKey])
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, () => true)

  const updateIsOpen = (updater: (current: boolean) => boolean) => {
    const next = updater(isOpen)
    storedDisclosureMemory.set(storageKey, next)
    try {
      window.localStorage.setItem(storageKey, String(next))
    } catch {
      // The in-memory value keeps the disclosure usable without browser storage.
    }
    window.dispatchEvent(new CustomEvent(STORED_DISCLOSURE_EVENT, { detail: storageKey }))
  }

  return [isOpen, updateIsOpen] as const
}

const STORED_DISCLOSURE_EVENT = 'talia:stored-disclosure-change'
const storedDisclosureMemory = new Map<string, boolean>()

function isWhatsappConversationPath(pathname: string, tenantId: string) {
  const root = `/${tenantId}/whatsapp`
  return pathname === root || (pathname.startsWith(`${root}/`) && pathname !== `${root}/settings`)
}
