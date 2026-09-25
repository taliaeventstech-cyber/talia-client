import type { ResponseSource } from '@/lib/conversations/response-sources'
import type { ResponseSourcesCopy } from '@/lib/i18n/response-sources-copy'
import Link from 'next/link'

export function ResponseSources({
  tenantId,
  sources,
  additionalCount,
  canViewKnowledge,
  copy,
}: {
  tenantId: string
  sources: ResponseSource[]
  additionalCount: number
  canViewKnowledge: boolean
  copy: ResponseSourcesCopy
}) {
  if (!sources.length) return null

  return (
    <section className="response-sources" aria-label={copy.title}>
      <strong>{copy.title}</strong>
      <div className="response-source-list">
        {sources.map((source) => canViewKnowledge ? (
          <Link
            className="response-source-link"
            href={`/${tenantId}/knowledge?tab=${source.href}`}
            key={`${source.href}-${source.label}`}
          >
            {source.label}
          </Link>
        ) : (
          <span className="response-source-link" key={`${source.href}-${source.label}`}>
            {source.label}
          </span>
        ))}
        {additionalCount > 0 ? (
          <span className="response-source-more">{copy.more(additionalCount)}</span>
        ) : null}
      </div>
      {canViewKnowledge ? (
        <Link className="response-sources-knowledge-link" href={`/${tenantId}/knowledge`}>
          {copy.viewKnowledge}
        </Link>
      ) : null}
    </section>
  )
}
