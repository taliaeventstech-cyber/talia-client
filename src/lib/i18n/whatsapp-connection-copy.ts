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
  disconnected: string
  phone: string
  name: string
  expires: string
  connect: string
  replace: string
  connecting: string
  success: string
  cancelled: string
  sdkError: string
  setupMissing: string
  providerError: string
  permissions: string
}

const copies: Record<'es' | 'ca' | 'en' | 'pt', WhatsappConnectionCopy> = {
  es: {
    nav: 'Configuración', eyebrow: 'Agente de WhatsApp', title: 'Conexión con Meta',
    description: 'Vincula el número de WhatsApp Business de este espacio. TALIA solo podrá acceder a los activos que autorices durante el proceso.',
    status: 'Estado', connected: 'Conectado', pilot: 'Piloto', pending: 'Pendiente', error: 'Requiere atención',
    disconnected: 'Sin conectar', phone: 'Número', name: 'Nombre verificado', expires: 'Renovación de credencial',
    connect: 'Conectar WhatsApp', replace: 'Conectar un WABA administrado', connecting: 'Conectando…',
    success: 'WhatsApp se ha conectado correctamente.', cancelled: 'Has cancelado la conexión.',
    sdkError: 'No se ha podido abrir Meta. Inténtalo de nuevo.', setupMissing: 'Falta completar la configuración de Meta en este entorno.',
    providerError: 'Meta no ha podido completar la conexión. Revisa la cuenta e inténtalo de nuevo.',
    permissions: 'Solo propietarios y administradores pueden cambiar esta conexión.',
  },
  ca: {
    nav: 'Configuració', eyebrow: 'Agent de WhatsApp', title: 'Connexió amb Meta',
    description: 'Vincula el número de WhatsApp Business d’aquest espai. TALIA només podrà accedir als actius que autoritzis durant el procés.',
    status: 'Estat', connected: 'Connectat', pilot: 'Pilot', pending: 'Pendent', error: 'Requereix atenció',
    disconnected: 'Sense connectar', phone: 'Número', name: 'Nom verificat', expires: 'Renovació de credencial',
    connect: 'Connectar WhatsApp', replace: 'Connectar un WABA administrat', connecting: 'Connectant…',
    success: 'WhatsApp s’ha connectat correctament.', cancelled: 'Has cancel·lat la connexió.',
    sdkError: 'No s’ha pogut obrir Meta. Torna-ho a provar.', setupMissing: 'Falta completar la configuració de Meta en aquest entorn.',
    providerError: 'Meta no ha pogut completar la connexió. Revisa el compte i torna-ho a provar.',
    permissions: 'Només propietaris i administradors poden canviar aquesta connexió.',
  },
  en: {
    nav: 'Settings', eyebrow: 'WhatsApp agent', title: 'Meta connection',
    description: 'Link this venue’s WhatsApp Business number. TALIA can only access the assets you authorize during setup.',
    status: 'Status', connected: 'Connected', pilot: 'Pilot', pending: 'Pending', error: 'Needs attention',
    disconnected: 'Not connected', phone: 'Number', name: 'Verified name', expires: 'Credential renewal',
    connect: 'Connect WhatsApp', replace: 'Connect a managed WABA', connecting: 'Connecting…',
    success: 'WhatsApp was connected successfully.', cancelled: 'You cancelled the connection.',
    sdkError: 'Meta could not be opened. Try again.', setupMissing: 'Meta configuration is incomplete in this environment.',
    providerError: 'Meta could not complete the connection. Review the account and try again.',
    permissions: 'Only owners and administrators can change this connection.',
  },
  pt: {
    nav: 'Configurações', eyebrow: 'Agente de WhatsApp', title: 'Conexão com a Meta',
    description: 'Vincule o número do WhatsApp Business deste espaço. A TALIA só poderá acessar os ativos autorizados durante o processo.',
    status: 'Status', connected: 'Conectado', pilot: 'Piloto', pending: 'Pendente', error: 'Requer atenção',
    disconnected: 'Não conectado', phone: 'Número', name: 'Nome verificado', expires: 'Renovação da credencial',
    connect: 'Conectar WhatsApp', replace: 'Conectar uma WABA gerenciada', connecting: 'Conectando…',
    success: 'O WhatsApp foi conectado com sucesso.', cancelled: 'Você cancelou a conexão.',
    sdkError: 'Não foi possível abrir a Meta. Tente novamente.', setupMissing: 'Falta concluir a configuração da Meta neste ambiente.',
    providerError: 'A Meta não conseguiu concluir a conexão. Revise a conta e tente novamente.',
    permissions: 'Somente proprietários e administradores podem alterar esta conexão.',
  },
}

export function getWhatsappConnectionCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0]
  return copies[language === 'ca' || language === 'en' || language === 'pt' ? language : 'es']
}
