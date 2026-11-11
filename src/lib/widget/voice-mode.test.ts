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
    expect(widgetSource.match(/shortcutKeys: keys,/g)).toHaveLength(4)
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

    expect(widgetSource).toContain('return status === 402 || status === 429 || status === 502 || status === 503;')
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

async function loadVoiceCopy() {
  const widgetSource = await readWidget()
  const start = widgetSource.indexOf('  function isApplePlatform()')
  const end = widgetSource.indexOf('  function createVoiceController(')
  // Evaluates the shipped copy builder (no browser globals needed when the
  // platform is passed explicitly).
  return new Function(`${widgetSource.slice(start, end)}; return getVoiceCopy;`)() as (
    language: string,
    apple: boolean,
  ) => Record<string, string>
}

describe('widget voice shortcut labels per platform', () => {
  it.each([
    ['es', 'Alt+Mayús+V', 'Opción+Mayús+V'],
    ['ca', 'Alt+Maj+V', 'Opció+Maj+V'],
    ['en', 'Alt+Shift+V', 'Option+Shift+V'],
    ['pt-BR', 'Alt+Shift+V', 'Option+Shift+V'],
  ])('names the keys of the visitor\'s keyboard (%s)', async (language, windowsKeys, macKeys) => {
    const getVoiceCopy = await loadVoiceCopy()

    for (const [apple, keys] of [[false, windowsKeys], [true, macKeys]] as const) {
      const copy = getVoiceCopy(language, apple)
      expect(copy.shortcutKeys).toBe(keys)
      expect(copy.shortcutHint).toContain(keys)
      expect(copy.firstOpen).toContain(keys)
      expect(copy.noSpeech).toContain(keys)
    }
  })

  it('listens for the same physical keys on every platform (Option is Alt on a Mac)', async () => {
    const widgetSource = await readWidget()

    // event.code keeps working on macOS, where Option+Shift+V types "◊".
    expect(widgetSource).toContain("event.code === 'KeyV'")
  })
})

async function loadWakePhraseMatcher() {
  const widgetSource = await readWidget()
  const start = widgetSource.indexOf('  function isWakePhrase(')
  const end = widgetSource.indexOf('  var VOICE_COMMANDS')
  return new Function(`${widgetSource.slice(start, end)}; return isWakePhrase;`)() as (text: string, name?: string) => boolean
}

describe('widget hands-free conversation and wake word', () => {
  it.each([
    ['Hola Talia', true],
    ['hola talía, ¿qué hay hoy?', true],
    ['Hello TALIA', true],
    ['Hey Thalia', true],
    ['Olá Talia', true],
    ['Bon dia Talia', true],
    ['Talía', true],
    ['Hola Italia', true],
    ['hola Natalia', true],
    ['Oye Talia', true],
    ['Italia', false],
    ['La Talia de ayer', false],
    ['Hola, ¿a qué hora abrís?', false],
  ])('recognises the wake phrase in "%s": %s', async (utterance, expected) => {
    const isWakePhrase = await loadWakePhraseMatcher()
    expect(isWakePhrase(utterance, 'TALIA')).toBe(expected)
  })

  it('also wakes with a single-word custom assistant name', async () => {
    const isWakePhrase = await loadWakePhraseMatcher()
    expect(isWakePhrase('Hola Olympia', 'Olympia')).toBe(true)
  })

  it('keeps the wake word opt-in, visible, browser-only and paused in background tabs', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain("var wakeEnabled = support.browserRecognition && getStoredValue(wakeKey) === 'on';")
    expect(widgetSource).toContain("var voiceHandsFreeMarkup = voiceSupport.browserRecognition")
    expect(widgetSource).toContain('role="switch" aria-checked="false"')
    expect(widgetSource).toContain("options.launcher.classList.toggle('toggle--wake', active);")
    expect(widgetSource).toContain('if (document.hidden) stopWake();')
    expect(widgetSource).toContain('if (!wakeEnabled || wakeRecognition || !isIdle() || document.hidden) return;')
  })

  it('listens again only after a spoken answer to a voice question, and ends after silence', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('speak(text, language, true, fromVoice ? continueConversation : null);')
    expect(widgetSource).toContain('startListening(true);')
    expect(widgetSource).toContain('announce(copy.handsFreeEnded);')
  })
})

describe('widget voice offer in the greeting', () => {
  it('only offers voice when the venue enabled it and stops offering it once dismissed', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain("var offerVoice = !!welcomeVoice && config.voiceInvitation === true && getStoredValue(voiceInviteKey) !== 'dismissed';")
    expect(widgetSource).toContain("if (offerVoice) setStoredValue(voiceInviteKey, 'dismissed');")
    expect(widgetSource).toContain('if (config.autoOpen || offerVoice) {')
  })

  it('starts listening only from the visitor\'s "Hablar" click, with a just-in-time notice', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toMatch(/\[data-welcome-talk\]'\)\.addEventListener\('click', function \(\) \{[\s\S]*?voice\.toggleListening\(\);/)
    expect(widgetSource).toContain("escapeHtml(voiceCopy.greetingNotice)")
    expect(widgetSource).not.toMatch(/setTimeout\([^)]*(enableWake|toggleListening)/)
  })

  it('shows voice status in the chat pad with one clear action, and reveals hands-free progressively', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('<div class="voice-dock" data-voice-dock aria-hidden="true">')
    expect(widgetSource).toContain("if (panel.getAttribute('data-voice-state') === 'listening') voice.toggleListening();")
    expect(widgetSource).toContain('<div class="voice-handsfree" data-voice-handsfree hidden>')
    expect(widgetSource).toContain('function revealHandsFree() {')
    expect(widgetSource).not.toContain('data-voice-visual-status')
  })

  it.each(['es', 'ca', 'en', 'pt-BR'])('is fully localized (%s)', async (language) => {
    const widgetSource = await readWidget()
    const start = widgetSource.indexOf('  function isApplePlatform()')
    const end = widgetSource.indexOf('  function createVoiceController(')
    const getVoiceCopy = new Function(`${widgetSource.slice(start, end)}; return getVoiceCopy;`)() as (
      language: string,
      apple: boolean,
    ) => Record<string, string>
    const copy = getVoiceCopy(language, false)

    for (const key of [
      'greetingVoiceHint', 'greetingType', 'greetingTalk', 'greetingNotice',
      'dockListeningTitle', 'dockListeningHint', 'dockThinkingTitle', 'dockThinkingHint',
      'dockSpeakingTitle', 'dockSpeakingHint', 'dockDone', 'dockCancel', 'dockStop',
      'handsFreeLabel', 'handsFreeTitle',
    ]) {
      expect(copy[key]).toBeTruthy()
    }
    expect(copy.handsFreeLabel).toMatch(/TALIA/)
    expect(copy.handsFreeTitle).toMatch(/micr[oóò](f|ph)on/i)
  })
})

describe('widget animated voice states (sound bars)', () => {
  it('derives one visual state from the voice controller and shows it on the launcher and header', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain("var next = listening ? 'listening'")
    expect(widgetSource).toContain("toggle.setAttribute('data-voice-state', state);")
    expect(widgetSource).toContain("panel.setAttribute('data-voice-state', state);")
    expect(widgetSource).toContain('<span class="voice-bars" aria-hidden="true">')
    expect(widgetSource).not.toContain('wake-dot')
  })

  it('drives the bars with the real microphone and TALIA voice levels', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('setLevel(Math.min(1, level * 7));')
    expect(widgetSource).toContain('outputMeterStop = meterOutput(context, source);')
    // Initialised before `noop` exists: must be a real function.
    expect(widgetSource).toContain('var outputMeterStop = function () {};')
  })

  it('stops every animation when the visitor prefers reduced motion', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain('.voice-bars span { animation: none !important; transition: none; }')
  })
})

describe('widget voice diagnostics', () => {
  it('only logs what the browser heard when debugging is explicitly enabled', async () => {
    const widgetSource = await readWidget()

    expect(widgetSource).toContain("var voiceDebug = script.hasAttribute('data-voice-debug') || /[?&]talia_voice_debug=1(&|$)/.test(window.location.search);")
    expect(widgetSource).toContain('if (!voiceDebug || !window.console) return;')
  })
})
