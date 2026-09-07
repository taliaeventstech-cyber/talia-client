import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BackstageAiDiagnosticPanel, BackstageAiDiagnosticReport } from './ai-diagnostic-panel'

describe('BackstageAiDiagnosticPanel', () => {
  it('renders an evidence-backed diagnostic report', () => {
    const html = renderToStaticMarkup(
      <BackstageAiDiagnosticReport
        analysis={{
          provider: 'openai',
          model: 'gpt-test',
          usage: {
            request_count: 1,
            input_tokens: 20,
            cached_input_tokens: 0,
            output_tokens: 10,
          },
          usageComponents: [{
            component: 'diagnostic_agent',
            provider: 'openai',
            model: 'gpt-test',
            request_count: 1,
            input_tokens: 20,
            cached_input_tokens: 0,
            output_tokens: 10,
          }],
          report: {
            schema_version: 'talia.diagnostic_report.v1',
            generated_at: '2026-09-03T10:00:00.000Z',
            artifact_type: 'response_trace',
            artifact_id: '00000000-0000-4000-8000-000000000002',
            summary: 'No se encontró evidencia suficiente para responder.',
            classification: 'knowledge_gap',
            confidence: 'high',
            knowledge_review: {
              status: 'completed',
              query: '¿En qué idioma es L’Estanquera del Raval?',
              sources_reviewed: 2,
              source_ids: ['generic-language-faq', 'event-page'],
            },
            discrepancies: [{
              subject: 'L’Estanquera del Raval',
              attribute: 'idioma de representación',
              assessment: 'scope_mismatch',
              explanation: 'La FAQ genérica no demuestra el idioma de la obra.',
              values: [{
                value: 'castellano',
                source_ids: ['generic-language-faq'],
                specificity: 'general',
              }, {
                value: 'catalán',
                source_ids: ['event-page'],
                specificity: 'subject_specific',
              }],
            }],
            findings: [{
              title: 'Sin fuentes admitidas',
              evidence: 'La recuperación terminó sin fuentes seleccionadas.',
              severity: 'warning',
              source_ids: ['generic-language-faq', 'event-page'],
            }],
            recommended_actions: [{
              action: 'Revisar Knowledge',
              rationale: 'Falta contenido sobre la consulta.',
              priority: 'high',
            }],
            limitations: ['No se incluyen logs externos.'],
          },
        }}
      />,
    )

    expect(html).toContain('Diagnóstico generado por IA')
    expect(html).toContain('Falta de conocimiento')
    expect(html).toContain('Confianza alta')
    expect(html).toContain('Sin fuentes admitidas')
    expect(html).toContain('Discrepancias de conocimiento')
    expect(html).toContain('desajuste de alcance')
    expect(html).toContain('2 evidencias revisadas')
    expect(html).toContain('Revisar Knowledge')
    expect(html).toContain('Generado por gpt-test. Revisión humana obligatoria antes de actuar.')
  })

  it('renders the initial analysis action without exposing a report', () => {
    const html = renderToStaticMarkup(
      <BackstageAiDiagnosticPanel
        tenantId="00000000-0000-4000-8000-000000000001"
        artifactType="knowledge_source"
        artifactId="00000000-0000-4000-8000-000000000003"
      />,
    )

    expect(html).toContain('Analizar con IA')
    expect(html).not.toContain('Diagnóstico probable')
  })
})
