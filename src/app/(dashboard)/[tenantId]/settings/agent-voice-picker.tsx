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

  const selectedOption = options.find((option) => option.value === selected)
  const isPlaying = playingVoice === selected
  const isLoading = loadingVoice === selected
  const selectId = `agent-voice-${tenantId}`

  return (
    <div className="agent-voice-picker">
      <label className="field" htmlFor={selectId}>
        {labels.agentVoice}
      </label>
      <div className="agent-voice-row">
        <select
          id={selectId}
          name="agent_voice"
          value={selected}
          onChange={(event) => {
            stopPlayback()
            setSelected(event.target.value as AgentVoice)
          }}
          aria-describedby={`${selectId}-hint`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} · {option.description}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="agent-voice-listen"
          onClick={() => void listen(selected)}
          disabled={loadingVoice !== null && !isLoading}
          aria-label={`${isPlaying ? labels.agentVoiceStop : labels.agentVoiceListen}: ${selectedOption?.label ?? selected}`}
          aria-pressed={isPlaying}
        >
          {isPlaying ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
          <span>{isLoading ? labels.agentVoiceLoading : isPlaying ? labels.agentVoiceStop : labels.agentVoiceListen}</span>
        </button>
      </div>
      <p className="muted" id={`${selectId}-hint`}>{labels.agentVoiceHint}</p>
      <p className="muted" role="status" aria-live="polite">{message}</p>
    </div>
  )
}
