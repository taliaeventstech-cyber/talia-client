import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard-nav'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getTenantAccess } from '@/lib/auth/tenant-access'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UserRound } from 'lucide-react'

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
          labels={{
            main: dictionary.nav.main,
            overview: dictionary.nav.overview,
            attention: dictionary.nav.attention,
            webChatbot: dictionary.nav.webChatbot,
            voiceAgent: dictionary.nav.voiceAgent,
            emailAgent: dictionary.nav.emailAgent,
            whatsapp: dictionary.nav.whatsapp,
            marketing: dictionary.nav.marketing,
            campaigns: dictionary.nav.campaigns,
            active: dictionary.common.active,
            soon: dictionary.common.soon,
            conversations: dictionary.common.conversations,
            analysis: dictionary.common.analysis,
            settings: dictionary.common.settings,
          }}
        />
        <div className="dashboard-sidebar-footer">
          <LanguageToggle
            locale={locale}
            labels={{
              label: dictionary.language.label,
              es: dictionary.language.es,
              ca: dictionary.language.ca,
            }}
          />
          <ThemeToggle />
        </div>
      </aside>

      <header className="dashboard-topbar">
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
    </div>
  )
}
