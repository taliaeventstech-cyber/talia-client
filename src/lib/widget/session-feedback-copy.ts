export type SessionFeedbackCopy = {
  groupLabel: string
  title: string
  description: string
  positive: string
  negative: string
  commentsPlaceholder: string
  submit: string
  skip: string
}

export function getSessionFeedbackCopy(language: string): SessionFeedbackCopy {
  if (language === 'ca') {
    return {
      groupLabel: 'Valoració abans de reiniciar',
      title: 'Tornem a començar?',
      description: 'Abans, digues-me si he resolt la teva consulta.',
      positive: 'Sí, gràcies',
      negative: 'No del tot',
      commentsPlaceholder: 'Comentari opcional',
      submit: 'Enviar i reiniciar',
      skip: 'Reiniciar sense valorar',
    }
  }

  if (language === 'en') {
    return {
      groupLabel: 'Feedback before restarting',
      title: 'Start a new conversation?',
      description: 'Before we do, did I resolve your question?',
      positive: 'Yes, thanks',
      negative: 'Not quite',
      commentsPlaceholder: 'Optional comment',
      submit: 'Submit and restart',
      skip: 'Restart without rating',
    }
  }

  if (language === 'pt-BR') {
    return {
      groupLabel: 'Avaliação antes de reiniciar',
      title: 'Começar uma nova conversa?',
      description: 'Antes disso, diga se consegui resolver sua dúvida.',
      positive: 'Sim, obrigado',
      negative: 'Não totalmente',
      commentsPlaceholder: 'Comentário opcional',
      submit: 'Enviar e reiniciar',
      skip: 'Reiniciar sem avaliar',
    }
  }

  return {
    groupLabel: 'Valoración antes de reiniciar',
    title: '¿Empezamos de nuevo?',
    description: 'Antes, dime si he resuelto tu consulta.',
    positive: 'Sí, gracias',
    negative: 'No del todo',
    commentsPlaceholder: 'Comentario opcional',
    submit: 'Enviar y reiniciar',
    skip: 'Reiniciar sin valorar',
  }
}
