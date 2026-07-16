import { isManagedWebSourceType } from './managed-web-sources'

const REPROCESSABLE_STRUCTURED_SOURCE_TYPES = new Set(['pdf', 'manual', 'xlsx', 'csv'])

export function canReprocessKnowledgeSourceFromBackstage(sourceType: string) {
  return isManagedWebSourceType(sourceType) || REPROCESSABLE_STRUCTURED_SOURCE_TYPES.has(sourceType)
}
