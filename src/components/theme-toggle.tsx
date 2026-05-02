'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('talia-theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const next = saved ?? (prefersDark ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', next)
    queueMicrotask(() => setTheme(next))
  }, [])

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme')
    const next = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('talia-theme', next)
    setTheme(next)
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar entre modo claro y oscuro"
      aria-pressed={theme === 'dark'}
    >
      <span className={theme === 'light' ? 'theme-toggle-option theme-toggle-option-active' : 'theme-toggle-option'}>
        <Sun aria-hidden="true" size={14} strokeWidth={2} />
      </span>
      <span className={theme === 'dark' ? 'theme-toggle-option theme-toggle-option-active' : 'theme-toggle-option'}>
        <Moon aria-hidden="true" size={14} strokeWidth={2} />
      </span>
    </button>
  )
}
