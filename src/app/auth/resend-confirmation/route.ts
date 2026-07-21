import { getAuthCallbackUrl } from '@/lib/auth/callback-url'
import { checkRateLimit, getClientIp, normalizeEmail } from '@/lib/auth/security'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const resendSchema = z.object({
  email: z.string().trim().email(),
})

export async function POST(request: NextRequest) {
  const payload = await request.json()
  const parsed = resendSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_email' },
      { status: 400 }
    )
  }

  const email = normalizeEmail(parsed.data.email)
  const limited = await checkRateLimit(request, [
    { key: `auth-resend:ip:${getClientIp(request)}`, limit: 5 },
    { key: `auth-resend:email:${email}`, limit: 2 },
  ])
  if (limited) return limited

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(request),
    },
  })

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth-resend-confirmation]', error.message)
    }

    const isProviderRateLimit = error.message.toLowerCase().includes('rate limit')

    return NextResponse.json(
      { error: isProviderRateLimit ? 'email_rate_limited' : 'resend_failed' },
      { status: isProviderRateLimit ? 429 : 400 }
    )
  }

  return NextResponse.json({
    message: 'Hemos reenviado el email de confirmación. Si no aparece, revisa spam o promociones.',
  })
}
