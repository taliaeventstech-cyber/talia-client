'use client'

import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AgentVoice } from '@/lib/widget/agent-voices'
import { previewAgentVoice } from './preview-agent-voice-action'

export type AgentVoicePickerLabels = {
  agentVoice: string
  agentVoiceHint: string
  agentVoiceListen: string
  agentVoiceStop: string
  agentVoiceLoading: string
  agentVoiceError: string
  agentVoiceUnavailable: string
  agentVoiceRateLimited: string
}

type Props = {
  tenantId: string
  defaultVoice: AgentVoice
  options: { value: AgentVoice; label: string; description: string }[]
  labels: AgentVoicePickerLabels
}

/**
 * Lets a venue choose the voice its Web Agent speaks with, and listen to a
 * sample of each before saving. The chosen value is submitted with the
 * settings form as `agent_voice`.
 */
export function AgentVoicePicker({ tenantId, defaultVoice, options, labels }: Props) {
  const [selected, setSelected] = useState<AgentVoice>(defaultVoice)
  const [loadingVoice, setLoadingVoice] = useState<AgentVoice | null>(null)
  const [playingVoice, setPlayingVoice] = useState<AgentVoice | null>(null)
  const [message, setMessage] = useState('')
  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  useEffect(() => () => {
    sourceRef.current?.stop()
    void contextRef.current?.close()
  }, [])

  function stopPlayback() {
    if (sourceRef.current) {
      sourceRef.current.onended = null
      try { sourceRef.current.stop() } catch { /* already stopped */ }
      sourceRef.current = null
    }
    setPlayingVoice(null)
  }

  async function listen(voice: AgentVoice) {
    if (playingVoice === voice) {
      stopPlayback()
      return
    }
    stopPlayback()
    setMessage('')
    setLoadingVoice(voice)

    // Created inside the click so browsers allow playback.
    const context = contextRef.current ?? new AudioContext()
    contextRef.current = context
    if (context.state === 'suspended') await context.resume().catch(() => undefined)

    const result = await previewAgentVoice(tenantId, voice)
    setLoadingVoice(null)
    if (!result.ok) {
      setMessage(
        result.error === 'rate_limited'
          ? labels.agentVoiceRateLimited
          : result.error === 'unavailable'
            ? labels.agentVoiceUnavailable
            : labels.agentVoiceError,
      )
      return
    }

    try {
      const bytes = Uint8Array.from(atob(result.audioBase64), (char) => char.charCodeAt(0))
      const buffer = await context.decodeAudioData(bytes.buffer)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null
          setPlayingVoice(null)
        }
      }
      sourceRef.current = source
      setPlayingVoice(voice)
      source.start()
    } catch {
      setMessage(labels.agentVoiceError)
    }
  }

  return (
    <fieldset className="agent-voice-picker">
      <legend>{labels.agentVoice}</legend>
      <p className="muted">{labels.agentVoiceHint}</p>
      <div className="agent-voice-options" role="radiogroup" aria-label={labels.agentVoice}>
        {options.map((option) => {
          const isPlaying = playingVoice === option.value
          const isLoading = loadingVoice === option.value
          return (
            <div
              key={option.value}
              className={selected === option.value ? 'agent-voice-option agent-voice-option-selected' : 'agent-voice-option'}
            >
              <label className="agent-voice-option-label">
                <input
                  type="radio"
                  name="agent_voice"
                  value={option.value}
                  checked={selected === option.value}
                  onChange={() => setSelected(option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span className="muted">{option.description}</span>
                </span>
              </label>
              <button
                type="button"
                className="agent-voice-listen"
                onClick={() => void listen(option.value)}
                disabled={loadingVoice !== null && !isLoading}
                aria-label={`${isPlaying ? labels.agentVoiceStop : labels.agentVoiceListen}: ${option.label}`}
                aria-pressed={isPlaying}
              >
                {isPlaying ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
                <span>{isLoading ? labels.agentVoiceLoading : isPlaying ? labels.agentVoiceStop : labels.agentVoiceListen}</span>
              </button>
            </div>
          )
        })}
      </div>
      <p className="muted" role="status" aria-live="polite">{message}</p>
    </fieldset>
  )
}
