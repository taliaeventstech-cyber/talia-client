import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

async function readWidget() {
  return readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')
}

describe('widget voice mode', () => {
  it('only renders voice controls when the browser supports them and allows opting out', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('window.SpeechRecognition || window.webkitSpeechRecognition')
    expect(widgetSource).toContain("attributeValue === 'off'")
    expect(widgetSource).toContain('var voiceMicMarkup = voiceSupport.recognition')
    expect(widgetSource).toContain('var voiceSpeakerMarkup = voiceSupport.synthesis')
  })

  it('exposes a global Alt+Shift+V shortcut to screen readers', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey')
    expect(widgetSource).toContain('aria-keyshortcuts="Alt+Shift+V"')
    expect(widgetSource).toContain('aria-describedby="talia-voice-hint"')
    expect(widgetSource).toContain('data-voice-status role="status" aria-live="assertive"')
  })

  it('plays a distinct audio cue for every step without fetching audio files', async () => {
    const widgetSource = await readWidget()

    for (const cue of ['listen', 'captured', 'processing', 'reply', 'cancel', 'error']) {
      expect(widgetSource).toMatch(new RegExp(`\\b${cue}: \\[\\[`))
    }
    expect(widgetSource).toContain('audio.createOscillator()')
    expect(widgetSource).not.toMatch(/new Audio\(/)
  })

  it('starts recognition only after the listening cue so the cue is never transcribed', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toMatch(/earcons\.play\('listen', function \(\) \{[\s\S]*?recognition\.start\(\);/)
  })

  it('speaks voice-initiated replies and localizes every voice string', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('if (!(fromVoice && speakVoiceReplies) && !readAloud) return;')
    expect(widgetSource).toContain("shortcutKeys: 'Alt+Mayús+V'")
    expect(widgetSource).toContain("shortcutKeys: 'Alt+Maj+V'")
    expect(widgetSource.match(/shortcutKeys: 'Alt\+Shift\+V'/g)).toHaveLength(2)
  })
})

describe('widget voice mode with TALIA (talia-ai) speech', () => {
  it('prefers TALIA voice when the public config reports the talia provider', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain("configValue.provider === 'talia'")
    expect(widgetSource).toContain("baseUrl + '/api/chat/' + tenantId + '/transcribe'")
    expect(widgetSource).toContain("baseUrl + '/api/chat/' + tenantId + '/speech'")
    expect(widgetSource).toContain('context.decodeAudioData(buffer, resolve, reject)')
  })

  it('falls back to the browser engine when TALIA voice is unavailable or limited', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('return status === 402 || status === 429 || status === 503;')
    expect(widgetSource).toContain('speakWithBrowser(chunks.slice(index).join')
  })

  it('records only after the ready cue and stops itself after a pause, silence or 30 s', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toMatch(/earcons\.play\('listen', function \(\) \{[\s\S]*?beginRecording\(stream, token\);/)
    expect(widgetSource).toContain('now - lastVoiceAt > 1500')
    expect(widgetSource).toContain('now - startedAt > 8000')
    expect(widgetSource).toContain('now - startedAt > 30000')
  })

  it('keeps speech chunks under the server cap', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('splitSpeechChunks(text, 240, 1000)')
  })
})

async function loadVoiceCommandMatcher() {
  const widgetSource = await readWidget()
  const start = widgetSource.indexOf('  var VOICE_COMMANDS')
  const end = widgetSource.indexOf('  // TALIA voice is unavailable')
  // Evaluates the real matcher from the shipped widget, not a copy.
  return new Function(`${widgetSource.slice(start, end)}; return getVoiceCommand;`)() as (text: string) => string | null
}

describe('widget voice commands (TAL-8)', () => {
  it.each([
    ['Para.', 'stop'],
    ['Stop!', 'stop'],
    ['Talia, para', 'stop'],
    ['¡Repite, por favor!', 'repeat'],
    ['Repeteix-ho', 'repeat'],
    ['Pode repetir?', 'repeat'],
    ['Más despacio', 'slower'],
    ['Speak more slowly please', 'slower'],
    ['Mais devagar', 'slower'],
    ['Escríbelo', 'write'],
    ['Write it down', 'write'],
    ['Per escrit', 'write'],
  ])('recognises "%s" as %s in every widget language', async (utterance, command) => {
    const getVoiceCommand = await loadVoiceCommandMatcher()
    expect(getVoiceCommand(utterance)).toBe(command)
  })

  it.each([
    '¿Cuánto cuesta la entrada?',
    'Para mañana hay entradas',
    'Quiero hablar con una persona',
    'Can you repeat the opening hours for Saturday and Sunday please',
  ])('sends real questions and handoff requests to the agent: "%s"', async (utterance) => {
    const getVoiceCommand = await loadVoiceCommandMatcher()
    expect(getVoiceCommand(utterance)).toBeNull()
  })

  it('applies the slow pace to TALIA and browser speech and remembers the last reply', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('pace: pace')
    expect(widgetSource).toContain("utterance.rate = pace === 'slow' ? 0.8 : 1;")
    expect(widgetSource).toContain('if (!failed) lastReply = { text: text, language: language };')
    expect(widgetSource).toContain('if (!(fromVoice && speakVoiceReplies) && !readAloud) return;')
  })
})
