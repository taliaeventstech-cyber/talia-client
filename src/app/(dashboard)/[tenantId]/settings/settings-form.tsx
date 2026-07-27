'use client'

import { ActionToast } from '@/components/ui/action-toast'
import { ConfirmationToast } from '@/components/ui/confirmation-toast'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CopyScriptButton } from '@/components/copy-script-button'
import { updateTenantSettings, type SettingsFormState } from './actions'
import { InternationalPhoneInput } from '@/components/ui/international-phone-input'
import { getDefaultPhoneCountry } from '@/lib/phone/international'
import Image from 'next/image'
import { ArrowDown, ArrowUp, ArrowUpRight, Bot, ChevronLeft, MessageCircle, MessageCircleMore, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import type { WidgetLauncherIcon } from '@/lib/widget/launcher-icon'
import {
  getVisibleSuggestedQuestions,
  MAX_SUGGESTED_QUESTION_TARGETS,
  MAX_SUGGESTED_QUESTIONS,
  type SuggestedQuestion,
  type SuggestedQuestionTarget,
  type SuggestedQuestionTargetType,
} from '@/lib/widget/suggested-questions'

type SettingsFormLabels = {
  chatbot: string
  widgetAvailability: string
  widgetAvailabilityHint: string
  widgetEnabled: string
  widgetDisabled: string
  currentPlan: string
  planDescription: string
  managePlan: string
  initialMessage: string
  suggestedQuestions: string
  suggestedQuestionsHint: string
  suggestedQuestionsLanguage: string
  suggestedQuestionsPrompt: string
  suggestedQuestionsEmpty: string
  suggestedQuestionAdd: string
  suggestedQuestionActive: string
  suggestedQuestionMoveUp: string
  suggestedQuestionMoveDown: string
  suggestedQuestionRemove: string
  suggestedQuestionText: string
  suggestedQuestionScope: string
  suggestedQuestionScopeGeneral: string
  suggestedQuestionScopeContextual: string
  suggestedQuestionTargets: string
  suggestedQuestionTargetsHint: string
  suggestedQuestionTargetAdd: string
  suggestedQuestionTargetRemove: string
  suggestedQuestionTargetTypeHostname: string
  suggestedQuestionTargetTypePathPrefix: string
  suggestedQuestionTargetTypeExactUrl: string
  suggestedQuestionTargetValue: string
  suggestedQuestionsPreviewUrl: string
  suggestedQuestionsPreviewUrlHint: string
  suggestedQuestionLanguageEs: string
  suggestedQuestionLanguageCa: string
  suggestedQuestionLanguageEn: string
  primaryColor: string
  fallbackEmail: string
  fallbackPhone: string
  fallbackMessage: string
  fallbackMessageHint: string
  fallbackWhatsApp: string
  fallbackWhatsAppHint: string
  autoOpen: string
  proactiveMessage: string
  proactiveMessageHint: string
  delay: string
  allowedDomains: string
  allowedDomainsHint: string
  position: string
  widgetSize: string
  widgetTheme: string
  widgetThemeHint: string
  widgetThemeSolid: string
  widgetThemeSolidHint: string
  widgetThemeGlass: string
  widgetThemeGlassHint: string
  widgetIcon: string
  widgetIconTalia: string
  widgetIconChat: string
  widgetIconBubble: string
  widgetIconBot: string
  widgetIconExpand: string
  widgetIconCollapse: string
  glassBackground: string
  glassBackgroundHint: string
  glassBackgroundLight: string
  glassBackgroundDark: string
  glassBlur: string
  glassTranslucency: string
  inlineOffset: string
  blockOffset: string
  collisionStrategy: string
  collisionStrategyHint: string
  offsetHint: string
  channelPrompt: string
  channelPromptHint: string
  unsavedChanges: string
  unsavedChangesWarning: string
  keepEditing: string
  leaveWithoutSaving: string
  saving: string
  save: string
}

type SettingsFormProps = {
  tenantId: string
  theatre: {
    system_prompt: string | null
    fallback_email: string | null
    fallback_phone: string | null
    primary_language: string
    website_url: string | null
  }
  commercialPlan: {
    title: string
    priceMonthly: number
    includedLabel: string
    monthlyLabel: string
  }
  widgetConfig: {
    enabled: boolean
    initialMessage: string
    primaryColor: string
    position: string
    widgetSize: 'small' | 'medium' | 'large'
    inlineOffset: number
    blockOffset: number
    collisionStrategy: 'auto' | 'none'
    widgetTheme: 'solid' | 'glass'
    launcherIcon: WidgetLauncherIcon
    glassBackground: 'light' | 'dark'
    glassBlur: number
    glassTranslucency: number
    autoOpen: boolean
    autoOpenDelay: number
    proactiveMessage: string
    suggestedQuestions: SuggestedQuestion[]
    allowedDomains: string[]
    fallbackMessage: string | null
    fallbackWhatsApp: boolean
  }
  labels: SettingsFormLabels
  previewLabel: string
  integration: {
    title: string
    help: string
    copyScript: string
    copiedScript: string
    embedCode: string
    hasScriptAccess: boolean
  }
}

const initialState: SettingsFormState = {
  ok: false,
  message: '',
}

export function SettingsForm({ tenantId, theatre, commercialPlan, widgetConfig, labels, previewLabel, integration }: SettingsFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateTenantSettings.bind(null, tenantId), initialState)
  const [widgetEnabled, setWidgetEnabled] = useState(widgetConfig.enabled)
  const [dirty, setDirty] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const changeVersionRef = useRef(0)
  const submittedVersionRef = useRef(0)
  const navigationTriggerRef = useRef<HTMLAnchorElement | null>(null)
  const [previewConfig, setPreviewConfig] = useState({
    assistantName: 'TALIA',
    initialMessage: widgetConfig.initialMessage,
    primaryColor: widgetConfig.primaryColor,
    position: widgetConfig.position,
    widgetSize: widgetConfig.widgetSize,
    inlineOffset: widgetConfig.inlineOffset,
    blockOffset: widgetConfig.blockOffset,
    collisionStrategy: widgetConfig.collisionStrategy,
    widgetTheme: widgetConfig.widgetTheme,
    launcherIcon: widgetConfig.launcherIcon,
    glassBackground: widgetConfig.glassBackground,
    glassBlur: widgetConfig.glassBlur,
    glassTranslucency: widgetConfig.glassTranslucency,
    autoOpen: widgetConfig.autoOpen,
    proactiveMessage: widgetConfig.proactiveMessage,
    suggestedQuestions: widgetConfig.suggestedQuestions,
    fallbackLanguage: theatre.primary_language,
    pageUrl: theatre.website_url ?? '',
  })
  const [suggestedQuestions, setSuggestedQuestions] = useState(widgetConfig.suggestedQuestions)

  useEffect(() => {
    if (!state.ok) return

    const timer = setTimeout(() => {
      if (changeVersionRef.current === submittedVersionRef.current) setDirty(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (!dirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || !(event.target instanceof Element)
      ) return

      const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const destination = new URL(anchor.href, window.location.href)
      if (destination.href === window.location.href) return
      if (destination.origin !== window.location.origin) return

      event.preventDefault()
      event.stopImmediatePropagation()
      navigationTriggerRef.current = anchor
      setPendingNavigation(`${destination.pathname}${destination.search}${destination.hash}`)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [dirty])

  const keepEditing = () => {
    setPendingNavigation(null)
    navigationTriggerRef.current?.focus()
    navigationTriggerRef.current = null
  }

  const leaveWithoutSaving = () => {
    if (!pendingNavigation) return
    const destination = pendingNavigation
    setPendingNavigation(null)
    setDirty(false)
    navigationTriggerRef.current = null
    router.push(destination)
  }

  const markDirty = () => {
    changeVersionRef.current += 1
    setDirty(true)
  }

  const updateSuggestedQuestions = (
    updater: (current: SuggestedQuestion[]) => SuggestedQuestion[],
  ) => {
    setSuggestedQuestions((current) => {
      const next = updater(current)
      setPreviewConfig((preview) => ({ ...preview, suggestedQuestions: next }))
      return next
    })
    markDirty()
  }

  return (
    <form
      action={formAction}
      className="stack"
      onChange={() => {
        changeVersionRef.current += 1
        setDirty(true)
      }}
      onSubmit={() => {
        submittedVersionRef.current = changeVersionRef.current
      }}
    >
      <ActionToast state={state} />
      {pendingNavigation ? (
        <ConfirmationToast
          message={labels.unsavedChangesWarning}
          cancelLabel={labels.keepEditing}
          confirmLabel={labels.leaveWithoutSaving}
          onCancel={keepEditing}
          onConfirm={leaveWithoutSaving}
        />
      ) : null}

      <div className="chatbot-settings-save-bar">
        <span className="chatbot-settings-unsaved" aria-live="polite">
          {dirty ? labels.unsavedChanges : ''}
        </span>
        <button className="button-primary" type="submit" disabled={!dirty || pending}>
          {pending ? labels.saving : labels.save}
        </button>
      </div>

      <div className="two-column-grid chatbot-settings-grid">
        <div className="stack">
          <section className="card chatbot-availability-card" data-enabled={widgetEnabled}>
            <div>
              <h2>{labels.widgetAvailability}</h2>
              <p className="muted">{labels.widgetAvailabilityHint}</p>
            </div>
            <label className="chatbot-availability-control">
              <input
                type="checkbox"
                name="widget_enabled"
                checked={widgetEnabled}
                onChange={(event) => setWidgetEnabled(event.target.checked)}
              />
              <span className="chatbot-availability-switch" aria-hidden="true">
                <span />
              </span>
              <strong>{widgetEnabled ? labels.widgetEnabled : labels.widgetDisabled}</strong>
            </label>
          </section>

          <section className="card stack">
            <h2>{labels.chatbot}</h2>
            <div className="chatbot-plan-summary">
              <div className="chatbot-plan-summary-copy">
                <span className="eyebrow">{labels.currentPlan}</span>
                <div className="chatbot-plan-summary-title">
                  <strong>{commercialPlan.title}</strong>
                  <span>{commercialPlan.priceMonthly}€ {commercialPlan.monthlyLabel}</span>
                </div>
                <p>{commercialPlan.includedLabel}. {labels.planDescription}</p>
              </div>
              <Link className="button-outline button-fit" href={`/${tenantId}/upgrade`}>
                {labels.managePlan}
                <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
            <div className="form-grid">
              <label className="field">
                {labels.initialMessage}
                <textarea
                  name="initial_message"
                  defaultValue={widgetConfig.initialMessage}
                  rows={3}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, initialMessage: event.target.value }))}
                />
              </label>

              <SuggestedQuestionsEditor
                questions={suggestedQuestions}
                chatbotLanguage={theatre.primary_language}
                labels={labels}
                onChange={updateSuggestedQuestions}
              />

              <label className="field">
                {labels.primaryColor}
                <input
                  name="primary_color"
                  type="color"
                  defaultValue={widgetConfig.primaryColor}
                  style={{ height: 44 }}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, primaryColor: event.target.value }))}
                />
              </label>

              <label className="field">
                {labels.position}
                <select
                  name="position"
                  defaultValue={widgetConfig.position}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, position: event.target.value }))}
                >
                  <option value="bottom-right">Abajo derecha</option>
                  <option value="bottom-left">Abajo izquierda</option>
                  <option value="top-right">Arriba derecha</option>
                  <option value="top-left">Arriba izquierda</option>
                </select>
              </label>

              <label className="field">
                {labels.widgetSize}
                <select
                  name="widget_size"
                  defaultValue={widgetConfig.widgetSize}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, widgetSize: getWidgetSize(event.target.value) }))}
                >
                  <option value="small">Pequeño</option>
                  <option value="medium">Mediano</option>
                  <option value="large">Grande</option>
                </select>
              </label>

              <fieldset className="field widget-theme-field widget-appearance-field" style={{ gridColumn: '1 / -1', border: 0, padding: 0, margin: 0 }}>
                <legend style={{ padding: 0 }}>{labels.widgetTheme}</legend>
                <div className="widget-appearance-controls">
                  <ThemeToggle
                    value={previewConfig.widgetTheme}
                    color={previewConfig.primaryColor}
                    solidLabel={labels.widgetThemeSolid}
                    glassLabel={labels.widgetThemeGlass}
                    onSelect={(widgetTheme) => setPreviewConfig((current) => ({ ...current, widgetTheme }))}
                  />
                  <LauncherIconPicker
                    value={previewConfig.launcherIcon}
                    color={previewConfig.primaryColor}
                    label={labels.widgetIcon}
                    taliaLabel={labels.widgetIconTalia}
                    chatLabel={labels.widgetIconChat}
                    bubbleLabel={labels.widgetIconBubble}
                    botLabel={labels.widgetIconBot}
                    expandLabel={labels.widgetIconExpand}
                    collapseLabel={labels.widgetIconCollapse}
                    onSelect={(launcherIcon) => setPreviewConfig((current) => ({ ...current, launcherIcon }))}
                  />
                </div>
              </fieldset>

              {previewConfig.widgetTheme === 'glass' ? (
                <div className="glass-controls" style={{ gridColumn: '1 / -1' }}>
                  <div className="glass-range-controls">
                    <label className="field glass-range-field">
                      <span className="glass-range-label">
                        <span>{labels.glassBlur}</span>
                        <output>{Math.round((previewConfig.glassBlur / 30) * 100)}%</output>
                      </span>
                      <input
                        type="range"
                        name="glass_blur"
                        min={0}
                        max={30}
                        value={previewConfig.glassBlur}
                        style={{ ['--fill' as string]: `${Math.round((previewConfig.glassBlur / 30) * 100)}%` }}
                        onChange={(event) => setPreviewConfig((current) => ({ ...current, glassBlur: Number(event.target.value) }))}
                      />
                    </label>

                    <label className="field glass-range-field">
                      <span className="glass-range-label">
                        <span>{labels.glassTranslucency}</span>
                        <output>{Math.round(((previewConfig.glassTranslucency - 15) / 70) * 100)}%</output>
                      </span>
                      <input
                        type="range"
                        name="glass_translucency"
                        min={15}
                        max={85}
                        value={previewConfig.glassTranslucency}
                        style={{ ['--fill' as string]: `${Math.round(((previewConfig.glassTranslucency - 15) / 70) * 100)}%` }}
                        onChange={(event) => setPreviewConfig((current) => ({ ...current, glassTranslucency: Number(event.target.value) }))}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <input type="hidden" name="glass_blur" value={previewConfig.glassBlur} />
                  <input type="hidden" name="glass_translucency" value={previewConfig.glassTranslucency} />
                </>
              )}

              <label className="field">
                {labels.inlineOffset}
                <input
                  name="inline_offset"
                  type="number"
                  min={12}
                  max={320}
                  defaultValue={widgetConfig.inlineOffset}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, inlineOffset: getNumericInput(event.target.value, widgetConfig.inlineOffset) }))}
                />
              </label>

              <label className="field">
                {labels.blockOffset}
                <input
                  name="block_offset"
                  type="number"
                  min={12}
                  max={320}
                  defaultValue={widgetConfig.blockOffset}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, blockOffset: getNumericInput(event.target.value, widgetConfig.blockOffset) }))}
                />
              </label>

              <label className="field">
                {labels.fallbackEmail}
                <input name="fallback_email" type="email" defaultValue={theatre.fallback_email ?? ''} />
              </label>

              <InternationalPhoneInput
                name="fallback_phone"
                label={labels.fallbackPhone}
                defaultValue={theatre.fallback_phone}
                defaultCountry={getDefaultPhoneCountry(theatre.primary_language)}
                locale={theatre.primary_language}
              />

              <label className="field" style={{ gridColumn: '1 / -1' }}>
                {labels.fallbackMessage}
                <textarea name="fallback_message" defaultValue={widgetConfig.fallbackMessage ?? ''} rows={3} />
                <span className="muted">{labels.fallbackMessageHint}</span>
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="fallback_whatsapp"
                defaultChecked={widgetConfig.fallbackWhatsApp}
                style={{ width: 16, height: 16, marginTop: 4 }}
              />
              <span>
                <strong>{labels.fallbackWhatsApp}</strong>
                <span className="muted" style={{ display: 'block', marginTop: 4 }}>
                  {labels.fallbackWhatsAppHint}
                </span>
              </span>
            </label>

            <div className="form-row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="collision_strategy"
                  value="auto"
                  defaultChecked={widgetConfig.collisionStrategy !== 'none'}
                  style={{ width: 16, height: 16, marginTop: 4 }}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, collisionStrategy: event.target.checked ? 'auto' : 'none' }))}
                />
                <span>
                  <strong>{labels.collisionStrategy}</strong>
                  <span className="muted" style={{ display: 'block', marginTop: 4 }}>
                    {labels.collisionStrategyHint}
                  </span>
                  <span className="muted" style={{ display: 'block', marginTop: 4 }}>
                    {labels.offsetHint}
                  </span>
                </span>
              </label>
            </div>

            <div className="form-row" style={{ alignItems: 'center', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="auto_open"
                  defaultChecked={widgetConfig.autoOpen}
                  style={{ width: 16, height: 16 }}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, autoOpen: event.target.checked }))}
                />
                {labels.autoOpen}
              </label>
              <label className="field" style={{ margin: 0 }}>
                {labels.delay}
                <input
                  name="auto_open_delay"
                  type="number"
                  min={0}
                  max={60}
                  defaultValue={widgetConfig.autoOpenDelay}
                  style={{ width: 80 }}
                />
              </label>
            </div>
            <label className="field">
              {labels.proactiveMessage}
              <input
                name="proactive_message"
                type="text"
                maxLength={160}
                defaultValue={widgetConfig.proactiveMessage}
                onChange={(event) => setPreviewConfig((current) => ({ ...current, proactiveMessage: event.target.value }))}
              />
              <span className="muted">{labels.proactiveMessageHint}</span>
            </label>
          </section>

        </div>

        <aside className="stack">
          <section className="card stack chatbot-preview-card">
            <div className="chatbot-preview-card-header">
              <h2>{previewLabel}</h2>
              <BackgroundToggle
                value={previewConfig.glassBackground}
                label={labels.glassBackground}
                lightLabel={labels.glassBackgroundLight}
                darkLabel={labels.glassBackgroundDark}
                onSelect={(glassBackground) => setPreviewConfig((current) => ({ ...current, glassBackground }))}
              />
            </div>
            <label className="field suggested-questions-preview-url">
              {labels.suggestedQuestionsPreviewUrl}
              <input
                type="url"
                value={previewConfig.pageUrl}
                placeholder="https://example.org/agenda"
                onChange={(event) => {
                  event.stopPropagation()
                  setPreviewConfig((current) => ({ ...current, pageUrl: event.target.value }))
                }}
              />
              <span className="muted">{labels.suggestedQuestionsPreviewUrlHint}</span>
            </label>
            <WidgetPreview
              key={previewConfig.autoOpen ? 'proactive' : 'manual'}
              widgetConfig={previewConfig}
              suggestedQuestionsLabel={labels.suggestedQuestions}
              suggestedQuestionsPrompt={labels.suggestedQuestionsPrompt}
            />
          </section>

          <section className="card stack">
            <h2>{integration.title}</h2>
            {integration.hasScriptAccess ? (
              <>
                <p
                  className="muted"
                  dangerouslySetInnerHTML={{ __html: integration.help }}
                />
                <div className="script-code-panel">
                  <CopyScriptButton
                    value={integration.embedCode}
                    label={integration.copyScript}
                    copiedLabel={integration.copiedScript}
                  />
                  <pre className="ai-output script-code-block">{integration.embedCode}</pre>
                </div>
              </>
            ) : (
              <div className="locked-panel">
                <span className="status-pill status-pill-soon">Configura el asistente</span>
                <h3>El script se desbloquea al completar la configuración</h3>
                <p className="muted">
                  Completa el setup inicial para generar el script de instalación.
                </p>
              </div>
            )}
          </section>

          <section className="card stack">
            <h2>{labels.allowedDomains}</h2>
            <p className="muted">{labels.allowedDomainsHint}</p>
            <textarea
              name="allowed_domains"
              defaultValue={widgetConfig.allowedDomains.join('\n')}
              rows={4}
              className="mono"
              placeholder="staging.example.com&#10;preview.example.com"
            />
          </section>

          <section className="card stack">
            <h2>{labels.channelPrompt}</h2>
            <p className="muted">{labels.channelPromptHint}</p>
            <textarea
              name="system_prompt"
              defaultValue={theatre.system_prompt ?? ''}
              rows={8}
              className="mono"
              placeholder="Instrucciones específicas para el asistente de IA."
            />
          </section>
        </aside>
      </div>
    </form>
  )
}

function SuggestedQuestionsEditor({
  questions,
  chatbotLanguage,
  labels,
  onChange,
}: {
  questions: SuggestedQuestion[]
  chatbotLanguage: string
  labels: SettingsFormLabels
  onChange: (updater: (current: SuggestedQuestion[]) => SuggestedQuestion[]) => void
}) {
  const addQuestion = () => {
    onChange((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        enabled: true,
        text: '',
        targets: [],
      },
    ])
  }

  const updateQuestion = (
    id: string,
    updater: (question: SuggestedQuestion) => SuggestedQuestion,
  ) => {
    onChange((current) => current.map((question) => (
      question.id === id ? updater(question) : question
    )))
  }

  const moveQuestion = (index: number, offset: -1 | 1) => {
    onChange((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [question] = next.splice(index, 1)
      next.splice(target, 0, question)
      return next
    })
  }

  const setQuestionScope = (id: string, contextual: boolean) => {
    updateQuestion(id, (question) => ({
      ...question,
      targets: contextual
        ? question.targets.length > 0
          ? question.targets
          : [createSuggestedQuestionTarget()]
        : [],
    }))
  }

  const addQuestionTarget = (id: string) => {
    updateQuestion(id, (question) => ({
      ...question,
      targets: question.targets.length >= MAX_SUGGESTED_QUESTION_TARGETS
        ? question.targets
        : [...question.targets, createSuggestedQuestionTarget()],
    }))
  }

  const updateQuestionTarget = (
    questionId: string,
    targetId: string,
    updater: (target: SuggestedQuestionTarget) => SuggestedQuestionTarget,
  ) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      targets: question.targets.map((target) => (
        target.id === targetId ? updater(target) : target
      )),
    }))
  }

  const removeQuestionTarget = (questionId: string, targetId: string) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      targets: question.targets.filter((target) => target.id !== targetId),
    }))
  }

  return (
    <fieldset className="suggested-questions-editor">
      <legend>{labels.suggestedQuestions}</legend>
      <p className="muted">{labels.suggestedQuestionsHint}</p>
      <p className="suggested-questions-language">
        <strong>{labels.suggestedQuestionsLanguage}:</strong>{' '}
        {getSuggestedQuestionLanguageLabel(chatbotLanguage, labels)}
      </p>
      <input type="hidden" name="suggested_questions" value={JSON.stringify(questions)} />

      <div className="suggested-questions-editor-list">
        {questions.length === 0 ? (
          <p className="suggested-questions-empty">{labels.suggestedQuestionsEmpty}</p>
        ) : questions.map((question, index) => (
          <article className="suggested-question-editor-item" key={question.id}>
            <header className="suggested-question-editor-header">
              <strong>#{index + 1}</strong>
              <label className="suggested-question-enabled">
                <input
                  type="checkbox"
                  checked={question.enabled}
                  onChange={(event) => updateQuestion(question.id, (current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))}
                />
                {labels.suggestedQuestionActive}
              </label>
              <span className="suggested-question-editor-actions">
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === 0}
                  aria-label={labels.suggestedQuestionMoveUp}
                  title={labels.suggestedQuestionMoveUp}
                  onClick={() => moveQuestion(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === questions.length - 1}
                  aria-label={labels.suggestedQuestionMoveDown}
                  title={labels.suggestedQuestionMoveDown}
                  onClick={() => moveQuestion(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button suggested-question-remove"
                  aria-label={labels.suggestedQuestionRemove}
                  title={labels.suggestedQuestionRemove}
                  onClick={() => onChange((current) => current.filter((item) => item.id !== question.id))}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </span>
            </header>

            <label className="field">
              {labels.suggestedQuestionText}
              <input
                type="text"
                maxLength={160}
                value={question.text}
                onChange={(event) => updateQuestion(question.id, (current) => ({
                  ...current,
                  text: event.target.value,
                }))}
              />
            </label>

            <label className="field">
              {labels.suggestedQuestionScope}
              <select
                value={question.targets.length > 0 ? 'contextual' : 'general'}
                onChange={(event) => setQuestionScope(
                  question.id,
                  event.target.value === 'contextual',
                )}
              >
                <option value="general">{labels.suggestedQuestionScopeGeneral}</option>
                <option value="contextual">{labels.suggestedQuestionScopeContextual}</option>
              </select>
            </label>

            {question.targets.length > 0 ? (
              <div className="suggested-question-targets">
                <div>
                  <strong>{labels.suggestedQuestionTargets}</strong>
                  <p className="muted">{labels.suggestedQuestionTargetsHint}</p>
                </div>
                <div className="suggested-question-target-list">
                  {question.targets.map((target, targetIndex) => (
                    <div className="suggested-question-target-row" key={target.id}>
                      <select
                        aria-label={`${labels.suggestedQuestionScope} ${targetIndex + 1}`}
                        value={target.type}
                        onChange={(event) => updateQuestionTarget(
                          question.id,
                          target.id,
                          (current) => ({
                            ...current,
                            type: event.target.value as SuggestedQuestionTargetType,
                            value: '',
                          }),
                        )}
                      >
                        <option value="hostname">{labels.suggestedQuestionTargetTypeHostname}</option>
                        <option value="path_prefix">{labels.suggestedQuestionTargetTypePathPrefix}</option>
                        <option value="exact_url">{labels.suggestedQuestionTargetTypeExactUrl}</option>
                      </select>
                      <input
                        aria-label={`${labels.suggestedQuestionTargetValue} ${targetIndex + 1}`}
                        type="text"
                        maxLength={2048}
                        placeholder={getSuggestedQuestionTargetPlaceholder(target.type)}
                        value={target.value}
                        onChange={(event) => updateQuestionTarget(
                          question.id,
                          target.id,
                          (current) => ({ ...current, value: event.target.value }),
                        )}
                      />
                      <button
                        type="button"
                        className="icon-button suggested-question-remove"
                        aria-label={labels.suggestedQuestionTargetRemove}
                        title={labels.suggestedQuestionTargetRemove}
                        onClick={() => removeQuestionTarget(question.id, target.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="button-outline button-fit"
                  disabled={question.targets.length >= MAX_SUGGESTED_QUESTION_TARGETS}
                  onClick={() => addQuestionTarget(question.id)}
                >
                  <Plus size={15} aria-hidden="true" />
                  {labels.suggestedQuestionTargetAdd}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <button
        type="button"
        className="button-outline button-fit"
        disabled={questions.length >= MAX_SUGGESTED_QUESTIONS}
        onClick={addQuestion}
      >
        <Plus size={16} aria-hidden="true" />
        {labels.suggestedQuestionAdd}
      </button>
    </fieldset>
  )
}

function getSuggestedQuestionLanguageLabel(
  language: string,
  labels: SettingsFormLabels,
) {
  if (language === 'ca') return labels.suggestedQuestionLanguageCa
  if (language === 'en') return labels.suggestedQuestionLanguageEn
  return labels.suggestedQuestionLanguageEs
}

function createSuggestedQuestionTarget(): SuggestedQuestionTarget {
  return {
    id: crypto.randomUUID(),
    type: 'path_prefix',
    value: '',
  }
}

function getSuggestedQuestionTargetPlaceholder(type: SuggestedQuestionTargetType) {
  if (type === 'hostname') return 'example.org'
  if (type === 'exact_url') return 'https://example.org/agenda/hamlet'
  return '/agenda'
}

function ThemeToggle({
  value,
  color,
  solidLabel,
  glassLabel,
  onSelect,
}: {
  value: 'solid' | 'glass'
  color: string
  solidLabel: string
  glassLabel: string
  onSelect: (value: 'solid' | 'glass') => void
}) {
  return (
    <div
      className="widget-theme-toggle"
      data-theme={value}
      style={{ ['--widget-theme-color' as string]: color }}
      role="radiogroup"
      aria-label={`${solidLabel} / ${glassLabel}`}
    >
      <span className="widget-theme-toggle-indicator" aria-hidden="true" />
      <label className="widget-theme-toggle-option" title={solidLabel}>
        <input
          type="radio"
          name="widget_theme"
          value="solid"
          checked={value === 'solid'}
          onChange={() => onSelect('solid')}
          className="sr-only"
          aria-label={solidLabel}
        />
        <span className="widget-theme-orb widget-theme-orb-solid" aria-hidden="true" />
      </label>
      <label className="widget-theme-toggle-option" title={glassLabel}>
        <input
          type="radio"
          name="widget_theme"
          value="glass"
          checked={value === 'glass'}
          onChange={() => onSelect('glass')}
          className="sr-only"
          aria-label={glassLabel}
        />
        <span className="widget-theme-orb widget-theme-orb-glass" aria-hidden="true" />
      </label>
    </div>
  )
}

function LauncherIconPicker({
  value,
  color,
  label,
  taliaLabel,
  chatLabel,
  bubbleLabel,
  botLabel,
  expandLabel,
  collapseLabel,
  onSelect,
}: {
  value: WidgetLauncherIcon
  color: string
  label: string
  taliaLabel: string
  chatLabel: string
  bubbleLabel: string
  botLabel: string
  expandLabel: string
  collapseLabel: string
  onSelect: (value: WidgetLauncherIcon) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const options: Array<{ value: WidgetLauncherIcon; label: string }> = [
    { value: 'talia', label: taliaLabel },
    { value: 'chat', label: chatLabel },
    { value: 'bubble', label: bubbleLabel },
    { value: 'bot', label: botLabel },
  ]

  return (
    <div
      className={expanded ? 'widget-icon-picker widget-icon-picker-expanded' : 'widget-icon-picker'}
      style={{
        ['--widget-icon-color' as string]: color,
        ['--widget-icon-count' as string]: options.length,
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setExpanded(false)
          event.currentTarget.querySelector<HTMLButtonElement>('.widget-icon-picker-trigger')?.focus()
        }
      }}
    >
      <input type="hidden" name="launcher_icon" value={value} />
      <button
        type="button"
        className="widget-icon-picker-trigger"
        aria-expanded={expanded}
        aria-label={expanded ? collapseLabel : expandLabel}
        title={expanded ? collapseLabel : expandLabel}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? <ChevronLeft className="widget-icon-picker-collapse-glyph" aria-hidden="true" /> : <LauncherIconGlyph value={value} />}
      </button>
      <div className="widget-icon-picker-options" role="radiogroup" aria-label={label} aria-hidden={!expanded}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'widget-icon-picker-option widget-icon-picker-option-active' : 'widget-icon-picker-option'}
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.label}
            title={option.label}
            tabIndex={expanded ? 0 : -1}
            onClick={() => onSelect(option.value)}
          >
            <LauncherIconGlyph value={option.value} />
          </button>
        ))}
      </div>
    </div>
  )
}

function LauncherIconGlyph({ value }: { value: WidgetLauncherIcon }) {
  if (value === 'bubble') {
    return <MessageCircleMore className="widget-launcher-glyph widget-launcher-glyph-bubble" strokeWidth={2.2} aria-hidden="true" />
  }

  if (value === 'bot') {
    return <Bot className="widget-launcher-glyph widget-launcher-glyph-bot" strokeWidth={2.2} aria-hidden="true" />
  }

  if (value === 'chat') {
    return <MessageCircle className="widget-launcher-glyph widget-launcher-glyph-chat" strokeWidth={2.2} aria-hidden="true" />
  }

  return (
    <Image
      className="widget-launcher-glyph widget-launcher-glyph-talia"
      src="/icon.svg"
      alt=""
      aria-hidden="true"
      width={500}
      height={500}
    />
  )
}

function BackgroundToggle({
  value,
  label,
  lightLabel,
  darkLabel,
  onSelect,
}: {
  value: 'light' | 'dark'
  label: string
  lightLabel: string
  darkLabel: string
  onSelect: (value: 'light' | 'dark') => void
}) {
  return (
    <fieldset className="glass-background-toggle-field">
      <legend className="sr-only">{label}</legend>
      <div className="glass-background-toggle" data-background={value} role="radiogroup" aria-label={label} aria-orientation="vertical">
        <span className="glass-background-toggle-indicator" aria-hidden="true" />
        <label className="glass-background-toggle-option" title={lightLabel}>
          <input
            type="radio"
            name="glass_background"
            value="light"
            checked={value === 'light'}
            onChange={() => onSelect('light')}
            className="sr-only"
            aria-label={lightLabel}
          />
          <span className="glass-background-orb glass-background-orb-light" aria-hidden="true" />
        </label>
        <label className="glass-background-toggle-option" title={darkLabel}>
          <input
            type="radio"
            name="glass_background"
            value="dark"
            checked={value === 'dark'}
            onChange={() => onSelect('dark')}
            className="sr-only"
            aria-label={darkLabel}
          />
          <span className="glass-background-orb glass-background-orb-dark" aria-hidden="true" />
        </label>
      </div>
    </fieldset>
  )
}

function WidgetPreview({
  widgetConfig,
  suggestedQuestionsLabel,
  suggestedQuestionsPrompt,
}: {
  widgetConfig: {
    assistantName: string
    initialMessage: string
    primaryColor: string
    position: string
    widgetSize: 'small' | 'medium' | 'large'
    inlineOffset: number
    blockOffset: number
    collisionStrategy: 'auto' | 'none'
    widgetTheme: 'solid' | 'glass'
    launcherIcon: WidgetLauncherIcon
    glassBackground: 'light' | 'dark'
    glassBlur: number
    glassTranslucency: number
    autoOpen: boolean
    proactiveMessage: string
    suggestedQuestions: SuggestedQuestion[]
    fallbackLanguage: string
    pageUrl: string
  }
  suggestedQuestionsLabel: string
  suggestedQuestionsPrompt: string
}) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [greetingVisible, setGreetingVisible] = useState(widgetConfig.autoOpen)
  const [sessionFeedbackOpen, setSessionFeedbackOpen] = useState(false)
  const [sessionFeedbackResolved, setSessionFeedbackResolved] = useState<boolean | null>(null)
  const [selectedSuggestedQuestion, setSelectedSuggestedQuestion] = useState<string | null>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const chatbotOffset = widgetConfig.blockOffset
  const inlineOffset = widgetConfig.inlineOffset
  const previewSize = getPreviewWidgetSize(widgetConfig.widgetSize)
  const chatbotPosition = getPreviewPosition(widgetConfig.position, chatbotOffset, inlineOffset)
  const floatingContentPosition = getPreviewFloatingContentPosition(widgetConfig.position, chatbotOffset, inlineOffset, previewSize)
  const glass = widgetConfig.widgetTheme === 'glass'
  const color = widgetConfig.primaryColor
  const skin = getGlassSkin(color, widgetConfig.glassBackground, widgetConfig.glassTranslucency)
  const stageBackground = glass ? skin.stage : getSolidPreviewStage(widgetConfig.glassBackground)
  const visibleSuggestedQuestions = getVisibleSuggestedQuestions(
    widgetConfig.suggestedQuestions,
    widgetConfig.fallbackLanguage,
    widgetConfig.pageUrl,
  )
  const responseFeedbackCopy = getPreviewResponseFeedbackCopy(widgetConfig.fallbackLanguage)

  const filter = `blur(${widgetConfig.glassBlur}px) saturate(200%) brightness(${skin.bright})`

  const panelStyle: React.CSSProperties = glass
    ? {
        background: skin.panelFill,
        backdropFilter: filter,
        WebkitBackdropFilter: filter,
        boxShadow: `${skin.shadow}, inset 0 1.5px 0 ${skin.spec}, inset 0 -1px 0 ${skin.spec2}, inset 0 0 0 1px ${skin.hairline}`,
      }
    : { background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }

  const headerStyle: React.CSSProperties = glass
    ? { background: skin.chromeFill, backdropFilter: filter, WebkitBackdropFilter: filter, color: '#fff', boxShadow: `inset 0 1px 0 ${skin.spec}` }
    : { background: color, color: '#fff' }

  const toggleStyle: React.CSSProperties = glass
    ? { background: skin.toggleFill, backdropFilter: filter, WebkitBackdropFilter: filter, boxShadow: `${skin.shadow}, inset 0 1.5px 0 ${skin.spec}, inset 0 0 0 1px ${skin.hairline}` }
    : { background: color, boxShadow: '0 10px 24px rgba(0,0,0,.22)' }

  const botBubbleStyle: React.CSSProperties = glass
    ? { background: skin.botBubble, color: skin.botText }
    : { background: '#fff', color: '#1A1A2E' }

  function openPanel() {
    launcherRef.current?.focus()
    setGreetingVisible(false)
    setPanelOpen(true)
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  function closePanel() {
    launcherRef.current?.focus()
    setPanelOpen(false)
  }

  function closeGreeting() {
    launcherRef.current?.focus()
    setGreetingVisible(false)
  }

  function closeSessionFeedback() {
    setSessionFeedbackOpen(false)
    setSessionFeedbackResolved(null)
    setSelectedSuggestedQuestion(null)
  }

  return (
    <div
      className="widget-live-preview"
      style={{ background: stageBackground }}
    >
      <section
        className="widget-preview-panel"
        data-open={panelOpen}
        aria-hidden={!panelOpen}
        style={{ ...floatingContentPosition, ...panelStyle }}
      >
        {glass ? (
          <span className="widget-preview-specular" aria-hidden="true" />
        ) : null}
        <div className="widget-preview-header" style={headerStyle}>
          <span className="widget-preview-header-brand">
            <span className="widget-preview-header-mark" style={{ color }}>
              <PreviewLauncherIcon value={widgetConfig.launcherIcon} size={34} tone="brand" />
            </span>
            <span className="widget-preview-header-name">{widgetConfig.assistantName}</span>
          </span>
          <span className="widget-preview-header-actions">
            <button
              type="button"
              className="widget-preview-icon-button widget-preview-restart"
              aria-label="Volver a comenzar"
              title="Volver a comenzar"
              onClick={() => setSessionFeedbackOpen(true)}
            >
              <RefreshCcw aria-hidden="true" strokeWidth={2} />
            </button>
            <button type="button" className="widget-preview-icon-button widget-preview-close" aria-label="Cerrar" onClick={closePanel}>×</button>
          </span>
        </div>
        <div className="widget-preview-messages" style={{ background: glass ? skin.msgSurface : '#F5F2EC' }}>
          <p className="widget-preview-message" style={botBubbleStyle}>
            {widgetConfig.initialMessage}
          </p>
          <div
            className="widget-preview-feedback"
            aria-label={responseFeedbackCopy.groupLabel}
          >
            <span>{responseFeedbackCopy.prompt}</span>
            <div>
              <button type="button" className="widget-preview-feedback-button" aria-label={responseFeedbackCopy.positiveLabel} title={responseFeedbackCopy.positiveLabel} aria-disabled="true">
                {responseFeedbackCopy.positive}
              </button>
              <button type="button" className="widget-preview-feedback-button" aria-label={responseFeedbackCopy.negativeLabel} title={responseFeedbackCopy.negativeLabel} aria-disabled="true">
                {responseFeedbackCopy.negative}
              </button>
            </div>
          </div>
          {!selectedSuggestedQuestion && !sessionFeedbackOpen && visibleSuggestedQuestions.length > 0 ? (
            <div
              className="widget-preview-suggested-questions"
              role="group"
              aria-label={suggestedQuestionsLabel}
              style={{ ['--widget-preview-suggestion-color' as string]: color }}
            >
              <p className="widget-preview-suggested-questions-title">
                {suggestedQuestionsPrompt}
              </p>
              <div className="widget-preview-suggested-questions-actions">
                {visibleSuggestedQuestions.map((question) => (
                  <button
                    type="button"
                    className="widget-preview-suggested-question"
                    key={question.id}
                    onClick={() => {
                      setSelectedSuggestedQuestion(question.text)
                      requestAnimationFrame(() => composerRef.current?.focus())
                    }}
                  >
                    {question.text}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {selectedSuggestedQuestion ? (
            <p className="widget-preview-message widget-preview-message-user" style={{ background: color }}>
              {selectedSuggestedQuestion}
            </p>
          ) : null}
          {sessionFeedbackOpen ? (
            <div className="widget-preview-message widget-preview-session-feedback" style={botBubbleStyle} aria-label="Feedback antes de reiniciar">
              <strong>Antes de empezar de nuevo, ¿he resuelto tu consulta?</strong>
              <div className="widget-preview-session-feedback-choices">
                <button
                  type="button"
                  className={sessionFeedbackResolved === true ? 'widget-preview-session-feedback-choice widget-preview-session-feedback-choice-active' : 'widget-preview-session-feedback-choice'}
                  data-value="yes"
                  onClick={() => setSessionFeedbackResolved(true)}
                >
                  <span>Sí</span>
                </button>
                <button
                  type="button"
                  className={sessionFeedbackResolved === false ? 'widget-preview-session-feedback-choice widget-preview-session-feedback-choice-active' : 'widget-preview-session-feedback-choice'}
                  data-value="no"
                  onClick={() => setSessionFeedbackResolved(false)}
                >
                  <span>No</span>
                </button>
              </div>
              <textarea maxLength={1000} placeholder="Añade comentarios adicionales..." />
              <div className="widget-preview-session-feedback-actions">
                <button type="button" className="widget-preview-session-feedback-button widget-preview-session-feedback-submit" disabled={sessionFeedbackResolved === null} onClick={closeSessionFeedback}>Enviar y reiniciar</button>
                <button type="button" className="widget-preview-session-feedback-button" onClick={closeSessionFeedback}>Saltar</button>
              </div>
            </div>
          ) : null}
        </div>
        <div
          className="widget-preview-form"
          style={{
            '--widget-preview-caret': color,
            background: glass ? skin.chromeFill : '#fff',
            backdropFilter: glass ? filter : undefined,
            WebkitBackdropFilter: glass ? filter : undefined,
          } as React.CSSProperties}
        >
          <textarea
            ref={composerRef}
            rows={1}
            placeholder="Escribe tu mensaje..."
            onInput={(event) => resizePreviewComposer(event.currentTarget)}
          />
          <button type="button" disabled style={{ background: color }}>Enviar</button>
        </div>
        <div
          className="widget-preview-powered"
          style={{
            background: glass ? skin.chromeFill : '#fff',
            backdropFilter: glass ? filter : undefined,
            WebkitBackdropFilter: glass ? filter : undefined,
          }}
        >
          <a href="https://talia.events" target="_blank" rel="noopener noreferrer">Powered by TALIA</a>
        </div>
      </section>

      <aside
        className="widget-preview-welcome"
        data-visible={greetingVisible}
        aria-hidden={!greetingVisible}
        style={{
          ...floatingContentPosition,
          background: glass ? skin.panelFill : '#fff',
          color: glass ? skin.botText : '#1A1A2E',
          borderColor: glass ? skin.hairline : 'rgba(26,26,46,.12)',
          backdropFilter: glass ? filter : undefined,
          WebkitBackdropFilter: glass ? filter : undefined,
        }}
      >
        <button type="button" className="widget-preview-welcome-action" onClick={openPanel}>
          <span className="widget-preview-welcome-brand">
            <strong>{widgetConfig.assistantName}</strong>
          </span>
          <span className="widget-preview-welcome-message">{widgetConfig.proactiveMessage}</span>
        </button>
        <button
          type="button"
          className="widget-preview-welcome-close"
          aria-label="Cerrar"
          onClick={closeGreeting}
        >
          ×
        </button>
      </aside>

      <button
        ref={launcherRef}
        type="button"
        className="widget-preview-launcher"
        aria-label={panelOpen ? 'Cerrar asistente' : 'Abrir asistente'}
        aria-expanded={panelOpen}
        style={{ ...chatbotPosition, width: previewSize, height: previewSize, ...toggleStyle }}
        onClick={() => {
          if (panelOpen) {
            closePanel()
          } else {
            openPanel()
          }
        }}
      >
        <PreviewLauncherIcon value={widgetConfig.launcherIcon} size={previewSize} tone="light" />
      </button>
    </div>
  )
}

function PreviewLauncherIcon({ value, size, tone = 'light' }: { value: WidgetLauncherIcon; size: number; tone?: 'light' | 'brand' }) {
  const shadow = { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.2))' }

  if (value === 'chat') {
    return <MessageCircle aria-hidden="true" width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} strokeWidth={2.2} style={shadow} />
  }
  if (value === 'bubble') {
    return <MessageCircleMore aria-hidden="true" width={Math.round(size * 0.54)} height={Math.round(size * 0.54)} strokeWidth={2.2} style={shadow} />
  }
  if (value === 'bot') {
    return <Bot aria-hidden="true" width={Math.round(size * 0.54)} height={Math.round(size * 0.54)} strokeWidth={2.2} style={shadow} />
  }

  return (
    <Image
      src="/icon.svg"
      alt=""
      aria-hidden="true"
      width={500}
      height={500}
      style={{
        width: Math.round(size * 0.82),
        height: Math.round(size * 0.82),
        objectFit: 'contain',
        filter: tone === 'light' ? 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,.2))' : undefined,
      }}
    />
  )
}

// Single source of truth for the glass material, mirrored by the production widget
// (public/widget.js). `translucency` is 15–85 where higher = more see-through.
function getGlassSkin(color: string, background: 'light' | 'dark', translucency: number) {
  const alpha = Math.min(0.85, Math.max(0.15, (100 - translucency) / 100))
  if (background === 'dark') {
    return {
      bright: 1.16,
      stage: 'radial-gradient(120% 80% at 18% 8%, rgba(255,196,120,0.32), transparent 55%), radial-gradient(90% 70% at 88% 90%, rgba(180,60,90,0.4), transparent 60%), linear-gradient(135deg, #2b0f1f, #141019)',
      panelFill: `color-mix(in srgb, ${color} 16%, rgba(46,36,52,${alpha}))`,
      chromeFill: `color-mix(in srgb, ${color} 40%, rgba(40,30,46,${alpha * 0.85}))`,
      toggleFill: `color-mix(in srgb, ${color} 54%, rgba(60,44,66,0.3))`,
      spec: 'rgba(255,255,255,0.62)',
      spec2: 'rgba(255,255,255,0.22)',
      hairline: 'rgba(255,255,255,0.14)',
      msgSurface: 'rgba(30,23,36,0.55)',
      botBubble: 'rgba(255,255,255,0.15)',
      botText: '#f3ecf3',
      shadow: '0 20px 50px -14px rgba(0,0,0,0.62)',
    }
  }
  return {
    bright: 1.04,
    stage: 'radial-gradient(120% 80% at 15% 10%, rgba(255,196,120,0.45), transparent 55%), radial-gradient(90% 70% at 90% 88%, rgba(120,150,210,0.4), transparent 60%), linear-gradient(135deg, #f3ede1, #e4d3bd)',
    panelFill: `color-mix(in srgb, ${color} 8%, rgba(255,255,255,${alpha}))`,
    chromeFill: `color-mix(in srgb, ${color} 40%, rgba(255,255,255,${alpha * 0.7}))`,
    toggleFill: `color-mix(in srgb, ${color} 56%, rgba(255,255,255,0.22))`,
    spec: 'rgba(255,255,255,0.9)',
    spec2: 'rgba(255,255,255,0.4)',
    hairline: 'rgba(255,255,255,0.6)',
    msgSurface: 'rgba(250,248,243,0.55)',
    botBubble: '#ffffff',
    botText: '#211018',
    shadow: '0 18px 45px -14px rgba(40,10,25,0.42)',
  }
}

function getSolidPreviewStage(background: 'light' | 'dark') {
  if (background === 'dark') {
    return 'radial-gradient(120% 90% at 14% 8%, rgba(226,93,89,0.26), transparent 50%), linear-gradient(135deg, #211d32, #111827)'
  }

  return 'linear-gradient(135deg, #f4f1eb, #dce3ea)'
}

function getWidgetSize(value: string): 'small' | 'medium' | 'large' {
  if (value === 'small' || value === 'large') return value
  return 'medium'
}

function getPreviewWidgetSize(size: 'small' | 'medium' | 'large') {
  if (size === 'small') return 56
  if (size === 'large') return 72
  return 64
}

function getPreviewResponseFeedbackCopy(language: string) {
  if (language === 'ca') {
    return {
      groupLabel: 'Valorar la resposta',
      prompt: 'T’ha ajudat?',
      positive: 'Sí',
      positiveLabel: 'La resposta m’ha ajudat',
      negative: 'No',
      negativeLabel: 'La resposta no m’ha ajudat',
    }
  }
  if (language === 'en') {
    return {
      groupLabel: 'Rate this answer',
      prompt: 'Was this helpful?',
      positive: 'Yes',
      positiveLabel: 'This answer was helpful',
      negative: 'No',
      negativeLabel: 'This answer was not helpful',
    }
  }
  return {
    groupLabel: 'Valorar la respuesta',
    prompt: '¿Te ha ayudado?',
    positive: 'Sí',
    positiveLabel: 'La respuesta me ha ayudado',
    negative: 'No',
    negativeLabel: 'La respuesta no me ha ayudado',
  }
}

function getPreviewPosition(position: string, blockOffset: number, inlineOffset: number) {
  if (position === 'bottom-left') return { left: inlineOffset, bottom: blockOffset }
  if (position === 'top-right') return { right: inlineOffset, top: blockOffset }
  if (position === 'top-left') return { left: inlineOffset, top: blockOffset }
  return { right: inlineOffset, bottom: blockOffset }
}

function getPreviewFloatingContentPosition(position: string, blockOffset: number, inlineOffset: number, widgetSize: number) {
  const panelOffset = blockOffset + widgetSize + 12
  if (position === 'bottom-left') return { left: inlineOffset, bottom: panelOffset }
  if (position === 'top-right') return { right: inlineOffset, top: panelOffset }
  if (position === 'top-left') return { left: inlineOffset, top: panelOffset }
  return { right: inlineOffset, bottom: panelOffset }
}

function resizePreviewComposer(composer: HTMLTextAreaElement) {
  composer.style.height = 'auto'
  const nextHeight = Math.min(composer.scrollHeight, 120)
  composer.style.height = `${Math.max(nextHeight, 44)}px`
  composer.style.overflowY = composer.scrollHeight > 120 ? 'auto' : 'hidden'
}

function getNumericInput(value: string, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(320, Math.max(12, Math.round(numericValue)))
}
