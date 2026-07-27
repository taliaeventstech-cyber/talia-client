export type ResponseFeedbackMetrics = {
  accuracyPercent: number | null
  coveragePercent: number
  positiveCount: number
  negativeCount: number
  ratedCount: number
  totalCount: number
}

export function getResponseFeedbackMetrics({
  positiveCount,
  negativeCount,
  totalCount,
}: {
  positiveCount: number
  negativeCount: number
  totalCount: number
}): ResponseFeedbackMetrics {
  const safePositiveCount = normalizeCount(positiveCount)
  const safeNegativeCount = normalizeCount(negativeCount)
  const safeTotalCount = normalizeCount(totalCount)
  const ratedCount = safePositiveCount + safeNegativeCount

  return {
    accuracyPercent: ratedCount > 0
      ? Math.round((safePositiveCount / ratedCount) * 100)
      : null,
    coveragePercent: safeTotalCount > 0
      ? Math.min(100, Math.round((ratedCount / safeTotalCount) * 100))
      : 0,
    positiveCount: safePositiveCount,
    negativeCount: safeNegativeCount,
    ratedCount,
    totalCount: safeTotalCount,
  }
}

function normalizeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}
