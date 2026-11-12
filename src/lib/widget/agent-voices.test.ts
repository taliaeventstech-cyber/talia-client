import { describe, expect, it } from 'vitest'
import {
  AGENT_VOICES,
  DEFAULT_AGENT_VOICE,
  getAgentVoiceFromWidgetConfig,
  getAgentVoiceOptions,
  getAgentVoicePreviewSample,
  isVoiceControlEnabled,
  isVoiceInvitationEnabled,
  isVoiceInvitationSaved,
  normalizeAgentVoice,
} from './agent-voices'

describe('agent voices', () => {
  it('only accepts the voices talia-ai supports', () => {
    expect(AGENT_VOICES).toEqual(['coral', 'sage', 'ash'])
    expect(normalizeAgentVoice('ash')).toBe('ash')
    // Voices removed for the MVP fall back to the default.
    expect(normalizeAgentVoice('onyx')).toBe(DEFAULT_AGENT_VOICE)
    expect(normalizeAgentVoice('robot')).toBe(DEFAULT_AGENT_VOICE)
    expect(normalizeAgentVoice(undefined)).toBe(DEFAULT_AGENT_VOICE)
  })

  it('reads the venue voice from widget_config and defaults safely', () => {
    expect(getAgentVoiceFromWidgetConfig({ agentVoice: 'ash' })).toBe('ash')
    expect(getAgentVoiceFromWidgetConfig({ agentVoice: 'nova' })).toBe(DEFAULT_AGENT_VOICE)
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

describe('voice invitation setting', () => {
  it('is off unless the venue explicitly enabled it', () => {
    expect(isVoiceInvitationEnabled({ voiceInvitation: true })).toBe(true)
    expect(isVoiceInvitationEnabled({ voice_invitation: true })).toBe(true)
    expect(isVoiceInvitationEnabled({ voiceInvitation: 'true' })).toBe(false)
    expect(isVoiceInvitationEnabled({})).toBe(false)
    expect(isVoiceInvitationEnabled(null)).toBe(false)
  })
})

describe('voice control setting', () => {
  it('stays on unless the venue explicitly switched it off', () => {
    expect(isVoiceControlEnabled({})).toBe(true)
    expect(isVoiceControlEnabled(null)).toBe(true)
    expect(isVoiceControlEnabled({ voiceEnabled: true })).toBe(true)
    expect(isVoiceControlEnabled({ voiceEnabled: 'false' })).toBe(true)
    expect(isVoiceControlEnabled({ voiceEnabled: false })).toBe(false)
    expect(isVoiceControlEnabled({ voice_enabled: false })).toBe(false)
  })

  it('never invites to talk while voice is off, but keeps the saved choice', () => {
    const config = { voiceEnabled: false, voiceInvitation: true }
    expect(isVoiceInvitationEnabled(config)).toBe(false)
    expect(isVoiceInvitationSaved(config)).toBe(true)
  })
})
