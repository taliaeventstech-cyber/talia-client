import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { hasTenantPermission, isTenantModuleEnabled } from '@/lib/auth/permissions'
import {
  getConversationQuestion,
  getConversationResponseReview,
  getConversationReviewSummary,
} from '@/lib/chat/supervised-learning'
import { orderConversationMessagesByNewestTurn } from '@/lib/conversations/message-order'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getIntlLocale } from '@/lib/i18n/config'
import {
  ConversationDetailHeader,
  ConversationMessageList,
  type ConversationMessageItem,
} from '@/components/conversations/conversation-detail'
import { LocalDateTime } from '@/components/local-date-time'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteConversationButton } from '../delete-button'
import {
  ConversationReviewNavigator,
  type PendingReviewNavigationItem,
} from '../review-navigator'
import { SupervisedFaqForm } from '../supervised-faq-form'

interface Props {
  params: Promise<{ tenantId: string; conversationId: string }>
}

export default async function ConversationDetailPage({ params }: Props) {
  const { tenantId, conversationId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const supervisedFaqCopy = dictionary.conversations.supervisedFaq
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'web')

  const admin = createAdminClient()

  const [{ data: conversation }, { data: messages }] = await Promise.all([
    admin
      .from('conversations')
      .select('id, session_id, started_at, ended_at, message_count, metadata')
      .eq('id', conversationId)
      .eq('theatre_id', tenantId)
      .single(),
    admin
      .from('messages')
      .select('id, role, content, created_at, metadata')
      .eq('conversation_id', conversationId)
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: true }),
  ])

  if (!conversation) notFound()

  const visitorEmail = getVisitorEmail(conversation.metadata)
  const canManageKnowledge = hasTenantPermission(access.role, 'manage_knowledge')
    && isTenantModuleEnabled(access.modules.data)
  const conversationMessages = messages ?? []
  const displayMessages = orderConversationMessagesByNewestTurn(conversationMessages)
  const questionByAssistantId = getQuestionByAssistantId(conversationMessages)
  const assistantMessageIds = conversationMessages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.id)
  const { data: supervisedFaqs } = assistantMessageIds.length
    ? await admin
      .from('knowledge_items')
      .select('id')
      .eq('theatre_id', tenantId)
      .in('id', assistantMessageIds)
    : { data: [] }
  const supervisedFaqIds = new Set((supervisedFaqs ?? []).map((item) => item.id))
  const assistantMessages = conversationMessages.filter((message) => message.role === 'assistant')
  const reviewSummary = getConversationReviewSummary(assistantMessages, supervisedFaqIds)
  const pendingReviewItems = displayMessages.flatMap((message): PendingReviewNavigationItem[] => {
    if (message.role !== 'assistant') return []
    const review = getConversationResponseReview(message.metadata)
    const resolved = review.humanReviewStatus === 'accepted_valid'
      || review.knowledgeItemId !== null
      || supervisedFaqIds.has(message.id)
    if (!review.eligibleForCorrection || resolved) return []
    return [{
      messageId: message.id,
      questionMessageId: questionByAssistantId.get(message.id)?.id ?? null,
    }]
  })
  const hasReviewActivity = pendingReviewItems.length > 0
    || reviewSummary.correctedCount > 0
    || reviewSummary.acceptedCount > 0
  const messageItems: ConversationMessageItem[] = displayMessages.map((message) => {
    const review = message.role === 'assistant'
      ? getConversationResponseReview(message.metadata)
      : null
    const question = message.role === 'assistant'
      ? getConversationQuestion(message.metadata) ?? questionByAssistantId.get(message.id)?.content ?? ''
      : null
    const publishedKnowledgeItemId = message.role === 'assistant' && supervisedFaqIds.has(message.id)
      ? message.id
      : null

    return {
      id: message.id,
      anchorId: message.role === 'assistant'
        ? `response-${message.id}`
        : message.role === 'user'
          ? `question-${message.id}`
          : undefined,
      senderLabel: message.role === 'assistant' ? 'TALIA' : 'Usuario',
      body: message.content,
      createdAt: message.created_at,
      isAssistant: message.role === 'assistant',
      extras: (
        <>
          {review ? (
            <div className="conversation-feedback-row">
              {review.rating === 'positive' ? (
                <span className="conversation-feedback-pill conversation-feedback-positive">
                  {supervisedFaqCopy.feedback.positive}
                </span>
              ) : null}
              {review.eligibleForCorrection ? (
                <span className="conversation-feedback-pill conversation-feedback-improvement">
                  {supervisedFaqCopy.feedback.improvement}
                </span>
              ) : null}
              {!review.rating && !review.fallback ? (
                <span className="conversation-feedback-pill">{supervisedFaqCopy.feedback.unrated}</span>
              ) : null}
            </div>
          ) : null}

          {review && publishedKnowledgeItemId ? (
            <div className="supervised-faq-published">
              <div>
                <strong>{supervisedFaqCopy.published.title}</strong>
                <p>
                  {review.publicationStatus === 'indexed'
                    ? supervisedFaqCopy.published.indexed
                    : supervisedFaqCopy.published.pending}
                </p>
              </div>
              <Link className="button-outline button-fit" href={`/${tenantId}/knowledge`}>
                {supervisedFaqCopy.published.viewKnowledge}
              </Link>
            </div>
          ) : review?.humanReviewStatus === 'accepted_valid' ? (
            <div className="supervised-faq-published supervised-response-accepted">
              <div>
                <strong>{supervisedFaqCopy.published.acceptedTitle}</strong>
                <p>{supervisedFaqCopy.published.acceptedDescription}</p>
              </div>
            </div>
          ) : review?.eligibleForCorrection && canManageKnowledge && question ? (
            <SupervisedFaqForm
              tenantId={tenantId}
              conversationId={conversationId}
              assistantMessageId={message.id}
              question={question}
              answer={message.content}
              locale={locale}
              copy={supervisedFaqCopy.form}
            />
          ) : null}
        </>
      ),
    }
  })

  return (
    <main className="page-shell">
      <ConversationDetailHeader
        backHref={`/${tenantId}/conversations`}
        backLabel="Volver a conversaciones"
        eyebrow="Conversation log"
        title="Conversación"
        metadata={[
          { label: 'Session ID', value: <span className="mono">{conversation.session_id}</span> },
          { label: 'Email', value: visitorEmail ?? '-' },
          {
            label: 'Inicio',
            value: <LocalDateTime value={conversation.started_at} locale={getIntlLocale(locale)} />,
          },
          { label: 'Mensajes', value: conversation.message_count },
        ]}
        actions={access.role === 'owner' || access.role === 'admin' ? (
            <DeleteConversationButton
              tenantId={tenantId}
              conversationId={conversationId}
              copy={dictionary.conversations.deletion}
            />
          ) : null}
      />

      {hasReviewActivity ? (
        <ConversationReviewNavigator
          items={pendingReviewItems}
          correctedCount={reviewSummary.correctedCount}
          acceptedCount={reviewSummary.acceptedCount}
          copy={supervisedFaqCopy.navigator}
        />
      ) : null}

      <ConversationMessageList items={messageItems} locale={getIntlLocale(locale)} />
    </main>
  )
}

function getVisitorEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const email = (metadata as { email?: unknown; visitor_email?: unknown }).email
    ?? (metadata as { email?: unknown; visitor_email?: unknown }).visitor_email
  return typeof email === 'string' && email ? email : null
}

function getQuestionByAssistantId(
  messages: Array<{ id: string; role: string; content: string }>,
) {
  const questions = new Map<string, { id: string; content: string }>()
  let previousUserMessage: { id: string; content: string } | null = null

  for (const message of messages) {
    if (message.role === 'user') {
      previousUserMessage = {
        id: message.id,
        content: message.content,
      }
    } else if (message.role === 'assistant' && previousUserMessage) {
      questions.set(message.id, previousUserMessage)
    }
  }

  return questions
}
