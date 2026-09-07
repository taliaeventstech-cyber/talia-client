import type { createAdminClient } from '@/lib/supabase/admin'
import { recordMeasuredAiUsage } from '@/lib/usage/ai-cost'
import { recordUsageEvent } from '@/lib/usage/service'
import type { DiagnosticAnalysis, DiagnosticArtifactType } from './report'

type AdminClient = ReturnType<typeof createAdminClient>

type DiagnosticUsageDependencies = {
  recordUsageEvent: typeof recordUsageEvent
  recordMeasuredAiUsage: typeof recordMeasuredAiUsage
}

const defaultDependencies: DiagnosticUsageDependencies = {
  recordUsageEvent,
  recordMeasuredAiUsage,
}

export async function recordDiagnosticUsage(
  admin: AdminClient,
  input: {
    tenantId: string
    artifactType: DiagnosticArtifactType
    artifactId: string
    diagnosticRunId: string
    analysis: DiagnosticAnalysis
  },
  dependencies: DiagnosticUsageDependencies = defaultDependencies,
) {
  const usage = input.analysis.usage
  const event = await dependencies.recordUsageEvent(admin, {
    tenantId: input.tenantId,
    moduleKey: 'data',
    channel: 'backstage',
    eventType: 'ai_call',
    quantity: usage.request_count,
    unit: 'call',
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    idempotencyKey: `backstage-diagnostic:${input.diagnosticRunId}:ai_call`,
    metadata: {
      artifact_type: input.artifactType,
      artifact_id: input.artifactId,
      accuracy: 'measured',
      component_count: input.analysis.usageComponents.length,
    },
  })

  if (!event.ok || !event.eventId) {
    console.error('[backstage-diagnostics] failed to record usage event', {
      tenantId: input.tenantId,
      artifactType: input.artifactType,
      artifactId: input.artifactId,
      error: event.ok ? 'missing_event_id' : event.error,
    })
    return
  }

  const measured = await dependencies.recordMeasuredAiUsage(admin, {
    tenantId: input.tenantId,
    sessionId: `backstage-diagnostic:${input.artifactId}`,
    usageEventId: event.eventId,
    idempotencyPrefix: `backstage-diagnostic:${input.diagnosticRunId}:component`,
    components: input.analysis.usageComponents,
    metadata: {
      channel: 'backstage',
      artifact_type: input.artifactType,
    },
  })

  if (!measured.ok) {
    console.error('[backstage-diagnostics] failed to persist precise AI usage', {
      tenantId: input.tenantId,
      artifactType: input.artifactType,
      artifactId: input.artifactId,
      error: measured.error,
    })
  }
}
