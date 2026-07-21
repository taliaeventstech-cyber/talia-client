'use client'

import { useEffect, useRef } from 'react'

function loadSplineViewer() {
  return import('@splinetool/viewer').then(() => undefined)
}

export function AuthSplineBackground({ sceneUrl }: { sceneUrl?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const normalizedSceneUrl = sceneUrl?.trim()

    if (!host || !normalizedSceneUrl) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let disposed = false

    loadSplineViewer()
      .then(() => {
        if (disposed || !host) return

        host.replaceChildren()

        const viewer = document.createElement('spline-viewer')
        viewer.setAttribute('url', normalizedSceneUrl)
        viewer.setAttribute('loading-anim-type', 'spinner-small-dark')
        viewer.className = 'auth-spline-viewer'
        host.appendChild(viewer)
      })
      .catch(() => {
        host.replaceChildren()
      })

    return () => {
      disposed = true
      host.replaceChildren()
    }
  }, [sceneUrl])

  if (!sceneUrl?.trim()) return null

  return <div ref={hostRef} className="auth-spline-background" aria-hidden="true" />
}
