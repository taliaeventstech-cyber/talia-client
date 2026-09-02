type WhatsappHandoffCopy = {
  queue: {
    eyebrow: string
    title: string
    description: string
    count: (count: number) => string
    emptyTitle: string
    emptyDescription: string
    contact: string
    latestMessage: string
    status: string
    statuses: Record<'open' | 'pending' | 'handoff' | 'resolved' | 'blocked', string>
    activity: string
    messages: string
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
  navigator: {
    title: string
    pending: string
    none: string
    position: string
    previous: string
    next: string
    attention: string
  }
  controls: {
    reply: string
    takeOver: string
    takingOver: string
    returnToTalia: string
    returningToTalia: string
    manualTitle: string
    manualAvailable: string
    manualActive: string
    assignedElsewhere: string
    replyLabel: string
    replyPlaceholder: string
    send: string
    ignore: string
    readOnly: string
  }
  action: {
    claimed: string
    alreadyClaimed: string
    alreadyAssigned: string
    unavailable: string
    sent: string
    sendFailed: string
    uncertain: string
    sendInProgress: string
    ignored: string
    invalidReply: string
    forbidden: string
    takenOver: string
    alreadyTakenOver: string
    takeoverSendInProgress: string
    released: string
  }
}

const copies: Record<'es' | 'ca' | 'en' | 'pt', WhatsappHandoffCopy> = {
  es: {
    queue: {
      eyebrow: 'Agente de WhatsApp',
      title: 'Historial de conversaciones',
      description: 'Todas las conversaciones atendidas por TALIA a través de WhatsApp.',
      count: (count) => `${count} ${count === 1 ? 'conversación' : 'conversaciones'}`,
      emptyTitle: 'Todavía no hay conversaciones',
      emptyDescription: 'Las nuevas conversaciones aparecerán aquí automáticamente.',
      contact: 'Contacto', latestMessage: 'Último mensaje', status: 'Estado',
      statuses: { open: 'Abierta', pending: 'Pendiente', handoff: 'Necesita atención', resolved: 'Resuelta', blocked: 'Bloqueada' },
      activity: 'Actividad', messages: 'Mensajes', view: 'Abrir',
    },
    detail: {
      back: 'Volver a WhatsApp', eyebrow: 'Agente de WhatsApp', title: 'Conversación',
      contact: 'Contacto', reason: 'Motivo', assignedTo: 'Asignada a', unassigned: 'Sin asignar',
      user: 'Usuario', talia: 'TALIA', operator: 'Operador', unsupportedMessage: 'Mensaje no textual',
      delivery: { queued: 'En cola', sending: 'Enviando', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Fallido', unknown: 'Estado incierto' },
    },
    navigator: {
      title: 'Atención humana', pending: 'Pendientes', none: 'No hay mensajes pendientes de atención.',
      position: 'Pendiente {current} de {total}', previous: 'Mensaje pendiente anterior',
      next: 'Siguiente mensaje pendiente', attention: 'Necesita atención',
    },
    controls: {
      reply: 'Contestar de forma manual', assignedElsewhere: 'Asignada a otra persona',
      takeOver: 'Tomar la conversación', takingOver: 'Tomando la conversación…',
      returnToTalia: 'Devolver a TALIA', returningToTalia: 'Devolviendo a TALIA…',
      manualTitle: 'Control de la conversación',
      manualAvailable: 'TALIA responde automáticamente. Puedes tomar el control en cualquier momento.',
      manualActive: 'Modo manual activo. TALIA no responderá hasta que le devuelvas la conversación.',
      replyLabel: 'Respuesta por WhatsApp', replyPlaceholder: 'Escribe tu respuesta…',
      send: 'Enviar', ignore: 'Ignorar', readOnly: 'Tienes acceso de solo lectura.',
    },
    action: {
      claimed: 'Conversación asignada.', alreadyClaimed: 'Ya tienes asignada esta conversación.',
      alreadyAssigned: 'Otra persona ya ha reclamado esta conversación.', unavailable: 'La conversación ya no está disponible.',
      sent: 'Respuesta enviada.', sendFailed: 'Meta rechazó el envío. El caso sigue abierto.',
      uncertain: 'No se pudo confirmar el resultado del envío. No se reenviará automáticamente.',
      sendInProgress: 'Hay una respuesta enviándose. Espera a que termine antes de ignorar el mensaje.',
      ignored: 'Mensaje ignorado.', invalidReply: 'Escribe una respuesta de entre 1 y 4096 caracteres.',
      forbidden: 'No tienes permisos para realizar esta acción.',
      takenOver: 'Has tomado el control. TALIA ha pausado sus respuestas.',
      alreadyTakenOver: 'Ya tienes el control de esta conversación.',
      takeoverSendInProgress: 'TALIA está terminando una respuesta. Espera un momento antes de tomar el control.',
      released: 'Conversación devuelta a TALIA.',
    },
  },
  ca: {
    queue: {
      eyebrow: 'Agent de WhatsApp', title: 'Historial de converses',
      description: 'Totes les converses ateses per TALIA a través de WhatsApp.',
      count: (count) => `${count} ${count === 1 ? 'conversa' : 'converses'}`,
      emptyTitle: 'Encara no hi ha converses', emptyDescription: 'Les converses noves apareixeran aquí automàticament.',
      contact: 'Contacte', latestMessage: 'Últim missatge', status: 'Estat',
      statuses: { open: 'Oberta', pending: 'Pendent', handoff: 'Necessita atenció', resolved: 'Resolvida', blocked: 'Bloquejada' },
      activity: 'Activitat', messages: 'Missatges', view: 'Obrir',
    },
    detail: {
      back: 'Tornar a WhatsApp', eyebrow: 'Agent de WhatsApp', title: 'Conversa', contact: 'Contacte',
      reason: 'Motiu', assignedTo: 'Assignada a', unassigned: 'Sense assignar', user: 'Usuari', talia: 'TALIA',
      operator: 'Operador', unsupportedMessage: 'Missatge no textual',
      delivery: { queued: 'En cua', sending: 'Enviant', sent: 'Enviat', delivered: 'Lliurat', read: 'Llegit', failed: 'Fallat', unknown: 'Estat incert' },
    },
    navigator: {
      title: 'Atenció humana', pending: 'Pendents', none: 'No hi ha missatges pendents d’atenció.',
      position: 'Pendent {current} de {total}', previous: 'Missatge pendent anterior',
      next: 'Missatge pendent següent', attention: 'Necessita atenció',
    },
    controls: {
      reply: 'Respondre manualment', assignedElsewhere: 'Assignada a una altra persona',
      takeOver: 'Prendre la conversa', takingOver: 'Prenent la conversa…',
      returnToTalia: 'Retornar a TALIA', returningToTalia: 'Retornant a TALIA…',
      manualTitle: 'Control de la conversa',
      manualAvailable: 'TALIA respon automàticament. Pots prendre el control en qualsevol moment.',
      manualActive: 'Mode manual actiu. TALIA no respondrà fins que li retornis la conversa.',
      replyLabel: 'Resposta per WhatsApp', replyPlaceholder: 'Escriu la teva resposta…',
      send: 'Enviar', ignore: 'Ignorar', readOnly: 'Tens accés només de lectura.',
    },
    action: {
      claimed: 'Conversa assignada.', alreadyClaimed: 'Ja tens assignada aquesta conversa.',
      alreadyAssigned: 'Una altra persona ja ha reclamat aquesta conversa.', unavailable: 'La conversa ja no està disponible.',
      sent: 'Resposta enviada.', sendFailed: "Meta ha rebutjat l'enviament. El cas continua obert.",
      uncertain: "No s'ha pogut confirmar el resultat de l'enviament. No es reenviarà automàticament.",
      sendInProgress: 'Hi ha una resposta en procés d’enviament. Espera que acabi abans d’ignorar el missatge.',
      ignored: 'Missatge ignorat.', invalidReply: 'Escriu una resposta entre 1 i 4096 caràcters.',
      forbidden: 'No tens permisos per fer aquesta acció.',
      takenOver: 'Has pres el control. TALIA ha pausat les respostes.',
      alreadyTakenOver: 'Ja tens el control d’aquesta conversa.',
      takeoverSendInProgress: 'TALIA està acabant una resposta. Espera un moment abans de prendre el control.',
      released: 'Conversa retornada a TALIA.',
    },
  },
  en: {
    queue: {
      eyebrow: 'WhatsApp agent', title: 'Conversation history',
      description: 'Every conversation handled by TALIA through WhatsApp.',
      count: (count) => `${count} ${count === 1 ? 'conversation' : 'conversations'}`,
      emptyTitle: 'No conversations yet', emptyDescription: 'New conversations will appear here automatically.',
      contact: 'Contact', latestMessage: 'Latest message', status: 'Status',
      statuses: { open: 'Open', pending: 'Pending', handoff: 'Needs attention', resolved: 'Resolved', blocked: 'Blocked' },
      activity: 'Activity', messages: 'Messages', view: 'Open',
    },
    detail: {
      back: 'Back to WhatsApp', eyebrow: 'WhatsApp agent', title: 'Conversation', contact: 'Contact', reason: 'Reason',
      assignedTo: 'Assigned to', unassigned: 'Unassigned', user: 'User', talia: 'TALIA', operator: 'Operator',
      unsupportedMessage: 'Non-text message',
      delivery: { queued: 'Queued', sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed', unknown: 'Uncertain status' },
    },
    navigator: {
      title: 'Human attention', pending: 'Pending', none: 'No messages are waiting for attention.',
      position: 'Pending {current} of {total}', previous: 'Previous pending message',
      next: 'Next pending message', attention: 'Needs attention',
    },
    controls: {
      reply: 'Reply manually', assignedElsewhere: 'Assigned to someone else',
      takeOver: 'Take over conversation', takingOver: 'Taking over…',
      returnToTalia: 'Return to TALIA', returningToTalia: 'Returning to TALIA…',
      manualTitle: 'Conversation control',
      manualAvailable: 'TALIA is replying automatically. You can take over at any time.',
      manualActive: 'Manual mode is active. TALIA will not reply until you return the conversation.',
      replyLabel: 'WhatsApp reply', replyPlaceholder: 'Write your reply…',
      send: 'Send', ignore: 'Ignore', readOnly: 'You have read-only access.',
    },
    action: {
      claimed: 'Conversation assigned.', alreadyClaimed: 'This conversation is already assigned to you.',
      alreadyAssigned: 'Someone else has already claimed this conversation.', unavailable: 'The conversation is no longer available.',
      sent: 'Reply sent.', sendFailed: 'Meta rejected the send. The case remains open.',
      uncertain: 'The send outcome could not be confirmed. It will not be retried automatically.',
      sendInProgress: 'A reply is being sent. Wait for it to finish before ignoring the message.',
      ignored: 'Message ignored.', invalidReply: 'Write a reply between 1 and 4096 characters.',
      forbidden: 'You do not have permission to perform this action.',
      takenOver: 'You are in control. TALIA has paused its replies.',
      alreadyTakenOver: 'You already control this conversation.',
      takeoverSendInProgress: 'TALIA is finishing a reply. Wait a moment before taking control.',
      released: 'Conversation returned to TALIA.',
    },
  },
  pt: {
    queue: {
      eyebrow: 'Agente de WhatsApp', title: 'Histórico de conversas',
      description: 'Todas as conversas atendidas pela TALIA através do WhatsApp.',
      count: (count) => `${count} ${count === 1 ? 'conversa' : 'conversas'}`,
      emptyTitle: 'Ainda não há conversas', emptyDescription: 'As novas conversas aparecerão aqui automaticamente.',
      contact: 'Contato', latestMessage: 'Última mensagem', status: 'Estado',
      statuses: { open: 'Aberta', pending: 'Pendente', handoff: 'Precisa de atenção', resolved: 'Resolvida', blocked: 'Bloqueada' },
      activity: 'Atividade', messages: 'Mensagens', view: 'Abrir',
    },
    detail: {
      back: 'Voltar ao WhatsApp', eyebrow: 'Agente de WhatsApp', title: 'Conversa', contact: 'Contato', reason: 'Motivo',
      assignedTo: 'Atribuída a', unassigned: 'Não atribuída', user: 'Usuário', talia: 'TALIA', operator: 'Operador',
      unsupportedMessage: 'Mensagem sem texto',
      delivery: { queued: 'Na fila', sending: 'Enviando', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falhou', unknown: 'Status incerto' },
    },
    navigator: {
      title: 'Atendimento humano', pending: 'Pendentes', none: 'Não há mensagens aguardando atendimento.',
      position: 'Pendente {current} de {total}', previous: 'Mensagem pendente anterior',
      next: 'Próxima mensagem pendente', attention: 'Precisa de atenção',
    },
    controls: {
      reply: 'Responder manualmente', assignedElsewhere: 'Atribuída a outra pessoa',
      takeOver: 'Assumir a conversa', takingOver: 'Assumindo a conversa…',
      returnToTalia: 'Devolver à TALIA', returningToTalia: 'Devolvendo à TALIA…',
      manualTitle: 'Controle da conversa',
      manualAvailable: 'A TALIA responde automaticamente. Você pode assumir o controle a qualquer momento.',
      manualActive: 'Modo manual ativo. A TALIA não responderá até que você devolva a conversa.',
      replyLabel: 'Resposta pelo WhatsApp', replyPlaceholder: 'Escreva sua resposta…',
      send: 'Enviar', ignore: 'Ignorar', readOnly: 'Você tem acesso somente para leitura.',
    },
    action: {
      claimed: 'Conversa atribuída.', alreadyClaimed: 'Esta conversa já está atribuída a você.',
      alreadyAssigned: 'Outra pessoa já assumiu esta conversa.', unavailable: 'A conversa não está mais disponível.',
      sent: 'Resposta enviada.', sendFailed: 'A Meta rejeitou o envio. O caso continua aberto.',
      uncertain: 'Não foi possível confirmar o resultado do envio. Ele não será repetido automaticamente.',
      sendInProgress: 'Uma resposta está sendo enviada. Aguarde a conclusão antes de ignorar a mensagem.',
      ignored: 'Mensagem ignorada.', invalidReply: 'Escreva uma resposta entre 1 e 4096 caracteres.',
      forbidden: 'Você não tem permissão para realizar esta ação.',
      takenOver: 'Você assumiu o controle. A TALIA pausou as respostas.',
      alreadyTakenOver: 'Você já controla esta conversa.',
      takeoverSendInProgress: 'A TALIA está concluindo uma resposta. Aguarde um momento antes de assumir o controle.',
      released: 'Conversa devolvida à TALIA.',
    },
  },
}

export function getWhatsappHandoffCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0]
  return copies[language === 'ca' || language === 'en' || language === 'pt' ? language : 'es']
}

export function getWhatsappOperatorControlsCopy(locale: string) {
  return getWhatsappHandoffCopy(locale).controls
}

export type { WhatsappHandoffCopy }
