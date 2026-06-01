'use client'

import { useActionState, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Globe2, Landmark, Mail, MessageSquare, Sparkles, Ticket } from 'lucide-react'
import Image from 'next/image'
import { createTenant, type OnboardingFormState } from './actions'

type EntityType = 'theatre' | 'museum' | 'cinema' | 'auditorium' | 'festival' | 'cultural_center' | 'other'
type Language = 'ca' | 'es' | 'en'
type WorkspaceStep = 0 | 1 | 2

type FormValues = {
  fullName: string
  role: string
  heardAbout: string
  deployTimeline: string
  entityType: EntityType
  theatreName: string
  websiteUrl: string
  primaryLanguage: Language
  fallbackEmail: string
  fallbackPhone: string
  goals: string[]
}

const initialState: OnboardingFormState = {
  ok: false,
  message: '',
}

const WORKSPACE_STEPS = ['Sobre ti', 'Sobre tu entidad', 'Casos de uso'] as const

const ROLE_OPTIONS = [
  'Dirección / gerencia',
  'Marketing / comunicación',
  'Atención al público',
  'Ticketing / taquilla',
  'Producción',
  'Equipo técnico',
  'Otro',
]

const HEARD_ABOUT_OPTIONS = ['Recomendación', 'Google', 'LinkedIn', 'Evento del sector', 'Equipo TALIA', 'Otro']
const DEPLOY_TIMELINES = ['Esta semana', 'Este mes', 'En 1-3 meses', 'Solo estoy explorando']

const ENTITY_OPTIONS: { value: EntityType; label: string; description: string }[] = [
  { value: 'theatre', label: 'Teatro', description: 'Programación escénica, entradas y accesibilidad.' },
  { value: 'museum', label: 'Museo', description: 'Visitas, exposiciones, horarios y entradas.' },
  { value: 'cinema', label: 'Cine', description: 'Cartelera, sesiones, entradas y promociones.' },
  { value: 'auditorium', label: 'Auditorio', description: 'Conciertos, salas, abonos y acceso.' },
  { value: 'festival', label: 'Festival', description: 'Agenda, sedes, pases y logística.' },
  { value: 'cultural_center', label: 'Centro cultural', description: 'Actividades, talleres y comunidad.' },
  { value: 'other', label: 'Otra entidad cultural', description: 'Configuración flexible para otros casos.' },
]

const USE_CASES = [
  { value: 'faqs', label: 'Preguntas frecuentes', icon: MessageSquare },
  { value: 'agenda', label: 'Programación / agenda', icon: Sparkles },
  { value: 'tickets', label: 'Entradas / reservas', icon: Ticket },
  { value: 'hours', label: 'Horarios', icon: Globe2 },
  { value: 'location', label: 'Ubicación / cómo llegar', icon: Landmark },
  { value: 'accessibility', label: 'Accesibilidad', icon: Check },
  { value: 'prices', label: 'Precios / descuentos', icon: Ticket },
  { value: 'email', label: 'Agente de email', icon: Mail },
]

const MAX_USE_CASES = 3

export function OnboardingForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(createTenant, initialState)
  const [workspaceStep, setWorkspaceStep] = useState<WorkspaceStep>(0)
  const [values, setValues] = useState<FormValues>({
    fullName: '',
    role: '',
    heardAbout: '',
    deployTimeline: '',
    entityType: 'theatre',
    theatreName: '',
    websiteUrl: '',
    primaryLanguage: 'es',
    fallbackEmail: email,
    fallbackPhone: '',
    goals: [],
  })

  const websiteUrlError = getWebsiteUrlError(values.websiteUrl)
  const normalizedWebsiteUrl = useMemo(() => normalizeWebsiteUrl(values.websiteUrl), [values.websiteUrl])
  const canContinue = isWorkspaceStepValid(workspaceStep, values, websiteUrlError)

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function toggleGoal(goal: string) {
    setValues((current) => ({
      ...current,
      goals: current.goals.includes(goal)
        ? current.goals.filter((item) => item !== goal)
        : current.goals.length >= MAX_USE_CASES
          ? current.goals
          : [...current.goals, goal],
    }))
  }

  function handleNext() {
    if (workspaceStep < 2) {
      setWorkspaceStep((current) => (current + 1) as WorkspaceStep)
    }
  }

  function handleBack() {
    setWorkspaceStep((current) => Math.max(0, current - 1) as WorkspaceStep)
  }

  return (
    <form action={action} className="onboarding-flow">
      <input type="hidden" name="full_name" value={values.fullName} />
      <input type="hidden" name="user_role" value={values.role} />
      <input type="hidden" name="heard_about" value={values.heardAbout} />
      <input type="hidden" name="deploy_timeline" value={values.deployTimeline} />
      <input type="hidden" name="entity_type" value={values.entityType} />
      <input type="hidden" name="theatre_name" value={values.theatreName} />
      <input type="hidden" name="website_url" value={normalizedWebsiteUrl} />
      <input type="hidden" name="primary_language" value={values.primaryLanguage} />
      <input type="hidden" name="fallback_email" value={values.fallbackEmail} />
      <input type="hidden" name="fallback_phone" value={values.fallbackPhone} />
      {values.goals.map((goal) => (
        <input key={goal} type="hidden" name="onboarding_goals" value={goal} />
      ))}

      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <StepHeader steps={WORKSPACE_STEPS} activeStep={workspaceStep} />

      <div className="onboarding-panel">
        <section className="onboarding-panel-main">
          {workspaceStep === 0 ? (
            <WorkspaceAboutYou values={values} update={update} />
          ) : null}

          {workspaceStep === 1 ? (
            <WorkspaceCompany
              values={values}
              update={update}
              email={email}
              websiteUrlError={websiteUrlError}
            />
          ) : null}

          {workspaceStep === 2 ? (
            <WorkspaceUseCases goals={values.goals} toggleGoal={toggleGoal} />
          ) : null}

        </section>

        <OnboardingVisual />
      </div>

      <div className="onboarding-actions">
        <button
          className="button-outline"
          type="button"
          onClick={handleBack}
          disabled={workspaceStep === 0 || pending}
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
          Atrás
        </button>

        {workspaceStep < 2 ? (
          <button
            className="button-primary"
            type="button"
            onClick={handleNext}
            disabled={!canContinue || pending}
            style={{ opacity: !canContinue ? 0.5 : 1 }}
          >
            Continuar
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <button className="button-primary" type="submit" disabled={!canContinue || pending}>
            {pending ? 'Creando espacio...' : 'Configurar chatbot'}
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  )
}

function StepHeader({ steps, activeStep }: { steps: readonly string[]; activeStep: number }) {
  return (
    <div className="onboarding-stepper" aria-label="Progreso del onboarding">
      {steps.map((label, index) => {
        const isDone = index < activeStep
        const isActive = index === activeStep
        return (
          <div key={label} className="onboarding-stepper-item">
          <span className={isDone ? 'onboarding-stepper-index onboarding-stepper-index-done' : isActive ? 'onboarding-stepper-index onboarding-stepper-index-active' : 'onboarding-stepper-index'}>
              {isDone ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : index + 1}
            </span>
            <strong>{label}</strong>
          </div>
        )
      })}
    </div>
  )
}

function WorkspaceAboutYou({
  values,
  update,
}: {
  values: FormValues
  update: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void
}) {
  return (
    <div className="onboarding-step-content">
      <p className="section-label">Paso 1 de 3</p>
      <h2>Bienvenido a TALIA</h2>
      <p className="muted">Queremos entender tu contexto para preparar una experiencia útil desde el primer minuto.</p>

      <label className="field">
        Nombre completo
        <input value={values.fullName} onChange={(event) => update('fullName', event.target.value)} placeholder="Nombre y apellidos" />
      </label>

      <label className="field">
        ¿Qué describe mejor tu rol?
        <select value={values.role} onChange={(event) => update('role', event.target.value)}>
          <option value="">Selecciona una opción</option>
          {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>

      <label className="field">
        ¿Cómo nos conociste?
        <select value={values.heardAbout} onChange={(event) => update('heardAbout', event.target.value)}>
          <option value="">Selecciona una opción</option>
          {HEARD_ABOUT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>

      <label className="field">
        ¿Cuándo quieres activar TALIA?
        <select value={values.deployTimeline} onChange={(event) => update('deployTimeline', event.target.value)}>
          <option value="">Selecciona una opción</option>
          {DEPLOY_TIMELINES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </div>
  )
}

function WorkspaceCompany({
  values,
  update,
  email,
  websiteUrlError,
}: {
  values: FormValues
  update: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void
  email: string
  websiteUrlError: string
}) {
  return (
    <div className="onboarding-step-content">
      <p className="section-label">Paso 2 de 3</p>
      <h2>Sobre tu entidad</h2>
      <p className="muted">Estos datos crean el primer espacio de trabajo y el núcleo común de conocimiento.</p>

      <label className="field">
        Nombre de la entidad
        <input value={values.theatreName} onChange={(event) => update('theatreName', event.target.value)} placeholder="Teatre Nacional de Catalunya" />
      </label>

      <label className="field">
        Tipo de entidad
        <select value={values.entityType} onChange={(event) => update('entityType', event.target.value as EntityType)}>
          {ENTITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      <label className="field">
        Web oficial
        <input
          value={values.websiteUrl}
          onChange={(event) => update('websiteUrl', event.target.value)}
          type="text"
          inputMode="url"
          placeholder="www.tnc.cat"
          aria-invalid={Boolean(websiteUrlError)}
          aria-describedby={websiteUrlError ? 'website-url-error' : undefined}
        />
        {websiteUrlError ? (
          <span className="field-error" id="website-url-error">{websiteUrlError}</span>
        ) : (
          <span className="field-hint">Puedes escribir el dominio sin https://. TALIA lo normaliza automáticamente.</span>
        )}
      </label>

      <div className="form-grid two-columns">
        <label className="field">
          Idioma principal
          <select value={values.primaryLanguage} onChange={(event) => update('primaryLanguage', event.target.value as Language)}>
            <option value="ca">Català</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>

        <label className="field">
          Email público
          <input value={values.fallbackEmail} onChange={(event) => update('fallbackEmail', event.target.value)} type="email" placeholder={email || 'info@entidad.com'} />
        </label>
      </div>

      <label className="field">
        Teléfono público
        <input value={values.fallbackPhone} onChange={(event) => update('fallbackPhone', event.target.value)} placeholder="+34 ..." />
      </label>
    </div>
  )
}

function WorkspaceUseCases({ goals, toggleGoal }: { goals: string[]; toggleGoal: (goal: string) => void }) {
  return (
    <div className="onboarding-step-content">
      <p className="section-label">Paso 3 de 3</p>
      <h2>¿Qué quieres resolver primero?</h2>
      <p className="muted">Elige hasta 3 casos de uso iniciales. Podrás ajustar prioridades más adelante.</p>

      <div className="onboarding-choice-list">
        {USE_CASES.map((goal) => {
          const Icon = goal.icon
          const selected = goals.includes(goal.value)
          const disabled = !selected && goals.length >= MAX_USE_CASES
          return (
            <button
              key={goal.value}
              type="button"
              className={selected ? 'onboarding-choice onboarding-choice-active' : 'onboarding-choice'}
              disabled={disabled}
              onClick={() => toggleGoal(goal.value)}
            >
              <span className="onboarding-choice-label">
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                {goal.label}
              </span>
              <span className="onboarding-checkbox">{selected ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : null}</span>
            </button>
          )
        })}
      </div>
      <span className="field-hint">{goals.length}/{MAX_USE_CASES} seleccionados</span>
    </div>
  )
}

function OnboardingVisual() {
  return (
    <aside className="onboarding-visual">
      <div className="onboarding-visual-card">
        <div className="onboarding-visual-icon">
          <Image src="/talia-logo-marble.png" alt="" width={132} height={36} />
        </div>
      </div>
    </aside>
  )
}

function isWorkspaceStepValid(step: WorkspaceStep, values: FormValues, websiteUrlError: string) {
  if (step === 0) {
    return values.fullName.trim().length >= 2 && Boolean(values.role) && Boolean(values.heardAbout) && Boolean(values.deployTimeline)
  }
  if (step === 1) {
    return (
      values.theatreName.trim().length >= 2
      && values.fallbackEmail.trim().length > 3
      && !websiteUrlError
    )
  }
  return values.goals.length > 0
}

function getWebsiteUrlError(value: string) {
  const url = normalizeWebsiteUrl(value)
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

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
