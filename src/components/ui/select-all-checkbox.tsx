'use client'

import { useEffect, useRef } from 'react'

type SelectAllCheckboxProps = {
  targetName: string
  label: string
}

export function SelectAllCheckbox({ targetName, label }: SelectAllCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = inputRef.current
    const form = input?.form
    if (!input || !form) return

    const updateState = () => {
      const targets = getTargetInputs(form, targetName)
      const checkedCount = targets.filter((target) => target.checked).length

      input.checked = targets.length > 0 && checkedCount === targets.length
      input.indeterminate = checkedCount > 0 && checkedCount < targets.length
    }

    form.addEventListener('change', updateState)
    updateState()

    return () => form.removeEventListener('change', updateState)
  }, [targetName])

  return (
    <input
      aria-label={label}
      onChange={(event) => {
        const form = event.currentTarget.form
        if (!form) return

        for (const input of getTargetInputs(form, targetName)) {
          input.checked = event.currentTarget.checked
        }
      }}
      ref={inputRef}
      type="checkbox"
    />
  )
}

function getTargetInputs(form: HTMLFormElement, targetName: string) {
  return Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${targetName}"]`))
}
