'use client'

import { useSyncExternalStore } from 'react'
import { formatDateTime } from '@/lib/i18n/date-time'

const subscribeToTimeZone = () => () => {}

export function LocalDateTime({
  value,
  locale,
  dateOnly = false,
}: {
  value: string
  locale: string
  dateOnly?: boolean
}) {
  const utcLabel = formatDateTime(value, locale, 'UTC', dateOnly)
  const label = useSyncExternalStore(
    subscribeToTimeZone,
    () => formatDateTime(value, locale, undefined, dateOnly),
    () => utcLabel,
  )

  const parsed = new Date(value)
  const dateTime = Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()

  return <time dateTime={dateTime}>{label}</time>
}
