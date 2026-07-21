import { createClient } from '@/lib/supabase/server'
import { getAuthCallbackUrl } from '@/lib/auth/callback-url'
import { checkRateLimit, getClientIp, normalizeEmail } from '@/lib/auth/security'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

// The endpoint always answers neutrally (ok: true), regardless of whether the
// email exists or the send failed, so it never reveals which addresses are registered.
export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  const parsed = forgotPasswordSchema.safeParse(payload)

  // Invalid email is still answered neutrally to avoid enumeration.
  if (!parsed.success) return NextResponse.json({ ok: true })

  const email = normalizeEmail(parsed.data.email)
  const limited = await checkRateLimit(request, [
    { key: `auth-forgot:ip:${getClientIp(request)}`, limit: 8 },
    { key: `auth-forgot:email:${email}`, limit: 3 },
  ])
  if (limited) return limited

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthCallbackUrl(request, '/auth/reset-callback'),
  })

  if (error && process.env.NODE_ENV !== 'production') {
    console.warn('[auth-forgot-password]', error.message)
  }

  return NextResponse.json({ ok: true })
}
