import type { createAdminClient } from '@/lib/supabase/admin'
import type { TenantRole } from './permissions'

type AdminClient = ReturnType<typeof createAdminClient>

export type UserVenueAccess = {
  id: string
  name: string
  slug: string
  accountId: string
  accountName: string
  accountSlug: string
  role: TenantRole
}

type VenueRole = {
  theatreId: string
  role: TenantRole
}

export async function getUserVenueAccess(admin: AdminClient, userId: string) {
  const venueRoles = new Map<string, TenantRole>()

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (profile) {
    const { data: venueMemberships } = await admin
      .from('venue_memberships')
      .select('theatre_id, role')
      .eq('profile_id', profile.id)
      .is('revoked_at', null)

    ;(venueMemberships ?? []).forEach((membership) => {
      venueRoles.set(membership.theatre_id, membership.role)
    })
  }

  const { data: legacyMemberships } = await admin
    .from('users')
    .select('theatre_id, role')
    .eq('id', userId)

  ;(legacyMemberships ?? []).forEach((membership) => {
    if (!venueRoles.has(membership.theatre_id)) {
      venueRoles.set(membership.theatre_id, membership.role)
    }
  })

  return hydrateVenueAccess(admin, Array.from(venueRoles.entries()).map(([theatreId, role]) => ({ theatreId, role })))
}

async function hydrateVenueAccess(admin: AdminClient, venueRoles: VenueRole[]) {
  const theatreIds = venueRoles.map((venue) => venue.theatreId)
  if (!theatreIds.length) return []

  const { data: theatres } = await admin
    .from('theatres')
    .select('id, name, slug, account_id')
    .in('id', theatreIds)
    .order('name', { ascending: true })

  const accountIds = Array.from(new Set((theatres ?? []).map((theatre) => theatre.account_id)))
  const { data: accounts } = accountIds.length
    ? await admin
      .from('accounts')
      .select('id, name, slug')
      .in('id', accountIds)
    : { data: [] }

  const roleByTheatre = new Map(venueRoles.map((venue) => [venue.theatreId, venue.role]))
  const accountById = new Map((accounts ?? []).map((account) => [account.id, account]))

  return (theatres ?? []).map((theatre) => {
    const account = accountById.get(theatre.account_id)

    return {
      id: theatre.id,
      name: theatre.name,
      slug: theatre.slug,
      accountId: theatre.account_id,
      accountName: account?.name ?? theatre.name,
      accountSlug: account?.slug ?? theatre.slug,
      role: roleByTheatre.get(theatre.id) ?? 'viewer',
    } satisfies UserVenueAccess
  })
}
