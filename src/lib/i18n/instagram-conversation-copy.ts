export type InstagramConversationCopy = {
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
    humanAgentUntil: string
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
    title: string
    description: string
    takeOver: string
    takingOver: string
    returnToTalia: string
    returningToTalia: string
    manualTitle: string
    manualAvailable: string
    manualActive: string
    reply: string
    replyLabel: string
    replyPlaceholder: string
    send: string
    ignore: string
    readOnly: string
    assignedElsewhere: string
    expired: string
  }
  action: {
    claimed: string
    alreadyClaimed: string
    alreadyAssigned: string
    unavailable: string
    sent: string
    sendFailed: string
    uncertain: string
    expired: string
    ignored: string
    invalidReply: string
    sendInProgress: string
    takenOver: string
    alreadyTakenOver: string
    takeoverSendInProgress: string
    released: string
    notAssigned: string
  }
}

const copies: Record<'es' | 'ca' | 'en' | 'pt', InstagramConversationCopy> = {
  es: {
    queue: {
      eyebrow: 'Agente de Instagram', title: 'Historial de conversaciones',
      description: 'Todas las conversaciones atendidas por TALIA mediante mensajes directos de Instagram.',
      count: (count) => `${count} ${count === 1 ? 'conversación' : 'conversaciones'}`,
      emptyTitle: 'Todavía no hay conversaciones', emptyDescription: 'Los nuevos mensajes directos aparecerán aquí automáticamente.',
      contact: 'Contacto', latestMessage: 'Último mensaje', status: 'Estado',
      statuses: { open: 'Abierta', pending: 'Pendiente', handoff: 'Necesita atención', resolved: 'Resuelta', blocked: 'Bloqueada' },
      activity: 'Actividad', messages: 'Mensajes', view: 'Abrir',
    },
    detail: {
      back: 'Volver a Instagram', eyebrow: 'Agente de Instagram', title: 'Conversación', contact: 'Contacto',
      reason: 'Motivo', assignedTo: 'Asignada a', unassigned: 'Sin asignar', humanAgentUntil: 'Respuesta humana disponible hasta',
      user: 'Usuario', talia: 'TALIA', operator: 'Operador', unsupportedMessage: 'Mensaje no textual',
      delivery: { queued: 'En cola', sending: 'Enviando', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Fallido', unknown: 'Estado incierto' },
    },
    navigator: {
      title: 'Atención humana', pending: 'Pendientes', none: 'No hay mensajes pendientes de atención.',
      position: 'Pendiente {current} de {total}', previous: 'Mensaje pendiente anterior',
      next: 'Siguiente mensaje pendiente', attention: 'Necesita atención',
    },
    controls: {
      title: 'Atención humana', description: 'TALIA ha derivado esta conversación para que la continúe una persona.',
      takeOver: 'Tomar la conversación', takingOver: 'Tomando la conversación…',
      returnToTalia: 'Devolver a TALIA', returningToTalia: 'Devolviendo a TALIA…',
      manualTitle: 'Control de la conversación',
      manualAvailable: 'TALIA responde automáticamente. Puedes tomar el control en cualquier momento.',
      manualActive: 'Modo manual activo. TALIA no responderá hasta que le devuelvas la conversación.',
      reply: 'Contestar de forma manual', replyLabel: 'Respuesta humana por Instagram',
      replyPlaceholder: 'Escribe tu respuesta…', send: 'Enviar', ignore: 'Ignorar',
      readOnly: 'Tienes acceso de solo lectura.', assignedElsewhere: 'Asignada a otra persona.',
      expired: 'La ventana de siete días de Meta ha expirado. Ya no se puede enviar una respuesta humana desde TALIA.',
    },
    action: {
      claimed: 'Conversación asignada.', alreadyClaimed: 'Ya tienes asignada esta conversación.',
      alreadyAssigned: 'Otra persona ya ha reclamado esta conversación.', unavailable: 'La conversación ya no está disponible.',
      sent: 'Respuesta humana enviada.', sendFailed: 'Meta rechazó el envío. El caso sigue abierto.',
      uncertain: 'No se pudo confirmar el resultado del envío. No se reintentará automáticamente.',
      expired: 'La ventana de siete días para respuestas humanas ha expirado.', ignored: 'Conversación resuelta sin responder.',
      invalidReply: 'Escribe una respuesta de entre 1 y 1.000 caracteres.', sendInProgress: 'Hay un envío en curso.',
      takenOver: 'Has tomado el control. TALIA ha pausado sus respuestas.',
      alreadyTakenOver: 'Ya tienes el control de esta conversación.',
      takeoverSendInProgress: 'TALIA está terminando una respuesta. Espera un momento antes de tomar el control.',
      released: 'Conversación devuelta a TALIA.', notAssigned: 'Esta conversación no está asignada a tu usuario.',
    },
  },
  ca: {
    queue: {
      eyebrow: 'Agent d’Instagram', title: 'Historial de converses',
      description: 'Totes les converses ateses per TALIA mitjançant missatges directes d’Instagram.',
      count: (count) => `${count} ${count === 1 ? 'conversa' : 'converses'}`,
      emptyTitle: 'Encara no hi ha converses', emptyDescription: 'Els nous missatges directes apareixeran aquí automàticament.',
      contact: 'Contacte', latestMessage: 'Últim missatge', status: 'Estat',
      statuses: { open: 'Oberta', pending: 'Pendent', handoff: 'Necessita atenció', resolved: 'Resolvida', blocked: 'Bloquejada' },
      activity: 'Activitat', messages: 'Missatges', view: 'Obrir',
    },
    detail: {
      back: 'Tornar a Instagram', eyebrow: 'Agent d’Instagram', title: 'Conversa', contact: 'Contacte',
      reason: 'Motiu', assignedTo: 'Assignada a', unassigned: 'Sense assignar', humanAgentUntil: 'Resposta humana disponible fins a',
      user: 'Usuari', talia: 'TALIA', operator: 'Operador', unsupportedMessage: 'Missatge no textual',
      delivery: { queued: 'En cua', sending: 'Enviant', sent: 'Enviat', delivered: 'Lliurat', read: 'Llegit', failed: 'Fallat', unknown: 'Estat incert' },
    },
    navigator: {
      title: 'Atenció humana', pending: 'Pendents', none: 'No hi ha missatges pendents d’atenció.',
      position: 'Pendent {current} de {total}', previous: 'Missatge pendent anterior',
      next: 'Missatge pendent següent', attention: 'Necessita atenció',
    },
    controls: {
      title: 'Atenció humana', description: 'TALIA ha derivat aquesta conversa perquè la continuï una persona.',
      takeOver: 'Prendre la conversa', takingOver: 'Prenent la conversa…',
      returnToTalia: 'Retornar a TALIA', returningToTalia: 'Retornant a TALIA…',
      manualTitle: 'Control de la conversa',
      manualAvailable: 'TALIA respon automàticament. Pots prendre el control en qualsevol moment.',
      manualActive: 'Mode manual actiu. TALIA no respondrà fins que li retornis la conversa.',
      reply: 'Respondre manualment', replyLabel: 'Resposta humana per Instagram',
      replyPlaceholder: 'Escriu la resposta…', send: 'Enviar', ignore: 'Ignorar',
      readOnly: 'Tens accés només de lectura.', assignedElsewhere: 'Assignada a una altra persona.',
      expired: 'La finestra de set dies de Meta ha expirat. Ja no es pot enviar una resposta humana des de TALIA.',
    },
    action: {
      claimed: 'Conversa assignada.', alreadyClaimed: 'Ja tens assignada aquesta conversa.',
      alreadyAssigned: 'Una altra persona ja ha reclamat aquesta conversa.', unavailable: 'La conversa ja no està disponible.',
      sent: 'Resposta humana enviada.', sendFailed: 'Meta ha rebutjat l’enviament. El cas continua obert.',
      uncertain: 'No s’ha pogut confirmar el resultat. No es reintentarà automàticament.',
      expired: 'La finestra de set dies per a respostes humanes ha expirat.', ignored: 'Conversa resolta sense respondre.',
      invalidReply: 'Escriu una resposta d’entre 1 i 1.000 caràcters.', sendInProgress: 'Hi ha un enviament en curs.',
      takenOver: 'Has pres el control. TALIA ha pausat les respostes.',
      alreadyTakenOver: 'Ja tens el control d’aquesta conversa.',
      takeoverSendInProgress: 'TALIA està acabant una resposta. Espera un moment abans de prendre el control.',
      released: 'Conversa retornada a TALIA.', notAssigned: 'Aquesta conversa no està assignada al teu usuari.',
    },
  },
  en: {
    queue: {
      eyebrow: 'Instagram agent', title: 'Conversation history',
      description: 'Every conversation handled by TALIA through Instagram direct messages.',
      count: (count) => `${count} ${count === 1 ? 'conversation' : 'conversations'}`,
      emptyTitle: 'No conversations yet', emptyDescription: 'New direct messages will appear here automatically.',
      contact: 'Contact', latestMessage: 'Latest message', status: 'Status',
      statuses: { open: 'Open', pending: 'Pending', handoff: 'Needs attention', resolved: 'Resolved', blocked: 'Blocked' },
      activity: 'Activity', messages: 'Messages', view: 'Open',
    },
    detail: {
      back: 'Back to Instagram', eyebrow: 'Instagram agent', title: 'Conversation', contact: 'Contact',
      reason: 'Reason', assignedTo: 'Assigned to', unassigned: 'Unassigned', humanAgentUntil: 'Human reply available until',
      user: 'User', talia: 'TALIA', operator: 'Operator', unsupportedMessage: 'Non-text message',
      delivery: { queued: 'Queued', sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed', unknown: 'Uncertain status' },
    },
    navigator: {
      title: 'Human attention', pending: 'Pending', none: 'No messages are waiting for attention.',
      position: 'Pending {current} of {total}', previous: 'Previous pending message',
      next: 'Next pending message', attention: 'Needs attention',
    },
    controls: {
      title: 'Human support', description: 'TALIA handed this conversation off for a person to continue it.',
      takeOver: 'Take over conversation', takingOver: 'Taking over…',
      returnToTalia: 'Return to TALIA', returningToTalia: 'Returning to TALIA…',
      manualTitle: 'Conversation control',
      manualAvailable: 'TALIA replies automatically. You can take over at any time.',
      manualActive: 'Manual mode is active. TALIA will stay silent until you return the conversation.',
      reply: 'Reply manually', replyLabel: 'Human reply on Instagram', replyPlaceholder: 'Write your reply…',
      send: 'Send', ignore: 'Ignore', readOnly: 'You have read-only access.', assignedElsewhere: 'Assigned to another person.',
      expired: 'Meta’s seven-day window has expired. A human reply can no longer be sent from TALIA.',
    },
    action: {
      claimed: 'Conversation assigned.', alreadyClaimed: 'This conversation is already assigned to you.',
      alreadyAssigned: 'Another person already claimed this conversation.', unavailable: 'The conversation is no longer available.',
      sent: 'Human reply sent.', sendFailed: 'Meta rejected the send. The case remains open.',
      uncertain: 'The send result could not be confirmed. TALIA will not retry automatically.',
      expired: 'The seven-day human reply window has expired.', ignored: 'Conversation resolved without a reply.',
      invalidReply: 'Write a reply between 1 and 1,000 characters.', sendInProgress: 'A send is already in progress.',
      takenOver: 'You have taken control. TALIA has paused its replies.',
      alreadyTakenOver: 'You already control this conversation.',
      takeoverSendInProgress: 'TALIA is finishing a reply. Wait a moment before taking control.',
      released: 'Conversation returned to TALIA.', notAssigned: 'This conversation is not assigned to you.',
    },
  },
  pt: {
    queue: {
      eyebrow: 'Agente do Instagram', title: 'Histórico de conversas',
      description: 'Todas as conversas atendidas pela TALIA através de mensagens diretas do Instagram.',
      count: (count) => `${count} ${count === 1 ? 'conversa' : 'conversas'}`,
      emptyTitle: 'Ainda não há conversas', emptyDescription: 'As novas mensagens diretas aparecerão aqui automaticamente.',
      contact: 'Contato', latestMessage: 'Última mensagem', status: 'Status',
      statuses: { open: 'Aberta', pending: 'Pendente', handoff: 'Precisa de atenção', resolved: 'Resolvida', blocked: 'Bloqueada' },
      activity: 'Atividade', messages: 'Mensagens', view: 'Abrir',
    },
    detail: {
      back: 'Voltar ao Instagram', eyebrow: 'Agente do Instagram', title: 'Conversa', contact: 'Contato',
      reason: 'Motivo', assignedTo: 'Atribuída a', unassigned: 'Não atribuída', humanAgentUntil: 'Resposta humana disponível até',
      user: 'Usuário', talia: 'TALIA', operator: 'Operador', unsupportedMessage: 'Mensagem sem texto',
      delivery: { queued: 'Na fila', sending: 'Enviando', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falhou', unknown: 'Status incerto' },
    },
    navigator: {
      title: 'Atendimento humano', pending: 'Pendentes', none: 'Não há mensagens aguardando atendimento.',
      position: 'Pendente {current} de {total}', previous: 'Mensagem pendente anterior',
      next: 'Próxima mensagem pendente', attention: 'Precisa de atenção',
    },
    controls: {
      title: 'Atendimento humano', description: 'A TALIA transferiu esta conversa para que uma pessoa possa continuá-la.',
      takeOver: 'Assumir a conversa', takingOver: 'Assumindo a conversa…',
      returnToTalia: 'Devolver à TALIA', returningToTalia: 'Devolvendo à TALIA…',
      manualTitle: 'Controle da conversa',
      manualAvailable: 'A TALIA responde automaticamente. Você pode assumir o controle a qualquer momento.',
      manualActive: 'Modo manual ativo. A TALIA não responderá até que você devolva a conversa.',
      reply: 'Responder manualmente', replyLabel: 'Resposta humana pelo Instagram', replyPlaceholder: 'Escreva sua resposta…',
      send: 'Enviar', ignore: 'Ignorar', readOnly: 'Você tem acesso somente de leitura.', assignedElsewhere: 'Atribuída a outra pessoa.',
      expired: 'A janela de sete dias da Meta expirou. Já não é possível enviar uma resposta humana pela TALIA.',
    },
    action: {
      claimed: 'Conversa atribuída.', alreadyClaimed: 'Esta conversa já está atribuída a você.',
      alreadyAssigned: 'Outra pessoa já assumiu esta conversa.', unavailable: 'A conversa já não está disponível.',
      sent: 'Resposta humana enviada.', sendFailed: 'A Meta rejeitou o envio. O caso continua aberto.',
      uncertain: 'Não foi possível confirmar o resultado. A TALIA não tentará novamente automaticamente.',
      expired: 'A janela de sete dias para respostas humanas expirou.', ignored: 'Conversa resolvida sem resposta.',
      invalidReply: 'Escreva uma resposta entre 1 e 1.000 caracteres.', sendInProgress: 'Há um envio em andamento.',
      takenOver: 'Você assumiu o controle. A TALIA pausou as respostas.',
      alreadyTakenOver: 'Você já controla esta conversa.',
      takeoverSendInProgress: 'A TALIA está terminando uma resposta. Aguarde antes de assumir o controle.',
      released: 'Conversa devolvida à TALIA.', notAssigned: 'Esta conversa não está atribuída ao seu usuário.',
    },
  },
}

export function getInstagramConversationCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0]
  return copies[language === 'ca' || language === 'en' || language === 'pt' ? language : 'es']
}
