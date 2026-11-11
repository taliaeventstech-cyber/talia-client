import type { CSSProperties } from 'react'

/**
 * The TALIA mark: the open "Λ" of the TALIA wordmark, drawn in
 * `currentColor`. Same shape as `getTaliaMarkIcon()` in public/widget.js, so
 * the Agora preview matches the installed widget.
 */
export function TaliaMark({ size, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d="M43 13h15l27 69q1.5 4 6 5v1H67v-1q4.5-1 3-5L50.5 31 32 82q-1.5 4 3 5v1H13v-1q4.5-1 6-5z" />
    </svg>
  )
}
