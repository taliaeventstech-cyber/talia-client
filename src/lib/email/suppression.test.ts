// @vitest-environment node

import type { createAdminClient } from '@/lib/supabase/admin'
import { describe, expect, it, vi } from 'vitest'
import { deleteEmailThreadsFromTalia } from './suppression'

type AdminClient = ReturnType<typeof createAdminClient>

describe('deleteEmailThreadsFromTalia', () => {
  it('deletes tenant-owned threads through the atomic suppression boundary', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null })

    await expect(deleteEmailThreadsFromTalia(
      { rpc } as unknown as AdminClient,
      {
        tenantId: '22000000-0000-0000-0000-000000000001',
        threadIds: [
          '24000000-0000-0000-0000-000000000001',
          '24000000-0000-0000-0000-000000000002',
        ],
      },
    )).resolves.toEqual({ deleted: 2 })

    expect(rpc).toHaveBeenCalledWith('delete_email_threads_from_talia', {
      p_theatre_id: '22000000-0000-0000-0000-000000000001',
      p_thread_ids: [
        '24000000-0000-0000-0000-000000000001',
        '24000000-0000-0000-0000-000000000002',
      ],
    })
  })
})
