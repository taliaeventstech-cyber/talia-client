'use client'

export function CopyInput({ value }: { value: string }) {
  return (
    <input
      readOnly
      value={value}
      className="mono"
      onClick={(e) => (e.target as HTMLInputElement).select()}
    />
  )
}
