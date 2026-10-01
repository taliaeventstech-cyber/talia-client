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
import { getInstagramConversationCopy } from '@/lib/i18n/instagram-conversation-copy'
import { getResponseSourcesCopy } from '@/lib/i18n/response-sources-copy'
import { getSupervisedFaqCopy } from '@/lib/i18n/supervised-faq-copy'
import { getInstagramConversationDetail } from '@/lib/instagram/conversations'
import { getInstagramQuestionByAssistantId } from '@/lib/instagram/supervised-learning'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteConversationButton } from '../../conversations/delete-button'
import { InstagramOperatorControls } from './operator-controls'
import { InstagramSupervisedFaqForm } from './supervised-faq-form'

interface Props {
  params: Promise<{ tenantId: string; conversationId: string }>
}

export default async function InstagramConversationDetailPage({ params }: Props) {
  const { tenantId, conversationId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = getInstagramConversationCopy(locale)
  const supervisedCopy = getSupervisedFaqCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'instagram')
  const admin = createAdminClient()
  const [conversation, profileResult] = await Promise.all([
    getInstagramConversationDetail(admin, {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    }),
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
    console.error('[instagram-supervision] failed to load linked FAQs', {
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
  const humanAgentUntil = conversation.human_agent_eligible_until
  const proactiveManualMode = conversation.operator_mode
    && conversation.handoff_reason === 'operator_takeover'
  const supportsManualMode = proactiveManualMode
    || conversation.status === 'open'
    || conversation.status === 'pending'
  const attentionMessages = conversation.status === 'handoff' && !proactiveManualMode
    ? conversation.messages.filter((message) => message.processing_status === 'handoff')
    : []
  const attentionMessageIds = new Set(attentionMessages.map((message) => message.id))
  const activeAttentionMessageId = attentionMessages.at(-1)?.id ?? null
  const questionByAssistantId = getInstagramQuestionByAssistantId(conversation.messages)
  const faqMessageIds = new Set((existingFaqResult.data ?? []).map((item) => item.id))
  const responseSourcesByMessageId = await getResponseSourcesByMessageId(admin, {
    tenantId,
    messages: conversation.messages.filter((message) => message.direction === 'outbound' && !message.is_operator_reply),
  })
  const responseSourcesCopy = getResponseSourcesCopy(locale)
  const messageItems: ConversationMessageItem[] = conversation.messages.map((message) => {
    const needsAttention = attentionMessageIds.has(message.id)
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
      anchorId: needsAttention ? `instagram-attention-${message.id}` : undefined,
      needsAttention,
      senderLabel: message.direction === 'inbound'
        ? copy.detail.user
        : message.is_operator_reply
          ? copy.detail.operator
          : copy.detail.talia,
      body: message.body_text ?? `[${copy.detail.unsupportedMessage}: ${message.message_type}]`,
      createdAt: message.created_at,
      isAssistant: message.direction === 'outbound',
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
            <InstagramSupervisedFaqForm
              answer={message.body_text}
              assistantMessageId={message.id}
              conversationId={conversationId}
              copy={supervisedCopy.form}
              locale={locale}
              question={faqQuestion}
              tenantId={tenantId}
            />
          ) : null}

          {message.id === activeAttentionMessageId ? (
            <div className="conversation-message-attention">
              <div>
                <strong>{copy.controls.title}</strong>
                <p>{copy.controls.description}</p>
              </div>
              <InstagramOperatorControls
                key={`handoff-${conversationId}-${activeAttentionMessageId}`}
                canManage={canManage}
                conversationId={conversationId}
                copy={copy.controls}
                isAssigned={conversation.assigned_profile_id !== null}
                isAssignedToCurrentUser={conversation.assigned_profile_id === currentProfileId}
                locale={locale}
                tenantId={tenantId}
                windowExpired={conversation.human_agent_window_expired}
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
        backHref={`/${tenantId}/instagram`}
        backLabel={copy.detail.back}
        eyebrow={copy.detail.eyebrow}
        title={copy.detail.title}
        metadata={[
          { label: copy.detail.contact, value: `Instagram · ${conversation.contact_masked}` },
          ...(conversation.status === 'handoff'
            ? [
                { label: copy.detail.assignedTo, value: assignedLabel },
                { label: copy.detail.reason, value: conversation.handoff_reason ?? '—' },
                ...(humanAgentUntil
                  ? [{
                      label: copy.detail.humanAgentUntil,
                      value: new Intl.DateTimeFormat(getIntlLocale(locale), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(humanAgentUntil)),
                    }]
                  : []),
              ]
            : []),
        ]}
        actions={access.role === 'owner' || access.role === 'admin' ? (
          <DeleteConversationButton
            tenantId={tenantId}
            conversationId={conversationId}
            channel="instagram"
            redirectHref={`/${tenantId}/instagram`}
            copy={dictionary.conversations.deletion}
          />
        ) : null}
      />

      {supportsManualMode ? (
        <section className="card stack">
          <div>
            <h2>{copy.controls.manualTitle}</h2>
            <p>{proactiveManualMode ? copy.controls.manualActive : copy.controls.manualAvailable}</p>
          </div>
          <InstagramOperatorControls
            key={`${conversationId}-${proactiveManualMode ? 'manual' : 'automatic'}-${conversation.messages.at(-1)?.id ?? 'empty'}`}
            canManage={canManage}
            conversationId={conversationId}
            copy={copy.controls}
            isAssigned={conversation.assigned_profile_id !== null}
            isAssignedToCurrentUser={conversation.assigned_profile_id === currentProfileId}
            locale={locale}
            tenantId={tenantId}
            variant={proactiveManualMode ? 'manual-active' : 'manual-available'}
            windowExpired={conversation.human_agent_window_expired}
          />
        </section>
      ) : null}

      {attentionMessages.length > 0 ? (
        <MessageAttentionNavigator
          currentLabel={copy.navigator.attention}
          items={attentionMessages.map((message) => ({
            targetId: `instagram-attention-${message.id}`,
          }))}
          next={copy.navigator.next}
          none={copy.navigator.none}
          position={copy.navigator.position}
          previous={copy.navigator.previous}
          statuses={[{
            label: copy.navigator.pending,
            count: attentionMessages.length,
            tone: 'pending',
          }]}
          title={copy.navigator.title}
        />
      ) : null}

      <ConversationMessageList
        ariaLabel={copy.detail.title}
        locale={getIntlLocale(locale)}
        items={messageItems}
      />
    </main>
  )
}
