import type { ClearViewRequest } from './clear-view'

const MAX_CLEAR_VIEW_INPUT_CHARS = 12_000

export function getClearViewInputLength(input: ClearViewRequest) {
  const values = [
    input.url,
    input.page.title,
    ...input.page.summary,
    ...input.page.actions.flatMap((action) => [action.label, action.href]),
    ...input.page.sections.flatMap((section) => [section.title, ...section.items]),
  ]

  return values.reduce((total, value) => total + value.length, 0)
}

export function isClearViewInputTooLarge(input: ClearViewRequest) {
  return getClearViewInputLength(input) > MAX_CLEAR_VIEW_INPUT_CHARS
}
