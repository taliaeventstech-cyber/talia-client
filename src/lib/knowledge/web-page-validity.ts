const NOT_FOUND_TEXT = /\b(?:page not found|not found|página no encontrada|pagina no encontrada|pàgina no trobada|pagina non trovata|page introuvable|seite nicht gefunden)\b/i
const NOT_FOUND_STATUS_TITLE = /^\s*(?:404|410)\b/

export type WebPageValidityInput = {
  httpStatus?: number | null
  title?: string | null
  heading?: string | null
}

export function getWebPageRejection(input: WebPageValidityInput) {
  if (input.httpStatus === 404 || input.httpStatus === 410) {
    return { code: 'page_not_found', message: `La página devuelve HTTP ${input.httpStatus}.` } as const
  }

  const visibleLabel = [input.title, input.heading]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
  if (visibleLabel && (NOT_FOUND_TEXT.test(visibleLabel) || NOT_FOUND_STATUS_TITLE.test(visibleLabel))) {
    return { code: 'page_not_found', message: 'La página indica que el contenido no existe.' } as const
  }

  return null
}
