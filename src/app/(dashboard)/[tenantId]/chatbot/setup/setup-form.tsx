'use client'

import { startTransition, useActionState, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Link2, MessageSquare } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { saveChatbotSetup, type ChatbotSetupState } from './actions'

type Step = 0 | 1 | 2
type Tone = 'close' | 'formal' | 'brief'
type FallbackBehavior = 'contact' | 'human' | 'unknown'

type InitialValues = {
  initialMessage: string
  primaryColor: string
  tone: Tone
  fallbackBehavior: FallbackBehavior
  sourceUrl: string
  systemPrompt: string
}

type ChatbotSetupCopy = Dictionary['chatbotSetup']

const initialState: ChatbotSetupState = {
  ok: false,
  message: '',
}

export function ChatbotSetupForm({
  copy,
  tenantId,
  initialValues,
}: {
  copy: ChatbotSetupCopy
  tenantId: string
  initialValues: InitialValues
}) {
  const [state, action, pending] = useActionState(saveChatbotSetup.bind(null, tenantId), initialState)
  const [step, setStep] = useState<Step>(0)
  const [values, setValues] = useState(initialValues)
  const normalizedSourceUrl = useMemo(() => normalizeUrl(values.sourceUrl), [values.sourceUrl])
  const sourceUrlError = getUrlError(values.sourceUrl, copy)
  const canContinue = isStepValid(step, values, sourceUrlError)

  function update<K extends keyof InitialValues>(key: K, value: InitialValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function next() {
    setStep((current) => Math.min(2, current + 1) as Step)
  }

  function back() {
    setStep((current) => Math.max(0, current - 1) as Step)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canContinue) return

    if (step < 2) {
      next()
      return
    }

    const formData = new FormData(event.currentTarget)
    startTransition(() => {
      action(formData)
    })
  }

  return (
    <form
      className="chatbot-setup-card"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="initial_message" value={values.initialMessage} />
      <input type="hidden" name="source_url" value={normalizedSourceUrl} />
      <input type="hidden" name="system_prompt" value={values.systemPrompt} />
      <input type="hidden" name="primary_color" value={values.primaryColor} />
      <input type="hidden" name="tone" value={values.tone} />
      <input type="hidden" name="fallback_behavior" value={values.fallbackBehavior} />

      <StepHeader copy={copy} activeStep={step} />

      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <div className="chatbot-setup-grid">
        <section className="chatbot-setup-main">
          {step === 0 ? <BasicStep copy={copy} values={values} update={update} /> : null}
          {step === 1 ? (
            <KnowledgeStep
              copy={copy}
              values={values}
              update={update}
              sourceUrlError={sourceUrlError}
            />
          ) : null}
          {step === 2 ? <WidgetStep copy={copy} values={values} update={update} /> : null}
        </section>

        <aside className="chatbot-setup-preview" aria-label={copy.previewLabel}>
          <div className="chatbot-widget-stage">
            <div className="chatbot-widget-panel">
              <div className="chatbot-widget-header" style={{ background: values.primaryColor }}>
                <span>TALIA</span>
                <button type="button" aria-label={copy.closePreview}>×</button>
              </div>
              <div className="chatbot-widget-messages">
                <p className="chatbot-widget-message chatbot-widget-message-assistant">
                  {values.initialMessage || copy.defaultInitialMessage}
                </p>
                <p className="chatbot-widget-message chatbot-widget-message-user" style={{ background: values.primaryColor }}>
                  {copy.previewUserMessage}
                </p>
              </div>
              <div className="chatbot-widget-form">
                <span>{copy.inputPlaceholder}</span>
                <button type="button" style={{ background: values.primaryColor }}>{copy.send}</button>
              </div>
            </div>
            <span className="chatbot-widget-toggle" style={{ background: values.primaryColor }} aria-hidden="true">
              <MessageSquare size={25} strokeWidth={2.2} />
            </span>
          </div>
        </aside>
      </div>

      <div className="chatbot-setup-actions">
        <button className="button-outline" type="button" onClick={back} disabled={step === 0 || pending}>
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
          {copy.back}
        </button>

        {step < 2 ? (
          <button
            className="button-primary"
            type="submit"
            disabled={!canContinue || pending}
            style={{ opacity: !canContinue ? 0.5 : 1 }}
          >
            {copy.continue}
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <button className="button-primary" type="submit" disabled={!canContinue || pending}>
            {pending ? copy.saving : copy.submit}
          </button>
        )}
      </div>
    </form>
  )
}

function StepHeader({ copy, activeStep }: { copy: ChatbotSetupCopy; activeStep: Step }) {
  return (
    <div className="chatbot-setup-stepper" aria-label={copy.progressLabel}>
      {copy.steps.map((label, index) => {
        const isDone = index < activeStep
        const isActive = index === activeStep
        return (
          <div key={label} className="chatbot-setup-stepper-item">
            <span className={isDone ? 'chatbot-setup-step-index chatbot-setup-step-index-done' : isActive ? 'chatbot-setup-step-index chatbot-setup-step-index-active' : 'chatbot-setup-step-index'}>
              {isDone ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : index + 1}
            </span>
            <strong>{label}</strong>
          </div>
        )
      })}
    </div>
  )
}

function BasicStep({
  copy,
  values,
  update,
}: {
  copy: ChatbotSetupCopy
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
}) {
  const basic = copy.basic
  return (
    <div className="chatbot-setup-step">
     
      <p className="section-label">{copy.stepLabel(1, 3)}</p>
      <h2>{basic.title}</h2>
      <p className="muted">{basic.description}</p>

      <label className="field">
        {basic.initialMessage}
        <textarea
          value={values.initialMessage}
          onChange={(event) => update('initialMessage', event.target.value)}
          maxLength={300}
          rows={3}
          placeholder={basic.initialMessagePlaceholder}
        />
      </label>

      <div className="chatbot-setup-option-grid">
        <ChoiceButton
          active={values.tone === 'close'}
          title={basic.tones.close.title}
          description={basic.tones.close.description}
          onClick={() => update('tone', 'close')}
        />
        <ChoiceButton
          active={values.tone === 'formal'}
          title={basic.tones.formal.title}
          description={basic.tones.formal.description}
          onClick={() => update('tone', 'formal')}
        />
        <ChoiceButton
          active={values.tone === 'brief'}
          title={basic.tones.brief.title}
          description={basic.tones.brief.description}
          onClick={() => update('tone', 'brief')}
        />
      </div>
    </div>
  )
}

function KnowledgeStep({
  copy,
  values,
  update,
  sourceUrlError,
}: {
  copy: ChatbotSetupCopy
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
  sourceUrlError: string
}) {
  const knowledge = copy.knowledge
  return (
    <div className="chatbot-setup-step">

      <p className="section-label">{copy.stepLabel(2, 3)}</p>
      <h2>{knowledge.title}</h2>
      <p className="muted">{knowledge.description}</p>

      <label className="field">
        {knowledge.sourceLabel}
        <div className="chatbot-setup-url-row">
          <Link2 size={18} strokeWidth={2} aria-hidden="true" />
          <input
            value={values.sourceUrl}
            onChange={(event) => update('sourceUrl', event.target.value)}
            type="text"
            inputMode="url"
            placeholder={knowledge.sourcePlaceholder}
            aria-invalid={Boolean(sourceUrlError)}
            aria-describedby={sourceUrlError ? 'chatbot-source-url-error' : undefined}
          />
        </div>
        {sourceUrlError ? (
          <span className="field-error" id="chatbot-source-url-error">{sourceUrlError}</span>
        ) : (
          <span className="field-hint">{knowledge.sourceHint}</span>
        )}
      </label>

      <label className="field">
        {knowledge.promptLabel}
        <textarea
          value={values.systemPrompt}
          onChange={(event) => update('systemPrompt', event.target.value)}
          rows={6}
          maxLength={8000}
          placeholder={knowledge.promptPlaceholder}
        />
      </label>
    </div>
  )
}

function WidgetStep({
  copy,
  values,
  update,
}: {
  copy: ChatbotSetupCopy
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
}) {
  const widget = copy.widget
  return (
    <div className="chatbot-setup-step">
      
      <p className="section-label">{copy.stepLabel(3, 3)}</p>
      <h2>{widget.title}</h2>
      <p className="muted">{widget.description}</p>

      <div className="field">
        {widget.color}
        <ColorPicker copy={copy} value={values.primaryColor} onChange={(color) => update('primaryColor', color)} />
      </div>

      <section className="chatbot-setup-explainer">
        <p className="section-label">{widget.fallbackTitle}</p>
        <p className="muted">{widget.fallbackDescription}</p>
      </section>

      <div className="chatbot-setup-option-grid">
        <ChoiceButton
          active={values.fallbackBehavior === 'contact'}
          title={widget.fallbackOptions.contact.title}
          description={widget.fallbackOptions.contact.description}
          onClick={() => update('fallbackBehavior', 'contact')}
        />
        <ChoiceButton
          active={values.fallbackBehavior === 'human'}
          title={widget.fallbackOptions.human.title}
          description={widget.fallbackOptions.human.description}
          onClick={() => update('fallbackBehavior', 'human')}
        />
        <ChoiceButton
          active={values.fallbackBehavior === 'unknown'}
          title={widget.fallbackOptions.unknown.title}
          description={widget.fallbackOptions.unknown.description}
          onClick={() => update('fallbackBehavior', 'unknown')}
        />
      </div>
    </div>
  )
}

function ColorPicker({ copy, value, onChange }: { copy: ChatbotSetupCopy; value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState(value)

  function commit(nextValue: string) {
    const normalized = nextValue.startsWith('#') ? nextValue : `#${nextValue}`
    setDraft(normalized)
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onChange(normalized)
    }
  }

  return (
    <div className="chatbot-color-picker">
      <label className="chatbot-color-picker-surface">
        <span className="chatbot-color-picker-preview" style={{ background: value }} aria-hidden="true" />
        <span>
          <strong>{copy.widget.brandColor}</strong>
          <small>{value.toUpperCase()}</small>
        </span>
        <input
          type="color"
          value={value}
          onChange={(event) => commit(event.target.value)}
          aria-label={copy.widget.openColorPicker}
        />
      </label>
      <label className="chatbot-color-hex">
        HEX
        <input
          value={draft}
          onBlur={() => setDraft(value)}
          onChange={(event) => commit(event.target.value.slice(0, 7))}
          spellCheck={false}
          inputMode="text"
          aria-label={copy.widget.hexColor}
        />
      </label>
    </div>
  )
}

function ChoiceButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={active ? 'chatbot-setup-choice chatbot-setup-choice-active' : 'chatbot-setup-choice'}
      onClick={onClick}
    >
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  )
}

function isStepValid(step: Step, values: InitialValues, sourceUrlError: string) {
  if (step === 0) return values.initialMessage.trim().length > 0
  if (step === 1) return !sourceUrlError
  return /^#[0-9a-fA-F]{6}$/.test(values.primaryColor)
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function getUrlError(value: string, copy: ChatbotSetupCopy) {
  const url = normalizeUrl(value)
  if (!url) return ''

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return copy.knowledge.protocolError
    }
    if (!parsed.hostname.includes('.')) {
      return copy.knowledge.domainError
    }
    return ''
  } catch {
    return copy.knowledge.urlError
  }
}
