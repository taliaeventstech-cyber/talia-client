import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthCallbackUrl } from '@/lib/auth/callback-url'
import { hashInviteToken } from '@/lib/auth/invite-token'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  inviteToken: z.string().trim().min(24),
})

export async function POST(request: NextRequest) {
  const payload = await request.json()
  const parsed = signupSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Introduce un email válido y una contraseña de al menos 8 caracteres.' },
      { status: 400 }
    )
  }

  const { password, inviteToken } = parsed.data
  const email = parsed.data.email.toLowerCase()
  const admin = createAdminClient()
  const tokenHash = hashInviteToken(inviteToken)
  const { data: invite, error: inviteError } = await admin
    .from('signup_invites')
    .select('id, account_id, theatre_id, email, role, permissions, invited_by, expires_at, accepted_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (
    inviteError ||
    !invite ||
    invite.email !== email ||
    invite.accepted_at ||
    invite.revoked_at ||
    new Date(invite.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: 'La invitación no es válida o ha caducado.' },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthCallbackUrl(request),
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const userId = data.user?.id ?? data.session?.user.id

  if (!userId) {
    return NextResponse.json(
      { error: 'No se pudo crear la cuenta con esta invitación.' },
      { status: 400 }
    )
  }

  const { error: memberError } = await admin
    .from('users')
    .upsert(
      {
        id: userId,
        theatre_id: invite.theatre_id,
        email,
        role: invite.role,
      },
      { onConflict: 'id' }
    )

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 })
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        auth_user_id: userId,
        email,
        status: 'active',
      },
      { onConflict: 'auth_user_id' }
    )
    .select('id')
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: profileError?.message ?? 'No se pudo crear el perfil de acceso.' },
      { status: 400 }
    )
  }

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

  if (accountMembershipError) {
    return NextResponse.json({ error: accountMembershipError.message }, { status: 400 })
  }

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

  if (venueMembershipError) {
    return NextResponse.json({ error: venueMembershipError.message }, { status: 400 })
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
      metadata: { email, role: invite.role },
    })

  await admin
    .from('signup_invites')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('id', invite.id)
    .is('accepted_at', null)

  if (data.session?.user) {
    return NextResponse.json({ redirectTo: `/${invite.theatre_id}/overview` })
  }

  return NextResponse.json({
    status: 'confirmation_required',
    message: 'Te hemos enviado un email de confirmación. Revisa tu bandeja de entrada antes de continuar.',
  })
}
