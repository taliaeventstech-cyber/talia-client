'use client'

import { CONVERSATION_PAGE_SIZE_OPTIONS } from '@/lib/conversations/pagination'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function ConversationPageSizeSelect({
  value,
  label,
  ariaLabel,
}: {
  value: number
  label: string
  ariaLabel: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <label className="table-page-size">
      <span>{label}</span>
      <span className="table-page-size-select">
        <select
          aria-label={ariaLabel}
          onChange={(event) => {
            const nextPageSize = Number(event.target.value)
            if (!CONVERSATION_PAGE_SIZE_OPTIONS.includes(
              nextPageSize as (typeof CONVERSATION_PAGE_SIZE_OPTIONS)[number],
            )) return

            const params = new URLSearchParams(searchParams.toString())
            params.set('page_size', String(nextPageSize))
            params.set('page', '1')
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
          }}
          value={value}
        >
          {CONVERSATION_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}
