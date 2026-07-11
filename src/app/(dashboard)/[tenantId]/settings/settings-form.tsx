'use client'

import { ActionToast } from '@/components/ui/action-toast'
import { useActionState, useState } from 'react'
import { CopyScriptButton } from './copy-script-button'
import { updateTenantSettings, type SettingsFormState } from './actions'
import { InternationalPhoneInput } from '@/components/ui/international-phone-input'
import { getDefaultPhoneCountry } from '@/lib/phone/international'

type SettingsFormLabels = {
  chatbot: string
  plan: string
  initialMessage: string
  primaryColor: string
  fallbackEmail: string
  fallbackPhone: string
  fallbackMessage: string
  fallbackMessageHint: string
  fallbackWhatsApp: string
  fallbackWhatsAppHint: string
  autoOpen: string
  delay: string
  allowedDomains: string
  allowedDomainsHint: string
  position: string
  widgetSize: string
  inlineOffset: string
  blockOffset: string
  collisionStrategy: string
  collisionStrategyHint: string
  offsetHint: string
  channelPrompt: string
  channelPromptHint: string
  saving: string
  save: string
}

type SettingsFormProps = {
  tenantId: string
  theatre: {
    plan: string
    system_prompt: string | null
    fallback_email: string | null
    fallback_phone: string | null
    primary_language: string
  }
  widgetConfig: {
    initialMessage: string
    primaryColor: string
    position: string
    widgetSize: 'small' | 'medium' | 'large'
    inlineOffset: number
    blockOffset: number
    collisionStrategy: 'auto' | 'none'
    autoOpen: boolean
    autoOpenDelay: number
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

export function SettingsForm({ tenantId, theatre, widgetConfig, labels, previewLabel, integration }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateTenantSettings.bind(null, tenantId), initialState)
  const [previewConfig, setPreviewConfig] = useState({
    assistantName: 'TALIA',
    initialMessage: widgetConfig.initialMessage,
    primaryColor: widgetConfig.primaryColor,
    position: widgetConfig.position,
    widgetSize: widgetConfig.widgetSize,
    inlineOffset: widgetConfig.inlineOffset,
    blockOffset: widgetConfig.blockOffset,
    collisionStrategy: widgetConfig.collisionStrategy,
  })

  return (
    <form action={formAction} className="stack">
      <ActionToast state={state} />

      <div className="two-column-grid">
        <div className="stack">
          <section className="card stack">
            <h2>{labels.chatbot}</h2>
            <div className="form-grid">
              <label className="field">
                {labels.plan}
                <select name="plan" defaultValue={theatre.plan}>
                  <option value="esencial">Esencial</option>
                  <option value="profesional">Profesional</option>
                  <option value="pro">Pro</option>
                </select>
              </label>

              <label className="field">
                {labels.initialMessage}
                <textarea
                  name="initial_message"
                  defaultValue={widgetConfig.initialMessage}
                  rows={3}
                  onChange={(event) => setPreviewConfig((current) => ({ ...current, initialMessage: event.target.value }))}
                />
              </label>

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

          <button className="button-primary" type="submit" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
            {pending ? labels.saving : labels.save}
          </button>
        </div>

        <aside className="stack">
          <section className="card stack">
            <h2>{previewLabel}</h2>
            <WidgetPreview widgetConfig={previewConfig} />
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
        </aside>
      </div>
    </form>
  )
}

function WidgetPreview({
  widgetConfig,
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
  }
}) {
  const scale = 0.35
  const chatbotOffset = Math.max(16, Math.round(widgetConfig.blockOffset * scale))
  const inlineOffset = Math.max(16, Math.round(widgetConfig.inlineOffset * scale))
  const previewSize = getPreviewWidgetSize(widgetConfig.widgetSize)
  const chatbotPosition = getPreviewPosition(widgetConfig.position, chatbotOffset, inlineOffset)

  return (
    <div style={{ minHeight: 260, position: 'relative' }}>
      <div style={{ border: '0.5px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)' }}>
        <div style={{ background: widgetConfig.primaryColor, color: '#fff', padding: '0.75rem', fontWeight: 700 }}>
          {widgetConfig.assistantName}
        </div>
        <div style={{ padding: '0.75rem', display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
          <p style={{ margin: 0, background: '#f1f1f1', color: '#1A1A2E', borderRadius: 8, padding: '0.6rem' }}>
            {widgetConfig.initialMessage}
          </p>
          <p style={{ margin: 0, justifySelf: 'end', background: widgetConfig.primaryColor, color: '#fff', borderRadius: 8, padding: '0.6rem' }}>
            Quiero información
          </p>
        </div>
      </div>
      <div style={{ position: 'absolute', ...chatbotPosition, width: previewSize, height: previewSize, borderRadius: 999, background: widgetConfig.primaryColor, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 10px 24px rgba(0,0,0,.22)' }}>
        <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false" width={Math.round(previewSize * 0.54)} height={Math.round(previewSize * 0.54)} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.25 6.8C5.25 4.98 6.73 3.5 8.55 3.5h10.9c1.82 0 3.3 1.48 3.3 3.3v7.7c0 1.82-1.48 3.3-3.3 3.3h-6.17l-5.1 4.2v-4.2h.37c-1.82 0-3.3-1.48-3.3-3.3V6.8Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M10 10.5h7.2M10 14h4.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
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

function getPreviewPosition(position: string, blockOffset: number, inlineOffset: number) {
  if (position === 'bottom-left') return { left: inlineOffset, bottom: blockOffset }
  if (position === 'top-right') return { right: inlineOffset, top: blockOffset }
  if (position === 'top-left') return { left: inlineOffset, top: blockOffset }
  return { right: inlineOffset, bottom: blockOffset }
}

function getNumericInput(value: string, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(320, Math.max(12, Math.round(numericValue)))
}
