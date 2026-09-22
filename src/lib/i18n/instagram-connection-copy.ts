export type InstagramConnectionCopy = {
  eyebrow: string
  title: string
  description: string
  status: string
  connected: string
  disconnected: string
  error: string
  revoked: string
  disabled: string
  connectedDescription: string
  disconnectedDescription: string
  errorDescription: string
  revokedDescription: string
  disabledDescription: string
  account: string
  accountType: string
  expires: string
  connect: string
  replace: string
  pilotNotice: string
  permissions: string
  connectedNotice: string
  failedNotice: string
  subscriptionFailedNotice: string
}

const copies: Record<'es' | 'ca' | 'en' | 'pt', InstagramConnectionCopy> = {
  es: {
    eyebrow: 'Agente de Instagram', title: 'Configura Instagram',
    description: 'Vincula la cuenta profesional de Instagram de este espacio para la prueba de mensajes directos.',
    status: 'Estado', connected: 'Conectado', disconnected: 'Sin conectar', error: 'Requiere atención', revoked: 'Acceso revocado', disabled: 'Desactivado',
    connectedDescription: 'La cuenta está vinculada. El piloto de mensajes permanece desactivado hasta completar la validación operativa.',
    disconnectedDescription: 'Conecta una cuenta profesional de Instagram para preparar el piloto de mensajes directos.',
    errorDescription: 'No se ha podido completar la conexión. Revisa la autorización de Instagram y vuelve a intentarlo.',
    revokedDescription: 'Instagram ha revocado el acceso. Autoriza la cuenta de nuevo para continuar.',
    disabledDescription: 'Esta conexión está desactivada. Vuelve a autorizar la cuenta para restaurarla.',
    account: 'Cuenta', accountType: 'Tipo de cuenta', expires: 'Renovación de credencial',
    connect: 'Conectar cuenta de Instagram', replace: 'Volver a conectar la cuenta',
    pilotNotice: 'Esta conexión no activa todavía respuestas ni procesamiento de mensajes.',
    permissions: 'Solo propietarios y administradores del espacio pueden gestionar esta conexión.',
    connectedNotice: 'Instagram se ha conectado correctamente.', failedNotice: 'No se ha podido completar la conexión con Instagram.',
    subscriptionFailedNotice: 'La cuenta se autorizó, pero Instagram rechazó la activación de mensajes. Revisa el rol de tester y vuelve a intentarlo.',
  },
  ca: {
    eyebrow: 'Agent d’Instagram', title: 'Configura Instagram',
    description: 'Vincula el compte professional d’Instagram d’aquest espai per a la prova de missatges directes.',
    status: 'Estat', connected: 'Connectat', disconnected: 'Sense connectar', error: 'Requereix atenció', revoked: 'Accés revocat', disabled: 'Desactivat',
    connectedDescription: 'El compte està vinculat. El pilot de missatges continua desactivat fins a completar la validació operativa.',
    disconnectedDescription: 'Connecta un compte professional d’Instagram per preparar el pilot de missatges directes.',
    errorDescription: 'No s’ha pogut completar la connexió. Revisa l’autorització d’Instagram i torna-ho a provar.',
    revokedDescription: 'Instagram ha revocat l’accés. Torna a autoritzar el compte per continuar.',
    disabledDescription: 'Aquesta connexió està desactivada. Torna a autoritzar el compte per restaurar-la.',
    account: 'Compte', accountType: 'Tipus de compte', expires: 'Renovació de credencial',
    connect: 'Connectar compte d’Instagram', replace: 'Tornar a connectar el compte',
    pilotNotice: 'Aquesta connexió encara no activa respostes ni processament de missatges.',
    permissions: 'Només els propietaris i administradors de l’espai poden gestionar aquesta connexió.',
    connectedNotice: 'Instagram s’ha connectat correctament.', failedNotice: 'No s’ha pogut completar la connexió amb Instagram.',
    subscriptionFailedNotice: 'El compte s’ha autoritzat, però Instagram ha rebutjat l’activació dels missatges. Revisa el rol de tester i torna-ho a provar.',
  },
  en: {
    eyebrow: 'Instagram agent', title: 'Set up Instagram',
    description: 'Link this venue’s professional Instagram account for the direct-message pilot.',
    status: 'Status', connected: 'Connected', disconnected: 'Not connected', error: 'Needs attention', revoked: 'Access revoked', disabled: 'Disabled',
    connectedDescription: 'The account is linked. The messaging pilot remains disabled until operational validation is complete.',
    disconnectedDescription: 'Connect a professional Instagram account to prepare the direct-message pilot.',
    errorDescription: 'The connection could not be completed. Review the Instagram authorization and try again.',
    revokedDescription: 'Instagram revoked access. Authorize the account again to continue.',
    disabledDescription: 'This connection is disabled. Authorize the account again to restore it.',
    account: 'Account', accountType: 'Account type', expires: 'Credential renewal',
    connect: 'Connect Instagram account', replace: 'Reconnect account',
    pilotNotice: 'This connection does not yet enable replies or message processing.',
    permissions: 'Only venue owners and administrators can manage this connection.',
    connectedNotice: 'Instagram connected successfully.', failedNotice: 'Instagram could not complete the connection.',
    subscriptionFailedNotice: 'The account was authorized, but Instagram rejected message activation. Check the tester role and try again.',
  },
  pt: {
    eyebrow: 'Agente do Instagram', title: 'Configure o Instagram',
    description: 'Vincule a conta profissional do Instagram deste espaço para o piloto de mensagens diretas.',
    status: 'Status', connected: 'Conectado', disconnected: 'Não conectado', error: 'Requer atenção', revoked: 'Acesso revogado', disabled: 'Desativado',
    connectedDescription: 'A conta está vinculada. O piloto de mensagens permanece desativado até a validação operacional ser concluída.',
    disconnectedDescription: 'Conecte uma conta profissional do Instagram para preparar o piloto de mensagens diretas.',
    errorDescription: 'Não foi possível concluir a conexão. Revise a autorização do Instagram e tente novamente.',
    revokedDescription: 'O Instagram revogou o acesso. Autorize a conta novamente para continuar.',
    disabledDescription: 'Esta conexão está desativada. Autorize a conta novamente para restaurá-la.',
    account: 'Conta', accountType: 'Tipo de conta', expires: 'Renovação da credencial',
    connect: 'Conectar conta do Instagram', replace: 'Reconectar conta',
    pilotNotice: 'Esta conexão ainda não habilita respostas nem processamento de mensagens.',
    permissions: 'Somente proprietários e administradores do espaço podem gerenciar esta conexão.',
    connectedNotice: 'Instagram conectado com sucesso.', failedNotice: 'Não foi possível concluir a conexão com o Instagram.',
    subscriptionFailedNotice: 'A conta foi autorizada, mas o Instagram rejeitou a ativação das mensagens. Verifique a função de testador e tente novamente.',
  },
}

export function getInstagramConnectionCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0]
  return copies[language === 'ca' || language === 'en' || language === 'pt' ? language : 'es']
}
