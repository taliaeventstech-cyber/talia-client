'use client'

import type { SupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type PendingReviewNavigationItem = {
  messageId: string
  questionMessageId: string | null
}

export function ConversationReviewNavigator({
  items,
  correctedCount,
  acceptedCount,
  copy,
}: {
  items: PendingReviewNavigationItem[]
  correctedCount: number
  acceptedCount: number
  copy: SupervisedFaqCopy['navigator']
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const highlightedElements = useRef<HTMLElement[]>([])
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCount = items.length
  const currentItem = items[currentIndex] ?? null

  useEffect(() => () => {
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    for (const element of highlightedElements.current) {
      element.classList.remove('conversation-review-active', 'conversation-review-pulse')
    }
  }, [])

  function highlightTurn(item: PendingReviewNavigationItem) {
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    for (const element of highlightedElements.current) {
      element.classList.remove('conversation-review-active', 'conversation-review-pulse')
    }

    const question = item.questionMessageId
      ? document.getElementById(`question-${item.questionMessageId}`)
      : null
    const response = document.getElementById(`response-${item.messageId}`)
    const elements = [question, response].filter((element): element is HTMLElement => element !== null)

    for (const element of elements) {
      element.classList.add('conversation-review-active', 'conversation-review-pulse')
    }
    highlightedElements.current = elements
    pulseTimer.current = setTimeout(() => {
      for (const element of elements) element.classList.remove('conversation-review-pulse')
    }, 1_300)
  }

  function navigateTo(index: number) {
    if (pendingCount === 0) return
    const normalizedIndex = (index + pendingCount) % pendingCount
    const item = items[normalizedIndex]
    if (!item) return

    setCurrentIndex(normalizedIndex)
    highlightTurn(item)
    const targetId = `response-${item.messageId}`
    window.history.replaceState(null, '', `#${targetId}`)
    document.getElementById(targetId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  return (
    <section className="conversation-review-navigator" aria-label={copy.title}>
      <div className="conversation-review-navigator-summary">
        <strong>{copy.title}</strong>
        <div>
          <span className={pendingCount > 0 ? 'conversation-review-count conversation-review-count-pending' : 'conversation-review-count'}>
            {copy.pending}: {pendingCount}
          </span>
          <span className="conversation-review-count conversation-review-count-corrected">
            {copy.corrected}: {correctedCount}
          </span>
          <span className="conversation-review-count conversation-review-count-accepted">
            {copy.accepted}: {acceptedCount}
          </span>
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
            <span>{copy.improvement}</span>
            <strong>
              {copy.position
                .replace('{current}', String(currentIndex + 1))
                .replace('{total}', String(pendingCount))}
            </strong>
          </button>
          <div>
            <button
              type="button"
              className="pagination-icon-button"
              aria-label={copy.previous}
              onClick={() => navigateTo(currentIndex - 1)}
            >
              <ChevronUp size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pagination-icon-button"
              aria-label={copy.next}
              onClick={() => navigateTo(currentIndex + 1)}
            >
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <p className="conversation-review-none">{copy.none}</p>
      )}
    </section>
  )
}
