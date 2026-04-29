import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('users')
    .select('theatre_id')
    .eq('id', data.user.id)
    .maybeSingle()

  return NextResponse.json({ redirectTo: member ? `/${member.theatre_id}/overview` : '/onboarding' })
}
