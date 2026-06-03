'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

type PasswordInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete: string
  showLabel: string
  hideLabel: string
  minLength?: number
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  showLabel,
  hideLabel,
  minLength,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const label = visible ? hideLabel : showLabel

  return (
    <div className="password-input-wrap">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required
      />
      <button
        className="password-visibility-button"
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={label}
        title={label}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  )
}
