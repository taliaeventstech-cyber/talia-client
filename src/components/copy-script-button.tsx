'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

export function CopyScriptButton({
  value,
  label,
  copiedLabel,
  showLabel = false,
}: {
  value: string
  label: string
  copiedLabel: string
  showLabel?: boolean
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [copied])

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        copyWithFallback(value)
      }
      setCopied(true)
    } catch {
      copyWithFallback(value)
      setCopied(true)
    }
  }

  const visibleLabel = copied ? copiedLabel : label

  return (
    <button
      type="button"
      className={[
        'script-copy-button',
        copied ? 'script-copy-button-copied' : '',
        showLabel ? 'script-copy-button-labelled' : '',
      ].filter(Boolean).join(' ')}
      onClick={handleCopy}
      aria-label={visibleLabel}
      title={visibleLabel}
    >
      {copied ? <Check size={16} strokeWidth={2.2} aria-hidden="true" /> : <Copy size={16} strokeWidth={2.2} aria-hidden="true" />}
      {showLabel ? <span>{visibleLabel}</span> : null}
    </button>
  )
}

function copyWithFallback(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
