'use client'

import { Download } from 'lucide-react'
import {
  buildKnowledgeSourceDebugPayload,
  getKnowledgeSourceDebugFilename,
  type DebuggableSource,
} from '@/lib/knowledge/source-debug'

export function BackstageKnowledgeSourceDebugDownloadButton({ source }: { source: DebuggableSource }) {
  function downloadDebugFile() {
    const payload = buildKnowledgeSourceDebugPayload(source)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = href
    link.download = getKnowledgeSourceDebugFilename(source.id)
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(href)
  }

  return (
    <button
      type="button"
      className="button-outline button-fit knowledge-source-debug-download"
      aria-label={`Descargar diagnóstico JSON de ${source.name}`}
      onClick={downloadDebugFile}
    >
      <Download size={14} strokeWidth={2} aria-hidden="true" />
      Descargar diagnóstico
    </button>
  )
}
