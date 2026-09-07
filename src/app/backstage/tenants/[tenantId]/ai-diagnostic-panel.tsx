'use client'

import { Download, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import { analyzeBackstageDiagnostic } from './actions'
import {
  getDiagnosticReportFilename,
  type DiagnosticAnalysis,
  type DiagnosticArtifactType,
} from '@/lib/diagnostics/report'

export function BackstageAiDiagnosticPanel({
  tenantId,
  artifactType,
  artifactId,
}: {
  tenantId: string
  artifactType: DiagnosticArtifactType
  artifactId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [analysis, setAnalysis] = useState<DiagnosticAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleAnalyze() {
    setError(null)
    startTransition(async () => {
      const result = await analyzeBackstageDiagnostic(tenantId, artifactType, artifactId)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setAnalysis(result.analysis)
    })
  }

  function handleDownload() {
    if (!analysis) return
    const payload = {
      ...analysis.report,
      generation: {
        provider: analysis.provider,
        model: analysis.model,
      },
    }
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = getDiagnosticReportFilename(analysis.report)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="backstage-ai-diagnostic">
      <div className="backstage-ai-diagnostic-actions">
        <button
          type="button"
          className="backstage-ai-diagnostic-button"
          onClick={handleAnalyze}
          disabled={isPending}
        >
          <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
          {isPending ? 'Analizando...' : analysis ? 'Volver a analizar' : 'Analizar con IA'}
        </button>
        {analysis ? (
          <button type="button" className="trace-download-button" onClick={handleDownload}>
            <Download size={14} strokeWidth={2.2} aria-hidden="true" />
            Descargar informe
          </button>
        ) : null}
      </div>

      {error ? <p className="backstage-ai-diagnostic-error" role="alert">{error}</p> : null}

      {analysis ? (
        <BackstageAiDiagnosticReport analysis={analysis} />
      ) : null}
    </div>
  )
}

export function BackstageAiDiagnosticReport({ analysis }: { analysis: DiagnosticAnalysis }) {
  return (
    <section className="backstage-ai-diagnostic-report" aria-label="Diagnóstico generado por IA">
      <div className="backstage-ai-diagnostic-heading">
        <div>
          <span>Diagnóstico probable</span>
          <h4>{getClassificationLabel(analysis.report.classification)}</h4>
        </div>
        <span className={`backstage-ai-confidence backstage-ai-confidence-${analysis.report.confidence}`}>
          Confianza {getConfidenceLabel(analysis.report.confidence)}
        </span>
      </div>
      <p>{analysis.report.summary}</p>

      <div className="backstage-ai-knowledge-review">
        <span>Revisión de Knowledge</span>
        <strong>{getKnowledgeReviewLabel(analysis.report.knowledge_review)}</strong>
        {analysis.report.knowledge_review.query ? (
          <small>Consulta: {analysis.report.knowledge_review.query}</small>
        ) : null}
      </div>

      {analysis.report.discrepancies.length ? (
        <div className="backstage-ai-diagnostic-section">
          <h5>Discrepancias de conocimiento</h5>
          <div className="backstage-ai-discrepancies">
            {analysis.report.discrepancies.map((discrepancy, index) => (
              <article key={`${discrepancy.subject}-${discrepancy.attribute}-${index}`}>
                <div>
                  <strong>{discrepancy.subject}</strong>
                  <span>{discrepancy.attribute} · {getAssessmentLabel(discrepancy.assessment)}</span>
                </div>
                <p>{discrepancy.explanation}</p>
                <ul>
                  {discrepancy.values.map((value, valueIndex) => (
                    <li key={`${value.value}-${valueIndex}`}>
                      <strong>{value.value}</strong>
                      <span>
                        {getSpecificityLabel(value.specificity)} · fuentes {value.source_ids.join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {analysis.report.findings.length ? (
        <div className="backstage-ai-diagnostic-section">
          <h5>Evidencias</h5>
          <ul>
            {analysis.report.findings.map((finding, index) => (
              <li key={`${finding.title}-${index}`}>
                <strong>{finding.title}</strong>
                <span>{finding.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {analysis.report.recommended_actions.length ? (
        <div className="backstage-ai-diagnostic-section">
          <h5>Siguientes pasos</h5>
          <ol>
            {analysis.report.recommended_actions.map((recommendation, index) => (
              <li key={`${recommendation.action}-${index}`}>
                <strong>{recommendation.action}</strong>
                <span>{recommendation.rationale}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {analysis.report.limitations.length ? (
        <details className="backstage-ai-diagnostic-limitations">
          <summary>Qué falta para confirmar la causa raíz</summary>
          <ul>
            {analysis.report.limitations.map((limitation, index) => (
              <li key={`${limitation}-${index}`}>{limitation}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <small>Generado por {analysis.model}. Revisión humana obligatoria antes de actuar.</small>
    </section>
  )
}

function getClassificationLabel(classification: DiagnosticAnalysis['report']['classification']) {
  const labels = {
    knowledge_gap: 'Falta de conocimiento',
    knowledge_conflict: 'Conflicto en Knowledge',
    retrieval_failure: 'Fallo de recuperación',
    grounding_rejection: 'Rechazo de grounding',
    configuration: 'Configuración',
    provider_failure: 'Fallo del proveedor',
    usage_limit: 'Límite de uso',
    response_quality: 'Calidad de respuesta',
    ingestion_failure: 'Fallo de ingesta',
    insufficient_evidence: 'Evidencia insuficiente',
  }
  return labels[classification]
}

function getKnowledgeReviewLabel(review: DiagnosticAnalysis['report']['knowledge_review']) {
  if (review.status === 'completed') return `${review.sources_reviewed} evidencias revisadas`
  if (review.status === 'unavailable') return 'Búsqueda no disponible'
  return 'Sin consulta aplicable'
}

function getAssessmentLabel(assessment: DiagnosticAnalysis['report']['discrepancies'][number]['assessment']) {
  if (assessment === 'conflict') return 'contradicción'
  if (assessment === 'scope_mismatch') return 'desajuste de alcance'
  if (assessment === 'resolved') return 'resuelta por evidencia específica'
  return 'ambigua'
}

function getSpecificityLabel(specificity: DiagnosticAnalysis['report']['discrepancies'][number]['values'][number]['specificity']) {
  if (specificity === 'subject_specific') return 'evidencia específica'
  if (specificity === 'general') return 'evidencia genérica'
  return 'alcance indeterminado'
}

function getConfidenceLabel(confidence: DiagnosticAnalysis['report']['confidence']) {
  if (confidence === 'high') return 'alta'
  if (confidence === 'medium') return 'media'
  return 'baja'
}
