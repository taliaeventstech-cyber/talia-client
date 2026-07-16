import { requirePlatformAdmin } from '@/lib/platform/auth'
import { LogOut, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { BackstageNavigation } from './backstage-navigation'

export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin()

  return (
    <div className="auth-shell backstage-shell">
      <aside className="backstage-sidebar">
        <Link className="backstage-brand" href="/backstage" aria-label="TALIA Backstage">
          <span className="backstage-brand-mark">T</span>
          <span>
            <strong>TALIA</strong>
            <small>Backstage</small>
          </span>
        </Link>

        <BackstageNavigation />

        <div className="backstage-sidebar-footer">
          <div className="backstage-admin-badge">
            <ShieldCheck aria-hidden="true" size={17} strokeWidth={2} />
            <span>Acceso de plataforma</span>
          </div>
          <form action="/auth/logout" method="post">
            <button className="backstage-navigation-link" type="submit">
              <LogOut aria-hidden="true" size={18} strokeWidth={2} />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="backstage-main">
        <div className="backstage-content">{children}</div>
      </main>
    </div>
  )
}
