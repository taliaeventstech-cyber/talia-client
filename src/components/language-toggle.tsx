'use client'

import type { Locale } from '@/lib/i18n/config'
import { persistLocale } from '@/lib/i18n/client'
import { Check, ChevronDown, Languages } from 'lucide-react'
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'

type LanguageToggleLabels = {
  label: string
  es: string
  ca: string
  en: string
  ptBR: string
}

export function LanguageToggle({ locale, labels }: { locale: Locale; labels: LanguageToggleLabels }) {
  const [currentLocale, setOptimisticLocale] = useOptimistic(locale)
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const options: Array<{ locale: Locale; label: string; shortLabel: string }> = [
    { locale: 'es', label: labels.es, shortLabel: 'ES' },
    { locale: 'ca', label: labels.ca, shortLabel: 'CA' },
    { locale: 'en', label: labels.en, shortLabel: 'EN' },
    { locale: 'pt-BR', label: labels.ptBR, shortLabel: 'PT-BR' },
  ]

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!toggleRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function setLocale(locale: Locale) {
    if (locale === currentLocale) return

    startTransition(async () => {
      setOptimisticLocale(locale)
      setOpen(false)
      await persistLocale(locale)
    })
  }

  const activeOption = options.find((option) => option.locale === currentLocale) ?? options[0]

  return (
    <div className="language-toggle" ref={toggleRef}>
      <button
        className="language-toggle-trigger"
        type="button"
        aria-label={labels.label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        disabled={pending}
        ref={triggerRef}
      >
        <Languages aria-hidden="true" size={15} strokeWidth={1.9} />
        <span>{activeOption.shortLabel}</span>
        <ChevronDown className="language-toggle-chevron" aria-hidden="true" size={14} strokeWidth={2} />
      </button>
      {open ? (
        <div className="language-toggle-menu" role="menu" aria-label={labels.label}>
          {options.map((option) => {
            const active = option.locale === currentLocale

            return (
              <button
                className={active ? 'language-toggle-option language-toggle-option-active' : 'language-toggle-option'}
                key={option.locale}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => setLocale(option.locale)}
                disabled={pending || active}
              >
                <span className="language-toggle-option-code">{option.shortLabel}</span>
                <span>{option.label}</span>
                {active ? <Check aria-hidden="true" size={15} strokeWidth={2.2} /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
