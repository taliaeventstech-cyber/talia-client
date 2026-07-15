export type ManagedWebOutcome =
  | 'paused'
  | 'queued'
  | 'running'
  | 'updated'
  | 'unchanged'
  | 'partial_discovery'
  | 'partial_capture'
  | 'quota'
  | 'blocked'
  | 'failed'
  | 'pending'

export type ManagedWebAction = 'retry' | 'support' | 'widget'

export type ManagedWebRunSummary = {
  status: string
  checked_count: number
  changed_count: number
  unchanged_count: number
  failed_count: number
  blocked_count: number
  error_code: string | null
}

export type ManagedWebPresentation = {
  outcome: ManagedWebOutcome
  tone: 'neutral' | 'success' | 'warning' | 'danger'
  actions: ManagedWebAction[]
}

export function getManagedWebPresentation(input: {
  syncEnabled: boolean
  sourceStatus: string
  run: ManagedWebRunSummary | null
}): ManagedWebPresentation {
  if (!input.syncEnabled) return presentation('paused', 'neutral', [])

  const run = input.run
  if (run?.status === 'queued') return presentation('queued', 'neutral', [])
  if (run?.status === 'running') return presentation('running', 'neutral', [])

  if (run?.error_code?.includes('quota_exceeded')) {
    return presentation('quota', 'danger', ['support'])
  }

  if (run?.status === 'partial') {
    if (run.error_code === 'discovery_incomplete') {
      return presentation('partial_discovery', 'warning', ['retry', 'widget', 'support'])
    }
    return presentation('partial_capture', 'warning', ['retry', 'support'])
  }

  if (run?.status === 'failed') {
    if (run.blocked_count > 0 || isBlockedCode(run.error_code)) {
      return presentation('blocked', 'danger', ['retry', 'widget', 'support'])
    }
    return presentation('failed', 'danger', ['retry', 'support'])
  }

  if (run?.status === 'succeeded') {
    return run.changed_count > 0
      ? presentation('updated', 'success', [])
      : presentation('unchanged', 'success', [])
  }

  if (input.sourceStatus === 'error') return presentation('failed', 'danger', ['retry', 'support'])
  if (input.sourceStatus === 'ready') return presentation('updated', 'success', [])
  return presentation('pending', 'neutral', [])
}

function presentation(
  outcome: ManagedWebOutcome,
  tone: ManagedWebPresentation['tone'],
  actions: ManagedWebAction[]
): ManagedWebPresentation {
  return { outcome, tone, actions }
}

function isBlockedCode(value: string | null) {
  return value === 'robots_disallowed'
    || value === 'private_dns_target'
    || value === 'private_host'
    || value === 'http_forbidden'
    || value === 'challenge_detected'
}
