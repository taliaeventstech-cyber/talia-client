import { describe, expect, it } from 'vitest'
import { getSupervisedFaqCopy, SUPERVISED_FAQ_COPY } from './supervised-faq-copy'

describe('supervised FAQ copy', () => {
  it.each([
    ['es', 'Crear FAQ y enseñar a TALIA'],
    ['ca', 'Crear FAQ i ensenyar a TALIA'],
    ['en', 'Create FAQ and teach TALIA'],
    ['pt-BR', 'Criar FAQ e ensinar a TALIA'],
    ['pt', 'Criar FAQ e ensinar a TALIA'],
  ])('returns the localized supervised flow for %s', (locale, submit) => {
    expect(getSupervisedFaqCopy(locale).form.submit).toBe(submit)
  })

  it('keeps Brazilian Portuguese complete for the future Agora locale', () => {
    expect(SUPERVISED_FAQ_COPY.ptBR.action.indexed).toContain('conhecimento oficial')
    expect(SUPERVISED_FAQ_COPY.ptBR.feedback.improvement).toContain('melhoria')
    expect(SUPERVISED_FAQ_COPY.ptBR.form.acceptResponse).toContain('válida')
    expect(SUPERVISED_FAQ_COPY.ptBR.navigator.none).toContain('pendentes')
  })
})
