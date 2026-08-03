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
    targets: [],
  },
  {
    id: 'question_two',
    enabled: false,
    text: '¿Cómo llegar?',
    targets: [],
  },
  {
    id: 'question_three',
    enabled: true,
    text: '¿Es accesible el recinto?',
    targets: [],
  },
]

describe('suggested questions', () => {
  it('normalizes locale variants and uses the tenant fallback for unsupported values', () => {
    expect(normalizeWidgetLanguage('ca-ES')).toBe('ca')
    expect(normalizeWidgetLanguage('pt-BR')).toBe('pt-BR')
    expect(normalizeWidgetLanguage('pt_BR')).toBe('pt-BR')
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
      error: 'Cada pregunta necesita un identificador único y un texto de hasta 160 caracteres. Las reglas contextuales deben contener dominios, rutas o URLs válidos y no repetidos.',
    })
  })

  it('rejects incomplete contextual rules with an actionable error', () => {
    expect(parseSuggestedQuestionsFormValue(JSON.stringify([{
      id: 'context_question',
      enabled: true,
      text: '¿Qué hay hoy?',
      targets: [{
        id: 'context_target',
        type: 'path_prefix',
        value: '',
      }],
    }]))).toEqual({
      ok: false,
      error: 'Cada pregunta necesita un identificador único y un texto de hasta 160 caracteres. Las reglas contextuales deben contener dominios, rutas o URLs válidos y no repetidos.',
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
      targets: [],
    }])
  })

  it('returns only active visible questions in their rendered order', () => {
    expect(getVisibleSuggestedQuestions(questions, 'es')).toEqual([
      {
        id: 'question_one',
        text: '¿Qué hay hoy?',
        position: 0,
        language: 'es',
        source: 'general',
        matchedTarget: null,
      },
      {
        id: 'question_three',
        text: '¿Es accesible el recinto?',
        position: 1,
        language: 'es',
        source: 'general',
        matchedTarget: null,
      },
    ])
  })

  it('prioritizes contextual matches and fills remaining slots with general questions', () => {
    const contextualQuestions: SuggestedQuestion[] = [
      questions[0],
      {
        id: 'event_duration',
        enabled: true,
        text: '¿Cuánto dura el espectáculo?',
        targets: [{
          id: 'target_event_path',
          type: 'path_prefix',
          value: '/agenda',
        }],
      },
      {
        id: 'event_tickets',
        enabled: true,
        text: '¿Quedan entradas?',
        targets: [{
          id: 'target_event_url',
          type: 'exact_url',
          value: 'https://venue.example/agenda/hamlet',
        }],
      },
      questions[2],
    ]

    expect(getVisibleSuggestedQuestions(
      contextualQuestions,
      'es',
      'https://venue.example/agenda/hamlet?utm_source=newsletter',
    )).toEqual([
      {
        id: 'event_duration',
        text: '¿Cuánto dura el espectáculo?',
        position: 0,
        language: 'es',
        source: 'contextual',
        matchedTarget: {
          id: 'target_event_path',
          type: 'path_prefix',
          value: '/agenda',
        },
      },
      {
        id: 'event_tickets',
        text: '¿Quedan entradas?',
        position: 1,
        language: 'es',
        source: 'contextual',
        matchedTarget: {
          id: 'target_event_url',
          type: 'exact_url',
          value: 'https://venue.example/agenda/hamlet',
        },
      },
      {
        id: 'question_one',
        text: '¿Qué hay hoy?',
        position: 2,
        language: 'es',
        source: 'general',
        matchedTarget: null,
      },
      {
        id: 'question_three',
        text: '¿Es accesible el recinto?',
        position: 3,
        language: 'es',
        source: 'general',
        matchedTarget: null,
      },
    ])
  })

  it('supports exact host, path prefix and exact URL rules without prefix collisions', () => {
    const contextualQuestions: SuggestedQuestion[] = [
      {
        id: 'host_question',
        enabled: true,
        text: 'Pregunta de dominio',
        targets: [{
          id: 'target_hostname',
          type: 'hostname',
          value: 'venue.example',
        }],
      },
      {
        id: 'path_question',
        enabled: true,
        text: 'Pregunta de agenda',
        targets: [{
          id: 'target_path',
          type: 'path_prefix',
          value: '/agenda',
        }],
      },
      {
        id: 'exact_question',
        enabled: true,
        text: 'Pregunta exacta',
        targets: [{
          id: 'target_exact',
          type: 'exact_url',
          value: 'https://venue.example/agenda/hamlet',
        }],
      },
    ]

    expect(getVisibleSuggestedQuestions(
      contextualQuestions,
      'es',
      'https://venue.example/agendario',
    ).map((question) => question.id)).toEqual(['host_question'])

    expect(getVisibleSuggestedQuestions(
      contextualQuestions,
      'es',
      'https://venue.example/agenda/hamlet/',
    ).map((question) => question.id)).toEqual([
      'host_question',
      'path_question',
      'exact_question',
    ])
  })

  it('falls back to general questions and removes duplicate visible text', () => {
    const contextualQuestions: SuggestedQuestion[] = [
      {
        ...questions[0],
        targets: [{
          id: 'target_other_path',
          type: 'path_prefix',
          value: '/visita',
        }],
      },
      questions[2],
      {
        id: 'question_duplicate',
        enabled: true,
        text: '  ¿ES ACCESIBLE EL RECINTO?  ',
        targets: [],
      },
    ]

    expect(getVisibleSuggestedQuestions(
      contextualQuestions,
      'es',
      'https://venue.example/agenda',
    ).map((question) => question.id)).toEqual(['question_three'])
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
      source: 'general',
      matchedTarget: null,
    })

    expect(validateSuggestedQuestionSelection(
      questions,
      { id: 'question_three', position: 0, language: 'es' },
      '¿Es accesible el recinto?',
      'es',
    )).toBeNull()
  })

  it('only validates a contextual selection when the current page matches', () => {
    const contextualQuestions: SuggestedQuestion[] = [{
      id: 'event_question',
      enabled: true,
      text: '¿Cuánto dura?',
      targets: [{
        id: 'target_event_path',
        type: 'path_prefix',
        value: '/agenda',
      }],
    }]

    expect(validateSuggestedQuestionSelection(
      contextualQuestions,
      { id: 'event_question', position: 0, language: 'es' },
      '¿Cuánto dura?',
      'es',
      'https://venue.example/agenda/hamlet',
    )?.source).toBe('contextual')

    expect(validateSuggestedQuestionSelection(
      contextualQuestions,
      { id: 'event_question', position: 0, language: 'es' },
      '¿Cuánto dura?',
      'es',
      'https://venue.example/contacto',
    )).toBeNull()
  })
})
