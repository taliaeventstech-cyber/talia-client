import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard-nav'
import { TrialExpiredModal } from '@/components/trial-expired-modal'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getTenantAccess } from '@/lib/auth/tenant-access'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { hasEmailAgentPreviewAccess } from '@/lib/email/legacy-access'

interface Props {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}

export default async function DashboardLayout({ children, params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getTenantAccess(tenantId)
  const billingAccess = access.billingAccess
  const emailAgentPreviewEnabled = await hasEmailAgentPreviewAccess(tenantId, user.email)

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <Image
            src="/talia-logo-marble.png"
            alt="Talía"
            width={552}
            height={151}
            className="dashboard-logo"
            priority
          />
          <span className="dashboard-brand-name">Àgora</span>
        </div>
        <DashboardNav
          tenantId={tenantId}
          role={access.role}
          modules={access.modules}
          hasProductAccess={billingAccess.hasProductAccess}
          needsUpgrade={billingAccess.needsUpgrade}
          isTrialExpired={billingAccess.isTrialExpired}
          trialDaysRemaining={billingAccess.isTrialing ? billingAccess.trialDaysRemaining : null}
          chatbotSetupCompleted={access.chatbotSetupCompleted}
          emailAgentPreviewEnabled={emailAgentPreviewEnabled}
          labels={{
            main: dictionary.nav.main,
            overview: dictionary.nav.overview,
            attention: dictionary.nav.attention,
            webChatbot: dictionary.nav.webChatbot,
            accessibility: dictionary.nav.accessibility,
            emailAgent: dictionary.nav.emailAgent,
            whatsappAgent: dictionary.nav.whatsappAgent,
            inbox: dictionary.nav.inbox,
            intelligence: dictionary.nav.intelligence,
            knowledge: dictionary.nav.knowledge,
            active: dictionary.common.active,
            conversations: dictionary.common.conversations,
            analysis: dictionary.common.analysis,
            settings: dictionary.common.settings,
            upgrade: dictionary.nav.upgrade,
            trialEndsIn: dictionary.nav.trialEndsIn,
            expand: dictionary.nav.expand,
            collapse: dictionary.nav.collapse,
          }}
        />
        <div className="dashboard-sidebar-footer">
          <LanguageToggle
            locale={locale}
            menuPlacement="top"
            labels={{
              label: dictionary.language.label,
              es: dictionary.language.es,
              ca: dictionary.language.ca,
              en: dictionary.language.en,
              ptBR: dictionary.language.ptBR,
            }}
          />
          <ThemeToggle />
        </div>
      </aside>

      <header className="dashboard-topbar">
        {billingAccess.isTrialExpired ? (
          <Link className="dashboard-trial-banner" href={`/${tenantId}/upgrade`}>
            <strong>{dictionary.trialExpired.bannerTitle}</strong>
            <span>{dictionary.trialExpired.bannerAction}</span>
          </Link>
        ) : null}
        <div className="dashboard-topbar-actions">
          <Link className="icon-button" href={access.source === 'platform' ? '/backstage' : `/${tenantId}/account`} aria-label="Área de usuario">
            <UserRound size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <form action="/auth/logout" method="post">
            <button className="button-outline" type="submit">
              {dictionary.common.logout}
            </button>
          </form>
        </div>
      </header>

      <div className="dashboard-main">{children}</div>
      {billingAccess.isTrialExpired ? (
        <TrialExpiredModal
          tenantId={tenantId}
          labels={dictionary.trialExpired}
        />
      ) : null}
    </div>
  )
}
