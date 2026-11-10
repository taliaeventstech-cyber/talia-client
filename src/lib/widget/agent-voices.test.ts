import { describe, expect, it } from 'vitest'
import {
  AGENT_VOICES,
  DEFAULT_AGENT_VOICE,
  getAgentVoiceFromWidgetConfig,
  getAgentVoiceOptions,
  getAgentVoicePreviewSample,
  normalizeAgentVoice,
} from './agent-voices'

describe('agent voices', () => {
  it('only accepts the voices talia-ai supports', () => {
    expect(AGENT_VOICES).toEqual(expect.arrayContaining(['coral', 'nova', 'sage', 'onyx']))
    expect(normalizeAgentVoice('onyx')).toBe('onyx')
    expect(normalizeAgentVoice('robot')).toBe(DEFAULT_AGENT_VOICE)
    expect(normalizeAgentVoice(undefined)).toBe(DEFAULT_AGENT_VOICE)
  })

  it('reads the venue voice from widget_config and defaults safely', () => {
    expect(getAgentVoiceFromWidgetConfig({ agentVoice: 'nova' })).toBe('nova')
    expect(getAgentVoiceFromWidgetConfig({ agent_voice: 'sage' })).toBe('sage')
    expect(getAgentVoiceFromWidgetConfig({ agentVoice: '<script>' })).toBe(DEFAULT_AGENT_VOICE)
    expect(getAgentVoiceFromWidgetConfig(null)).toBe(DEFAULT_AGENT_VOICE)
    expect(getAgentVoiceFromWidgetConfig([])).toBe(DEFAULT_AGENT_VOICE)
  })

  it.each(['es', 'ca', 'en', 'pt-BR'])('describes every voice in %s', (language) => {
    const options = getAgentVoiceOptions(language)
    expect(options).toHaveLength(AGENT_VOICES.length)
    for (const option of options) {
      expect(option.label).toMatch(/^[A-Z]/)
      expect(option.description.length).toBeGreaterThan(3)
    }
  })

  it('uses a preview sample in the venue language', () => {
    expect(getAgentVoicePreviewSample('ca').text).toContain('TALIA')
    expect(getAgentVoicePreviewSample('pt-BR')).toMatchObject({ language: 'pt-BR' })
    expect(getAgentVoicePreviewSample('fr')).toMatchObject({ language: 'es' })
  })
})
