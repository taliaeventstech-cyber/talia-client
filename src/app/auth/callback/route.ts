import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/login?error=no_code`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const { data: member } = await supabase
    .from('users')
    .select('theatre_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.redirect(`${origin}/onboarding`)

  return NextResponse.redirect(`${origin}/${member.theatre_id}/overview`)
}
