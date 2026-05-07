import { requirePlatformAdmin } from '@/lib/platform/auth'

export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin()

  return (
    <main className="auth-shell internal-shell">
      <section className="auth-card internal-card stack">
        <header className="internal-header">
          <div>
            <p className="section-label">TALIA</p>
            <h1>Backstage</h1>
          </div>
          <nav className="internal-nav" aria-label="Backstage">
            <form action="/auth/logout" method="post">
              <button className="button-outline" type="submit">
                Cerrar sesión
              </button>
            </form>
          </nav>
        </header>
        {children}
      </section>
    </main>
  )
}
