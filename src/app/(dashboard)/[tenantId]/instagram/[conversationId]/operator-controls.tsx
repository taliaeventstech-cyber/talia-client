'use client'

import type { InstagramConversationCopy } from '@/lib/i18n/instagram-conversation-copy'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InstagramHandoffActionState } from './actions'
import {
  claimInstagramHandoffAction,
  ignoreInstagramHandoffAction,
  releaseInstagramConversationAction,
  sendInstagramOperatorReplyAction,
  takeOverInstagramConversationAction,
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
  variant = 'handoff',
}: {
  tenantId: string
  conversationId: string
  locale: string
  canManage: boolean
  isAssignedToCurrentUser: boolean
  isAssigned: boolean
  windowExpired: boolean
  copy: InstagramConversationCopy['controls']
  variant?: 'handoff' | 'manual-available' | 'manual-active'
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
  const [takeoverState, takeoverAction, takeoverPending] = useActionState(
    takeOverInstagramConversationAction.bind(null, tenantId, conversationId, locale),
    initialState,
  )
  const [releaseState, releaseAction, releasePending] = useActionState(
    releaseInstagramConversationAction.bind(null, tenantId, conversationId, locale),
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
    if (idempotencyInput.current) idempotencyInput.current.value = ''
    router.refresh()
  }, [replyState.ok, replyState.resultId, router])
  useEffect(() => {
    if (!takeoverState.ok && !releaseState.ok) return
    router.refresh()
  }, [releaseState.ok, router, takeoverState.ok])

  if (!canManage) return <aside className="whatsapp-operator-panel muted">{copy.readOnly}</aside>
  if (isAssigned && !isAssignedToCurrentUser) {
    return <aside className="whatsapp-operator-panel muted">{copy.assignedElsewhere}</aside>
  }

  if (variant === 'manual-available') {
    return (
      <aside className="whatsapp-operator-panel stack">
        <p>{copy.manualAvailable}</p>
        <form action={takeoverAction}>
          <button className="button-primary button-fit" disabled={takeoverPending} type="submit">
            {takeoverPending ? copy.takingOver : copy.takeOver}
          </button>
        </form>
        <ActionMessage state={takeoverState} />
      </aside>
    )
  }

  if (windowExpired) {
    return (
      <aside className="whatsapp-operator-panel stack">
        <p>{copy.expired}</p>
        <form action={variant === 'manual-active' ? releaseAction : ignoreAction}>
          <button
            className="button-outline button-fit"
            disabled={variant === 'manual-active' ? releasePending : ignorePending}
            type="submit"
          >
            {variant === 'manual-active'
              ? releasePending ? copy.returningToTalia : copy.returnToTalia
              : copy.ignore}
          </button>
        </form>
        <ActionMessage state={variant === 'manual-active' ? releaseState : ignoreState} />
      </aside>
    )
  }

  const showReplyForm = variant === 'manual-active' ? isComposing : isComposing || claimState.ok
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
          {variant === 'manual-active' ? (
            <form action={releaseAction}>
              <button className="button-outline" disabled={releasePending} type="submit">
                {releasePending ? copy.returningToTalia : copy.returnToTalia}
              </button>
            </form>
          ) : (
            <form action={ignoreAction}>
              <button className="button-outline" disabled={claimPending || ignorePending} type="submit">
                {copy.ignore}
              </button>
            </form>
          )}
        </div>
        <ActionMessage
          state={claimState.message ? claimState : releaseState.message ? releaseState : ignoreState}
          hideSuccess={variant !== 'manual-active'}
        />
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
          {variant === 'manual-active' ? (
            <button className="button-outline" disabled={replyPending || releasePending} form="instagram-release-form" type="submit">
              {releasePending ? copy.returningToTalia : copy.returnToTalia}
            </button>
          ) : (
            <button className="button-outline" disabled={replyPending || ignorePending} form="instagram-ignore-form" type="submit">
              {copy.ignore}
            </button>
          )}
        </div>
      </form>
      <form action={ignoreAction} id="instagram-ignore-form" />
      <form action={releaseAction} id="instagram-release-form" />
      <ActionMessage state={replyState.message ? replyState : releaseState.message ? releaseState : ignoreState} />
    </aside>
  )
}

function ActionMessage({ state, hideSuccess = false }: { state: InstagramHandoffActionState; hideSuccess?: boolean }) {
  if (!state.message || (hideSuccess && state.ok)) return null
  return <p className={state.ok ? 'form-success' : 'form-error'} role="status">{state.message}</p>
}
