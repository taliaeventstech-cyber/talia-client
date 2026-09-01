export type WhatsappConnectionCopy = {
  nav: string
  eyebrow: string
  title: string
  description: string
  status: string
  connected: string
  pilot: string
  pending: string
  error: string
  revoked: string
  disabled: string
  disconnected: string
  connectedDescription: string
  pilotDescription: string
  pendingDescription: string
  errorDescription: string
  revokedDescription: string
  disabledDescription: string
  disconnectedDescription: string
  phone: string
  name: string
  expires: string
  connect: string
  replace: string
  retry: string
  connecting: string
  connectingDescription: string
  success: string
  cancelled: string
  sdkError: string
  setupMissing: string
  providerError: string
  disconnect: string
  disconnectConfirmation: string
  confirmDisconnect: string
  cancelDisconnect: string
  disconnecting: string
  disconnectError: string
  disconnectProviderWarning: string
  permissions: string
}

const copies: Record<'es' | 'ca' | 'en' | 'pt', WhatsappConnectionCopy> = {
  es: {
    nav: 'Configuración', eyebrow: 'Agente de WhatsApp', title: 'Configura WhatsApp',
    description: 'Vincula el número de WhatsApp Business que utiliza este espacio para atender a su público. Durante el proceso podrás elegir qué cuenta de Meta autorizas.',
    status: 'Estado', connected: 'Conectado', pilot: 'Conexión de prueba', pending: 'Pendiente', error: 'Requiere atención',
    revoked: 'Acceso revocado', disabled: 'Desactivado', disconnected: 'Sin conectar',
    connectedDescription: 'El número está listo para recibir y responder mensajes desde TALIA.',
    pilotDescription: 'TALIA está utilizando la conexión de prueba. Conecta el WhatsApp del espacio para completar la configuración.',
    pendingDescription: 'La configuración todavía no ha terminado. Puedes retomarla para completar la conexión.',
    errorDescription: 'No se ha podido completar la conexión. Revisa tu cuenta de Meta y vuelve a intentarlo.',
    revokedDescription: 'Meta ha revocado el acceso a esta conexión. Vuelve a autorizar el número para seguir utilizándolo.',
    disabledDescription: 'Esta conexión está desactivada. Vuelve a conectarla para utilizar el agente de WhatsApp.',
    disconnectedDescription: 'Conecta el número de WhatsApp Business que utilizará TALIA para atender al público.',
    phone: 'Número', name: 'Nombre verificado', expires: 'Renovación de credencial',
    connect: 'Conectar número de WhatsApp', replace: 'Conectar el WhatsApp de este espacio', retry: 'Reintentar conexión', connecting: 'Conectando…',
    connectingDescription: 'Mantén abierta la ventana de Meta mientras terminamos de configurar la conexión.',
    success: 'WhatsApp se ha conectado correctamente.', cancelled: 'Has cancelado la conexión.',
    sdkError: 'No se ha podido abrir Meta. Inténtalo de nuevo.', setupMissing: 'Falta completar la configuración de Meta en este entorno.',
    providerError: 'Meta no ha podido completar la conexión. Revisa la cuenta e inténtalo de nuevo.',
    disconnect: 'Desconectar WhatsApp',
    disconnectConfirmation: 'TALIA dejará de recibir y responder mensajes de este número. El historial de conversaciones se conservará.',
    confirmDisconnect: 'Sí, desconectar', cancelDisconnect: 'Cancelar', disconnecting: 'Desconectando…',
    disconnectError: 'No se ha podido desconectar WhatsApp. Inténtalo de nuevo.',
    disconnectProviderWarning: 'WhatsApp se ha desconectado de TALIA, pero Meta no ha confirmado la baja del webhook.',
    permissions: 'Solo propietarios y administradores del espacio pueden gestionar esta conexión.',
  },
  ca: {
    nav: 'Configuració', eyebrow: 'Agent de WhatsApp', title: 'Configura WhatsApp',
    description: 'Vincula el número de WhatsApp Business que utilitza aquest espai per atendre el seu públic. Durant el procés podràs triar quin compte de Meta autoritzes.',
    status: 'Estat', connected: 'Connectat', pilot: 'Connexió de prova', pending: 'Pendent', error: 'Requereix atenció',
    revoked: 'Accés revocat', disabled: 'Desactivat', disconnected: 'Sense connectar',
    connectedDescription: 'El número està preparat per rebre i respondre missatges des de TALIA.',
    pilotDescription: 'TALIA està utilitzant la connexió de prova. Connecta el WhatsApp de l’espai per completar la configuració.',
    pendingDescription: 'La configuració encara no ha acabat. Pots reprendre-la per completar la connexió.',
    errorDescription: 'No s’ha pogut completar la connexió. Revisa el teu compte de Meta i torna-ho a provar.',
    revokedDescription: 'Meta ha revocat l’accés a aquesta connexió. Torna a autoritzar el número per continuar utilitzant-lo.',
    disabledDescription: 'Aquesta connexió està desactivada. Torna a connectar-la per utilitzar l’agent de WhatsApp.',
    disconnectedDescription: 'Connecta el número de WhatsApp Business que TALIA utilitzarà per atendre el públic.',
    phone: 'Número', name: 'Nom verificat', expires: 'Renovació de credencial',
    connect: 'Connectar número de WhatsApp', replace: 'Connectar el WhatsApp d’aquest espai', retry: 'Tornar a provar la connexió', connecting: 'Connectant…',
    connectingDescription: 'Mantén oberta la finestra de Meta mentre acabem de configurar la connexió.',
    success: 'WhatsApp s’ha connectat correctament.', cancelled: 'Has cancel·lat la connexió.',
    sdkError: 'No s’ha pogut obrir Meta. Torna-ho a provar.', setupMissing: 'Falta completar la configuració de Meta en aquest entorn.',
    providerError: 'Meta no ha pogut completar la connexió. Revisa el compte i torna-ho a provar.',
    disconnect: 'Desconnectar WhatsApp',
    disconnectConfirmation: 'TALIA deixarà de rebre i respondre missatges d’aquest número. L’historial de converses es conservarà.',
    confirmDisconnect: 'Sí, desconnectar', cancelDisconnect: 'Cancel·lar', disconnecting: 'Desconnectant…',
    disconnectError: 'No s’ha pogut desconnectar WhatsApp. Torna-ho a provar.',
    disconnectProviderWarning: 'WhatsApp s’ha desconnectat de TALIA, però Meta no ha confirmat la baixa del webhook.',
    permissions: 'Només els propietaris i administradors de l’espai poden gestionar aquesta connexió.',
  },
  en: {
    nav: 'Settings', eyebrow: 'WhatsApp agent', title: 'Set up WhatsApp',
    description: 'Link the WhatsApp Business number this venue uses to assist its audience. During setup, you can choose which Meta account to authorize.',
    status: 'Status', connected: 'Connected', pilot: 'Test connection', pending: 'Pending', error: 'Needs attention',
    revoked: 'Access revoked', disabled: 'Disabled', disconnected: 'Not connected',
    connectedDescription: 'The number is ready to receive and reply to messages through TALIA.',
    pilotDescription: 'TALIA is using the test connection. Connect the venue’s WhatsApp to complete setup.',
    pendingDescription: 'Setup has not finished yet. Resume it to complete the connection.',
    errorDescription: 'The connection could not be completed. Review your Meta account and try again.',
    revokedDescription: 'Meta revoked access to this connection. Authorize the number again to continue using it.',
    disabledDescription: 'This connection is disabled. Connect it again to use the WhatsApp agent.',
    disconnectedDescription: 'Connect the WhatsApp Business number TALIA will use to assist the audience.',
    phone: 'Number', name: 'Verified name', expires: 'Credential renewal',
    connect: 'Connect WhatsApp number', replace: 'Connect this venue’s WhatsApp', retry: 'Retry connection', connecting: 'Connecting…',
    connectingDescription: 'Keep the Meta window open while we finish setting up the connection.',
    success: 'WhatsApp was connected successfully.', cancelled: 'You cancelled the connection.',
    sdkError: 'Meta could not be opened. Try again.', setupMissing: 'Meta configuration is incomplete in this environment.',
    providerError: 'Meta could not complete the connection. Review the account and try again.',
    disconnect: 'Disconnect WhatsApp',
    disconnectConfirmation: 'TALIA will stop receiving and replying to messages from this number. Conversation history will be preserved.',
    confirmDisconnect: 'Yes, disconnect', cancelDisconnect: 'Cancel', disconnecting: 'Disconnecting…',
    disconnectError: 'WhatsApp could not be disconnected. Try again.',
    disconnectProviderWarning: 'WhatsApp was disconnected from TALIA, but Meta did not confirm webhook removal.',
    permissions: 'Only venue owners and administrators can manage this connection.',
  },
  pt: {
    nav: 'Configurações', eyebrow: 'Agente de WhatsApp', title: 'Configure o WhatsApp',
    description: 'Vincule o número do WhatsApp Business que este espaço usa para atender seu público. Durante o processo, você poderá escolher qual conta da Meta autorizar.',
    status: 'Status', connected: 'Conectado', pilot: 'Conexão de teste', pending: 'Pendente', error: 'Requer atenção',
    revoked: 'Acesso revogado', disabled: 'Desativado', disconnected: 'Não conectado',
    connectedDescription: 'O número está pronto para receber e responder mensagens pela TALIA.',
    pilotDescription: 'A TALIA está usando a conexão de teste. Conecte o WhatsApp do espaço para concluir a configuração.',
    pendingDescription: 'A configuração ainda não foi concluída. Retome o processo para finalizar a conexão.',
    errorDescription: 'Não foi possível concluir a conexão. Revise sua conta da Meta e tente novamente.',
    revokedDescription: 'A Meta revogou o acesso a esta conexão. Autorize o número novamente para continuar usando-o.',
    disabledDescription: 'Esta conexão está desativada. Conecte-a novamente para usar o agente de WhatsApp.',
    disconnectedDescription: 'Conecte o número do WhatsApp Business que a TALIA usará para atender o público.',
    phone: 'Número', name: 'Nome verificado', expires: 'Renovação da credencial',
    connect: 'Conectar número do WhatsApp', replace: 'Conectar o WhatsApp deste espaço', retry: 'Tentar conexão novamente', connecting: 'Conectando…',
    connectingDescription: 'Mantenha a janela da Meta aberta enquanto concluímos a configuração da conexão.',
    success: 'O WhatsApp foi conectado com sucesso.', cancelled: 'Você cancelou a conexão.',
    sdkError: 'Não foi possível abrir a Meta. Tente novamente.', setupMissing: 'Falta concluir a configuração da Meta neste ambiente.',
    providerError: 'A Meta não conseguiu concluir a conexão. Revise a conta e tente novamente.',
    disconnect: 'Desconectar WhatsApp',
    disconnectConfirmation: 'A TALIA deixará de receber e responder mensagens deste número. O histórico de conversas será mantido.',
    confirmDisconnect: 'Sim, desconectar', cancelDisconnect: 'Cancelar', disconnecting: 'Desconectando…',
    disconnectError: 'Não foi possível desconectar o WhatsApp. Tente novamente.',
    disconnectProviderWarning: 'O WhatsApp foi desconectado da TALIA, mas a Meta não confirmou a remoção do webhook.',
    permissions: 'Somente proprietários e administradores do espaço podem gerenciar esta conexão.',
  },
}

export function getWhatsappConnectionCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0]
  return copies[language === 'ca' || language === 'en' || language === 'pt' ? language : 'es']
}
