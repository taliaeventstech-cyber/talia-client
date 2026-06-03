'use client'

import type { Locale } from '@/lib/i18n/config'
import { setLocaleAction } from './language-toggle/actions'
import { useRouter } from 'next/navigation'
import type React from 'react'
import { useTransition } from 'react'

type AuthLanguageSelectLabels = {
  label: string
  es: string
  ca: string
  en: string
}

export function AuthLanguageSelect({
  locale,
  labels,
}: {
  locale: Locale
  labels: AuthLanguageSelectLabels
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale

    startTransition(async () => {
      await setLocaleAction(nextLocale)
      router.refresh()
    })
  }

  return (
    <label className="auth-language-select">
      <select value={locale} onChange={handleChange} disabled={pending}>
        <option value="es">{labels.es}</option>
        <option value="ca">{labels.ca}</option>
        <option value="en">{labels.en}</option>
      </select>
    </label>
  )
}
