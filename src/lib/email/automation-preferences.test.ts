import { describe, expect, it } from 'vitest'
import { setAutomaticEmailDrafts } from './automation-preferences'

describe('setAutomaticEmailDrafts', () => {
  it('enables the classification required to prepare drafts automatically', () => {
    expect(setAutomaticEmailDrafts({ custom: 'preserved' }, true)).toEqual({
      custom: 'preserved',
      auto_process_after_sync: true,
      auto_classify_after_sync: true,
      auto_draft_after_sync: true,
    })
  })

  it('disables the complete automatic processing pipeline', () => {
    expect(setAutomaticEmailDrafts({
      auto_classify_after_sync: true,
      auto_draft_after_sync: true,
    }, false)).toEqual({
      auto_process_after_sync: false,
      auto_classify_after_sync: false,
      auto_draft_after_sync: false,
    })
  })

  it('keeps automatic classification disabled when both settings were disabled', () => {
    expect(setAutomaticEmailDrafts({}, false)).toEqual({
      auto_process_after_sync: false,
      auto_classify_after_sync: false,
      auto_draft_after_sync: false,
    })
  })
})
