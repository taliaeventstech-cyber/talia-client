import {
  ConversationDetailHeader,
  ConversationMessageList,
  type ConversationMessageItem,
} from '@/components/conversations/conversation-detail'
import { ResponseSources } from '@/components/conversations/response-sources'
import { getConversationStatusTone } from '@/components/conversations/conversation-history'
import { MessageAttentionNavigator } from '@/components/message-attention-navigator'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { hasTenantPermission, isTenantModuleEnabled } from '@/lib/auth/permissions'
import { getResponseSourcesByMessageId } from '@/lib/conversations/response-sources'
import { getIntlLocale } from '@/lib/i18n/config'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getResponseSourcesCopy } from '@/lib/i18n/response-sources-copy'
import { getSupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'
import { getWhatsappHandoffCopy, getWhatsappOperatorControlsCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappHandoffDetail } from '@/lib/whatsapp/operator-handoff'
import { getWhatsappQuestionByAssistantId } from '@/lib/whatsapp/supervised-learning'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteConversationButton } from '../../delete-button'
import { WhatsappOperatorControls } from '../operator-controls'
import { WhatsappSupervisedFaqForm } from '../supervised-faq-form'

interface Props {
  params: Promise<{ tenantId: string; conversationId: string }>
}

export default async function WhatsappHandoffDetailPage({ params }: Props) {
  const { tenantId, conversationId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = getWhatsappHandoffCopy(locale)
  const controlsCopy = getWhatsappOperatorControlsCopy(locale)
  const supervisedCopy = getSupervisedFaqCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'whatsapp')
  const admin = createAdminClient()
  const [conversation, profileResult] = await Promise.all([
    getWhatsappHandoffDetail(admin, { tenantId, conversationId, actorUserId: access.userId }),
    admin.from('profiles').select('id').eq('auth_user_id', access.userId).maybeSingle(),
  ])
  if (!conversation) notFound()

  const taliaMessageIds = conversation.messages
    .filter((message) => message.direction === 'outbound' && !message.is_operator_reply)
    .map((message) => message.id)
  const existingFaqResult = taliaMessageIds.length > 0
    ? await admin.from('knowledge_items').select('id').eq('theatre_id', tenantId).in('id', taliaMessageIds)
    : { data: [], error: null }
  if (existingFaqResult.error) {
    console.error('[whatsapp-supervision] failed to load linked FAQs', {
      tenantId,
      conversationId,
      error: existingFaqResult.error.message,
    })
  }

  const currentProfileId = profileResult.data?.id ?? null
  const assignedLabel = conversation.assigned_name ?? conversation.assigned_email ?? copy.detail.unassigned
  const canManage = hasTenantPermission(access.role, 'manage_conversations')
  const canManageKnowledge = hasTenantPermission(access.role, 'manage_knowledge')
    && isTenantModuleEnabled(access.modules.data)
  const attentionMessage = conversation.status === 'handoff' && !conversation.operator_mode
    ? findCurrentAttentionMessage(conversation.messages)
    : null
  const attentionTargetId = attentionMessage ? `whatsapp-attention-${attentionMessage.id}` : null
  const questionByAssistantId = getWhatsappQuestionByAssistantId(conversation.messages)
  const faqMessageIds = new Set((existingFaqResult.data ?? []).map((item) => item.id))
  const responseSourcesByMessageId = await getResponseSourcesByMessageId(admin, {
    tenantId,
    messages: conversation.messages.filter((message) => message.direction === 'outbound' && !message.is_operator_reply),
  })
  const responseSourcesCopy = getResponseSourcesCopy(locale)
  const supportsManualMode = conversation.operator_mode || conversation.status === 'open' || conversation.status === 'pending'
  const messageItems: ConversationMessageItem[] = conversation.messages.map((message) => {
    const label = message.direction === 'inbound'
      ? copy.detail.user
      : message.is_operator_reply
        ? copy.detail.operator
        : copy.detail.talia
    const needsAttention = message.id === attentionMessage?.id
    const faqQuestion = questionByAssistantId.get(message.id)
    const faqPublished = faqMessageIds.has(message.id)
    const responseSources = responseSourcesByMessageId.get(message.id)
    const canPromoteToFaq = canManageKnowledge
      && message.direction === 'outbound'
      && !message.is_operator_reply
      && Boolean(message.body_text)
      && Boolean(faqQuestion)
      && ['sent', 'delivered', 'read'].includes(message.delivery_status ?? '')

    return {
      id: message.id,
      senderLabel: label,
      body: message.body_text ?? `[${copy.detail.unsupportedMessage}: ${message.message_type}]`,
      createdAt: message.created_at,
      isAssistant: message.direction === 'outbound',
      anchorId: needsAttention ? attentionTargetId ?? undefined : undefined,
      needsAttention,
      delivery: message.direction === 'outbound' && message.delivery_status
        ? {
            label: copy.detail.delivery[message.delivery_status] ?? message.delivery_status,
            tone: getConversationStatusTone(message.delivery_status),
          }
        : undefined,
      extras: (
        <>
          {responseSources ? (
            <ResponseSources
              additionalCount={responseSources.additionalCount}
              canViewKnowledge={canManageKnowledge}
              copy={responseSourcesCopy}
              sources={responseSources.sources}
              tenantId={tenantId}
            />
          ) : null}

          {faqPublished ? (
            <div className="supervised-faq-published">
              <div>
                <strong>{supervisedCopy.published.title}</strong>
                <p>{supervisedCopy.published.indexed}</p>
              </div>
              <Link className="button-outline button-fit" href={`/${tenantId}/knowledge`}>
                {supervisedCopy.published.viewKnowledge}
              </Link>
            </div>
          ) : canPromoteToFaq && faqQuestion && message.body_text ? (
            <WhatsappSupervisedFaqForm
              answer={message.body_text}
              assistantMessageId={message.id}
              conversationId={conversationId}
              copy={supervisedCopy.form}
              locale={locale}
              question={faqQuestion}
              tenantId={tenantId}
            />
          ) : null}

          {needsAttention ? (
            <div className="conversation-message-attention">
              <WhatsappOperatorControls
                canManage={canManage}
                conversationId={conversationId}
                copy={controlsCopy}
                isAssigned={conversation.assigned_profile_id !== null}
                isAssignedToCurrentUser={conversation.assigned_profile_id === currentProfileId}
                locale={locale}
                tenantId={tenantId}
              />
            </div>
          ) : null}
        </>
      ),
    }
  })

  return (
    <main className="page-shell whatsapp-handoff-detail-shell">
      <ConversationDetailHeader
        backHref={`/${tenantId}/whatsapp`}
        backLabel={copy.detail.back}
        eyebrow={copy.detail.eyebrow}
        title={copy.detail.title}
        metadata={[
          { label: copy.detail.contact, value: `${conversation.contact_name} · ${conversation.contact_masked}` },
          ...(conversation.status === 'handoff'
            ? [
                { label: copy.detail.assignedTo, value: assignedLabel },
                { label: copy.detail.reason, value: conversation.handoff_reason ?? '—' },
              ]
            : []),
        ]}
        actions={access.role === 'owner' || access.role === 'admin' ? (
          <DeleteConversationButton
            tenantId={tenantId}
            conversationId={conversationId}
            channel="whatsapp"
            redirectHref={`/${tenantId}/whatsapp`}
            copy={dictionary.conversations.deletion}
          />
        ) : null}
      />

      {supportsManualMode ? (
        <section className="card stack">
          <div>
            <h2>{controlsCopy.manualTitle}</h2>
            <p>{conversation.operator_mode ? controlsCopy.manualActive : controlsCopy.manualAvailable}</p>
          </div>
          <WhatsappOperatorControls
            key={`${conversation.operator_mode ? 'manual' : 'automatic'}-${conversation.messages.at(-1)?.id ?? 'empty'}`}
            canManage={canManage}
            conversationId={conversationId}
            copy={controlsCopy}
            isAssigned={conversation.assigned_profile_id !== null}
            isAssignedToCurrentUser={conversation.assigned_profile_id === currentProfileId}
            locale={locale}
            tenantId={tenantId}
            variant={conversation.operator_mode ? 'manual-active' : 'manual-available'}
          />
        </section>
      ) : null}

      {attentionTargetId ? (
        <MessageAttentionNavigator
          currentLabel={copy.navigator.attention}
          items={[{ targetId: attentionTargetId }]}
          next={copy.navigator.next}
          none={copy.navigator.none}
          position={copy.navigator.position}
          previous={copy.navigator.previous}
          statuses={[{ label: copy.navigator.pending, count: 1, tone: 'pending' }]}
          title={copy.navigator.title}
        />
      ) : null}

      <ConversationMessageList
        ariaLabel={copy.detail.title}
        items={messageItems}
        locale={getIntlLocale(locale)}
      />
    </main>
  )
}

function findCurrentAttentionMessage<T extends { direction: string; processing_status: string }>(messages: T[]) {
  return [...messages].reverse().find((message) => message.processing_status === 'handoff')
    ?? [...messages].reverse().find((message) => message.direction === 'inbound')
    ?? messages.at(-1)
    ?? null
}
