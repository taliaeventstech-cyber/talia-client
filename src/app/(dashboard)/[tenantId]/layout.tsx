import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardNav } from '@/components/dashboard-nav'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import Image from 'next/image'
import { redirect } from 'next/navigation'

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

  const admin = createAdminClient()

  // Verificar que el usuario pertenece a este teatro
  const { data: membership } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .eq('theatre_id', tenantId)
    .single()

  if (!membership) redirect('/login')

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
          <span className="dashboard-brand-name">Agora</span>
        </div>
        <DashboardNav
          tenantId={tenantId}
          labels={{
            main: dictionary.nav.main,
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
      </aside>

      <header className="dashboard-topbar">
       
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LanguageToggle locale={locale} dictionary={dictionary} />
          <ThemeToggle />
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
