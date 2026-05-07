import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getUserVenueAccess } from '@/lib/auth/user-venues'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function AgoraPage() {
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: platformAdmin }, venues] = await Promise.all([
    admin
      .from('platform_admins')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle(),
    getUserVenueAccess(admin, user.id),
  ])

  if (platformAdmin) redirect('/backstage')
  if (venues.length === 0) redirect('/onboarding')
  if (venues.length === 1) redirect(`/${venues[0].id}/overview`)

  return (
    <main className="auth-shell auth-marketing-shell">
      <section className="auth-card venue-selector-card stack">
        <div>
          <p className="section-label">{dictionary.agora.section}</p>
          <h1>{dictionary.agora.title}</h1>
          <p className="muted">{dictionary.agora.description}</p>
        </div>

        <div className="venue-selector-list">
          {venues.map((venue) => (
            <Link key={venue.id} className="venue-selector-item" href={`/${venue.id}/overview`}>
              <span>
                <strong>{venue.name}</strong>
                <small>{venue.accountName}</small>
              </span>
              <span className="status-pill status-pill-active">
                {dictionary.account.roles[venue.role] ?? venue.role}
              </span>
            </Link>
          ))}
        </div>

        <form action="/auth/logout" method="post">
          <button className="button-outline" type="submit">
            {dictionary.common.logout}
          </button>
        </form>
      </section>
    </main>
  )
}
