'use client'

import { Download } from 'lucide-react'
import type { ResponseTraceExport } from '@/lib/knowledge/response-trace-export'

export function ResponseTraceDownloadButton({
  filename,
  trace,
}: {
  filename: string
  trace: ResponseTraceExport
}) {
  function handleDownload() {
    const blob = new Blob([`${JSON.stringify(trace, null, 2)}\n`], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      className="trace-download-button"
      onClick={handleDownload}
      title="Descargar pregunta, respuesta y detalle RAG"
    >
      <Download size={14} strokeWidth={2.2} aria-hidden="true" />
      Descargar JSON
    </button>
  )
}
