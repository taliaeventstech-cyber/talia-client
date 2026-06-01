'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { syncAndMaybeProcessEmail } from '@/lib/email/automation'
import { processEmailMessage } from '@/lib/email/service'
import { deleteGmailDraft } from '@/lib/email/gmail'
import { getFreshGoogleAccessToken } from '@/lib/email/google-tokens'
import { decryptOAuthTokens, revokeGoogleOAuthToken } from '@/lib/email/google-oauth'
import { getFreshMicrosoftAccessToken } from '@/lib/email/microsoft-tokens'
import { deleteOutlookDraft } from '@/lib/email/outlook'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function syncLatestEmailAction(tenantId: string) {
  await requireTenantProductAccess(tenantId, 'manage_email', 'email')

  const result = await syncAndMaybeProcessEmail(createAdminClient(), tenantId)

  if (!result.ok) {
    redirect(`/${tenantId}/email?email_sync_error=${encodeURIComponent(result.error)}`)
  }

  revalidatePath(`/${tenantId}/email`)
  redirect(`/${tenantId}/email?email_synced=${result.imported}&email_auto_processed=${result.processed}`)
}

export async function processSelectedEmailThreadsAction(tenantId: string, formData: FormData) {
  await requireTenantProductAccess(tenantId, 'manage_email', 'email')

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
  await requireTenantProductAccess(tenantId, 'manage_email', 'email')

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

export async function deleteEmailDraftAction(tenantId: string, draftId: string) {
  await requireTenantProductAccess(tenantId, 'manage_email', 'email')

  const admin = createAdminClient()
  const { data: drafts, error: fetchError } = await admin
    .from('email_drafts')
    .select('id, thread_id')
    .eq('theatre_id', tenantId)
    .eq('id', draftId)
    .limit(1)

  if (fetchError || !drafts?.length) {
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent(fetchError?.message ?? 'No se ha encontrado el draft')}`)
  }

  const { error } = await admin
    .from('email_drafts')
    .delete()
    .eq('theatre_id', tenantId)
    .eq('id', draftId)

  if (error) {
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent(error.message)}`)
  }

  await resetThreadsWithoutDrafts(admin, tenantId, drafts.map((draft) => draft.thread_id).filter(Boolean))
  revalidatePath(`/${tenantId}/email`)
  redirect(`/${tenantId}/email?email_draft_deleted=local`)
}

export async function deleteProviderEmailDraftAction(tenantId: string, draftId: string) {
  await requireTenantProductAccess(tenantId, 'manage_email', 'email')

  const admin = createAdminClient()
  const { data: draft, error } = await admin
    .from('email_drafts')
    .select('id, connection_id, thread_id, provider_draft_id, email_connections!inner(id, provider, oauth_metadata)')
    .eq('theatre_id', tenantId)
    .eq('id', draftId)
    .maybeSingle()

  const connection = Array.isArray(draft?.email_connections)
    ? draft?.email_connections[0]
    : draft?.email_connections

  if (error || !draft || !connection) {
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent(error?.message ?? 'No se ha encontrado el draft')}`)
  }

  if (!draft.provider_draft_id || !['google', 'microsoft'].includes(connection.provider)) {
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent('Este draft no tiene borrador de proveedor asociado')}`)
  }

  try {
    await deleteProviderDraft(admin, connection, draft.provider_draft_id)
  } catch (deleteError) {
    const message = deleteError instanceof Error ? deleteError.message : 'No se ha podido eliminar el draft en el buzón'
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent(message)}`)
  }

  const { error: localDeleteError } = await admin
    .from('email_drafts')
    .delete()
    .eq('theatre_id', tenantId)
    .eq('id', draft.id)

  if (localDeleteError) {
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent(localDeleteError.message)}`)
  }

  await resetThreadsWithoutDrafts(admin, tenantId, draft.thread_id ? [draft.thread_id] : [])
  revalidatePath(`/${tenantId}/email`)
  redirect(`/${tenantId}/email?email_draft_deleted=provider`)
}

export async function deleteSelectedEmailDraftsAction(tenantId: string, formData: FormData) {
  await requireTenantProductAccess(tenantId, 'manage_email', 'email')

  const singleDraftId = formData.get('single_draft_id')
  const draftIds = typeof singleDraftId === 'string' && singleDraftId
    ? [singleDraftId]
    : getSelectedDraftIds(formData)
  if (!draftIds.length) {
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent('Selecciona al menos un draft')}`)
  }

  const shouldDeleteProviderDrafts = formData.get('draft_delete_scope') === 'provider'
  const admin = createAdminClient()
  const { data: drafts, error: fetchError } = await admin
    .from('email_drafts')
    .select('id, thread_id, provider_draft_id, email_connections!inner(id, provider, oauth_metadata)')
    .eq('theatre_id', tenantId)
    .in('id', draftIds)

  if (fetchError || !drafts?.length) {
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent(fetchError?.message ?? 'No se han encontrado drafts válidos')}`)
  }

  let providerDeleted = 0
  let providerFailed = 0
  const accessTokens = new Map<string, string>()

  if (shouldDeleteProviderDrafts) {
    for (const draft of drafts) {
      const connection = Array.isArray(draft.email_connections)
        ? draft.email_connections[0]
        : draft.email_connections

      if (!draft.provider_draft_id || !connection || !['google', 'microsoft'].includes(connection.provider)) continue

      try {
        await deleteProviderDraft(admin, connection, draft.provider_draft_id, accessTokens)
        providerDeleted += 1
      } catch {
        providerFailed += 1
      }
    }
  }

  const { error: localDeleteError } = await admin
    .from('email_drafts')
    .delete()
    .eq('theatre_id', tenantId)
    .in('id', drafts.map((draft) => draft.id))

  if (localDeleteError) {
    redirect(`/${tenantId}/email?email_draft_delete_error=${encodeURIComponent(localDeleteError.message)}`)
  }

  await resetThreadsWithoutDrafts(admin, tenantId, drafts.map((draft) => draft.thread_id).filter(Boolean))
  revalidatePath(`/${tenantId}/email`)
  redirect(`/${tenantId}/email?email_drafts_deleted=${drafts.length}&email_provider_drafts_deleted=${providerDeleted}&email_provider_drafts_failed=${providerFailed}`)
}

export async function disconnectGoogleEmailAction(tenantId: string) {
  await requireTenantProductAccess(tenantId, 'manage_email', 'email')

  const admin = createAdminClient()
  const { data: connection, error } = await admin
    .from('email_connections')
    .select('id, provider, oauth_metadata')
    .eq('theatre_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !connection) {
    redirect(`/${tenantId}/email?email_error=no_connection`)
  }

  const revokeError = await revokeConnectionToken(connection.provider, connection.oauth_metadata)

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

async function deleteProviderDraft(
  admin: ReturnType<typeof createAdminClient>,
  connection: { id: string; provider: string; oauth_metadata: Json },
  draftId: string,
  tokenCache?: Map<string, string>,
) {
  const cachedToken = tokenCache?.get(connection.id)
  const accessToken = cachedToken ?? (connection.provider === 'microsoft'
    ? await getFreshMicrosoftAccessToken(admin, {
      id: connection.id,
      oauth_metadata: connection.oauth_metadata,
    })
    : await getFreshGoogleAccessToken(admin, {
      id: connection.id,
      oauth_metadata: connection.oauth_metadata,
    }))

  tokenCache?.set(connection.id, accessToken)

  if (connection.provider === 'microsoft') {
    await deleteOutlookDraft(accessToken, draftId)
    return
  }

  await deleteGmailDraft(accessToken, draftId)
}

async function revokeConnectionToken(provider: string, oauthMetadata: unknown) {
  try {
    if (provider === 'microsoft') return null

    const metadata = oauthMetadata && typeof oauthMetadata === 'object'
      ? oauthMetadata as Record<string, unknown>
      : {}
    const tokens = decryptOAuthTokens(metadata.encrypted_tokens)
    const tokenToRevoke = tokens.refresh_token ?? tokens.access_token

    if (!tokenToRevoke) return 'No revocable token found'

    await revokeGoogleOAuthToken(tokenToRevoke)
    return null
  } catch (error) {
    console.error('[email-disconnect]', error)
    return error instanceof Error ? error.message : 'Unknown token revocation error'
  }
}

function getSelectedThreadIds(formData: FormData) {
  return formData
    .getAll('thread_ids')
    .filter((value): value is string => typeof value === 'string' && Boolean(value))
}

function getSelectedDraftIds(formData: FormData) {
  return formData
    .getAll('draft_ids')
    .filter((value): value is string => typeof value === 'string' && Boolean(value))
}

async function resetThreadsWithoutDrafts(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  threadIds: (string | null)[],
) {
  const uniqueThreadIds = Array.from(new Set(threadIds.filter((threadId): threadId is string => Boolean(threadId))))
  if (!uniqueThreadIds.length) return

  const { data: remainingDrafts } = await admin
    .from('email_drafts')
    .select('thread_id')
    .eq('theatre_id', tenantId)
    .in('thread_id', uniqueThreadIds)

  const threadsWithDrafts = new Set((remainingDrafts ?? []).map((draft) => draft.thread_id).filter(Boolean))
  const threadsWithoutDrafts = uniqueThreadIds.filter((threadId) => !threadsWithDrafts.has(threadId))
  if (!threadsWithoutDrafts.length) return

  await admin
    .from('email_threads')
    .update({ status: 'new' })
    .eq('theatre_id', tenantId)
    .eq('status', 'drafted')
    .in('id', threadsWithoutDrafts)
}
