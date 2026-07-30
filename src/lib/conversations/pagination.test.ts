import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONVERSATION_PAGE_SIZE,
  getConversationPageCount,
  getConversationPagination,
} from './pagination'

describe('conversation pagination', () => {
  it('uses safe defaults', () => {
    expect(getConversationPagination({})).toEqual({
      page: 1,
      pageSize: DEFAULT_CONVERSATION_PAGE_SIZE,
      from: 0,
      to: DEFAULT_CONVERSATION_PAGE_SIZE - 1,
    })
  })

  it('accepts supported page sizes and calculates the database range', () => {
    expect(getConversationPagination({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
      from: 100,
      to: 149,
    })
  })

  it('rejects invalid pages and unsupported page sizes', () => {
    expect(getConversationPagination({ page: '-4', pageSize: '999' })).toMatchObject({
      page: 1,
      pageSize: DEFAULT_CONVERSATION_PAGE_SIZE,
    })
  })

  it('always exposes at least one page', () => {
    expect(getConversationPageCount(0, 25)).toBe(1)
    expect(getConversationPageCount(101, 25)).toBe(5)
  })
})
