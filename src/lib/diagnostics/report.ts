import { z } from 'zod'

export const diagnosticArtifactTypeSchema = z.enum(['response_trace', 'knowledge_source'])

export const diagnosticReportSchema = z.object({
  schema_version: z.literal('talia.diagnostic_report.v1'),
  generated_at: z.string(),
  artifact_type: diagnosticArtifactTypeSchema,
  artifact_id: z.string(),
  summary: z.string(),
  classification: z.enum([
    'knowledge_gap',
    'retrieval_failure',
    'grounding_rejection',
    'configuration',
    'provider_failure',
    'usage_limit',
    'response_quality',
    'ingestion_failure',
    'insufficient_evidence',
  ]),
  confidence: z.enum(['low', 'medium', 'high']),
  findings: z.array(z.object({
    title: z.string(),
    evidence: z.string(),
    severity: z.enum(['info', 'warning', 'critical']),
  })),
  recommended_actions: z.array(z.object({
    action: z.string(),
    rationale: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  })),
  limitations: z.array(z.string()),
})

export const diagnosticUsageSchema = z.object({
  request_count: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  cached_input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
}).refine(
  (usage) => usage.cached_input_tokens <= usage.input_tokens,
  { message: 'Cached input tokens cannot exceed input tokens' },
)

export type DiagnosticArtifactType = z.infer<typeof diagnosticArtifactTypeSchema>
export type DiagnosticReport = z.infer<typeof diagnosticReportSchema>

export type DiagnosticAnalysis = {
  report: DiagnosticReport
  provider: string
  model: string
  usage: z.infer<typeof diagnosticUsageSchema>
}

export function getDiagnosticReportFilename(report: DiagnosticReport) {
  const date = new Date(report.generated_at)
  const timestamp = Number.isNaN(date.getTime())
    ? 'unknown-date'
    : date.toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '-')
  const id = report.artifact_id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 12) || 'artifact'
  return `talia-ai-diagnostic_${report.artifact_type}_${timestamp}_${id}.json`
}

const SENSITIVE_FIELD_NAME = /authorization|api[_-]?key|secret|token|password|cookie|credential|session/i

export function sanitizeDiagnosticValue(
  value: unknown,
  fieldName = '',
  depth = 0,
): unknown {
  if (SENSITIVE_FIELD_NAME.test(fieldName)) return '[redacted]'
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return value.slice(0, 2_000)
  if (depth >= 5) return '[truncated]'
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => sanitizeDiagnosticValue(item, fieldName, depth + 1))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, item]) => [key, sanitizeDiagnosticValue(item, key, depth + 1)]),
    )
  }
  return null
}
