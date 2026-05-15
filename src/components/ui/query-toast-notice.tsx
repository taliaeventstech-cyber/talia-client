'use client'

import { useEffect } from 'react'
import { ToastNotice } from './toast-notice'

type QueryToastNoticeProps = {
  message: string
  tone?: 'success' | 'error' | 'warning' | 'info'
  clearParamPrefix: string
}

export function QueryToastNotice({ message, tone, clearParamPrefix }: QueryToastNoticeProps) {
  useEffect(() => {
    const url = new URL(window.location.href)
    let changed = false

    for (const key of Array.from(url.searchParams.keys())) {
      if (key.startsWith(clearParamPrefix)) {
        url.searchParams.delete(key)
        changed = true
      }
    }

    if (changed) {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [clearParamPrefix])

  return <ToastNotice message={message} tone={tone} />
}
