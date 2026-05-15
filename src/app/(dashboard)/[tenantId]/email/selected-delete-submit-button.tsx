'use client'

import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

type SelectedDeleteSubmitButtonProps = {
  formAction: (formData: FormData) => void | Promise<void>
  targetName: string
}

export function SelectedDeleteSubmitButton({ formAction, targetName }: SelectedDeleteSubmitButtonProps) {
  const { pending } = useFormStatus()
  const [hasSelection, setHasSelection] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return

    const updateSelection = () => {
      const selected = Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${targetName}"]`))
        .some((input) => input.checked)
      setHasSelection(selected)
    }

    form.addEventListener('change', updateSelection)
    updateSelection()

    return () => form.removeEventListener('change', updateSelection)
  }, [targetName])

  return (
    <span ref={rootRef}>
      <button
        aria-disabled={!hasSelection || pending}
        className="button-outline button-danger button-fit"
        disabled={!hasSelection || pending}
        formAction={formAction}
        type="submit"
      >
        <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
        Borrar
      </button>
    </span>
  )
}
