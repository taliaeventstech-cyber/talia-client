import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
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
    <>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem 2rem', borderBottom: '1px solid #222', fontFamily: 'sans-serif' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.95rem' }}>
          <Link href={`/${tenantId}/overview`}>Overview</Link>
          <Link href={`/${tenantId}/conversations`}>Conversaciones</Link>
          <Link href={`/${tenantId}/analytics`}>Analytics</Link>
          <Link href={`/${tenantId}/settings`}>Settings</Link>
        </nav>

        <form action="/auth/logout" method="post">
          <button type="submit" style={{ border: '1px solid #555', borderRadius: 6, background: 'transparent', color: 'inherit', padding: '0.45rem 0.75rem', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </form>
      </header>
      {children}
    </>
  )
}
