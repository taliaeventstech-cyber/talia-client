import Image from 'next/image'
import type { CSSProperties } from 'react'

/**
 * TALIA's face as a one-colour (white) icon: the same `public/icon.svg` the
 * installed widget shows, whitened with a CSS filter like public/widget.js.
 */
export function TaliaFace({ size, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <Image
      className={className}
      src="/icon.svg"
      alt=""
      aria-hidden="true"
      width={500}
      height={500}
      style={{
        ...(size ? { width: size, height: size } : null),
        objectFit: 'contain',
        filter: 'brightness(0) invert(1)',
        ...style,
      }}
    />
  )
}
