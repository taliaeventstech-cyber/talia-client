import { requirePlatformAdmin } from '@/lib/platform/auth'
import Link from 'next/link'

export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin()

  return (
    <main className="auth-shell internal-shell">
      <section className="auth-card internal-card stack">
        <header className="internal-header">
          <div>
            <p className="section-label">Talía backstage</p>
            <h1>Backstage</h1>
          </div>
          <nav className="internal-nav" aria-label="Backstage">
            <Link className="link-accent" href="/backstage">Clientes</Link>
          </nav>
        </header>
        {children}
      </section>
    </main>
  )
}
