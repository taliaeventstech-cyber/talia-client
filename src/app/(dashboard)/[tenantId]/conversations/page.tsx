import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function ConversationsPage({ params }: Props) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, session_id, started_at, message_count')
    .eq('theatre_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(50)

  return (
    <main>
      <h1>Conversaciones</h1>
      <p>{conversations?.length ?? 0} conversaciones</p>
    </main>
  )
}
