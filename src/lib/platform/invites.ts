import { randomBytes } from 'crypto'
import { hashInviteToken } from '@/lib/auth/invite-token'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export function createInviteToken() {
  return randomBytes(32).toString('base64url')
}

export async function createSignupInvite(
  admin: AdminClient,
  input: {
    theatreId: string
    email: string
    role: 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'
    invitedBy: string
  }
) {
  const token = createInviteToken()
  const tokenHash = hashInviteToken(token)
  const email = input.email.trim().toLowerCase()

  const { data, error } = await admin
    .from('signup_invites')
    .insert({
      theatre_id: input.theatreId,
      email,
      role: input.role,
      invited_by: input.invitedBy,
      token_hash: tokenHash,
    })
    .select('id, expires_at')
    .single()

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? 'Could not create invite' }
  }

  return {
    ok: true as const,
    inviteId: data.id,
    expiresAt: data.expires_at,
    token,
  }
}
