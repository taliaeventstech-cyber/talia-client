'use client'

import type { Locale } from '@/lib/i18n/config'
import { setLocaleAction } from './language-toggle/actions'
import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'

type LanguageToggleLabels = {
  label: string
  es: string
  ca: string
}

export function LanguageToggle({ locale, labels }: { locale: Locale; labels: LanguageToggleLabels }) {
  const router = useRouter()
  const [currentLocale, setOptimisticLocale] = useOptimistic(locale)
  const [pending, startTransition] = useTransition()

  function toggleLocale() {
    const nextLocale = currentLocale === 'ca' ? 'es' : 'ca'

    startTransition(async () => {
      setOptimisticLocale(nextLocale)
      await setLocaleAction(nextLocale)
      router.refresh()
    })
  }

  return (
    <button
      className={`language-toggle language-toggle-${currentLocale}`}
      type="button"
      onClick={toggleLocale}
      aria-label={labels.label}
      aria-pressed={currentLocale === 'ca'}
      disabled={pending}
    >
      <span className={currentLocale === 'es' ? 'language-toggle-option language-toggle-option-active' : 'language-toggle-option'}>
        {labels.es}
      </span>
      <span className={currentLocale === 'ca' ? 'language-toggle-option language-toggle-option-active' : 'language-toggle-option'}>
        {labels.ca}
      </span>
    </button>
  )
}
