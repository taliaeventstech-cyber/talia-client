'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type MessageAttentionNavigationItem = {
  targetId: string
  highlightIds?: string[]
}

export type MessageAttentionNavigatorStatus = {
  label: string
  count: number
  tone?: 'pending' | 'corrected' | 'accepted'
}

export function MessageAttentionNavigator({
  items,
  statuses,
  title,
  currentLabel,
  position,
  previous,
  next,
  none,
}: {
  items: MessageAttentionNavigationItem[]
  statuses: MessageAttentionNavigatorStatus[]
  title: string
  currentLabel: string
  position: string
  previous: string
  next: string
  none: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const highlightedElements = useRef<HTMLElement[]>([])
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentItem = items[currentIndex] ?? null

  useEffect(() => () => {
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    for (const element of highlightedElements.current) {
      element.classList.remove('conversation-review-active', 'conversation-review-pulse')
    }
  }, [])

  function highlight(item: MessageAttentionNavigationItem) {
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    for (const element of highlightedElements.current) {
      element.classList.remove('conversation-review-active', 'conversation-review-pulse')
    }

    const ids = item.highlightIds?.length ? item.highlightIds : [item.targetId]
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)

    for (const element of elements) {
      element.classList.add('conversation-review-active', 'conversation-review-pulse')
    }
    highlightedElements.current = elements
    pulseTimer.current = setTimeout(() => {
      for (const element of elements) element.classList.remove('conversation-review-pulse')
    }, 1_300)
  }

  function navigateTo(index: number) {
    if (items.length === 0) return
    const normalizedIndex = (index + items.length) % items.length
    const item = items[normalizedIndex]
    if (!item) return

    setCurrentIndex(normalizedIndex)
    highlight(item)
    window.history.replaceState(null, '', `#${item.targetId}`)
    document.getElementById(item.targetId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  return (
    <section className="conversation-review-navigator" aria-label={title}>
      <div className="conversation-review-navigator-summary">
        <strong>{title}</strong>
        <div>
          {statuses.map((status) => (
            <span
              className={`conversation-review-count ${status.tone ? `conversation-review-count-${status.tone}` : ''}`}
              key={`${status.label}-${status.tone ?? 'default'}`}
            >
              {status.label}: {status.count}
            </span>
          ))}
        </div>
      </div>

      {currentItem ? (
        <div className="conversation-review-navigator-controls">
          <button
            type="button"
            className="conversation-review-current"
            aria-current="true"
            onClick={() => navigateTo(currentIndex)}
          >
            <span>{currentLabel}</span>
            <strong>
              {position
                .replace('{current}', String(currentIndex + 1))
                .replace('{total}', String(items.length))}
            </strong>
          </button>
          <div>
            <button
              type="button"
              className="pagination-icon-button"
              aria-label={previous}
              onClick={() => navigateTo(currentIndex - 1)}
            >
              <ChevronUp size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pagination-icon-button"
              aria-label={next}
              onClick={() => navigateTo(currentIndex + 1)}
            >
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <p className="conversation-review-none">{none}</p>
      )}
    </section>
  )
}
