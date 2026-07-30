export type SupervisedFaqCopy = {
  feedback: {
    positive: string
    improvement: string
    unrated: string
  }
  published: {
    title: string
    indexed: string
    pending: string
    viewKnowledge: string
    acceptedTitle: string
    acceptedDescription: string
  }
  form: {
    title: string
    improvementReason: string
    humanReview: string
    questionLabel: string
    answerLabel: string
    answerPlaceholder: string
    languageRule: string
    submit: string
    submitting: string
    disclaimer: string
    editResponse: string
    acceptResponse: string
    acceptPrompt: string
    acceptDescription: string
    confirmAccept: string
    accepting: string
    cancel: string
    closeEditor: string
  }
  navigator: {
    title: string
    pending: string
    corrected: string
    accepted: string
    none: string
    position: string
    previous: string
    next: string
    improvement: string
  }
  action: {
    invalid: string
    unavailable: string
    notEligible: string
    alreadyCreated: string
    sourceError: string
    createError: string
    indexed: string
    pendingIndex: string
    accepted: string
    alreadyAccepted: string
    acceptError: string
  }
}

export const SUPERVISED_FAQ_COPY = {
  es: {
    feedback: {
      positive: 'Le gustó al visitante',
      improvement: 'Oportunidad de mejora',
      unrated: 'Sin valorar',
    },
    published: {
      title: 'FAQ creada desde esta conversación',
      indexed: 'La corrección ya está indexada y disponible para la recuperación de conocimiento de TALIA.',
      pending: 'La FAQ está guardada y queda pendiente de completar su indexación.',
      viewKnowledge: 'Ver en Knowledge',
      acceptedTitle: 'Respuesta validada por el equipo',
      acceptedDescription: 'Se conserva la valoración del visitante, pero esta respuesta ya no necesita revisión ni modifica Conocimiento.',
    },
    form: {
      title: 'Revisar esta respuesta de TALIA',
      improvementReason: 'Esta respuesta está disponible para revisión y mejora.',
      humanReview: 'Revisión humana',
      questionLabel: 'Pregunta que debe reconocer TALIA',
      answerLabel: 'Respuesta oficial',
      answerPlaceholder: 'Escribe la respuesta correcta que TALIA debería utilizar...',
      languageRule: 'TALIA utilizará esta información en cualquier idioma y responderá siempre en el idioma del último mensaje del usuario.',
      submit: 'Crear FAQ y enseñar a TALIA',
      submitting: 'Creando e indexando…',
      disclaimer: 'Al confirmar, se crea una FAQ oficial y trazable para este espacio. La conversación por sí sola nunca modifica Conocimiento.',
      editResponse: 'Corregir y enseñar a TALIA',
      acceptResponse: 'Marcar como respuesta válida',
      acceptPrompt: '¿Confirmas que la respuesta de TALIA es correcta?',
      acceptDescription: 'La valoración original del visitante se conservará. Esta decisión cerrará la revisión sin crear una FAQ.',
      confirmAccept: 'Sí, marcar como válida',
      accepting: 'Validando…',
      cancel: 'Cancelar',
      closeEditor: 'Cerrar edición',
    },
    navigator: {
      title: 'Revisión de respuestas',
      pending: 'Pendientes',
      corrected: 'Corregidas',
      accepted: 'Validadas',
      none: 'No quedan respuestas pendientes de revisión.',
      position: 'Pendiente {current} de {total}',
      previous: 'Respuesta pendiente anterior',
      next: 'Siguiente respuesta pendiente',
      improvement: 'Oportunidad de mejora',
    },
    action: {
      invalid: 'La pregunta y la respuesta deben tener entre 4 y 4.000 caracteres.',
      unavailable: 'La respuesta ya no está disponible.',
      notEligible: 'Solo se pueden revisar respuestas marcadas como oportunidad de mejora.',
      alreadyCreated: 'Esta respuesta ya se convirtió en FAQ.',
      sourceError: 'No se pudo preparar la fuente de FAQs manuales.',
      createError: 'No se pudo crear la FAQ.',
      indexed: 'FAQ creada e indexada. TALIA ya puede recuperarla como conocimiento oficial.',
      pendingIndex: 'FAQ creada, pero queda pendiente de indexación.',
      accepted: 'Respuesta validada. La valoración del visitante se conserva y la revisión queda cerrada.',
      alreadyAccepted: 'Esta respuesta ya había sido validada por el equipo.',
      acceptError: 'No se pudo validar la respuesta.',
    },
  },
  ca: {
    feedback: {
      positive: 'Ha agradat al visitant',
      improvement: 'Oportunitat de millora',
      unrated: 'Sense valorar',
    },
    published: {
      title: 'FAQ creada des d’aquesta conversa',
      indexed: 'La correcció ja està indexada i disponible per a la recuperació de coneixement de TALIA.',
      pending: 'La FAQ està desada i queda pendent de completar-ne la indexació.',
      viewKnowledge: 'Veure a Coneixement',
      acceptedTitle: 'Resposta validada per l’equip',
      acceptedDescription: 'Es conserva la valoració del visitant, però aquesta resposta ja no necessita revisió ni modifica Coneixement.',
    },
    form: {
      title: 'Revisar aquesta resposta de TALIA',
      improvementReason: 'Aquesta resposta està disponible per revisar-la i millorar-la.',
      humanReview: 'Revisió humana',
      questionLabel: 'Pregunta que TALIA ha de reconèixer',
      answerLabel: 'Resposta oficial',
      answerPlaceholder: 'Escriu la resposta correcta que TALIA hauria d’utilitzar...',
      languageRule: 'TALIA utilitzarà aquesta informació en qualsevol idioma i respondrà sempre en l’idioma de l’últim missatge de l’usuari.',
      submit: 'Crear FAQ i ensenyar a TALIA',
      submitting: 'Creant i indexant…',
      disclaimer: 'En confirmar, es crea una FAQ oficial i traçable per a aquest espai. La conversa per si sola no modifica mai Coneixement.',
      editResponse: 'Corregir i ensenyar a TALIA',
      acceptResponse: 'Marcar com a resposta vàlida',
      acceptPrompt: 'Confirmes que la resposta de TALIA és correcta?',
      acceptDescription: 'Es conservarà la valoració original del visitant. Aquesta decisió tancarà la revisió sense crear cap FAQ.',
      confirmAccept: 'Sí, marcar com a vàlida',
      accepting: 'Validant…',
      cancel: 'Cancel·lar',
      closeEditor: 'Tancar l’edició',
    },
    navigator: {
      title: 'Revisió de respostes',
      pending: 'Pendents',
      corrected: 'Corregides',
      accepted: 'Validades',
      none: 'No queden respostes pendents de revisió.',
      position: 'Pendent {current} de {total}',
      previous: 'Resposta pendent anterior',
      next: 'Resposta pendent següent',
      improvement: 'Oportunitat de millora',
    },
    action: {
      invalid: 'La pregunta i la resposta han de tenir entre 4 i 4.000 caràcters.',
      unavailable: 'La resposta ja no està disponible.',
      notEligible: 'Només es poden revisar respostes marcades com a oportunitat de millora.',
      alreadyCreated: 'Aquesta resposta ja s’ha convertit en FAQ.',
      sourceError: 'No s’ha pogut preparar la font de FAQs manuals.',
      createError: 'No s’ha pogut crear la FAQ.',
      indexed: 'FAQ creada i indexada. TALIA ja la pot recuperar com a coneixement oficial.',
      pendingIndex: 'FAQ creada, però queda pendent d’indexació.',
      accepted: 'Resposta validada. Es conserva la valoració del visitant i la revisió queda tancada.',
      alreadyAccepted: 'Aquesta resposta ja havia estat validada per l’equip.',
      acceptError: 'No s’ha pogut validar la resposta.',
    },
  },
  en: {
    feedback: {
      positive: 'The visitor found it helpful',
      improvement: 'Opportunity to improve',
      unrated: 'Not rated',
    },
    published: {
      title: 'FAQ created from this conversation',
      indexed: 'The correction is indexed and available to TALIA’s retrieval.',
      pending: 'The FAQ is saved and waiting for indexing to complete.',
      viewKnowledge: 'View in Knowledge',
      acceptedTitle: 'Response validated by the team',
      acceptedDescription: 'The visitor rating is preserved, but this response no longer needs review and does not change Knowledge.',
    },
    form: {
      title: 'Review this TALIA response',
      improvementReason: 'This response is available for review and improvement.',
      humanReview: 'Human review',
      questionLabel: 'Question TALIA should recognize',
      answerLabel: 'Official answer',
      answerPlaceholder: 'Write the correct answer TALIA should use...',
      languageRule: 'TALIA will use this information in any language and always answer in the language of the user’s latest message.',
      submit: 'Create FAQ and teach TALIA',
      submitting: 'Creating and indexing…',
      disclaimer: 'Confirming creates an official, traceable FAQ for this workspace. The conversation alone never changes Knowledge.',
      editResponse: 'Correct and teach TALIA',
      acceptResponse: 'Mark response as valid',
      acceptPrompt: 'Do you confirm that TALIA’s response is correct?',
      acceptDescription: 'The original visitor rating will be preserved. This closes the review without creating an FAQ.',
      confirmAccept: 'Yes, mark as valid',
      accepting: 'Validating…',
      cancel: 'Cancel',
      closeEditor: 'Close editor',
    },
    navigator: {
      title: 'Response review',
      pending: 'Pending',
      corrected: 'Corrected',
      accepted: 'Validated',
      none: 'There are no responses waiting for review.',
      position: 'Pending {current} of {total}',
      previous: 'Previous pending response',
      next: 'Next pending response',
      improvement: 'Opportunity to improve',
    },
    action: {
      invalid: 'The question and answer must contain between 4 and 4,000 characters.',
      unavailable: 'The response is no longer available.',
      notEligible: 'Only responses marked as an opportunity to improve can be reviewed.',
      alreadyCreated: 'This response has already been converted into an FAQ.',
      sourceError: 'The manual FAQ source could not be prepared.',
      createError: 'The FAQ could not be created.',
      indexed: 'FAQ created and indexed. TALIA can now retrieve it as official knowledge.',
      pendingIndex: 'FAQ created, but it is still waiting to be indexed.',
      accepted: 'Response validated. The visitor rating is preserved and the review is now closed.',
      alreadyAccepted: 'This response had already been validated by the team.',
      acceptError: 'The response could not be validated.',
    },
  },
  ptBR: {
    feedback: {
      positive: 'O visitante considerou a resposta útil',
      improvement: 'Oportunidade de melhoria',
      unrated: 'Sem avaliação',
    },
    published: {
      title: 'FAQ criada a partir desta conversa',
      indexed: 'A correção já foi indexada e está disponível para a recuperação de conhecimento da TALIA.',
      pending: 'A FAQ foi salva e aguarda a conclusão da indexação.',
      viewKnowledge: 'Ver em Conhecimento',
      acceptedTitle: 'Resposta validada pela equipe',
      acceptedDescription: 'A avaliação do visitante é preservada, mas esta resposta não precisa mais de revisão e não altera o Conhecimento.',
    },
    form: {
      title: 'Revisar esta resposta da TALIA',
      improvementReason: 'Esta resposta está disponível para revisão e melhoria.',
      humanReview: 'Revisão humana',
      questionLabel: 'Pergunta que a TALIA deve reconhecer',
      answerLabel: 'Resposta oficial',
      answerPlaceholder: 'Escreva a resposta correta que a TALIA deve utilizar...',
      languageRule: 'A TALIA usará estas informações em qualquer idioma e sempre responderá no idioma da última mensagem do usuário.',
      submit: 'Criar FAQ e ensinar a TALIA',
      submitting: 'Criando e indexando…',
      disclaimer: 'Ao confirmar, uma FAQ oficial e rastreável será criada para este espaço. A conversa, por si só, nunca altera o Conhecimento.',
      editResponse: 'Corrigir e ensinar à TALIA',
      acceptResponse: 'Marcar resposta como válida',
      acceptPrompt: 'Você confirma que a resposta da TALIA está correta?',
      acceptDescription: 'A avaliação original do visitante será preservada. Esta decisão encerrará a revisão sem criar uma FAQ.',
      confirmAccept: 'Sim, marcar como válida',
      accepting: 'Validando…',
      cancel: 'Cancelar',
      closeEditor: 'Fechar edição',
    },
    navigator: {
      title: 'Revisão de respostas',
      pending: 'Pendentes',
      corrected: 'Corrigidas',
      accepted: 'Validadas',
      none: 'Não há respostas pendentes de revisão.',
      position: 'Pendente {current} de {total}',
      previous: 'Resposta pendente anterior',
      next: 'Próxima resposta pendente',
      improvement: 'Oportunidade de melhoria',
    },
    action: {
      invalid: 'A pergunta e a resposta devem ter entre 4 e 4.000 caracteres.',
      unavailable: 'A resposta não está mais disponível.',
      notEligible: 'Somente respostas marcadas como oportunidade de melhoria podem ser revisadas.',
      alreadyCreated: 'Esta resposta já foi convertida em FAQ.',
      sourceError: 'Não foi possível preparar a fonte de FAQs manuais.',
      createError: 'Não foi possível criar a FAQ.',
      indexed: 'FAQ criada e indexada. A TALIA já pode recuperá-la como conhecimento oficial.',
      pendingIndex: 'FAQ criada, mas ainda aguarda indexação.',
      accepted: 'Resposta validada. A avaliação do visitante é preservada e a revisão foi encerrada.',
      alreadyAccepted: 'Esta resposta já havia sido validada pela equipe.',
      acceptError: 'Não foi possível validar a resposta.',
    },
  },
} satisfies Record<'es' | 'ca' | 'en' | 'ptBR', SupervisedFaqCopy>

export function getSupervisedFaqCopy(locale: string): SupervisedFaqCopy {
  const normalized = locale.trim().toLowerCase()
  if (normalized === 'ca') return SUPERVISED_FAQ_COPY.ca
  if (normalized === 'en') return SUPERVISED_FAQ_COPY.en
  if (normalized === 'pt' || normalized === 'pt-br' || normalized === 'pt_br') {
    return SUPERVISED_FAQ_COPY.ptBR
  }
  return SUPERVISED_FAQ_COPY.es
}
