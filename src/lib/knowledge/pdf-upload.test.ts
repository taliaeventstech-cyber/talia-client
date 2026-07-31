import { describe, expect, it } from 'vitest'
import { formatPdfUploadSize, getPdfUploadCandidateError, MAX_PDF_UPLOAD_SIZE } from './pdf-upload'

describe('PDF upload candidate', () => {
  it('accepts PDFs detected by MIME type or extension', () => {
    expect(getPdfUploadCandidateError({
      name: 'programa',
      type: 'application/pdf',
      size: 1_024,
    })).toBeNull()
    expect(getPdfUploadCandidateError({
      name: 'PROGRAMA.PDF',
      type: '',
      size: 1_024,
    })).toBeNull()
  })

  it('rejects other formats and PDFs larger than 8 MB', () => {
    expect(getPdfUploadCandidateError({
      name: 'programa.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1_024,
    })).toBe('type')
    expect(getPdfUploadCandidateError({
      name: 'programa.pdf',
      type: 'application/pdf',
      size: MAX_PDF_UPLOAD_SIZE + 1,
    })).toBe('size')
  })

  it('formats the selected file size for the dropzone', () => {
    expect(formatPdfUploadSize(512 * 1024)).toBe('512 KB')
    expect(formatPdfUploadSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})
