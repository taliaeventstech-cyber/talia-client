import { MessageAttentionNavigator } from '@/components/message-attention-navigator'
import type { SupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'

export type PendingReviewNavigationItem = {
  messageId: string
  questionMessageId: string | null
}

export function ConversationReviewNavigator({
  items,
  correctedCount,
  acceptedCount,
  copy,
}: {
  items: PendingReviewNavigationItem[]
  correctedCount: number
  acceptedCount: number
  copy: SupervisedFaqCopy['navigator']
}) {
  return (
    <MessageAttentionNavigator
      currentLabel={copy.improvement}
      items={items.map((item) => ({
        targetId: `response-${item.messageId}`,
        highlightIds: [
          ...(item.questionMessageId ? [`question-${item.questionMessageId}`] : []),
          `response-${item.messageId}`,
        ],
      }))}
      next={copy.next}
      none={copy.none}
      position={copy.position}
      previous={copy.previous}
      statuses={[
        { label: copy.pending, count: items.length, tone: items.length > 0 ? 'pending' : undefined },
        { label: copy.corrected, count: correctedCount, tone: 'corrected' },
        { label: copy.accepted, count: acceptedCount, tone: 'accepted' },
      ]}
      title={copy.title}
    />
  )
}
