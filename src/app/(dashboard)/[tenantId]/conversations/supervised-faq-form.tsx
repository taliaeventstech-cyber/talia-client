'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import {
  acceptConversationResponse,
  createSupervisedFaqFromConversation,
  type SupervisedFaqState,
} from './actions'
import type { SupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'

const initialState: SupervisedFaqState = {
  ok: false,
  message: '',
}

export function SupervisedFaqForm({
  tenantId,
  conversationId,
  assistantMessageId,
  question,
  answer,
  locale,
  copy,
}: {
  tenantId: string
  conversationId: string
  assistantMessageId: string
  question: string
  answer: string
  locale: string
  copy: SupervisedFaqCopy['form']
}) {
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const [acceptConfirmationOpen, setAcceptConfirmationOpen] = useState(false)
  const createAction = createSupervisedFaqFromConversation.bind(
    null,
    tenantId,
    conversationId,
    assistantMessageId,
    locale,
  )
  const acceptAction = acceptConversationResponse.bind(
    null,
    tenantId,
    conversationId,
    assistantMessageId,
    locale,
  )
  const [createState, createFormAction, creating] = useActionState(createAction, initialState)
  const [acceptState, acceptFormAction, accepting] = useActionState(acceptAction, initialState)

  useEffect(() => {
    if (createState.ok || acceptState.ok) router.refresh()
  }, [acceptState.ok, createState.ok, router])

  const heading = (
    <div className="supervised-faq-heading">
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.improvementReason}</p>
      </div>
      <span className="supervised-faq-human-badge">{copy.humanReview}</span>
    </div>
  )

  if (editorOpen) {
    return (
      <form action={createFormAction} className="supervised-faq-form">
        {heading}

        <label>
          {copy.questionLabel}
          <textarea name="question" defaultValue={question} minLength={4} maxLength={500} required rows={2} />
        </label>

        <label>
          {copy.answerLabel}
          <textarea
            name="answer"
            defaultValue={answer}
            minLength={4}
            maxLength={4_000}
            placeholder={copy.answerPlaceholder}
            required
            rows={5}
          />
        </label>

        <div className="supervised-faq-footer">
          <p>{copy.languageRule}</p>
          <div className="supervised-faq-actions">
            <button
              className="button-outline button-fit"
              type="button"
              disabled={creating}
              onClick={() => setEditorOpen(false)}
            >
              {copy.closeEditor}
            </button>
            <button className="button-primary button-fit" type="submit" disabled={creating}>
              {creating ? copy.submitting : copy.submit}
            </button>
          </div>
        </div>

        <small>{copy.disclaimer}</small>
        {createState.message ? (
          <p className={createState.ok ? 'form-status success' : 'form-status error'} role="status">
            {createState.message}
          </p>
        ) : null}
      </form>
    )
  }

  if (acceptConfirmationOpen) {
    return (
      <form action={acceptFormAction} className="supervised-faq-form">
        {heading}
        <div className="supervised-response-accept-confirmation">
          <strong>{copy.acceptPrompt}</strong>
          <p>{copy.acceptDescription}</p>
        </div>
        <div className="supervised-faq-actions">
          <button
            className="button-outline button-fit"
            type="button"
            disabled={accepting}
            onClick={() => setAcceptConfirmationOpen(false)}
          >
            {copy.cancel}
          </button>
          <button className="button-primary button-fit" type="submit" disabled={accepting}>
            {accepting ? copy.accepting : copy.confirmAccept}
          </button>
        </div>
        {acceptState.message ? (
          <p className={acceptState.ok ? 'form-status success' : 'form-status error'} role="status">
            {acceptState.message}
          </p>
        ) : null}
      </form>
    )
  }

  return (
    <div className="supervised-faq-form">
      {heading}
      <div className="supervised-faq-actions">
        <button className="button-primary button-fit" type="button" onClick={() => setEditorOpen(true)}>
          {copy.editResponse}
        </button>
        <button className="button-outline button-fit" type="button" onClick={() => setAcceptConfirmationOpen(true)}>
          {copy.acceptResponse}
        </button>
      </div>
    </div>
  )
}
