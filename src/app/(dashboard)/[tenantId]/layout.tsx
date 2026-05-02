import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardNav } from '@/components/dashboard-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import Image from 'next/image'
import { redirect } from 'next/navigation'

interface Props {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}

export default async function DashboardLayout({ children, params }: Props) {
  const { tenantId } = await params
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
        
        </div>
        <DashboardNav tenantId={tenantId} />
      </aside>

      <header className="dashboard-topbar">
       
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
          <form action="/auth/logout" method="post">
            <button className="button-outline" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <div className="dashboard-main">{children}</div>
    </div>
  )
}
