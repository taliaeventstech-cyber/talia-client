'use client'

import { useEffect, useRef } from 'react'

const SPLINE_VIEWER_SCRIPT_ID = 'talia-spline-viewer-script'
const SPLINE_VIEWER_SRC = 'https://unpkg.com/@splinetool/viewer/build/spline-viewer.js'

function loadSplineViewer() {
  const existingScript = document.getElementById(SPLINE_VIEWER_SCRIPT_ID) as HTMLScriptElement | null

  if (existingScript) {
    return new Promise<void>((resolve, reject) => {
      if (existingScript.dataset.loaded === 'true') {
        resolve()
        return
      }

      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Spline viewer failed to load')), { once: true })
    })
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SPLINE_VIEWER_SCRIPT_ID
    script.type = 'module'
    script.src = SPLINE_VIEWER_SRC
    script.async = true
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => reject(new Error('Spline viewer failed to load')), { once: true })
    document.head.appendChild(script)
  })
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
