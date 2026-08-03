'use client'

import type { Locale } from './config'

export async function persistLocale(locale: Locale) {
  const response = await fetch('/api/locale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  })

  if (!response.ok) throw new Error('locale_update_failed')
  window.location.reload()
}
