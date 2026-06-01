'use client'

import { startTransition, useActionState, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Database, Link2, MessageSquare, Palette } from 'lucide-react'
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

const initialState: ChatbotSetupState = {
  ok: false,
  message: '',
}

const STEPS = ['Setup básico', 'Conocimiento', 'Widget'] as const

export function ChatbotSetupForm({
  tenantId,
  initialValues,
}: {
  tenantId: string
  initialValues: InitialValues
}) {
  const [state, action, pending] = useActionState(saveChatbotSetup.bind(null, tenantId), initialState)
  const [step, setStep] = useState<Step>(0)
  const [values, setValues] = useState(initialValues)
  const normalizedSourceUrl = useMemo(() => normalizeUrl(values.sourceUrl), [values.sourceUrl])
  const sourceUrlError = getUrlError(values.sourceUrl)
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

      <StepHeader activeStep={step} />

      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <div className="chatbot-setup-grid">
        <section className="chatbot-setup-main">
          {step === 0 ? <BasicStep values={values} update={update} /> : null}
          {step === 1 ? (
            <KnowledgeStep
              values={values}
              update={update}
              sourceUrlError={sourceUrlError}
            />
          ) : null}
          {step === 2 ? <WidgetStep values={values} update={update} /> : null}
        </section>

        <aside className="chatbot-setup-preview" aria-label="Vista previa del chatbot">
          <div className="chatbot-widget-stage">
            <div className="chatbot-widget-panel">
              <div className="chatbot-widget-header" style={{ background: values.primaryColor }}>
                <span>TALIA</span>
                <button type="button" aria-label="Cerrar preview">×</button>
              </div>
              <div className="chatbot-widget-messages">
                <p className="chatbot-widget-message chatbot-widget-message-assistant">
                  {values.initialMessage || 'Hola, soy TALIA. ¿En qué puedo ayudarte?'}
                </p>
                <p className="chatbot-widget-message chatbot-widget-message-user" style={{ background: values.primaryColor }}>
                  Quiero información
                </p>
              </div>
              <div className="chatbot-widget-form">
                <span>Escribe tu mensaje...</span>
                <button type="button" style={{ background: values.primaryColor }}>Enviar</button>
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
          Atrás
        </button>

        {step < 2 ? (
          <button
            className="button-primary"
            type="submit"
            disabled={!canContinue || pending}
            style={{ opacity: !canContinue ? 0.5 : 1 }}
          >
            Continuar
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <button className="button-primary" type="submit" disabled={!canContinue || pending}>
            {pending ? 'Guardando...' : 'Guardar y entrar al Àgora'}
          </button>
        )}
      </div>
    </form>
  )
}

function StepHeader({ activeStep }: { activeStep: Step }) {
  return (
    <div className="chatbot-setup-stepper" aria-label="Progreso de configuración del chatbot">
      {STEPS.map((label, index) => {
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
  values,
  update,
}: {
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
}) {
  return (
    <div className="chatbot-setup-step">
      <span className="chatbot-setup-icon"><MessageSquare size={20} strokeWidth={2} aria-hidden="true" /></span>
      <p className="section-label">Paso 1 de 3</p>
      <h2>Define cómo debe responder TALIA</h2>
      <p className="muted">Estos ajustes marcan la primera impresión del chatbot antes de entrar en configuración avanzada.</p>

      <label className="field">
        Mensaje inicial
        <textarea
          value={values.initialMessage}
          onChange={(event) => update('initialMessage', event.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Hola, soy TALIA. ¿En qué puedo ayudarte?"
        />
      </label>

      <div className="chatbot-setup-option-grid">
        <ChoiceButton
          active={values.tone === 'close'}
          title="Cercano"
          description="Claro, amable y directo."
          onClick={() => update('tone', 'close')}
        />
        <ChoiceButton
          active={values.tone === 'formal'}
          title="Formal"
          description="Más institucional y sobrio."
          onClick={() => update('tone', 'formal')}
        />
        <ChoiceButton
          active={values.tone === 'brief'}
          title="Breve"
          description="Respuestas más compactas."
          onClick={() => update('tone', 'brief')}
        />
      </div>
    </div>
  )
}

function KnowledgeStep({
  values,
  update,
  sourceUrlError,
}: {
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
  sourceUrlError: string
}) {
  return (
    <div className="chatbot-setup-step">
      <span className="chatbot-setup-icon"><Database size={20} strokeWidth={2} aria-hidden="true" /></span>
      <p className="section-label">Paso 2 de 3</p>
      <h2>Añade la primera fuente de conocimiento</h2>
      <p className="muted">Puedes empezar con la web oficial. Luego podrás completar la base de conocimiento desde su sección propia.</p>

      <label className="field">
        Web oficial o fuente principal
        <div className="chatbot-setup-url-row">
          <Link2 size={18} strokeWidth={2} aria-hidden="true" />
          <input
            value={values.sourceUrl}
            onChange={(event) => update('sourceUrl', event.target.value)}
            type="text"
            inputMode="url"
            placeholder="www.teatro.com"
            aria-invalid={Boolean(sourceUrlError)}
            aria-describedby={sourceUrlError ? 'chatbot-source-url-error' : undefined}
          />
        </div>
        {sourceUrlError ? (
          <span className="field-error" id="chatbot-source-url-error">{sourceUrlError}</span>
        ) : (
          <span className="field-hint">Puedes escribir el dominio sin https://. TALIA lo normaliza automáticamente.</span>
        )}
      </label>

      <label className="field">
        Instrucciones internas del canal chatbot
        <textarea
          value={values.systemPrompt}
          onChange={(event) => update('systemPrompt', event.target.value)}
          rows={6}
          maxLength={8000}
          placeholder="Ejemplo: Responde siempre con tono claro, deriva a taquilla cuando no haya certeza y prioriza programación, horarios y entradas."
        />
      </label>
    </div>
  )
}

function WidgetStep({
  values,
  update,
}: {
  values: InitialValues
  update: <K extends keyof InitialValues>(key: K, value: InitialValues[K]) => void
}) {
  return (
    <div className="chatbot-setup-step">
      <span className="chatbot-setup-icon"><Palette size={20} strokeWidth={2} aria-hidden="true" /></span>
      <p className="section-label">Paso 3 de 3</p>
      <h2>Ajusta la presencia del widget</h2>
      <p className="muted">Deja una base visual coherente. Los detalles finos siguen disponibles en la configuración del chatbot.</p>

      <div className="field">
        Color principal
        <ColorPicker value={values.primaryColor} onChange={(color) => update('primaryColor', color)} />
      </div>

      <div className="chatbot-setup-option-grid">
        <ChoiceButton
          active={values.fallbackBehavior === 'contact'}
          title="Derivar a contacto"
          description="Muestra contacto oficial si no hay certeza."
          onClick={() => update('fallbackBehavior', 'contact')}
        />
        <ChoiceButton
          active={values.fallbackBehavior === 'human'}
          title="Pedir revisión"
          description="Marca los casos dudosos para humano."
          onClick={() => update('fallbackBehavior', 'human')}
        />
        <ChoiceButton
          active={values.fallbackBehavior === 'unknown'}
          title="Responder sin inventar"
          description="Admite falta de información."
          onClick={() => update('fallbackBehavior', 'unknown')}
        />
      </div>
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
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
          <strong>Color de marca</strong>
          <small>{value.toUpperCase()}</small>
        </span>
        <input
          type="color"
          value={value}
          onChange={(event) => commit(event.target.value)}
          aria-label="Abrir selector de color"
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
          aria-label="Color en formato hexadecimal"
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

function getUrlError(value: string) {
  const url = normalizeUrl(value)
  if (!url) return ''

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'La web debe empezar por https:// o http://'
    }
    if (!parsed.hostname.includes('.')) {
      return 'Introduce un dominio válido, por ejemplo https://www.tnc.cat'
    }
    return ''
  } catch {
    return 'Introduce una URL válida, por ejemplo https://www.tnc.cat'
  }
}
