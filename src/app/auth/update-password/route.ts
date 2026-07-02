import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPostAuthRedirectPath } from '@/lib/auth/post-auth-redirect'
import { checkRateLimit, getClientIp, passwordSchema } from '@/lib/auth/security'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updatePasswordSchema = z.object({
  password: passwordSchema,
})

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, [
    { key: `auth-update-password:ip:${getClientIp(request)}`, limit: 10 },
  ])
  if (limited) return limited

  const payload = await request.json().catch(() => null)
  const parsed = updatePasswordSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 })
  }

  const supabase = await createClient()

  // The recovery link established a session via /auth/reset-callback. Without it
  // there is nothing to update, so we reject rather than silently no-op.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'session_expired' }, { status: 401 })
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth-update-password]', error.message)
    }

    const isSamePassword = error.message.toLowerCase().includes('should be different')
    return NextResponse.json(
      { error: isSamePassword ? 'same_password' : 'update_failed' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const redirectTo = await getPostAuthRedirectPath(admin, user.id)
  return NextResponse.json({ redirectTo })
}
