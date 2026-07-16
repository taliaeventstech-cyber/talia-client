import { hashInviteToken } from '@/lib/auth/invite-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function redirectToInvite(request: NextRequest, token: string, error?: string) {
  const suffix = error ? `?error=${encodeURIComponent(error)}` : ''
  return NextResponse.redirect(new URL(`/invite/${encodeURIComponent(token)}${suffix}`, request.url), {
    status: 303,
  })
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const token = String(formData.get('token') ?? '')

  if (!token) return NextResponse.redirect(new URL('/login', request.url), { status: 303 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(`/invite/${token}`)}`, request.url),
      { status: 303 }
    )
  }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('signup_invites')
    .select('id, account_id, theatre_id, email, role, permissions, invited_by, expires_at, accepted_at, revoked_at')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle()

  const userEmail = user.email?.toLowerCase()
  const invalidInvite = !invite ||
    invite.accepted_at ||
    invite.revoked_at ||
    new Date(invite.expires_at).getTime() < Date.now()

  if (invalidInvite) return redirectToInvite(request, token, 'invalid')
  if (!userEmail || invite.email !== userEmail) return redirectToInvite(request, token, 'email')

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        auth_user_id: user.id,
        email: userEmail,
        status: 'active',
      },
      { onConflict: 'auth_user_id' }
    )
    .select('id')
    .single()

  if (profileError || !profile) return redirectToInvite(request, token, 'profile')

  const accountRole = invite.role === 'owner' ? 'owner' : invite.role === 'admin' ? 'admin' : 'viewer'
  const permissions = Array.isArray(invite.permissions) ? invite.permissions : []

  const { error: accountMembershipError } = await admin
    .from('account_memberships')
    .upsert(
      {
        account_id: invite.account_id,
        profile_id: profile.id,
        role: accountRole,
        permissions,
        invited_by: invite.invited_by,
        revoked_at: null,
      },
      { onConflict: 'account_id,profile_id' }
    )

  if (accountMembershipError) return redirectToInvite(request, token, 'account')

  if (invite.theatre_id) {
    const { error: venueMembershipError } = await admin
      .from('venue_memberships')
      .upsert(
        {
          theatre_id: invite.theatre_id,
          profile_id: profile.id,
          role: invite.role,
          permissions,
          invited_by: invite.invited_by,
          revoked_at: null,
        },
        { onConflict: 'theatre_id,profile_id' }
      )

    if (venueMembershipError) return redirectToInvite(request, token, 'venue')
  }

  await admin
    .from('audit_events')
    .insert({
      account_id: invite.account_id,
      theatre_id: invite.theatre_id,
      actor_user_id: invite.invited_by,
      action: 'signup_invite.accepted',
      target_type: 'profile',
      target_id: profile.id,
      metadata: { email: userEmail, role: invite.role },
    })

  await admin
    .from('signup_invites')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq('id', invite.id)
    .is('accepted_at', null)

  const destination = invite.theatre_id ? `/${invite.theatre_id}/overview` : `/accounts/${invite.account_id}`
  return NextResponse.redirect(new URL(destination, request.url), { status: 303 })
}
