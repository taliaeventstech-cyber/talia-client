'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type SourceTypeOption = {
  count: number
  label: string
  value: string
}

export function KnowledgeSourceTypeFilter({
  options,
  value,
}: {
  options: SourceTypeOption[]
  value: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <label className="table-page-size">
      <span>Tipo</span>
      <span className="table-page-size-select">
        <select
          aria-label="Filtrar fuentes por tipo"
          onChange={(event) => {
            const params = new URLSearchParams(searchParams.toString())
            const nextType = event.target.value
            if (nextType === 'all') params.delete('source_type')
            else params.set('source_type', nextType)
            params.set('source_page', '1')
            params.set('tab', 'knowledge')
            router.replace(`${pathname}?${params.toString()}#knowledge-web-sources`, { scroll: false })
          }}
          value={value}
        >
          <option value="all">Todos ({options.reduce((total, option) => total + option.count, 0)})</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}
