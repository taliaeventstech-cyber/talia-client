import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function OverviewPage({ params }: Props) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: theatre } = await supabase
    .from('theatres')
    .select('name')
    .eq('id', tenantId)
    .single()

  return (
    <main>
      <h1>{theatre?.name ?? 'Teatro'} — Overview</h1>
    </main>
  )
}
