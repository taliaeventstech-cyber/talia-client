import { createClient } from '@/lib/supabase/server'
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

  // Verificar que el usuario pertenece a este teatro
  const { data: membership } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .eq('theatre_id', tenantId)
    .single()

  if (!membership) redirect('/login')

  return <>{children}</>
}
