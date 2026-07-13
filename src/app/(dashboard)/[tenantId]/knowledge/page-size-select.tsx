'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const PAGE_SIZE_OPTIONS = [5, 10, 20]

export function KnowledgePageSizeSelect({ value }: { value: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <label className="table-page-size">
      <span>Ver</span>
      <span className="table-page-size-select">
        <select
          aria-label="Entradas por página"
          onChange={(event) => {
            const nextPageSize = Number(event.target.value)
            if (!PAGE_SIZE_OPTIONS.includes(nextPageSize)) return

            const params = new URLSearchParams(searchParams.toString())
            params.set('page_size', String(nextPageSize))
            params.set('page', '1')
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
          }}
          value={value}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}
