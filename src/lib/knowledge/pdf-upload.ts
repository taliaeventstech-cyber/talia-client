export const MAX_PDF_UPLOAD_SIZE = 8 * 1024 * 1024

export type PdfUploadCandidate = {
  name: string
  size: number
  type: string
}

export function getPdfUploadCandidateError(file: PdfUploadCandidate): 'type' | 'size' | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return 'type'
  if (file.size === 0 || file.size > MAX_PDF_UPLOAD_SIZE) return 'size'
  return null
}

export function formatPdfUploadSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
