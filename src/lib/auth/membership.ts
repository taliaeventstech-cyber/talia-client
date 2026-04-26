import { createAdminClient } from '@/lib/supabase/admin'

const FALLBACK_THEATRE_ID = '00000000-0000-0000-0000-000000000001'

type Membership = {
  theatre_id: string
}

export async function ensureUserMembership(user: { id: string; email?: string | null }) {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('users')
    .select('theatre_id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) return existing

  const theatreId = await getDefaultTheatreId()

  const { data: membership, error } = await admin
    .from('users')
    .upsert(
      {
        id: user.id,
        theatre_id: theatreId,
        email: user.email ?? '',
        role: 'admin',
      },
      { onConflict: 'id' }
    )
    .select('theatre_id')
    .single()

  if (error) {
    console.error('Failed to create user membership', error)
    return null
  }

  return membership satisfies Membership
}

async function getDefaultTheatreId() {
  const configuredTheatreId = process.env.DEFAULT_THEATRE_ID
  if (configuredTheatreId) return configuredTheatreId

  const admin = createAdminClient()
  const { data: theatre } = await admin
    .from('theatres')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (theatre) return theatre.id

  const { data: created, error } = await admin
    .from('theatres')
    .insert({
      id: FALLBACK_THEATRE_ID,
      name: 'Teatro Demo',
      slug: 'teatro-demo',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create default theatre', error)
    return FALLBACK_THEATRE_ID
  }

  return created.id
}
