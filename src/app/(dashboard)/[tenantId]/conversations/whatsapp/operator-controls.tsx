'use client'

import { useActionState, useEffect, useRef } from 'react'
import type { WhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import type { WhatsappHandoffActionState } from './actions'
import {
  claimWhatsappHandoffAction,
  ignoreWhatsappHandoffAction,
  sendWhatsappOperatorReplyAction,
} from './actions'

const initialState: WhatsappHandoffActionState = { ok: false, message: '' }

export function WhatsappOperatorControls({
  tenantId,
  conversationId,
  locale,
  canManage,
  isAssignedToCurrentUser,
  isAssigned,
  copy,
}: {
  tenantId: string
  conversationId: string
  locale: string
  canManage: boolean
  isAssignedToCurrentUser: boolean
  isAssigned: boolean
  copy: WhatsappHandoffCopy['controls']
}) {
  const [claimState, claimAction, claimPending] = useActionState(
    claimWhatsappHandoffAction.bind(null, tenantId, conversationId, locale),
    initialState,
  )
  const [replyState, replyAction, replyPending] = useActionState(
    sendWhatsappOperatorReplyAction.bind(null, tenantId, conversationId, locale),
    initialState,
  )
  const [ignoreState, ignoreAction, ignorePending] = useActionState(
    ignoreWhatsappHandoffAction.bind(null, tenantId, conversationId, locale),
    initialState,
  )
  const replyForm = useRef<HTMLFormElement>(null)
  const idempotencyInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (idempotencyInput.current) idempotencyInput.current.value = crypto.randomUUID()
  }, [])
  useEffect(() => {
    if (!replyState.ok || !replyState.resultId) return
    replyForm.current?.reset()
    if (idempotencyInput.current) idempotencyInput.current.value = ''
  }, [replyState.ok, replyState.resultId])

  if (!canManage) {
    return <aside className="whatsapp-operator-panel muted">{copy.readOnly}</aside>
  }

  if (isAssigned && !isAssignedToCurrentUser) {
    return <aside className="whatsapp-operator-panel muted">{copy.assignedElsewhere}</aside>
  }

  const showReplyForm = isAssignedToCurrentUser || claimState.ok

  if (!showReplyForm) {
    return (
      <aside className="whatsapp-operator-panel stack">
        <div className="whatsapp-operator-actions">
          <form action={claimAction}>
            <button className="button-primary" disabled={claimPending || ignorePending} type="submit">
              {copy.reply}
            </button>
          </form>
          <form action={ignoreAction}>
            <button className="button-outline" disabled={claimPending || ignorePending} type="submit">
              {copy.ignore}
            </button>
          </form>
        </div>
        <ActionMessage state={claimState.message ? claimState : ignoreState} hideSuccess />
      </aside>
    )
  }

  return (
    <aside className="whatsapp-operator-panel stack">
      <form
        ref={replyForm}
        action={replyAction}
        className="stack whatsapp-operator-reply-form"
        onSubmit={() => {
          if (idempotencyInput.current && !idempotencyInput.current.value) {
            idempotencyInput.current.value = crypto.randomUUID()
          }
        }}
      >
        <label className="sr-only" htmlFor="whatsapp-operator-reply">{copy.replyLabel}</label>
        <textarea
          id="whatsapp-operator-reply"
          name="body"
          maxLength={4096}
          placeholder={copy.replyPlaceholder}
          required
          rows={5}
        />
        <input ref={idempotencyInput} name="idempotencyKey" type="hidden" />
        <div className="whatsapp-operator-actions">
          <button className="button-primary button-fit" disabled={replyPending || ignorePending} type="submit">
            {copy.send}
          </button>
          <button className="button-outline" disabled={replyPending || ignorePending} form="whatsapp-ignore-form" type="submit">
            {copy.ignore}
          </button>
        </div>
      </form>
      <form action={ignoreAction} id="whatsapp-ignore-form" />
      <ActionMessage state={replyState.message ? replyState : ignoreState} />
    </aside>
  )
}

function ActionMessage({ state, hideSuccess = false }: { state: WhatsappHandoffActionState; hideSuccess?: boolean }) {
  if (!state.message || (hideSuccess && state.ok)) return null
  return (
    <p className={state.ok ? 'form-success' : 'form-error'} role="status">
      {state.message}
    </p>
  )
}
