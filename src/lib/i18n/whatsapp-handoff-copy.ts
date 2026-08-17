type WhatsappHandoffCopy = {
  tabs: { web: string; whatsapp: string }
  queue: {
    eyebrow: string
    title: string
    description: string
    pending: (count: number) => string
    emptyTitle: string
    emptyDescription: string
    contact: string
    latestMessage: string
    assignedTo: string
    activity: string
    messages: string
    unassigned: string
    view: string
  }
  detail: {
    back: string
    eyebrow: string
    title: string
    contact: string
    reason: string
    assignedTo: string
    unassigned: string
    user: string
    talia: string
    operator: string
    unsupportedMessage: string
    delivery: Record<string, string>
  }
  controls: {
    claim: string
    claimedByYou: string
    assignedElsewhere: string
    replyLabel: string
    replyPlaceholder: string
    send: string
    resolve: string
    readOnly: string
    claimFirst: string
  }
  action: {
    claimed: string
    alreadyClaimed: string
    alreadyAssigned: string
    unavailable: string
    sent: string
    sendFailed: string
    uncertain: string
    resolved: string
    invalidReply: string
    forbidden: string
  }
}

const copies: Record<'es' | 'ca' | 'en' | 'pt', WhatsappHandoffCopy> = {
  es: {
    tabs: { web: 'Web', whatsapp: 'WhatsApp' },
    queue: {
      eyebrow: 'Atención · WhatsApp',
      title: 'Conversaciones que necesitan ayuda',
      description: 'Casos que TALIA ha derivado a una persona. Reclama una conversación antes de responder.',
      pending: (count) => `${count} ${count === 1 ? 'caso pendiente' : 'casos pendientes'}`,
      emptyTitle: 'No hay conversaciones pendientes',
      emptyDescription: 'Los nuevos handoffs aparecerán aquí automáticamente.',
      contact: 'Contacto', latestMessage: 'Último mensaje', assignedTo: 'Asignada a',
      activity: 'Actividad', messages: 'Mensajes', unassigned: 'Sin asignar', view: 'Abrir',
    },
    detail: {
      back: 'Volver a WhatsApp', eyebrow: 'Handoff de WhatsApp', title: 'Conversación',
      contact: 'Contacto', reason: 'Motivo', assignedTo: 'Asignada a', unassigned: 'Sin asignar',
      user: 'Usuario', talia: 'TALIA', operator: 'Operador', unsupportedMessage: 'Mensaje no textual',
      delivery: { queued: 'En cola', sending: 'Enviando', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Fallido', unknown: 'Estado incierto' },
    },
    controls: {
      claim: 'Reclamar conversación', claimedByYou: 'La tienes asignada',
      assignedElsewhere: 'Asignada a otra persona', replyLabel: 'Respuesta',
      replyPlaceholder: 'Escribe una respuesta humana…', send: 'Enviar por WhatsApp',
      resolve: 'Resolver conversación', readOnly: 'Tienes acceso de solo lectura.',
      claimFirst: 'Reclama la conversación para poder responder.',
    },
    action: {
      claimed: 'Conversación asignada.', alreadyClaimed: 'Ya tienes asignada esta conversación.',
      alreadyAssigned: 'Otra persona ya ha reclamado esta conversación.', unavailable: 'La conversación ya no está disponible.',
      sent: 'Respuesta enviada.', sendFailed: 'Meta rechazó el envío. El caso sigue abierto.',
      uncertain: 'No se pudo confirmar el resultado del envío. No se reenviará automáticamente.',
      resolved: 'Conversación resuelta.', invalidReply: 'Escribe una respuesta de entre 1 y 4096 caracteres.',
      forbidden: 'No tienes permisos para realizar esta acción.',
    },
  },
  ca: {
    tabs: { web: 'Web', whatsapp: 'WhatsApp' },
    queue: {
      eyebrow: 'Atenció · WhatsApp', title: 'Converses que necessiten ajuda',
      description: 'Casos que TALIA ha derivat a una persona. Reclama una conversa abans de respondre.',
      pending: (count) => `${count} ${count === 1 ? 'cas pendent' : 'casos pendents'}`,
      emptyTitle: 'No hi ha converses pendents', emptyDescription: 'Els nous handoffs apareixeran aquí automàticament.',
      contact: 'Contacte', latestMessage: 'Últim missatge', assignedTo: 'Assignada a', activity: 'Activitat',
      messages: 'Missatges', unassigned: 'Sense assignar', view: 'Obrir',
    },
    detail: {
      back: 'Tornar a WhatsApp', eyebrow: 'Handoff de WhatsApp', title: 'Conversa', contact: 'Contacte',
      reason: 'Motiu', assignedTo: 'Assignada a', unassigned: 'Sense assignar', user: 'Usuari', talia: 'TALIA',
      operator: 'Operador', unsupportedMessage: 'Missatge no textual',
      delivery: { queued: 'En cua', sending: 'Enviant', sent: 'Enviat', delivered: 'Lliurat', read: 'Llegit', failed: 'Fallat', unknown: 'Estat incert' },
    },
    controls: {
      claim: 'Reclamar conversa', claimedByYou: 'La tens assignada', assignedElsewhere: 'Assignada a una altra persona',
      replyLabel: 'Resposta', replyPlaceholder: 'Escriu una resposta humana…', send: 'Enviar per WhatsApp',
      resolve: 'Resoldre conversa', readOnly: 'Tens accés només de lectura.', claimFirst: 'Reclama la conversa per poder respondre.',
    },
    action: {
      claimed: 'Conversa assignada.', alreadyClaimed: 'Ja tens assignada aquesta conversa.',
      alreadyAssigned: 'Una altra persona ja ha reclamat aquesta conversa.', unavailable: 'La conversa ja no està disponible.',
      sent: 'Resposta enviada.', sendFailed: "Meta ha rebutjat l'enviament. El cas continua obert.",
      uncertain: "No s'ha pogut confirmar el resultat de l'enviament. No es reenviarà automàticament.",
      resolved: 'Conversa resolta.', invalidReply: 'Escriu una resposta entre 1 i 4096 caràcters.',
      forbidden: 'No tens permisos per fer aquesta acció.',
    },
  },
  en: {
    tabs: { web: 'Web', whatsapp: 'WhatsApp' },
    queue: {
      eyebrow: 'Support · WhatsApp', title: 'Conversations needing help',
      description: 'Cases TALIA has handed over to a person. Claim a conversation before replying.',
      pending: (count) => `${count} pending ${count === 1 ? 'case' : 'cases'}`,
      emptyTitle: 'No conversations are pending', emptyDescription: 'New handoffs will appear here automatically.',
      contact: 'Contact', latestMessage: 'Latest message', assignedTo: 'Assigned to', activity: 'Activity',
      messages: 'Messages', unassigned: 'Unassigned', view: 'Open',
    },
    detail: {
      back: 'Back to WhatsApp', eyebrow: 'WhatsApp handoff', title: 'Conversation', contact: 'Contact', reason: 'Reason',
      assignedTo: 'Assigned to', unassigned: 'Unassigned', user: 'User', talia: 'TALIA', operator: 'Operator',
      unsupportedMessage: 'Non-text message',
      delivery: { queued: 'Queued', sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed', unknown: 'Uncertain status' },
    },
    controls: {
      claim: 'Claim conversation', claimedByYou: 'Assigned to you', assignedElsewhere: 'Assigned to someone else',
      replyLabel: 'Reply', replyPlaceholder: 'Write a human reply…', send: 'Send on WhatsApp',
      resolve: 'Resolve conversation', readOnly: 'You have read-only access.', claimFirst: 'Claim the conversation to reply.',
    },
    action: {
      claimed: 'Conversation assigned.', alreadyClaimed: 'This conversation is already assigned to you.',
      alreadyAssigned: 'Someone else has already claimed this conversation.', unavailable: 'The conversation is no longer available.',
      sent: 'Reply sent.', sendFailed: 'Meta rejected the send. The case remains open.',
      uncertain: 'The send outcome could not be confirmed. It will not be retried automatically.',
      resolved: 'Conversation resolved.', invalidReply: 'Write a reply between 1 and 4096 characters.',
      forbidden: 'You do not have permission to perform this action.',
    },
  },
  pt: {
    tabs: { web: 'Web', whatsapp: 'WhatsApp' },
    queue: {
      eyebrow: 'Atendimento · WhatsApp', title: 'Conversas que precisam de ajuda',
      description: 'Casos que a TALIA encaminhou para uma pessoa. Assuma uma conversa antes de responder.',
      pending: (count) => `${count} ${count === 1 ? 'caso pendente' : 'casos pendentes'}`,
      emptyTitle: 'Não há conversas pendentes', emptyDescription: 'Novos handoffs aparecerão aqui automaticamente.',
      contact: 'Contato', latestMessage: 'Última mensagem', assignedTo: 'Atribuída a', activity: 'Atividade',
      messages: 'Mensagens', unassigned: 'Não atribuída', view: 'Abrir',
    },
    detail: {
      back: 'Voltar ao WhatsApp', eyebrow: 'Handoff do WhatsApp', title: 'Conversa', contact: 'Contato', reason: 'Motivo',
      assignedTo: 'Atribuída a', unassigned: 'Não atribuída', user: 'Usuário', talia: 'TALIA', operator: 'Operador',
      unsupportedMessage: 'Mensagem sem texto',
      delivery: { queued: 'Na fila', sending: 'Enviando', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falhou', unknown: 'Status incerto' },
    },
    controls: {
      claim: 'Assumir conversa', claimedByYou: 'Atribuída a você', assignedElsewhere: 'Atribuída a outra pessoa',
      replyLabel: 'Resposta', replyPlaceholder: 'Escreva uma resposta humana…', send: 'Enviar pelo WhatsApp',
      resolve: 'Resolver conversa', readOnly: 'Você tem acesso somente para leitura.', claimFirst: 'Assuma a conversa para responder.',
    },
    action: {
      claimed: 'Conversa atribuída.', alreadyClaimed: 'Esta conversa já está atribuída a você.',
      alreadyAssigned: 'Outra pessoa já assumiu esta conversa.', unavailable: 'A conversa não está mais disponível.',
      sent: 'Resposta enviada.', sendFailed: 'A Meta rejeitou o envio. O caso continua aberto.',
      uncertain: 'Não foi possível confirmar o resultado do envio. Ele não será repetido automaticamente.',
      resolved: 'Conversa resolvida.', invalidReply: 'Escreva uma resposta entre 1 e 4096 caracteres.',
      forbidden: 'Você não tem permissão para realizar esta ação.',
    },
  },
}

export function getWhatsappHandoffCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0]
  return copies[language === 'ca' || language === 'en' || language === 'pt' ? language : 'es']
}

export type { WhatsappHandoffCopy }
