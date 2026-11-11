'use client'

import { ActionToast } from '@/components/ui/action-toast'
import { ConfirmationToast } from '@/components/ui/confirmation-toast'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CopyScriptButton } from '@/components/copy-script-button'
import { updateTenantSettings, type SettingsFormState } from './actions'
import { AgentVoicePicker, type AgentVoicePickerLabels } from './agent-voice-picker'
import { TaliaFace } from '@/components/talia-face'
import { TaliaMark } from '@/components/talia-mark'
import { testWebAgentMessage, type TestWebAgentResult } from './test-web-agent-action'
import type { Json } from '@/types/database.types'
import type { AgentVoice } from '@/lib/widget/agent-voices'
import { InternationalPhoneInput } from '@/components/ui/international-phone-input'
import { getDefaultPhoneCountry } from '@/lib/phone/international'
import { ArrowDown, ArrowUp, Bot, ChevronLeft, Globe, MessageCircle, MessageCircleMore, Mic, Moon, Palette, Plug, Plus, RefreshCcw, Sun, Trash2, Volume2 } from 'lucide-react'
import type { WidgetLauncherIcon } from '@/lib/widget/launcher-icon'
import { getSessionFeedbackCopy } from '@/lib/widget/session-feedback-copy'
import {
  getVisibleSuggestedQuestions,
  MAX_SUGGESTED_QUESTION_TARGETS,
  MAX_SUGGESTED_QUESTIONS,
  type SuggestedQuestion,
  type SuggestedQuestionTarget,
  type SuggestedQuestionTargetType,
} from '@/lib/widget/suggested-questions'
import type { WidgetComplianceCopy } from '@/lib/widget/compliance'
import {
  WidgetInstallationAssistant,
  type WidgetInstallationAssistantLabels,
} from '@/components/widget-installation-assistant'

type SettingsFormLabels = AgentVoicePickerLabels & {
  testChatHint: string
  testChatSources: string
  testChatNoSources: string
  testChatError: string
  testChatRateLimited: string
  testChatThinking: string
  settingsSections: string
  tabConversation: string
  tabAnswers: string
  tabVoice: string
  tabAppearance: string
  tabInstall: string
  sectionWelcome: string
  sectionWelcomeHint: string
  sectionFallback: string
  sectionFallbackHint: string
  sectionVoice: string
  sectionVoiceHint: string
  sectionStyle: string
  sectionPlacement: string
  advancedSettings: string
  sectionPrivacy: string
  voiceInvitation: string
  voiceInvitationHint: string
  voiceEnabled: string
  voiceEnabledHint: string
  chatbot: string
  widgetAvailability: string
  widgetAvailabilityHint: string
  widgetKnowledgeRequired: string
  widgetKnowledgeLink: string
  widgetEnabled: string
  widgetDisabled: string
  initialMessage: string
  privacyUrl: string
  privacyUrlHint: string
  aiDisclosureFixed: string
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
  widgetIconMark: string
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
  channelPromptHintBefore: string
  channelPromptHintKnowledge: string
  unsavedChanges: string
  unsavedChangesWarning: string
  keepEditing: string
  leaveWithoutSaving: string
  saveChanges: string
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
  widgetConfig: {
    enabled: boolean
    initialMessage: string
    privacyUrl: string
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
    agentVoice: AgentVoice
    voiceInvitation: boolean
    voiceEnabled: boolean
  }
  voiceOptions: { value: AgentVoice; label: string; description: string }[]
  hasUsableKnowledge: boolean
  labels: SettingsFormLabels
  compliance: WidgetComplianceCopy
  previewLabel: string
  title: string
  subtitle: string
  integration: {
    title: string
    help: string
    copyScript: string
    copiedScript: string
    embedCode: string
    hasScriptAccess: boolean
    security: {
      title: string
      help: string
      instructions: string
      copy: string
      copied: string
    }
    assistant: {
      websiteUrl: string | null
      installation: { origin: string; lastSeenAt: string } | null
      labels: WidgetInstallationAssistantLabels
    }
  }
}

const initialState: SettingsFormState = {
  ok: false,
  message: '',
}

type SettingsTabId = 'conversation' | 'answers' | 'voice' | 'appearance' | 'install'

// Grouped by what the venue wants to do, not by field type.
const SETTINGS_TABS: { id: SettingsTabId; labelKey: 'tabConversation' | 'tabAnswers' | 'tabVoice' | 'tabAppearance' | 'tabInstall'; icon: typeof MessageCircle }[] = [
  { id: 'conversation', labelKey: 'tabConversation', icon: MessageCircle },
  { id: 'answers', labelKey: 'tabAnswers', icon: Bot },
  { id: 'voice', labelKey: 'tabVoice', icon: Mic },
  { id: 'appearance', labelKey: 'tabAppearance', icon: Palette },
  { id: 'install', labelKey: 'tabInstall', icon: Plug },
]

function isSettingsTabId(value: string): value is SettingsTabId {
  return SETTINGS_TABS.some((tab) => tab.id === value)
}

// Every panel stays mounted (only hidden) so all fields are always submitted.
function SettingsPanel({ id, activeTab, children }: { id: SettingsTabId; activeTab: SettingsTabId; children: React.ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`chatbot-settings-panel-${id}`}
      aria-labelledby={`chatbot-settings-tab-${id}`}
      data-settings-panel={id}
      hidden={activeTab !== id}
      className="stack chatbot-settings-panel"
    >
      {children}
    </div>
  )
}

export function SettingsForm({ tenantId, theatre, widgetConfig, voiceOptions, hasUsableKnowledge, labels, compliance, previewLabel, title, subtitle, integration }: SettingsFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateTenantSettings.bind(null, tenantId), initialState)
  const [widgetEnabled, setWidgetEnabled] = useState(widgetConfig.enabled)
  const [activeTab, setActiveTab] = useState<SettingsTabId>('conversation')
  const activationLocked = !hasUsableKnowledge && !widgetConfig.enabled
  const [dirty, setDirty] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const changeVersionRef = useRef(0)
  const submittedVersionRef = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)
  const savingPendingNavigationRef = useRef(false)
  const navigationTriggerRef = useRef<HTMLAnchorElement | null>(null)
  const [previewConfig, setPreviewConfig] = useState({
    assistantName: 'TALIA',
    initialMessage: widgetConfig.initialMessage,
    privacyUrl: widgetConfig.privacyUrl,
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
    voiceEnabled: widgetConfig.voiceEnabled,
  })
  const [suggestedQuestions, setSuggestedQuestions] = useState(widgetConfig.suggestedQuestions)

  useEffect(() => {
    if (!state.ok) return

    if (savingPendingNavigationRef.current) {
      savingPendingNavigationRef.current = false
      setPendingNavigation(null)
      navigationTriggerRef.current = null
    }

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

  const savePendingNavigation = () => {
    if (!pendingNavigation || pending) return
    savingPendingNavigationRef.current = true
    formRef.current?.requestSubmit()
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
      ref={formRef}
      action={formAction}
      className="stack chatbot-settings-form"
      onChange={() => {
        changeVersionRef.current += 1
        setDirty(true)
      }}
      onSubmit={() => {
        submittedVersionRef.current = changeVersionRef.current
      }}
      onInvalidCapture={(event) => {
        // A required field in another tab: show that tab so the browser can
        // point at the field instead of failing silently.
        const panel = (event.target as HTMLElement).closest<HTMLElement>('[data-settings-panel]')
        const tab = panel?.dataset.settingsPanel
        if (tab && isSettingsTabId(tab)) setActiveTab(tab)
      }}
    >
      <ActionToast state={state} />
      {pendingNavigation ? (
        <ConfirmationToast
          title={labels.unsavedChanges}
          message={labels.unsavedChangesWarning}
          discardLabel={labels.leaveWithoutSaving}
          saveLabel={labels.saveChanges}
          saving={pending}
          onCancel={keepEditing}
          onDiscard={leaveWithoutSaving}
          onSave={savePendingNavigation}
        />
      ) : null}

      <div className="page-header chatbot-settings-header chatbot-settings-save-bar">
        <div>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <div className="chatbot-settings-save-actions">
          {activationLocked ? (
            <Link
              className="chatbot-settings-availability-hint"
              href={`/${tenantId}/knowledge`}
              title={labels.widgetKnowledgeRequired}
              id="chatbot-knowledge-requirement"
            >
              {labels.widgetKnowledgeLink}
            </Link>
          ) : null}
          <label className="chatbot-availability-control" data-disabled={activationLocked}>
            <input
              type="checkbox"
              name="widget_enabled"
              checked={widgetEnabled}
              disabled={activationLocked}
              aria-describedby={activationLocked ? 'chatbot-knowledge-requirement' : undefined}
              onChange={(event) => setWidgetEnabled(event.target.checked)}
            />
            <span className="chatbot-availability-switch" aria-hidden="true">
              <span />
            </span>
            <strong>{widgetEnabled ? labels.widgetEnabled : labels.widgetDisabled}</strong>
          </label>
          {dirty ? <span className="chatbot-settings-unsaved">{labels.unsavedChanges}</span> : null}
          <button className="button-primary chatbot-settings-save-button" type="submit" disabled={!dirty || pending}>
            {pending ? labels.saving : labels.save}
          </button>
        </div>
      </div>

      <div className="chatbot-settings-tabs" role="tablist" aria-label={labels.settingsSections}>
        {SETTINGS_TABS.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`chatbot-settings-tab-${tab.id}`}
            aria-controls={`chatbot-settings-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className="chatbot-settings-tab"
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
              if (!step) return
              event.preventDefault()
              const next = SETTINGS_TABS[(index + step + SETTINGS_TABS.length) % SETTINGS_TABS.length]
              setActiveTab(next.id)
              document.getElementById(`chatbot-settings-tab-${next.id}`)?.focus()
            }}
          >
            <tab.icon aria-hidden="true" size={17} strokeWidth={2} />
            <span>{labels[tab.labelKey]}</span>
          </button>
        ))}
      </div>

      <div className="two-column-grid chatbot-settings-grid">
        <div className="stack chatbot-settings-main-column">
          <SettingsPanel id="conversation" activeTab={activeTab}>
            <section className="card stack">
              <h2>{labels.sectionWelcome}</h2>
              <p className="muted settings-section-hint">{labels.sectionWelcomeHint}</p>
              <label className="field">
                {labels.initialMessage}
                <textarea
                  name="initial_message"
                  defaultValue={widgetConfig.initialMessage}
                  rows={3}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, initialMessage: event.target.value }))}
                />
              </label>

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

            <section className="card stack">
              <SuggestedQuestionsEditor
                questions={suggestedQuestions}
                chatbotLanguage={theatre.primary_language}
                labels={labels}
                onChange={updateSuggestedQuestions}
              />

            </section>
          </SettingsPanel>

          <SettingsPanel id="answers" activeTab={activeTab}>
            <section className="card stack">
              <h2>{labels.channelPrompt}</h2>
              <p className="muted">
                {labels.channelPromptHintBefore}
                <Link href={`/${tenantId}/knowledge`}>{labels.channelPromptHintKnowledge}</Link>.
              </p>
              <textarea
                name="system_prompt"
                defaultValue={theatre.system_prompt ?? ''}
                rows={10}
                className="mono"
                placeholder="Instrucciones específicas para el Agente Web."
              />
            </section>


            <section className="card stack">
              <h2>{labels.sectionFallback}</h2>
              <p className="muted settings-section-hint">{labels.sectionFallbackHint}</p>
              <div className="form-grid">
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

            </section>
          </SettingsPanel>

          <SettingsPanel id="voice" activeTab={activeTab}>
            <section className="card stack">
              <h2>{labels.sectionVoice}</h2>
              <p className="muted settings-section-hint">{labels.sectionVoiceHint}</p>
              <label className="voice-invitation-toggle">
                <input
                  type="checkbox"
                  name="voice_enabled"
                  checked={previewConfig.voiceEnabled}
                  onChange={(event) => {
                    const voiceEnabled = event.target.checked
                    setPreviewConfig((current) => ({ ...current, voiceEnabled }))
                  }}
                />
                <span>
                  <strong>{labels.voiceEnabled}</strong>
                  <span className="muted">{labels.voiceEnabledHint}</span>
                </span>
              </label>
              {/* Voice options only apply while voice is on; they keep their saved values. */}
              <fieldset className="voice-options" disabled={!previewConfig.voiceEnabled}>
                <label className="voice-invitation-toggle">
                  <input
                    type="checkbox"
                    name="voice_invitation"
                    defaultChecked={widgetConfig.voiceInvitation}
                  />
                  <span>
                    <strong>{labels.voiceInvitation}</strong>
                    <span className="muted">{labels.voiceInvitationHint}</span>
                  </span>
                </label>
                <AgentVoicePicker
                  tenantId={tenantId}
                  defaultVoice={widgetConfig.agentVoice}
                  options={voiceOptions}
                  labels={labels}
                />
              </fieldset>
            </section>

          </SettingsPanel>

          <SettingsPanel id="appearance" activeTab={activeTab}>
            <section className="card stack">
              <h2>{labels.sectionStyle}</h2>
              <div className="form-grid">
                <label className="field settings-color-field">
                  {labels.primaryColor}
                  <input
                    name="primary_color"
                    type="color"
                    defaultValue={widgetConfig.primaryColor}
                    style={{ height: 44 }}
                    onChange={(event) => setPreviewConfig((current) => ({ ...current, primaryColor: event.target.value }))}
                  />
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
                      markLabel={labels.widgetIconMark}
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

              </div>
            </section>

            <section className="card stack">
              <h2>{labels.sectionPlacement}</h2>
              <div className="form-grid">
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

              </div>
              <details className="settings-advanced">
                <summary>{labels.advancedSettings}</summary>
                <div className="form-grid">
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

                </div>
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

              </details>
            </section>
          </SettingsPanel>

          <SettingsPanel id="install" activeTab={activeTab}>
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
                  <WidgetInstallationAssistant
                    websiteUrl={integration.assistant.websiteUrl}
                    installation={integration.assistant.installation}
                    security={integration.security}
                    labels={integration.assistant.labels}
                  />
                </>
              ) : (
                <div className="locked-panel">
                  <span className="status-pill status-pill-soon">Configura el Agente Web</span>
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
              <h2>{labels.sectionPrivacy}</h2>
              <label className="field">
                {labels.privacyUrl}
                <input
                  name="privacy_url"
                  type="url"
                  inputMode="url"
                  required
                  defaultValue={widgetConfig.privacyUrl}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, privacyUrl: event.target.value }))}
                />
                <small className="muted">{labels.privacyUrlHint}</small>
              </label>

              <div className="chatbot-compliance-summary">
                <strong>{compliance.aiLabel}</strong>
                <p>{labels.aiDisclosureFixed}</p>
              </div>

            </section>
          </SettingsPanel>
        </div>

        <aside className="stack chatbot-settings-preview-column">
          {/* The preview is a mini browser window: the simulated page URL lives in
              its address bar so the widget gets almost all the space. */}
          <section className="card chatbot-preview-card chatbot-preview-frame" aria-label={previewLabel}>
            <div className="preview-browser-bar">
              <span className="preview-browser-dots" aria-hidden="true"><i /><i /><i /></span>
              <label className="preview-browser-address" title={labels.suggestedQuestionsPreviewUrlHint}>
                <Globe aria-hidden="true" size={14} strokeWidth={2} />
                <span className="sr-only">{labels.suggestedQuestionsPreviewUrl}</span>
                <input
                  type="url"
                  value={previewConfig.pageUrl}
                  placeholder="https://example.org/agenda"
                  aria-describedby="chatbot-preview-url-hint"
                  onChange={(event) => {
                    event.stopPropagation()
                    setPreviewConfig((current) => ({ ...current, pageUrl: event.target.value }))
                  }}
                />
              </label>
              <span className="sr-only" id="chatbot-preview-url-hint">{labels.suggestedQuestionsPreviewUrlHint}</span>
              <PreviewBackgroundSwitch
                value={previewConfig.glassBackground}
                label={labels.glassBackground}
                lightLabel={labels.glassBackgroundLight}
                darkLabel={labels.glassBackgroundDark}
                onSelect={(glassBackground) => setPreviewConfig((current) => ({ ...current, glassBackground }))}
              />
            </div>
            <WidgetPreview
              key={previewConfig.autoOpen ? 'proactive' : 'manual'}
              widgetConfig={previewConfig}
              compliance={compliance}
              suggestedQuestionsLabel={labels.suggestedQuestions}
              suggestedQuestionsPrompt={labels.suggestedQuestionsPrompt}
              testChat={{
                send: (payload) => testWebAgentMessage(tenantId, payload),
                labels,
              }}
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
  markLabel,
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
  markLabel: string
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
    { value: 'mark', label: markLabel },
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

  if (value === 'mark') {
    return <TaliaMark className="widget-launcher-glyph widget-launcher-glyph-mark" />
  }

  return <TaliaFace className="widget-launcher-glyph widget-launcher-glyph-talia" />
}

// Compact light/dark page background switch for the preview's address bar.
// Keeps the `glass_background` form field the settings action saves.
function PreviewBackgroundSwitch({
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
    <div className="preview-background-switch" role="radiogroup" aria-label={label}>
      {([['light', lightLabel, Sun], ['dark', darkLabel, Moon]] as const).map(([option, optionLabel, Icon]) => (
        <label key={option} className="preview-background-option" title={optionLabel} data-checked={value === option}>
          <input
            type="radio"
            name="glass_background"
            value={option}
            checked={value === option}
            onChange={() => onSelect(option)}
            className="sr-only"
            aria-label={optionLabel}
          />
          <Icon aria-hidden="true" size={14} strokeWidth={2} />
        </label>
      ))}
    </div>
  )
}

type TestChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  additionalSources?: number
  error?: boolean
}

function WidgetPreview({
  widgetConfig,
  compliance,
  suggestedQuestionsLabel,
  suggestedQuestionsPrompt,
  testChat,
}: {
  widgetConfig: {
    assistantName: string
    initialMessage: string
    privacyUrl: string
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
    voiceEnabled: boolean
  }
  compliance: WidgetComplianceCopy
  suggestedQuestionsLabel: string
  suggestedQuestionsPrompt: string
  testChat: {
    send: (payload: {
      message: string
      history: { role: 'user' | 'assistant'; content: string }[]
      state: Json | null
      pageUrl?: string
      timeZone?: string
    }) => Promise<TestWebAgentResult>
    labels: Pick<SettingsFormLabels, 'testChatHint' | 'testChatSources' | 'testChatNoSources' | 'testChatError' | 'testChatRateLimited' | 'testChatThinking'>
  }
}) {
  const [panelOpen, setPanelOpen] = useState(true)
  // Test chat: real answers from the saved Knowledge; nothing is stored.
  const [testMessages, setTestMessages] = useState<TestChatMessage[]>([])
  const [testState, setTestState] = useState<Json | null>(null)
  const [testPending, setTestPending] = useState(false)
  const [draft, setDraft] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = messagesRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [testMessages.length, testPending])

  async function sendTestMessage(text: string) {
    const message = text.trim()
    if (!message || testPending) return
    const history = testMessages
      .filter((item) => !item.error)
      .map((item) => ({ role: item.role, content: item.content }))
    setTestMessages((current) => [...current, { role: 'user', content: message }])
    setDraft('')
    setTestPending(true)
    try {
      const result = await testChat.send({
        message,
        history,
        state: testState,
        pageUrl: widgetConfig.pageUrl || undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      if (result.ok) {
        setTestState(result.state)
        setTestMessages((current) => [...current, {
          role: 'assistant',
          content: result.reply,
          sources: result.sources.map((source) => source.label),
          additionalSources: result.additionalSources,
        }])
      } else {
        setTestMessages((current) => [...current, {
          role: 'assistant',
          content: result.error === 'rate_limited' ? testChat.labels.testChatRateLimited : testChat.labels.testChatError,
          error: true,
        }])
      }
    } catch {
      setTestMessages((current) => [...current, { role: 'assistant', content: testChat.labels.testChatError, error: true }])
    } finally {
      setTestPending(false)
      requestAnimationFrame(() => composerRef.current?.focus())
    }
  }
  const [greetingVisible, setGreetingVisible] = useState(false)
  const [sessionFeedbackOpen, setSessionFeedbackOpen] = useState(false)
  const [sessionFeedbackResolved, setSessionFeedbackResolved] = useState<boolean | null>(null)
  const [selectedSuggestedQuestion, setSelectedSuggestedQuestion] = useState<string | null>(null)
  const [privacyConversationOpen, setPrivacyConversationOpen] = useState(false)
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
  const sessionFeedbackCopy = getSessionFeedbackCopy(widgetConfig.fallbackLanguage)

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
    setTestMessages([])
    setTestState(null)
    setSessionFeedbackOpen(false)
    setSessionFeedbackResolved(null)
    setSelectedSuggestedQuestion(null)
    setPrivacyConversationOpen(false)
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
            <span className="widget-preview-header-mark">
              {/* TALIA's own avatar is always TALIA's face, like the installed widget. */}
              <TaliaFace size={32} />
            </span>
            <span className="widget-preview-header-identity">
              <span className="widget-preview-header-name">{widgetConfig.assistantName}</span>
              <small>{compliance.aiLabel}</small>
            </span>
          </span>
          <span className="widget-preview-header-actions">
            {/* Mirrors the installed widget's voice controls (public/widget.js); inert in preview. */}
            {widgetConfig.voiceEnabled ? (
              <button
                type="button"
                className="widget-preview-icon-button widget-preview-voice-control"
                aria-label="Leer respuestas en voz alta"
                title="Leer respuestas en voz alta"
                aria-disabled="true"
              >
                <Volume2 aria-hidden="true" strokeWidth={2} />
              </button>
            ) : null}
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
        <div ref={messagesRef} className="widget-preview-messages" style={{ background: glass ? skin.msgSurface : '#F5F2EC' }}>
          <p className="widget-preview-ai-disclosure">{compliance.disclosure}</p>
          <p className="widget-preview-test-hint">{testChat.labels.testChatHint}</p>
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
          {!selectedSuggestedQuestion && !privacyConversationOpen && !sessionFeedbackOpen && testMessages.length === 0 && visibleSuggestedQuestions.length > 0 ? (
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
                      setPrivacyConversationOpen(false)
                      void sendTestMessage(question.text)
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
          {testMessages.map((item, index) => item.role === 'user' ? (
            <p key={index} className="widget-preview-message widget-preview-message-user" style={{ background: color }}>
              {item.content}
            </p>
          ) : (
            <div key={index} className="widget-preview-test-answer">
              <p className={item.error ? 'widget-preview-message widget-preview-test-error' : 'widget-preview-message'} style={item.error ? undefined : botBubbleStyle}>
                {item.content}
              </p>
              {item.error ? null : item.sources && item.sources.length ? (
                <p className="widget-preview-test-sources">
                  {testChat.labels.testChatSources}: {item.sources.join(' · ')}
                  {item.additionalSources ? ` (+${item.additionalSources})` : ''}
                </p>
              ) : (
                <p className="widget-preview-test-sources widget-preview-test-sources-missing">{testChat.labels.testChatNoSources}</p>
              )}
            </div>
          ))}
          {testPending ? (
            <p className="widget-preview-message widget-preview-test-typing" style={botBubbleStyle} aria-label={testChat.labels.testChatThinking}>
              <span /><span /><span />
            </p>
          ) : null}
          {privacyConversationOpen ? (
            <>
              <p className="widget-preview-message widget-preview-message-user" style={{ background: color }}>
                {compliance.privacyQuestion}
              </p>
              <div className="widget-preview-message" style={botBubbleStyle}>
                <p>{compliance.privacySummary}</p>
                <p>
                  {compliance.privacyMore}{' '}
                  <a href={widgetConfig.privacyUrl} target="_blank" rel="noopener noreferrer">
                    {widgetConfig.privacyUrl}
                  </a>
                </p>
              </div>
            </>
          ) : null}
          {sessionFeedbackOpen ? (
            <div
              className="widget-preview-message widget-preview-session-feedback"
              style={{
                ...botBubbleStyle,
                ['--widget-preview-session-feedback-color' as string]: color,
              }}
              aria-label={sessionFeedbackCopy.groupLabel}
            >
              <div className="widget-preview-session-feedback-heading">
                <strong>{sessionFeedbackCopy.title}</strong>
                <span>{sessionFeedbackCopy.description}</span>
              </div>
              <div className="widget-preview-session-feedback-choices">
                <button
                  type="button"
                  className={sessionFeedbackResolved === true ? 'widget-preview-session-feedback-choice widget-preview-session-feedback-choice-active' : 'widget-preview-session-feedback-choice'}
                  data-value="yes"
                  onClick={() => setSessionFeedbackResolved(true)}
                >
                  <span>{sessionFeedbackCopy.positive}</span>
                </button>
                <button
                  type="button"
                  className={sessionFeedbackResolved === false ? 'widget-preview-session-feedback-choice widget-preview-session-feedback-choice-active' : 'widget-preview-session-feedback-choice'}
                  data-value="no"
                  onClick={() => setSessionFeedbackResolved(false)}
                >
                  <span>{sessionFeedbackCopy.negative}</span>
                </button>
              </div>
              <textarea maxLength={1000} placeholder={sessionFeedbackCopy.commentsPlaceholder} />
              <div className="widget-preview-session-feedback-actions">
                <button type="button" className="widget-preview-session-feedback-button widget-preview-session-feedback-submit" disabled={sessionFeedbackResolved === null} onClick={closeSessionFeedback}>{sessionFeedbackCopy.submit}</button>
                <button type="button" className="widget-preview-session-feedback-button widget-preview-session-feedback-skip" onClick={closeSessionFeedback}>{sessionFeedbackCopy.skip}</button>
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
            value={draft}
            onInput={(event) => resizePreviewComposer(event.currentTarget)}
            onChange={(event) => {
              // Test messages are not settings: don't mark the form as changed.
              event.stopPropagation()
              setDraft(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendTestMessage(draft)
              }
            }}
          />
          {widgetConfig.voiceEnabled ? (
            <button
              type="button"
              className="widget-preview-mic"
              disabled
              aria-label="Hablar con el agente (Alt+Mayús+V; en Mac, Opción+Mayús+V)"
              title="Hablar con el agente (Alt+Mayús+V; en Mac, Opción+Mayús+V)"
              style={{ color }}
            >
              <Mic aria-hidden="true" strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            className="widget-preview-send"
            disabled={!draft.trim() || testPending}
            style={{ background: color }}
            onClick={() => void sendTestMessage(draft)}
          >
            Enviar
          </button>
        </div>
        <div
          className="widget-preview-powered"
          style={{
            background: glass ? skin.chromeFill : '#fff',
            backdropFilter: glass ? filter : undefined,
            WebkitBackdropFilter: glass ? filter : undefined,
          }}
        >
          <a
            href={widgetConfig.privacyUrl}
            onClick={(event) => {
              event.preventDefault()
              setSessionFeedbackOpen(false)
              setSelectedSuggestedQuestion(null)
              setPrivacyConversationOpen(true)
              openPanel()
            }}
          >
            {compliance.privacyLabel}
          </a>
          <span aria-hidden="true"> · </span>
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
        aria-label={panelOpen ? 'Cerrar Agente Web' : 'Abrir Agente Web'}
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
        <PreviewLauncherIcon value={widgetConfig.launcherIcon} size={previewSize} />
      </button>
    </div>
  )
}

function PreviewLauncherIcon({ value, size }: { value: WidgetLauncherIcon; size: number }) {
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

  if (value === 'mark') {
    return <TaliaMark size={Math.round(size * 0.54)} style={shadow} />
  }

  return <TaliaFace size={Math.round(size * 0.82)} style={{ filter: 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,.2))' }} />
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
