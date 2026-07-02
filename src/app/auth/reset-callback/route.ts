import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Recovery links land here: exchange the code for a session, then send the user
// straight to the update-password form (skipping the "email confirmed" screen).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/forgot-password?error=recovery_link_invalid`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/forgot-password?error=recovery_link_invalid`)

  return NextResponse.redirect(`${origin}/reset-password`)
}
