'use client'

import { ToastNotice } from './toast-notice'

type ActionToastProps = {
  state: {
    ok: boolean
    message: string
  }
}

export function ActionToast({ state }: ActionToastProps) {
  if (!state.message) return null

  return <ToastNotice message={state.message} tone={state.ok ? 'success' : 'error'} />
}
