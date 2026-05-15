'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const PAGE_SIZE_OPTIONS = [15, 25, 50]

export function ThreadPageSizeSelect({ value }: { value: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <label className="table-page-size">
      <span>Por página</span>
      <span className="table-page-size-select">
        <select
          aria-label="Emails por página"
          onChange={(event) => {
            const nextLimit = Number(event.target.value)
            if (!PAGE_SIZE_OPTIONS.includes(nextLimit)) return

            const params = new URLSearchParams(searchParams.toString())
            params.set('thread_limit', String(nextLimit))
            params.set('thread_page', '1')
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
