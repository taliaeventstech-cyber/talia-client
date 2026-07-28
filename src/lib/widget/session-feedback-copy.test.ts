import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getSessionFeedbackCopy } from './session-feedback-copy'

describe('session feedback copy', () => {
  it.each([
    ['es', '¿Empezamos de nuevo?', 'Sí, gracias', 'Reiniciar sin valorar'],
    ['ca', 'Tornem a començar?', 'Sí, gràcies', 'Reiniciar sense valorar'],
    ['en', 'Start a new conversation?', 'Yes, thanks', 'Restart without rating'],
  ])('uses the configured %s widget language', (language, title, positive, skip) => {
    expect(getSessionFeedbackCopy(language)).toMatchObject({ title, positive, skip })
  })

  it('falls back to Spanish for unsupported configured languages', () => {
    expect(getSessionFeedbackCopy('fr')).toEqual(getSessionFeedbackCopy('es'))
  })

  it('wires the configured widget language into the public restart prompt', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')

    expect(widgetSource).toContain('createSessionFeedbackPrompt(sessionId, fallbackLanguage)')
    expect(widgetSource).toContain('var copy = getSessionFeedbackCopy(language);')
    expect(widgetSource).toContain("prompt.className = 'message notranslate assistant session-feedback'")
    expect(widgetSource).not.toContain('Antes de empezar de nuevo, ¿he resuelto tu consulta?')
  })
})
