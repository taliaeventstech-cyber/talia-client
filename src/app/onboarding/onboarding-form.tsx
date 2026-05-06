'use client'

import { useActionState, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, Landmark, Music, Palette, Sparkles } from 'lucide-react'
import { createTenant, type OnboardingFormState } from './actions'

type EntityType = 'theatre' | 'museum' | 'cinema' | 'auditorium' | 'festival' | 'cultural_center' | 'other'
type Language = 'ca' | 'es' | 'en'

type FormValues = {
  entityType: EntityType
  theatreName: string
  websiteUrl: string
  primaryLanguage: Language
  fallbackEmail: string
  fallbackPhone: string
  primaryColor: string
  goals: string[]
}

const initialState: OnboardingFormState = {
  ok: false,
  message: '',
}

const STEPS = [
  { eyebrow: 'Paso 1 de 4', title: '¿Qué tipo de entidad cultural eres?' },
  { eyebrow: 'Paso 2 de 4', title: 'Datos básicos' },
  { eyebrow: 'Paso 3 de 4', title: 'Qué debe resolver TALIA' },
  { eyebrow: 'Paso 4 de 4', title: 'Ajuste visual' },
] as const

const ENTITY_OPTIONS: { value: EntityType; label: string; description: string }[] = [
  { value: 'theatre', label: 'Teatro', description: 'Programación escénica, entradas y accesibilidad.' },
  { value: 'museum', label: 'Museo', description: 'Visitas, exposiciones, horarios y entradas.' },
  { value: 'cinema', label: 'Cine', description: 'Cartelera, sesiones, entradas y promociones.' },
  { value: 'auditorium', label: 'Auditorio', description: 'Conciertos, salas, abonos y acceso.' },
  { value: 'festival', label: 'Festival', description: 'Agenda, sedes, pases y logística.' },
  { value: 'cultural_center', label: 'Centro cultural', description: 'Actividades, talleres y comunidad.' },
  { value: 'other', label: 'Otra entidad cultural', description: 'Configuración flexible para otros casos.' },
]

const GOALS = [
  { value: 'faqs', label: 'Preguntas frecuentes' },
  { value: 'agenda', label: 'Programación / agenda' },
  { value: 'tickets', label: 'Entradas / reservas' },
  { value: 'hours', label: 'Horarios' },
  { value: 'location', label: 'Ubicación / cómo llegar' },
  { value: 'accessibility', label: 'Accesibilidad' },
  { value: 'prices', label: 'Precios / descuentos' },
]

export function OnboardingForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(createTenant, initialState)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<FormValues>({
    entityType: 'theatre',
    theatreName: '',
    websiteUrl: '',
    primaryLanguage: 'es',
    fallbackEmail: email,
    fallbackPhone: '',
    primaryColor: '#000000',
    goals: ['faqs', 'agenda', 'tickets'],
  })

  const initialMessage = useMemo(() => getInitialMessage(values.primaryLanguage, values.entityType), [values.primaryLanguage, values.entityType])
  const canContinue = isStepValid(step, values)
  const currentStep = STEPS[step]

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function toggleGoal(goal: string) {
    setValues((current) => ({
      ...current,
      goals: current.goals.includes(goal)
        ? current.goals.filter((item) => item !== goal)
        : [...current.goals, goal],
    }))
  }

  return (
    <form action={action} className="onboarding-wizard">
      <input type="hidden" name="entity_type" value={values.entityType} />
      <input type="hidden" name="theatre_name" value={values.theatreName} />
      <input type="hidden" name="website_url" value={values.websiteUrl} />
      <input type="hidden" name="primary_language" value={values.primaryLanguage} />
      <input type="hidden" name="fallback_email" value={values.fallbackEmail} />
      <input type="hidden" name="fallback_phone" value={values.fallbackPhone} />
      <input type="hidden" name="primary_color" value={values.primaryColor} />
      {values.goals.map((goal) => (
        <input key={goal} type="hidden" name="onboarding_goals" value={goal} />
      ))}

      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <div className="onboarding-progress" aria-hidden="true">
        {STEPS.map((item, index) => (
          <span key={item.eyebrow} className={index <= step ? 'onboarding-progress-dot onboarding-progress-dot-active' : 'onboarding-progress-dot'} />
        ))}
      </div>

      <div className="onboarding-step">
        <p className="section-label">{currentStep.eyebrow}</p>
        <h2>{currentStep.title}</h2>

        {step === 0 ? (
          <div className="onboarding-option-grid">
            {ENTITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={values.entityType === option.value ? 'onboarding-option onboarding-option-active' : 'onboarding-option'}
                onClick={() => update('entityType', option.value)}
              >
                <span className="onboarding-option-icon">{getEntityIcon(option.value)}</span>
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="form-grid">
            <label className="field">
              Nombre de la entidad
              <input
                value={values.theatreName}
                onChange={(event) => update('theatreName', event.target.value)}
                placeholder="Teatre Nacional de Catalunya"
              />
            </label>

            <label className="field">
              Web oficial
              <input
                value={values.websiteUrl}
                onChange={(event) => update('websiteUrl', event.target.value)}
                type="url"
                placeholder="https://www.tnc.cat"
              />
            </label>

            <label className="field">
              Idioma principal
              <select value={values.primaryLanguage} onChange={(event) => update('primaryLanguage', event.target.value as Language)}>
                <option value="ca">Català</option>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className="field">
              Email de contacto
              <input
                value={values.fallbackEmail}
                onChange={(event) => update('fallbackEmail', event.target.value)}
                type="email"
                placeholder={email || 'info@entidad.com'}
              />
            </label>

            <label className="field">
              Teléfono público
              <input
                value={values.fallbackPhone}
                onChange={(event) => update('fallbackPhone', event.target.value)}
                placeholder="+34 ..."
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-goal-grid">
            {GOALS.map((goal) => (
              <button
                key={goal.value}
                type="button"
                className={values.goals.includes(goal.value) ? 'onboarding-goal onboarding-goal-active' : 'onboarding-goal'}
                onClick={() => toggleGoal(goal.value)}
              >
                <span>{goal.label}</span>
                {values.goals.includes(goal.value) ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="onboarding-preview-grid">
            <section className="stack">
              <label className="field">
                Color principal
                <input
                  value={values.primaryColor}
                  onChange={(event) => update('primaryColor', event.target.value)}
                  type="color"
                  style={{ height: 46 }}
                />
              </label>
              <p className="muted">
                TALIA usará este color para el widget. El nombre del asistente no se configura: TALIA es TALIA.
              </p>
            </section>

            <section className="onboarding-widget-preview" style={{ borderColor: values.primaryColor }}>
              <div className="onboarding-widget-header" style={{ background: values.primaryColor }}>
                TALIA
              </div>
              <div className="onboarding-widget-body">
                <p>{initialMessage}</p>
              </div>
            </section>
          </div>
        ) : null}
      </div>

      <div className="onboarding-actions">
        <button
          className="button-outline"
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || pending}
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
          Atrás
        </button>

        {step < STEPS.length - 1 ? (
          <button
            className="button-primary"
            type="button"
            onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}
            disabled={!canContinue || pending}
            style={{ opacity: !canContinue ? 0.5 : 1 }}
          >
            Continuar
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <button className="button-primary" type="submit" disabled={pending || !canContinue}>
            {pending ? 'Creando espacio...' : 'Crear espacio TALIA'}
          </button>
        )}
      </div>
    </form>
  )
}

function isStepValid(step: number, values: FormValues) {
  if (step === 1) {
    return values.theatreName.trim().length >= 2 && values.fallbackEmail.trim().length > 3
  }
  if (step === 2) return values.goals.length > 0
  return true
}

function getInitialMessage(language: Language, entityType: EntityType) {
  const entity = ENTITY_OPTIONS.find((option) => option.value === entityType)?.label.toLowerCase() ?? 'entidad cultural'
  if (language === 'ca') return `Hola, soc TALIA. En què et puc ajudar sobre aquest ${entity}?`
  if (language === 'en') return `Hi, I am TALIA. How can I help you with this ${entity}?`
  return `Hola, soy TALIA. ¿En qué puedo ayudarte sobre este ${entity}?`
}

function getEntityIcon(entityType: EntityType) {
  if (entityType === 'museum') return <Landmark size={18} strokeWidth={2} aria-hidden="true" />
  if (entityType === 'auditorium' || entityType === 'festival') return <Music size={18} strokeWidth={2} aria-hidden="true" />
  if (entityType === 'cultural_center') return <Palette size={18} strokeWidth={2} aria-hidden="true" />
  if (entityType === 'other') return <Sparkles size={18} strokeWidth={2} aria-hidden="true" />
  return <Building2 size={18} strokeWidth={2} aria-hidden="true" />
}
