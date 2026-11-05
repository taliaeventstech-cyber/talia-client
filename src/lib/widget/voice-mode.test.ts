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

    expect(widgetSource).toContain('if (!fromVoice && !readAloud) return;')
    expect(widgetSource).toContain("shortcutKeys: 'Alt+Mayús+V'")
    expect(widgetSource).toContain("shortcutKeys: 'Alt+Maj+V'")
    expect(widgetSource.match(/shortcutKeys: 'Alt\+Shift\+V'/g)).toHaveLength(2)
  })
})
