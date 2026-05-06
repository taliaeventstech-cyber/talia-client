'use client'

import { useActionState, useState, useTransition } from 'react'
import { updateVoiceSettings, regenerateVoicePrompt, type VoiceSettingsState } from './actions'

type VoiceTone = 'warm' | 'professional' | 'neutral'

type VoiceSettingsFormProps = {
  tenantId: string
  current: {
    voiceEnabled: boolean
    elevenLabsAgentId: string | null
    voicePhoneNumber: string | null
    voiceId: string | null
    voiceLanguage: string
    voiceTone: string
    voiceTemperature: number
    voiceCustomPrompt: string | null
    voiceMaxTurns: number
    generatedPrompt: string
  }
  labels: {
    state: string
    enabled: string
    enabledHint: string
    elevenLabs: string
    agentIdHint: string
    voiceIdHint: string
    personality: string
    tone: string
    toneHint: string
    creativity: string
    deterministic: string
    creative: string
    telephony: string
    phoneNumber: string
    phoneHint: string
    defaultLanguage: string
    maxTurns: string
    maxTurnsHint: string
    voicePrompt: string
    regenerate: string
    generating: string
    promptHelp: string
    backToAutomatic: string
    save: string
    saving: string
    temperatures: {
      veryDeterministic: string
      deterministic: string
      balanced: string
      creative: string
      veryCreative: string
    }
    tones: Record<VoiceTone, string>
  }
}

const initialState: VoiceSettingsState = { ok: false, message: '' }

export function VoiceSettingsForm({ tenantId, current, labels }: VoiceSettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateVoiceSettings.bind(null, tenantId), initialState)
  const [temperature, setTemperature] = useState(current.voiceTemperature)
  const [customPrompt, setCustomPrompt] = useState(current.voiceCustomPrompt ?? '')
  const [isRegenerating, startRegenerate] = useTransition()

  function handleRegenerate() {
    startRegenerate(async () => {
      const { prompt } = await regenerateVoicePrompt(tenantId)
      setCustomPrompt('')
      // Show the generated prompt in the textarea as a preview
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="voice_custom_prompt"]')
      if (textarea) {
        textarea.value = prompt
        textarea.placeholder = prompt
      }
    })
  }

  const tempLabel = temperature <= 20
    ? labels.temperatures.veryDeterministic
    : temperature <= 40
    ? labels.temperatures.deterministic
    : temperature <= 60
    ? labels.temperatures.balanced
    : temperature <= 80
    ? labels.temperatures.creative
    : labels.temperatures.veryCreative

  return (
    <form action={formAction} className="stack">
      {state.message ? (
        <p role="status" className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <section className="card stack">
        <h2>{labels.state}</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="voice_enabled"
            defaultChecked={current.voiceEnabled}
            style={{ width: 16, height: 16 }}
          />
          <span>{labels.enabled}</span>
        </label>
        <p className="muted">{labels.enabledHint}</p>
      </section>

      <section className="card stack">
        <h2>{labels.elevenLabs}</h2>
        <div className="form-grid">
          <label className="field">
            Agent ID
            <input
              name="elevenlabs_agent_id"
              defaultValue={current.elevenLabsAgentId ?? ''}
              placeholder="agent_01jxxxxxxxxxxxxxxxx"
              className="mono"
            />
            <span className="field-hint">
              {labels.agentIdHint}
            </span>
          </label>

          <label className="field">
            Voice ID
            <input
              name="voice_id"
              defaultValue={current.voiceId ?? ''}
              placeholder="21m00Tcm4TlvDq8ikWAM"
              className="mono"
            />
            <span className="field-hint">
              {labels.voiceIdHint}
            </span>
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>{labels.personality}</h2>

        <label className="field">
          {labels.tone}
          <select name="voice_tone" defaultValue={current.voiceTone}>
            {(Object.entries(labels.tones) as [VoiceTone, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span className="field-hint">
            {labels.toneHint}
          </span>
        </label>

        <div className="field">
          <label htmlFor="voice_temperature" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{labels.creativity}</span>
            <span className="muted" style={{ fontSize: '0.8em' }}>{tempLabel} ({temperature}%)</span>
          </label>
          <input
            id="voice_temperature"
            name="voice_temperature"
            type="range"
            min={0}
            max={100}
            step={5}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="field-hint">{labels.deterministic}</span>
            <span className="field-hint">{labels.creative}</span>
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>{labels.telephony}</h2>
        <div className="form-grid">
          <label className="field">
            {labels.phoneNumber}
            <input
              name="voice_phone_number"
              defaultValue={current.voicePhoneNumber ?? ''}
              placeholder="+34931234567"
            />
            <span className="field-hint">
              {labels.phoneHint}
            </span>
          </label>

          <label className="field">
            {labels.defaultLanguage}
            <select name="voice_language" defaultValue={current.voiceLanguage}>
              <option value="ca">Català</option>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="field">
            {labels.maxTurns}
            <input
              name="voice_max_turns"
              type="number"
              min={1}
              max={30}
              defaultValue={current.voiceMaxTurns}
              style={{ width: 80 }}
            />
            <span className="field-hint">{labels.maxTurnsHint}</span>
          </label>
        </div>
      </section>

      <section className="card stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>{labels.voicePrompt}</h2>
          <button
            type="button"
            className="button-ghost"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            style={{ fontSize: '0.8em' }}
          >
            {isRegenerating ? labels.generating : labels.regenerate}
          </button>
        </div>
        <p className="muted">
          {labels.promptHelp}
        </p>
        <textarea
          name="voice_custom_prompt"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={current.generatedPrompt}
          rows={16}
          className="mono"
        />
        {customPrompt && (
          <button
            type="button"
            className="button-ghost"
            onClick={() => setCustomPrompt('')}
            style={{ fontSize: '0.8em', alignSelf: 'flex-start' }}
          >
            {labels.backToAutomatic}
          </button>
        )}
      </section>

      <button
        className="button-primary"
        type="submit"
        disabled={pending}
        style={{ opacity: pending ? 0.7 : 1 }}
      >
        {pending ? labels.saving : labels.save}
      </button>
    </form>
  )
}
