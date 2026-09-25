// @vitest-environment node

import type { createAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEmailSyncConfig, getEmailSyncFailureState, syncGmailMessages } from './sync'

type AdminClient = ReturnType<typeof createAdminClient>

const emailProviderMocks = vi.hoisted(() => ({
  getFreshGoogleAccessToken: vi.fn(),
  getGmailMessage: vi.fn(),
  listGmailInboxMessages: vi.fn(),
  parseGmailMessage: vi.fn(),
}))

vi.mock('./google-tokens', () => ({
  getFreshGoogleAccessToken: emailProviderMocks.getFreshGoogleAccessToken,
}))

vi.mock('./gmail', () => ({
  getGmailMessage: emailProviderMocks.getGmailMessage,
  listGmailInboxMessages: emailProviderMocks.listGmailInboxMessages,
  parseGmailMessage: emailProviderMocks.parseGmailMessage,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getEmailSyncConfig', () => {
  it('uses safer defaults for automated Gmail syncs', () => {
    expect(getEmailSyncConfig({})).toMatchObject({
      limit: 100,
      query: 'in:inbox newer_than:14d',
      autoProcessAfterSync: false,
      autoClassifyAfterSync: false,
      autoDraftAfterSync: false,
    })
  })

  it('keeps legacy auto process metadata as classify and draft automation', () => {
    expect(getEmailSyncConfig({ auto_process_after_sync: true })).toMatchObject({
      autoClassifyAfterSync: true,
      autoDraftAfterSync: true,
    })
  })

  it('allows classification and draft automation to be configured separately', () => {
    expect(getEmailSyncConfig({
      auto_classify_after_sync: true,
      auto_draft_after_sync: false,
    })).toMatchObject({
      autoClassifyAfterSync: true,
      autoDraftAfterSync: false,
    })
  })

  it('accepts larger backfill limits from Backstage metadata', () => {
    expect(getEmailSyncConfig({ gmail_sync_limit: 500 }).limit).toBe(500)
    expect(getEmailSyncConfig({ gmail_sync_limit: 999 }).limit).toBe(100)
  })
})

describe('getEmailSyncFailureState', () => {
  it('retries twice and leaves the connection in error after the third failure', () => {
    expect(getEmailSyncFailureState({})).toEqual({
      consecutiveFailures: 1,
      retryable: true,
      status: 'connected',
    })
    expect(getEmailSyncFailureState({ email_sync_consecutive_failures: 1 })).toEqual({
      consecutiveFailures: 2,
      retryable: true,
      status: 'connected',
    })
    expect(getEmailSyncFailureState({ email_sync_consecutive_failures: 2 })).toEqual({
      consecutiveFailures: 3,
      retryable: false,
      status: 'error',
    })
  })
})

describe('syncGmailMessages', () => {
  it('does not re-import a message that the operator deleted from TALIA', async () => {
    const connectionId = '23000000-0000-0000-0000-000000000001'
    const providerMessageId = 'gmail-message-deleted-from-talia'
    const providerMessageIdHash = createHash('sha256')
      .update(`${connectionId}:${providerMessageId}`)
      .digest('hex')
    const admin = createSyncAdmin({ connectionId, suppressedHashes: [providerMessageIdHash] })

    emailProviderMocks.getFreshGoogleAccessToken.mockResolvedValue('google-access-token')
    emailProviderMocks.listGmailInboxMessages.mockResolvedValue({
      messages: [{ id: providerMessageId, threadId: 'gmail-thread-1' }],
    })
    emailProviderMocks.getGmailMessage.mockRejectedValue(
      new Error('Suppressed Gmail messages must not be downloaded'),
    )

    await expect(syncGmailMessages(admin, {
      tenantId: '22000000-0000-0000-0000-000000000001',
    })).resolves.toMatchObject({
      ok: true,
      imported: 0,
      skipped: 1,
      inspected: 1,
    })
    expect(emailProviderMocks.getGmailMessage).not.toHaveBeenCalled()
  })
})

function createSyncAdmin(input: { connectionId: string; suppressedHashes: string[] }) {
  const connection = {
    id: input.connectionId,
    theatre_id: '22000000-0000-0000-0000-000000000001',
    provider: 'google',
    mailbox_email: 'venue@example.com',
    status: 'connected',
    oauth_metadata: {},
    metadata: {},
  }

  const from = vi.fn((table: string) => {
    if (table === 'email_connections') {
      const selectChain = chain({ data: connection, error: null }, 'maybeSingle')
      return {
        select: vi.fn(() => selectChain),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      }
    }

    if (table === 'email_messages') {
      return {
        select: vi.fn(() => chain({ data: [], error: null }, 'in')),
      }
    }

    if (table === 'email_message_suppressions') {
      return {
        select: vi.fn(() => chain({
          data: input.suppressedHashes.map((provider_message_id_hash) => ({ provider_message_id_hash })),
          error: null,
        }, 'in')),
      }
    }

    throw new Error(`Unexpected table in email sync test: ${table}`)
  })

  return { from } as unknown as AdminClient
}

function chain<T>(result: T, terminalMethod: 'in' | 'maybeSingle') {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['eq', 'in', 'order', 'limit']) {
    builder[method] = vi.fn(() => method === terminalMethod ? Promise.resolve(result) : builder)
  }
  builder.maybeSingle = vi.fn(() => terminalMethod === 'maybeSingle' ? Promise.resolve(result) : builder)
  return builder
}
