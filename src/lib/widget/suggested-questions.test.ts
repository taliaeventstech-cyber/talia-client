import { describe, expect, it } from 'vitest'
import {
  getVisibleSuggestedQuestions,
  mergeSuggestedQuestionsIntoWidgetConfig,
  normalizeSuggestedQuestions,
  normalizeWidgetLanguage,
  parseSuggestedQuestionsFormValue,
  validateSuggestedQuestionSelection,
  type SuggestedQuestion,
} from './suggested-questions'

const questions: SuggestedQuestion[] = [
  {
    id: 'question_one',
    enabled: true,
    text: '¿Qué hay hoy?',
  },
  {
    id: 'question_two',
    enabled: false,
    text: '¿Cómo llegar?',
  },
  {
    id: 'question_three',
    enabled: true,
    text: '¿Es accesible el recinto?',
  },
]

describe('suggested questions', () => {
  it('normalizes locale variants and uses the tenant fallback for unsupported values', () => {
    expect(normalizeWidgetLanguage('ca-ES')).toBe('ca')
    expect(normalizeWidgetLanguage('fr-FR', 'en')).toBe('en')
  })

  it('normalizes valid questions while removing duplicates and invalid records', () => {
    expect(normalizeSuggestedQuestions([
      questions[0],
      questions[0],
      { id: 'short', enabled: true, text: 'No válida' },
      questions[2],
    ])).toEqual([questions[0], questions[2]])
  })

  it('rejects malformed form payloads instead of silently losing questions', () => {
    expect(parseSuggestedQuestionsFormValue('[{"id":"short"}]')).toEqual({
      ok: false,
      error: 'Cada pregunta necesita un identificador único y un texto de hasta 160 caracteres.',
    })
  })

  it('persists suggestions without replacing unrelated tenant widget settings', () => {
    expect(mergeSuggestedQuestionsIntoWidgetConfig(
      { enabled: true, primaryColor: '#123456' },
      questions,
    )).toEqual({
      enabled: true,
      primaryColor: '#123456',
      suggestedQuestions: questions,
    })
  })

  it('converts the previous multilingual shape using the chatbot language', () => {
    expect(normalizeSuggestedQuestions([{
      id: 'legacy_question',
      enabled: true,
      translations: {
        es: '¿Qué hay hoy?',
        ca: 'Què hi ha avui?',
      },
    }], 'ca')).toEqual([{
      id: 'legacy_question',
      enabled: true,
      text: 'Què hi ha avui?',
    }])
  })

  it('returns only active visible questions in their rendered order', () => {
    expect(getVisibleSuggestedQuestions(questions, 'es')).toEqual([
      { id: 'question_one', text: '¿Qué hay hoy?', position: 0, language: 'es' },
      { id: 'question_three', text: '¿Es accesible el recinto?', position: 1, language: 'es' },
    ])
  })

  it('validates ID, rendered position, language fallback and the visible message', () => {
    expect(validateSuggestedQuestionSelection(
      questions,
      { id: 'question_three', position: 1, language: 'es' },
      '¿Es accesible el recinto?',
      'es',
    )).toEqual({
      id: 'question_three',
      text: '¿Es accesible el recinto?',
      position: 1,
      language: 'es',
    })

    expect(validateSuggestedQuestionSelection(
      questions,
      { id: 'question_three', position: 0, language: 'es' },
      '¿Es accesible el recinto?',
      'es',
    )).toBeNull()
  })
})
