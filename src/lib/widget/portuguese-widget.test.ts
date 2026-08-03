import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Brazilian Portuguese public widget', () => {
  it('localizes the public chrome and fallback states', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')

    expect(widgetSource).toContain("language === 'pt-BR'")
    expect(widgetSource).toContain("inputPlaceholder: 'Digite sua mensagem...'")
    expect(widgetSource).toContain("openAssistant: 'Abrir agente web'")
    expect(widgetSource).toContain("return 'TALIA está digitando'")
    expect(widgetSource).toContain('Não consigo responder agora. Tente novamente em instantes.')
    expect(widgetSource).toContain("return 'Perguntas sugeridas'")
  })
})
