'use client'

import type { Locale } from '@/lib/i18n/config'
import { setLocaleAction } from './language-toggle/actions'
import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'

type LanguageToggleLabels = {
  label: string
  es: string
  ca: string
  en: string
}

export function LanguageToggle({ locale, labels }: { locale: Locale; labels: LanguageToggleLabels }) {
  const router = useRouter()
  const [currentLocale, setOptimisticLocale] = useOptimistic(locale)
  const [pending, startTransition] = useTransition()

  function setLocale(locale: Locale) {
    if (locale === currentLocale) return

    startTransition(async () => {
      setOptimisticLocale(locale)
      await setLocaleAction(locale)
      router.refresh()
    })
  }

  return (
    <div
      className={`language-toggle language-toggle-${currentLocale}`}
      role="group"
      aria-label={labels.label}
    >
      <button
        className={currentLocale === 'es' ? 'language-toggle-option language-toggle-option-active' : 'language-toggle-option'}
        type="button"
        onClick={() => setLocale('es')}
        disabled={pending}
      >
        ES
      </button>
      <button
        className={currentLocale === 'ca' ? 'language-toggle-option language-toggle-option-active' : 'language-toggle-option'}
        type="button"
        onClick={() => setLocale('ca')}
        disabled={pending}
      >
        CA
      </button>
      <button
        className={currentLocale === 'en' ? 'language-toggle-option language-toggle-option-active' : 'language-toggle-option'}
        type="button"
        onClick={() => setLocale('en')}
        disabled={pending}
      >
        EN
      </button>
    </div>
  )
}
