'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Globe2, Landmark, Mail, MessageSquare, Sparkles, Ticket } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { createTenant, type OnboardingFormState } from './actions'
import { InternationalPhoneInput } from '@/components/ui/international-phone-input'
import { getDefaultPhoneCountry, normalizeInternationalPhoneValue } from '@/lib/phone/international'
import type { TenantLanguage } from '@/lib/tenants/language'

type EntityType = 'theatre' | 'museum' | 'cinema' | 'auditorium' | 'festival' | 'cultural_center' | 'other'
type WorkspaceStep = 0 | 1 | 2

type FormValues = {
  fullName: string
  role: string
  heardAbout: string
  deployTimeline: string
  entityType: EntityType
  theatreName: string
  websiteUrl: string
  primaryLanguage: TenantLanguage
  fallbackEmail: string
  fallbackPhone: string
  goals: string[]
}

const initialState: OnboardingFormState = {
  ok: false,
  message: '',
}

export type OnboardingFormCopy = Omit<Dictionary['onboarding'], 'stepLabel' | 'useCases'> & {
  stepLabels: readonly [string, string, string]
  useCases: Omit<Dictionary['onboarding']['useCases'], 'selectedCount'> & {
    selectedCountLabels: Record<number, string>
  }
}

const ENTITY_TYPES: EntityType[] = ['theatre', 'museum', 'cinema', 'auditorium', 'festival', 'cultural_center', 'other']

const USE_CASES = [
  { value: 'faqs', icon: MessageSquare },
  { value: 'agenda', icon: Sparkles },
  { value: 'tickets', icon: Ticket },
  { value: 'hours', icon: Globe2 },
  { value: 'location', icon: Landmark },
  { value: 'accessibility', icon: Check },
  { value: 'prices', icon: Ticket },
  { value: 'email', icon: Mail },
] as const

const MAX_USE_CASES = 3

export function OnboardingForm({
  copy,
  email,
  defaultLanguage,
}: {
  copy: OnboardingFormCopy
  email: string
  defaultLanguage: TenantLanguage
}) {
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
    primaryLanguage: defaultLanguage,
    fallbackEmail: email,
    fallbackPhone: '',
    goals: [],
  })
  const previousDefaultLanguage = useRef(defaultLanguage)

  useEffect(() => {
    setValues((current) => current.primaryLanguage === previousDefaultLanguage.current
      ? { ...current, primaryLanguage: defaultLanguage }
      : current)
    previousDefaultLanguage.current = defaultLanguage
  }, [defaultLanguage])

  const websiteUrlError = getWebsiteUrlError(values.websiteUrl, copy)
  const normalizedWebsiteUrl = useMemo(() => normalizeWebsiteUrl(values.websiteUrl), [values.websiteUrl])
  const canContinue = isWorkspaceStepValid(workspaceStep, values, websiteUrlError)

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function toggleGoal(goal: string) {
    if (goal === 'email') return

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

      <div className="onboarding-panel">
        <section className="onboarding-panel-main">
          {workspaceStep === 0 ? (
            <WorkspaceAboutYou copy={copy} values={values} update={update} />
          ) : null}

          {workspaceStep === 1 ? (
            <WorkspaceCompany
              copy={copy}
              values={values}
              update={update}
              email={email}
              websiteUrlError={websiteUrlError}
            />
          ) : null}

          {workspaceStep === 2 ? (
            <WorkspaceUseCases copy={copy} goals={values.goals} toggleGoal={toggleGoal} />
          ) : null}

        </section>

        <OnboardingVisual copy={copy} activeStep={workspaceStep} complete={pending} />
      </div>

      <div className="onboarding-actions">
        <button
          className="button-outline"
          type="button"
          onClick={handleBack}
          disabled={workspaceStep === 0 || pending}
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
          {copy.back}
        </button>

        {workspaceStep < 2 ? (
          <button
            className="button-primary"
            type="button"
            onClick={handleNext}
            disabled={!canContinue || pending}
            style={{ opacity: !canContinue ? 0.5 : 1 }}
          >
            {copy.continue}
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <button className="button-primary" type="submit" disabled={!canContinue || pending}>
            {pending ? copy.submitting : copy.submit}
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  )
}

function WorkspaceAboutYou({
  copy,
  values,
  update,
}: {
  copy: OnboardingFormCopy
  values: FormValues
  update: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void
}) {
  const about = copy.about
  return (
    <div className="onboarding-step-content">
      <p className="section-label">{copy.stepLabels[0]}</p>
      <h2>{about.title}</h2>
      <p className="muted">{about.description}</p>

      <label className="field">
        {about.fullName}
        <input value={values.fullName} onChange={(event) => update('fullName', event.target.value)} placeholder={about.fullNamePlaceholder} />
      </label>

      <label className="field">
        {about.role}
        <select value={values.role} onChange={(event) => update('role', event.target.value)}>
          <option value="">{about.emptyOption}</option>
          {about.roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>

      <label className="field">
        {about.heardAbout}
        <select value={values.heardAbout} onChange={(event) => update('heardAbout', event.target.value)}>
          <option value="">{about.emptyOption}</option>
          {about.heardAboutOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>

      <label className="field">
        {about.deployTimeline}
        <select value={values.deployTimeline} onChange={(event) => update('deployTimeline', event.target.value)}>
          <option value="">{about.emptyOption}</option>
          {about.deployTimelineOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </div>
  )
}

function WorkspaceCompany({
  copy,
  values,
  update,
  email,
  websiteUrlError,
}: {
  copy: OnboardingFormCopy
  values: FormValues
  update: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void
  email: string
  websiteUrlError: string
}) {
  const company = copy.company
  return (
    <div className="onboarding-step-content">
      <p className="section-label">{copy.stepLabels[1]}</p>
      <h2>{company.title}</h2>
      <p className="muted">{company.description}</p>

      <label className="field">
        {company.name}
        <input value={values.theatreName} onChange={(event) => update('theatreName', event.target.value)} placeholder={company.namePlaceholder} />
      </label>

      <label className="field">
        {company.entityType}
        <select value={values.entityType} onChange={(event) => update('entityType', event.target.value as EntityType)}>
          {ENTITY_TYPES.map((value) => <option key={value} value={value}>{company.entityOptions[value].label}</option>)}
        </select>
      </label>

      <label className="field">
        {company.website}
        <input
          value={values.websiteUrl}
          onChange={(event) => update('websiteUrl', event.target.value)}
          type="text"
          inputMode="url"
          placeholder={company.websitePlaceholder}
          aria-invalid={Boolean(websiteUrlError)}
          aria-describedby={websiteUrlError ? 'website-url-error' : undefined}
        />
        {websiteUrlError ? (
          <span className="field-error" id="website-url-error">{websiteUrlError}</span>
        ) : (
          <span className="field-hint">{company.websiteHint}</span>
        )}
      </label>

      <div className="form-grid two-columns">
        <label className="field">
          {company.primaryLanguage}
          <select value={values.primaryLanguage} onChange={(event) => update('primaryLanguage', event.target.value as TenantLanguage)}>
            <option value="ca">Català</option>
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
        </label>

        <label className="field">
          {company.publicEmail}
          <input value={values.fallbackEmail} onChange={(event) => update('fallbackEmail', event.target.value)} type="email" placeholder={email || company.publicEmailPlaceholder} />
        </label>
      </div>

      <InternationalPhoneInput
        key={values.primaryLanguage}
        name="fallback_phone_input"
        label={company.publicPhone}
        defaultValue={values.fallbackPhone}
        defaultCountry={getDefaultPhoneCountry(values.primaryLanguage)}
        locale={values.primaryLanguage}
        numberPlaceholder={company.publicPhonePlaceholder}
        onValueChange={(value) => update('fallbackPhone', value)}
      />
    </div>
  )
}

function WorkspaceUseCases({ copy, goals, toggleGoal }: { copy: OnboardingFormCopy; goals: string[]; toggleGoal: (goal: string) => void }) {
  const useCases = copy.useCases
  return (
    <div className="onboarding-step-content">
      <p className="section-label">{copy.stepLabels[2]}</p>
      <h2>{useCases.title}</h2>
      <p className="muted">{useCases.description}</p>

      <div className="onboarding-choice-list">
        {USE_CASES.map((goal) => {
          const Icon = goal.icon
          const selected = goals.includes(goal.value)
          const unavailable = goal.value === 'email'
          const disabled = unavailable || (!selected && goals.length >= MAX_USE_CASES)
          return (
            <button
              key={goal.value}
              type="button"
              className={
                unavailable
                  ? 'onboarding-choice onboarding-choice-unavailable'
                  : selected
                    ? 'onboarding-choice onboarding-choice-active'
                    : 'onboarding-choice'
              }
              disabled={disabled}
              onClick={() => toggleGoal(goal.value)}
            >
              <span className="onboarding-choice-label">
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                {useCases.options[goal.value]}
              </span>
              <span className="onboarding-checkbox">{selected ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : null}</span>
            </button>
          )
        })}
      </div>
      <span className="field-hint">{useCases.selectedCountLabels[goals.length]}</span>
    </div>
  )
}

const CONSTELLATION_SEGMENTS = [
  'M87 401 C122 382 151 348 182 326',
  'M198 314 C241 288 274 241 312 216',
  'M328 205 C360 183 379 168 399 157',
] as const

function OnboardingVisual({
  copy,
  activeStep,
  complete,
}: {
  copy: OnboardingFormCopy
  activeStep: WorkspaceStep
  complete: boolean
}) {
  const iconLevel = complete ? 4 : activeStep + 1

  return (
    <aside
      className={`onboarding-visual onboarding-visual-level-${iconLevel}`}
      aria-label={copy.progressLabel}
    >
      <div className="onboarding-constellation">
        <svg
          className="onboarding-constellation-lines"
          viewBox="0 0 560 520"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {CONSTELLATION_SEGMENTS.map((path, index) => {
            const isLit = complete || index < activeStep
            return (
              <g key={path}>
                <path className="onboarding-constellation-line-ghost" d={path} />
                <path
                  className={isLit ? 'onboarding-constellation-line is-lit' : 'onboarding-constellation-line'}
                  d={path}
                  pathLength="1"
                />
              </g>
            )
          })}
        </svg>

        <ol className="onboarding-constellation-steps">
          {copy.steps.map((label, index) => {
            const isDone = complete || index < activeStep
            const isActive = !complete && index === activeStep
            const stateClass = isDone ? 'is-done' : isActive ? 'is-active' : 'is-pending'

            return (
              <li
                key={label}
                className={`onboarding-constellation-step ${stateClass}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="onboarding-constellation-dot" aria-hidden="true" />
                <strong>{label}</strong>
              </li>
            )
          })}

          <li
            className={complete ? 'onboarding-constellation-destination is-active' : 'onboarding-constellation-destination is-pending'}
            aria-current={complete ? 'step' : undefined}
            aria-label="TALIA"
          >
            <span className="onboarding-visual-mark-wrap" aria-hidden="true">
              <span className="onboarding-visual-mark" />
            </span>
          </li>
        </ol>
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
      && (!values.fallbackPhone.trim() || normalizeInternationalPhoneValue(values.fallbackPhone) !== null)
      && !websiteUrlError
    )
  }
  return values.goals.length > 0
}

function getWebsiteUrlError(value: string, copy: OnboardingFormCopy) {
  const url = normalizeWebsiteUrl(value)
  if (!url) return ''

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return copy.company.websiteProtocolError
    }
    if (!parsed.hostname.includes('.')) {
      return copy.company.websiteDomainError
    }
    return ''
  } catch {
    return copy.company.websiteUrlError
  }
}

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
