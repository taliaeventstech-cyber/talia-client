'use client'

import { useTransition, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteConversation } from './actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'

const SPRING = '600ms cubic-bezier(0.16, 1, 0.3, 1)'

type Props = {
  tenantId: string
  conversationId: string
  variant?: 'icon' | 'button'
  copy: Dictionary['conversations']['deletion']
}

export function DeleteConversationButton({ tenantId, conversationId, variant = 'icon', copy }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confirming) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setConfirming(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [confirming])

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteConversation(tenantId, conversationId)
      if (result.ok && variant === 'button') {
        router.push(`/${tenantId}/conversations`)
      }
      setConfirming(false)
    })
  }

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}
    >
      {/* Confirmation — expands from the right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: confirming ? 180 : 0,
          opacity: confirming ? 1 : 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: `max-width ${SPRING}, opacity ${SPRING}`,
        }}
      >
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-tertiary)',
            fontSize: 13,
            fontWeight: 500,
            padding: '4px 4px 4px 2px',
            transition: `color 150ms ease`,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
        >
          {copy.cancel}
        </button>

        <button
          onClick={handleConfirm}
          disabled={isPending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: 'none',
            cursor: isPending ? 'default' : 'pointer',
            color: 'var(--color-error)',
            fontSize: 13,
            fontWeight: 600,
            padding: '4px 2px',
            opacity: isPending ? 0.5 : 1,
            whiteSpace: 'nowrap',
            transition: `opacity 150ms ease`,
          }}
        >
          <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
          {isPending ? copy.deleting : copy.confirm}
        </button>
      </div>

      {/* Trash icon — collapses when confirming */}
      <button
        onClick={() => setConfirming(true)}
        aria-label={copy.ariaLabel}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-tertiary)',
          borderRadius: 4,
          display: 'grid',
          placeItems: 'center',
          maxWidth: confirming ? 0 : 22,
          opacity: confirming ? 0 : 1,
          overflow: 'hidden',
          padding: confirming ? 0 : 4,
          transition: `max-width ${SPRING}, opacity ${SPRING}, padding ${SPRING}`,
        }}
        onMouseEnter={(e) => { if (!confirming) e.currentTarget.style.color = 'var(--color-error)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
