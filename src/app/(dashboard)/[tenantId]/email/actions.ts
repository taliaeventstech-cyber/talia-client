'use server'

import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { syncAndMaybeProcessEmail } from '@/lib/email/automation'
import { processEmailMessage } from '@/lib/email/service'
import { decryptOAuthTokens, revokeGoogleOAuthToken } from '@/lib/email/google-oauth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function syncLatestEmailAction(tenantId: string) {
  await requireTenantPermission(tenantId, 'manage_email', 'email')

  const result = await syncAndMaybeProcessEmail(createAdminClient(), tenantId)

  if (!result.ok) {
    redirect(`/${tenantId}/email?email_sync_error=${encodeURIComponent(result.error)}`)
  }

  revalidatePath(`/${tenantId}/email`)
  redirect(`/${tenantId}/email?email_synced=${result.imported}&email_auto_processed=${result.processed}`)
}

export async function processSelectedEmailThreadsAction(tenantId: string, formData: FormData) {
  await requireTenantPermission(tenantId, 'manage_email', 'email')

  const threadIds = getSelectedThreadIds(formData)
  if (!threadIds.length) {
    redirect(`/${tenantId}/email?email_process_error=${encodeURIComponent('Selecciona al menos un thread')}`)
  }

  const admin = createAdminClient()
  const { data: threads, error } = await admin
    .from('email_threads')
    .select('id')
    .eq('theatre_id', tenantId)
    .in('id', threadIds)

  if (error || !threads?.length) {
    redirect(`/${tenantId}/email?email_process_error=${encodeURIComponent(error?.message ?? 'No se han encontrado threads válidos')}`)
  }

  let processed = 0
  let ignored = 0
  let failed = 0

  for (const thread of threads) {
    const result = await processEmailMessage(admin, { tenantId, threadId: thread.id })
    if (!result.ok) {
      failed += 1
      continue
    }
    if (result.action === 'ignored') ignored += 1
    else processed += 1
  }

  revalidatePath(`/${tenantId}/email`)
  redirect(`/${tenantId}/email?email_selected_processed=${processed}&email_selected_ignored=${ignored}&email_selected_failed=${failed}`)
}

export async function deleteSelectedEmailThreadsAction(tenantId: string, formData: FormData) {
  await requireTenantPermission(tenantId, 'manage_email', 'email')

  const threadIds = getSelectedThreadIds(formData)
  if (!threadIds.length) {
    redirect(`/${tenantId}/email?email_delete_error=${encodeURIComponent('Selecciona al menos un thread')}`)
  }

  const admin = createAdminClient()
  const { data: threads, error: fetchError } = await admin
    .from('email_threads')
    .select('id')
    .eq('theatre_id', tenantId)
    .in('id', threadIds)

  if (fetchError || !threads?.length) {
    redirect(`/${tenantId}/email?email_delete_error=${encodeURIComponent(fetchError?.message ?? 'No se han encontrado threads válidos')}`)
  }

  const { error: deleteError } = await admin
    .from('email_threads')
    .delete()
    .eq('theatre_id', tenantId)
    .in('id', threads.map((thread) => thread.id))

  if (deleteError) {
    redirect(`/${tenantId}/email?email_delete_error=${encodeURIComponent(deleteError.message)}`)
  }

  revalidatePath(`/${tenantId}/email`)
  redirect(`/${tenantId}/email?email_deleted=${threads.length}`)
}

export async function disconnectGoogleEmailAction(tenantId: string) {
  await requireTenantPermission(tenantId, 'manage_email', 'email')

  const admin = createAdminClient()
  const { data: connection, error } = await admin
    .from('email_connections')
    .select('id, oauth_metadata')
    .eq('theatre_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !connection) {
    redirect(`/${tenantId}/email?email_error=no_connection`)
  }

  const revokeError = await revokeConnectionToken(connection.oauth_metadata)

  const { error: updateError } = await admin
    .from('email_connections')
    .update({
      status: 'revoked',
      oauth_metadata: revokeError
        ? {
          disconnected_at: new Date().toISOString(),
          revoke_error: revokeError,
        }
        : {
          disconnected_at: new Date().toISOString(),
        },
      sync_cursor: null,
      last_synced_at: null,
      error_message: null,
    })
    .eq('id', connection.id)

  if (updateError) {
    redirect(`/${tenantId}/email?email_error=disconnect_failed`)
  }

  revalidatePath(`/${tenantId}/email`)
  redirect(`/${tenantId}/email?email_disconnected=1`)
}

async function revokeConnectionToken(oauthMetadata: unknown) {
  try {
    const metadata = oauthMetadata && typeof oauthMetadata === 'object'
      ? oauthMetadata as Record<string, unknown>
      : {}
    const tokens = decryptOAuthTokens(metadata.encrypted_tokens)
    const tokenToRevoke = tokens.refresh_token ?? tokens.access_token

    if (!tokenToRevoke) return 'No revocable token found'

    await revokeGoogleOAuthToken(tokenToRevoke)
    return null
  } catch (error) {
    console.error('[email-google-disconnect]', error)
    return error instanceof Error ? error.message : 'Unknown token revocation error'
  }
}

function getSelectedThreadIds(formData: FormData) {
  return formData
    .getAll('thread_ids')
    .filter((value): value is string => typeof value === 'string' && Boolean(value))
}
