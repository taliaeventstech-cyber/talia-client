'use client'

import type { InstagramConversationCopy } from '@/lib/i18n/instagram-conversation-copy'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InstagramHandoffActionState } from './actions'
import {
  claimInstagramHandoffAction,
  ignoreInstagramHandoffAction,
  sendInstagramOperatorReplyAction,
} from './actions'

const initialState: InstagramHandoffActionState = { ok: false, message: '' }

export function InstagramOperatorControls({
  tenantId,
  conversationId,
  locale,
  canManage,
  isAssignedToCurrentUser,
  isAssigned,
  windowExpired,
  copy,
}: {
  tenantId: string
  conversationId: string
  locale: string
  canManage: boolean
  isAssignedToCurrentUser: boolean
  isAssigned: boolean
  windowExpired: boolean
  copy: InstagramConversationCopy['controls']
}) {
  const router = useRouter()
  const [claimState, claimAction, claimPending] = useActionState(
    claimInstagramHandoffAction.bind(null, tenantId, conversationId, locale),
    initialState,
  )
  const [replyState, replyAction, replyPending] = useActionState(
    sendInstagramOperatorReplyAction.bind(null, tenantId, conversationId, locale),
    initialState,
  )
  const [ignoreState, ignoreAction, ignorePending] = useActionState(
    ignoreInstagramHandoffAction.bind(null, tenantId, conversationId, locale),
    initialState,
  )
  const replyForm = useRef<HTMLFormElement>(null)
  const idempotencyInput = useRef<HTMLInputElement>(null)
  const [isComposing, setIsComposing] = useState(false)

  useEffect(() => {
    if (idempotencyInput.current) idempotencyInput.current.value = crypto.randomUUID()
  }, [])
  useEffect(() => {
    if (!replyState.ok || !replyState.resultId) return
    replyForm.current?.reset()
    router.refresh()
  }, [replyState.ok, replyState.resultId, router])

  if (!canManage) return <aside className="whatsapp-operator-panel muted">{copy.readOnly}</aside>
  if (isAssigned && !isAssignedToCurrentUser) {
    return <aside className="whatsapp-operator-panel muted">{copy.assignedElsewhere}</aside>
  }

  if (windowExpired) {
    return (
      <aside className="whatsapp-operator-panel stack">
        <p>{copy.expired}</p>
        <form action={ignoreAction}>
          <button className="button-outline button-fit" disabled={ignorePending} type="submit">
            {copy.ignore}
          </button>
        </form>
        <ActionMessage state={ignoreState} />
      </aside>
    )
  }

  const showReplyForm = isComposing || claimState.ok
  if (!showReplyForm) {
    return (
      <aside className="whatsapp-operator-panel stack">
        <div className="whatsapp-operator-actions">
          {isAssignedToCurrentUser ? (
            <button className="button-primary" onClick={() => setIsComposing(true)} type="button">
              {copy.reply}
            </button>
          ) : (
            <form action={claimAction}>
              <button className="button-primary" disabled={claimPending || ignorePending} type="submit">
                {copy.reply}
              </button>
            </form>
          )}
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
        <label className="sr-only" htmlFor="instagram-operator-reply">{copy.replyLabel}</label>
        <textarea
          id="instagram-operator-reply"
          name="body"
          maxLength={1_000}
          placeholder={copy.replyPlaceholder}
          required
          rows={5}
        />
        <input ref={idempotencyInput} name="idempotencyKey" type="hidden" />
        <div className="whatsapp-operator-actions">
          <button className="button-primary button-fit" disabled={replyPending || ignorePending} type="submit">
            {copy.send}
          </button>
          <button className="button-outline" disabled={replyPending || ignorePending} form="instagram-ignore-form" type="submit">
            {copy.ignore}
          </button>
        </div>
      </form>
      <form action={ignoreAction} id="instagram-ignore-form" />
      <ActionMessage state={replyState.message ? replyState : ignoreState} />
    </aside>
  )
}

function ActionMessage({ state, hideSuccess = false }: { state: InstagramHandoffActionState; hideSuccess?: boolean }) {
  if (!state.message || (hideSuccess && state.ok)) return null
  return <p className={state.ok ? 'form-success' : 'form-error'} role="status">{state.message}</p>
}
