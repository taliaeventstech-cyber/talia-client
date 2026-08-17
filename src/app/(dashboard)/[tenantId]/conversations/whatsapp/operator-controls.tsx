'use client'

import { useActionState, useEffect, useRef } from 'react'
import type { WhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import type { WhatsappHandoffActionState } from './actions'
import {
  claimWhatsappHandoffAction,
  resolveWhatsappHandoffAction,
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
  const [resolveState, resolveAction, resolvePending] = useActionState(
    resolveWhatsappHandoffAction.bind(null, tenantId, conversationId, locale),
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

  if (!isAssigned) {
    return (
      <aside className="whatsapp-operator-panel stack">
        <p className="muted">{copy.claimFirst}</p>
        <form action={claimAction}>
          <button className="button-primary" disabled={claimPending} type="submit">
            {copy.claim}
          </button>
        </form>
        <ActionMessage state={claimState} />
      </aside>
    )
  }

  if (!isAssignedToCurrentUser) {
    return <aside className="whatsapp-operator-panel muted">{copy.assignedElsewhere}</aside>
  }

  return (
    <aside className="whatsapp-operator-panel stack">
      <strong>{copy.claimedByYou}</strong>
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
        <label htmlFor="whatsapp-operator-reply">{copy.replyLabel}</label>
        <textarea
          id="whatsapp-operator-reply"
          name="body"
          maxLength={4096}
          placeholder={copy.replyPlaceholder}
          required
          rows={5}
        />
        <input ref={idempotencyInput} name="idempotencyKey" type="hidden" />
        <button className="button-primary button-fit" disabled={replyPending} type="submit">
          {copy.send}
        </button>
      </form>
      <form action={resolveAction}>
        <button className="button-outline" disabled={resolvePending || replyPending} type="submit">
          {copy.resolve}
        </button>
      </form>
      <ActionMessage state={replyState.message ? replyState : resolveState} />
    </aside>
  )
}

function ActionMessage({ state }: { state: WhatsappHandoffActionState }) {
  if (!state.message) return null
  return (
    <p className={state.ok ? 'form-success' : 'form-error'} role="status">
      {state.message}
    </p>
  )
}
