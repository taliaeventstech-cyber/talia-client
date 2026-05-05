'use client'

import { useActionState, useState, useTransition } from 'react'
import { updateVoiceSettings, regenerateVoicePrompt, type VoiceSettingsState } from './actions'

type VoiceTone = 'warm' | 'professional' | 'neutral'

const TONE_LABELS: Record<VoiceTone, string> = {
  warm: 'Cálido y cercano',
  professional: 'Profesional y conciso',
  neutral: 'Neutro y equilibrado',
}

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
}

const initialState: VoiceSettingsState = { ok: false, message: '' }

export function VoiceSettingsForm({ tenantId, current }: VoiceSettingsFormProps) {
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
    ? 'Muy determinista'
    : temperature <= 40
    ? 'Determinista'
    : temperature <= 60
    ? 'Equilibrado'
    : temperature <= 80
    ? 'Creativo'
    : 'Muy creativo'

  return (
    <form action={formAction} className="stack">
      {state.message ? (
        <p role="status" className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <section className="card stack">
        <h2>Estado</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="voice_enabled"
            defaultChecked={current.voiceEnabled}
            style={{ width: 16, height: 16 }}
          />
          <span>Agente de voz activo</span>
        </label>
        <p className="muted">Cuando está activo, las llamadas se registran en TALIA y aparecen en Analytics.</p>
      </section>

      <section className="card stack">
        <h2>ElevenLabs</h2>
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
              ElevenLabs → Agentes → [tu agente] → copia el Agent ID de la URL.
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
              ElevenLabs → Voices → Voice ID de la voz elegida.
            </span>
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>Personalidad</h2>

        <label className="field">
          Tono
          <select name="voice_tone" defaultValue={current.voiceTone}>
            {(Object.entries(TONE_LABELS) as [VoiceTone, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span className="field-hint">
            Define el estilo de respuesta del agente. Se aplica al prompt generado automáticamente.
          </span>
        </label>

        <div className="field">
          <label htmlFor="voice_temperature" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Creatividad</span>
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
            <span className="field-hint">Determinista</span>
            <span className="field-hint">Creativo</span>
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>Telefonía</h2>
        <div className="form-grid">
          <label className="field">
            Número de teléfono
            <input
              name="voice_phone_number"
              defaultValue={current.voicePhoneNumber ?? ''}
              placeholder="+34931234567"
            />
            <span className="field-hint">
              Configúralo en ElevenLabs → Agentes → Números de teléfono.
            </span>
          </label>

          <label className="field">
            Idioma por defecto
            <select name="voice_language" defaultValue={current.voiceLanguage}>
              <option value="ca">Català</option>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="field">
            Turnos máximos por llamada
            <input
              name="voice_max_turns"
              type="number"
              min={1}
              max={30}
              defaultValue={current.voiceMaxTurns}
              style={{ width: 80 }}
            />
            <span className="field-hint">Límite de seguridad. Recomendado: 10.</span>
          </label>
        </div>
      </section>

      <section className="card stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Prompt de voz</h2>
          <button
            type="button"
            className="button-ghost"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            style={{ fontSize: '0.8em' }}
          >
            {isRegenerating ? 'Generando...' : 'Regenerar desde plantilla'}
          </button>
        </div>
        <p className="muted">
          Si lo dejas vacío, se genera automáticamente a partir del tono, idioma y base de conocimiento.
          Escribe aquí para sobrescribir el prompt generado.
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
            Volver al prompt automático
          </button>
        )}
      </section>

      <button
        className="button-primary"
        type="submit"
        disabled={pending}
        style={{ opacity: pending ? 0.7 : 1 }}
      >
        {pending ? 'Guardando...' : 'Guardar y sincronizar con ElevenLabs'}
      </button>
    </form>
  )
}
