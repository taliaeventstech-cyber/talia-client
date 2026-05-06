export default function TenantLoading() {
  return (
    <main className="page-shell">
      <header className="page-header">
        <div className="skeleton skeleton-kicker" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
      </header>

      <div className="kpi-row">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="kpi-card skeleton-card" key={index}>
            <div className="skeleton skeleton-label" />
            <div className="skeleton skeleton-value" />
          </div>
        ))}
      </div>

      <section className="card stack">
        <div className="skeleton skeleton-section-title" />
        <div className="overview-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="module-status-card skeleton-card" key={index}>
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line skeleton-short" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
