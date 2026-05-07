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
    accountId?: string
    theatreId?: string
    email: string
    role: 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'
    invitedBy: string
  }
) {
  const token = createInviteToken()
  const tokenHash = hashInviteToken(token)
  const email = input.email.trim().toLowerCase()

  const { data: theatre } = input.theatreId
    ? await admin
      .from('theatres')
      .select('account_id')
      .eq('id', input.theatreId)
      .single()
    : { data: null }

  const accountId = input.accountId ?? theatre?.account_id

  if (!accountId) {
    return { ok: false as const, error: 'The invite must be linked to an account or venue' }
  }

  const { data, error } = await admin
    .from('signup_invites')
    .insert({
      account_id: accountId,
      theatre_id: input.theatreId || null,
      email,
      role: input.role,
      invited_by: input.invitedBy,
      token_hash: tokenHash,
    } as never)
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
