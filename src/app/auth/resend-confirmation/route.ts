import { getAuthCallbackUrl } from '@/lib/auth/callback-url'
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
      { error: 'Introduce un email válido.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(request),
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: 'Hemos reenviado el email de confirmación. Si no aparece, revisa spam o promociones.',
  })
}
