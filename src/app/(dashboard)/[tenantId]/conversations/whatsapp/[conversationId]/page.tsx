import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { hasTenantPermission } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getWhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappHandoffDetail } from '@/lib/whatsapp/operator-handoff'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { WhatsappConversationThread } from '../conversation-thread'

interface Props {
  params: Promise<{ tenantId: string; conversationId: string }>
}

export default async function WhatsappHandoffDetailPage({ params }: Props) {
  const { tenantId, conversationId } = await params
  const locale = await getLocale()
  const copy = getWhatsappHandoffCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'whatsapp')
  const admin = createAdminClient()
  const [conversation, profileResult] = await Promise.all([
    getWhatsappHandoffDetail(admin, { tenantId, conversationId, actorUserId: access.userId }),
    admin.from('profiles').select('id').eq('auth_user_id', access.userId).maybeSingle(),
  ])
  if (!conversation) notFound()

  const currentProfileId = profileResult.data?.id ?? null
  const canManage = conversation.status === 'handoff' && hasTenantPermission(access.role, 'manage_conversations')
  const backHref = conversation.status === 'handoff'
    ? `/${tenantId}/whatsapp/attention`
    : `/${tenantId}/whatsapp`

  return (
    <main className="page-shell whatsapp-handoff-detail-shell">
      <Link className="back-link" href={backHref}>
        <ArrowLeft aria-hidden="true" size={14} strokeWidth={2} />
        <span>{copy.detail.back}</span>
      </Link>

      <WhatsappConversationThread
        canManage={canManage}
        conversation={conversation}
        copy={copy}
        currentProfileId={currentProfileId}
        headingLevel="h1"
        locale={locale}
        tenantId={tenantId}
      />
    </main>
  )
}
