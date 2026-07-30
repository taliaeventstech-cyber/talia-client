export const CONVERSATION_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export const DEFAULT_CONVERSATION_PAGE_SIZE = 25

export function getConversationPagination({
  page,
  pageSize,
}: {
  page?: string
  pageSize?: string
}) {
  const parsedPage = Number.parseInt(page ?? '', 10)
  const parsedPageSize = Number.parseInt(pageSize ?? '', 10)
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const currentPageSize = CONVERSATION_PAGE_SIZE_OPTIONS.includes(
    parsedPageSize as (typeof CONVERSATION_PAGE_SIZE_OPTIONS)[number],
  )
    ? parsedPageSize
    : DEFAULT_CONVERSATION_PAGE_SIZE

  return {
    page: currentPage,
    pageSize: currentPageSize,
    from: (currentPage - 1) * currentPageSize,
    to: currentPage * currentPageSize - 1,
  }
}

export function getConversationPageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize))
}
