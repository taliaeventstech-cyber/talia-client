'use client'

import { startTransition, useActionState, useState } from 'react'
import { ArrowLeft, ArrowRight, Bot, Check, Database, MessageSquare, Palette } from 'lucide-react'
import Link from 'next/link'
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
  systemPrompt: string
}

export type ChatbotSetupFormCopy = Omit<Dictionary['chatbotSetup'], 'title' | 'stepLabel'> & {
  stepLabels: readonly [string, string, string]
}

const initialState: ChatbotSetupState = {
  ok: false,
  message: '',
}

export function ChatbotSetupForm({
  copy,
  tenantId,
  skipHref,
  initialValues,
}: {
  copy: ChatbotSetupFormCopy
  tenantId: string
  skipHref?: string | null
  initialValues: InitialValues
}) {
  const [state, action, pending] = useActionState(saveChatbotSetup.bind(null, tenantId), initialState)
  const [step, setStep] = useState<Step>(0)
  const [values, setValues] = useState(initialValues)
  const [previewOpen, setPreviewOpen] = useState(true)
  const canContinue = isStepValid(step, values)

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
            />
          ) : null}
          {step === 2 ? <WidgetStep copy={copy} values={values} update={update} /> : null}
        </section>

        <aside className="chatbot-setup-preview" aria-label={copy.previewLabel}>
          <div className="chatbot-setup-preview-flow" aria-hidden="true">
            {[
              { label: copy.steps[0], Icon: Bot },
              { label: copy.steps[1], Icon: Database },
              { label: copy.steps[2], Icon: Palette },
            ].map(({ label, Icon }, index) => (
              <span
                key={label}
                className={
                  index === step
                    ? 'chatbot-setup-preview-node chatbot-setup-preview-node-active'
                    : index < step
                      ? 'chatbot-setup-preview-node chatbot-setup-preview-node-done'
                      : 'chatbot-setup-preview-node'
                }
              >
                <Icon size={18} strokeWidth={2.2} />
                {label}
              </span>
            ))}
          </div>
          <div className="chatbot-widget-stage">
            <div className={previewOpen ? 'chatbot-widget-panel' : 'chatbot-widget-panel chatbot-widget-panel-closed'}>
              <div className="chatbot-widget-header" style={{ background: values.primaryColor }}>
                <span>TALIA</span>
                <button type="button" aria-label={copy.closePreview} onClick={() => setPreviewOpen(false)}>×</button>
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
            <button
              className={previewOpen ? 'chatbot-widget-toggle chatbot-widget-toggle-active' : 'chatbot-widget-toggle'}
              type="button"
              style={{ background: values.primaryColor }}
              aria-label={previewOpen ? copy.closePreview : copy.previewLabel}
              aria-expanded={previewOpen}
              onClick={() => setPreviewOpen((current) => !current)}
            >
              <MessageSquare size={25} strokeWidth={2.2} />
            </button>
          </div>
        </aside>
      </div>

      <div className="chatbot-setup-actions">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="button-outline" type="button" onClick={back} disabled={step === 0 || pending}>
            <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
            {copy.back}
          </button>
          {skipHref ? (
            <Link className="button-outline" href={skipHref}>
              {copy.skip}
            </Link>
          ) : null}
        </div>

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

function StepHeader({ copy, activeStep }: { copy: ChatbotSetupFormCopy; activeStep: Step }) {
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
  copy: ChatbotSetupFormCopy
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
}) {
  const basic = copy.basic
  return (
    <div className="chatbot-setup-step">
     
      <p className="section-label">{copy.stepLabels[0]}</p>
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
}: {
  copy: ChatbotSetupFormCopy
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
}) {
  const knowledge = copy.knowledge
  return (
    <div className="chatbot-setup-step">

      <p className="section-label">{copy.stepLabels[1]}</p>
      <h2>{knowledge.title}</h2>
      <p className="muted">{knowledge.description}</p>

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
  copy: ChatbotSetupFormCopy
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
}) {
  const widget = copy.widget
  return (
    <div className="chatbot-setup-step">
      
      <p className="section-label">{copy.stepLabels[2]}</p>
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

function ColorPicker({ copy, value, onChange }: { copy: ChatbotSetupFormCopy; value: string; onChange: (color: string) => void }) {
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

function isStepValid(step: Step, values: InitialValues) {
  if (step === 0) return values.initialMessage.trim().length > 0
  if (step === 1) return true
  return /^#[0-9a-fA-F]{6}$/.test(values.primaryColor)
}
