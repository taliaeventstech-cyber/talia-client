'use client'

import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type DraftDeleteChoiceButtonProps = {
  buttonClassName?: string
  draftId?: string
  labels: {
    cancel: string
    deleting: string
    deletingAgora: string
    no: string
    question: string
    yes: string
  }
  label: string
  requireSelectionName?: string
}

export function DraftDeleteChoiceButton({
  buttonClassName = 'button-outline button-danger button-fit',
  draftId,
  labels,
  label,
  requireSelectionName,
}: DraftDeleteChoiceButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [hasSelection, setHasSelection] = useState(!requireSelectionName)
  const [deletingScope, setDeletingScope] = useState<'local' | 'provider' | null>(null)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!requireSelectionName) return

    const form = rootRef.current?.closest('form')
    if (!form) return

    const updateSelection = () => {
      const selected = Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${requireSelectionName}"]`))
        .some((input) => input.checked)
      setHasSelection(selected)
      if (!selected && !deletingScope) setConfirming(false)
    }

    form.addEventListener('change', updateSelection)
    updateSelection()

    return () => form.removeEventListener('change', updateSelection)
  }, [deletingScope, requireSelectionName])

  function submitChoice(scope: 'local' | 'provider') {
    const form = rootRef.current?.closest('form')

    if (!form) return
    setDeletingScope(scope)

    for (const input of form.querySelectorAll('[data-draft-delete-choice="true"]')) {
      input.remove()
    }

    form.append(createHiddenInput('draft_delete_scope', scope))
    if (draftId) form.append(createHiddenInput('single_draft_id', draftId))
    form.requestSubmit()
  }

  return (
    <span className="draft-delete-choice" ref={rootRef}>
      {confirming ? (
        <span className="draft-delete-inline-confirm">
          <span className="draft-delete-inline-question">
            {labels.question}
          </span>
          <span className="delete-inline-actions">
            <button
              className="button-outline button-fit"
              disabled={Boolean(deletingScope)}
              type="button"
              onClick={() => submitChoice('local')}
            >
              {deletingScope === 'local' ? (
                <>{labels.deletingAgora}<span className="inline-loading-dots" aria-hidden="true" /></>
              ) : labels.no}
            </button>
            <button
              className="button-outline button-danger button-fit"
              disabled={Boolean(deletingScope)}
              type="button"
              onClick={() => submitChoice('provider')}
            >
              {deletingScope === 'provider' ? (
                <>{labels.deleting}<span className="inline-loading-dots" aria-hidden="true" /></>
              ) : labels.yes}
            </button>
            <button
              className="button-outline button-fit"
              disabled={Boolean(deletingScope)}
              type="button"
              onClick={() => setConfirming(false)}
            >
              {labels.cancel}
            </button>
          </span>
        </span>
      ) : (
        <button
          aria-disabled={!hasSelection}
          className={buttonClassName}
          disabled={!hasSelection}
          onClick={() => setConfirming(true)}
          type="button"
        >
          <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
          {label}
        </button>
      )}
    </span>
  )
}

function createHiddenInput(name: string, value: string) {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  input.dataset.draftDeleteChoice = 'true'
  return input
}
