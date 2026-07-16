'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50]

export function BackstagePageSizeSelect({
  value,
  pageParam = 'page',
  pageSizeParam = 'page_size',
  anchor = 'accounts',
  ariaLabel = 'Clientes por página',
  options = DEFAULT_PAGE_SIZE_OPTIONS,
}: {
  value: number
  pageParam?: string
  pageSizeParam?: string
  anchor?: string
  ariaLabel?: string
  options?: readonly number[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <label className="table-page-size">
      <span>Ver</span>
      <span className="table-page-size-select">
        <select
          aria-label={ariaLabel}
          onChange={(event) => {
            const nextPageSize = Number(event.target.value)
            if (!options.includes(nextPageSize)) return

            const params = new URLSearchParams(searchParams.toString())
            params.set(pageSizeParam, String(nextPageSize))
            params.set(pageParam, '1')
            router.replace(`${pathname}?${params.toString()}${anchor ? `#${anchor}` : ''}`, { scroll: false })
          }}
          value={value}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}
