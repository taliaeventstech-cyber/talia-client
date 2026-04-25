import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function AnalyticsPage({ params }: Props) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: analytics } = await supabase
    .from('analytics_daily')
    .select('date, total_conversations, total_messages, avg_messages_per_conversation')
    .eq('theatre_id', tenantId)
    .order('date', { ascending: false })
    .limit(30)

  return (
    <main>
      <h1>Analytics</h1>
      <pre>{JSON.stringify(analytics?.slice(0, 3), null, 2)}</pre>
    </main>
  )
}
