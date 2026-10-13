import { isManagedWebSourceType } from './managed-web-sources'

const REPROCESSABLE_STRUCTURED_SOURCE_TYPES = new Set(['pdf', 'manual', 'xlsx', 'csv'])

export function canReprocessKnowledgeSourceFromBackstage(sourceType: string) {
  return isManagedWebSourceType(sourceType) || REPROCESSABLE_STRUCTURED_SOURCE_TYPES.has(sourceType)
}

type BackstageSyncRun = {
  status: string
  error_code: string | null
  error_details: string | null
}

export function getBackstageSyncRunPresentation({
  run,
  sourceLastError,
}: {
  run: BackstageSyncRun | null | undefined
  sourceLastError: string | null
}) {
  if (!run) {
    return {
      statusLabel: null,
      issue: sourceLastError,
      issueTone: sourceLastError ? 'danger' as const : 'neutral' as const,
      showCounters: false,
    }
  }

  if (run.status === 'queued') {
    return activeRunPresentation('Actualización en cola')
  }

  if (run.status === 'running') {
    return activeRunPresentation('Actualizando')
  }

  if (run.status === 'succeeded') {
    return {
      statusLabel: 'Actualización completada',
      issue: null,
      issueTone: 'neutral' as const,
      showCounters: true,
    }
  }

  if (run.status === 'partial') {
    return {
      statusLabel: 'Cobertura parcial',
      issue: getHumanizedSyncIssue(run.error_code, run.error_details ?? sourceLastError),
      issueTone: 'warning' as const,
      showCounters: true,
    }
  }

  return {
    statusLabel: run.status === 'failed' ? 'Actualización fallida' : `Actualización ${run.status}`,
    issue: getHumanizedSyncIssue(run.error_code, run.error_details ?? sourceLastError),
    issueTone: 'danger' as const,
    showCounters: true,
  }
}

function activeRunPresentation(statusLabel: string) {
  return {
    statusLabel,
    issue: null,
    issueTone: 'neutral' as const,
    showCounters: false,
  }
}

function getHumanizedSyncIssue(errorCode: string | null, fallback: string | null) {
  if (errorCode === 'discovery_incomplete') {
    return 'La fuente conserva contenido disponible, pero la última actualización no pudo confirmar que se revisara toda la web.'
  }

  if (errorCode === 'domain_lease_unavailable') {
    return 'La actualización no pudo iniciarse por falta temporal de capacidad. Se puede volver a intentar sin modificar la fuente.'
  }

  if (errorCode === 'robots_disallowed') {
    return 'El archivo robots.txt impide que TALIA lea la web. El responsable del sitio debe autorizar TALIA-AI-KnowledgeSync y volver a actualizar la fuente.'
  }

  if (errorCode === 'http_forbidden' || errorCode === 'challenge_detected') {
    return 'La web bloqueó el acceso automático durante la actualización.'
  }

  return fallback ?? 'La actualización terminó con una incidencia sin detalle adicional.'
}
