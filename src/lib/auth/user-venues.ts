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
    const [{ data: venueMemberships }, { data: accountMemberships }] = await Promise.all([
      admin
        .from('venue_memberships')
        .select('theatre_id, role')
        .eq('profile_id', profile.id)
        .is('revoked_at', null),
      admin
        .from('account_memberships')
        .select('account_id, role')
        .eq('profile_id', profile.id)
        .is('revoked_at', null),
    ])

    ;(venueMemberships ?? []).forEach((membership) => {
      venueRoles.set(membership.theatre_id, membership.role)
    })

    const accountIds = (accountMemberships ?? []).map((membership) => membership.account_id)
    const { data: accountVenues } = accountIds.length
      ? await admin
        .from('theatres')
        .select('id, account_id')
        .in('account_id', accountIds)
      : { data: [] }

    ;(accountVenues ?? []).forEach((venue) => {
      if (venueRoles.has(venue.id)) return

      const accountMembership = (accountMemberships ?? []).find((membership) => membership.account_id === venue.account_id)
      venueRoles.set(venue.id, mapAccountRoleToVenueRole(accountMembership?.role))
    })
  }

  return hydrateVenueAccess(admin, Array.from(venueRoles.entries()).map(([theatreId, role]) => ({ theatreId, role })))
}

function mapAccountRoleToVenueRole(role: string | null | undefined): TenantRole {
  if (role === 'owner') return 'owner'
  if (role === 'admin') return 'admin'
  return 'viewer'
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
