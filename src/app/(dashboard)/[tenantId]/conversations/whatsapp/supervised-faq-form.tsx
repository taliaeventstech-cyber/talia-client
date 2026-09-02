'use client'

import type { SupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import {
  createSupervisedFaqFromWhatsapp,
  type WhatsappSupervisedFaqState,
} from './actions'

const initialState: WhatsappSupervisedFaqState = { ok: false, message: '' }

export function WhatsappSupervisedFaqForm({
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
  const action = createSupervisedFaqFromWhatsapp.bind(
    null,
    tenantId,
    conversationId,
    assistantMessageId,
    locale,
  )
  const [state, formAction, pending] = useActionState(action, initialState)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [router, state.ok])

  if (!editorOpen) {
    return (
      <div className="supervised-faq-actions">
        <button className="button-outline button-fit" type="button" onClick={() => setEditorOpen(true)}>
          {copy.submit}
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="supervised-faq-form">
      <div className="supervised-faq-heading">
        <div>
          <strong>{copy.title}</strong>
          <p>{copy.improvementReason}</p>
        </div>
        <span className="supervised-faq-human-badge">{copy.humanReview}</span>
      </div>

      <label>
        {copy.questionLabel}
        <textarea name="question" defaultValue={question} minLength={4} maxLength={500} required rows={3} />
      </label>
      <label>
        {copy.answerLabel}
        <textarea name="answer" defaultValue={answer} minLength={4} maxLength={4_000} required rows={5} />
      </label>

      <div className="supervised-faq-footer">
        <p>{copy.languageRule}</p>
        <div className="supervised-faq-actions">
          <button className="button-outline button-fit" disabled={pending} type="button" onClick={() => setEditorOpen(false)}>
            {copy.closeEditor}
          </button>
          <button className="button-primary button-fit" disabled={pending} type="submit">
            {pending ? copy.submitting : copy.submit}
          </button>
        </div>
      </div>
      <small>{copy.disclaimer}</small>
      {state.message ? (
        <p className={state.ok ? 'form-status success' : 'form-status error'} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
