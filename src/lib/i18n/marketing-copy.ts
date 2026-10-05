export type MarketingCopy = {
  eyebrow: string
  title: string
  description: string
  status: string
  connected: string
  disconnected: string
  error: string
  revoked: string
  disabled: string
  rolloutReady: string
  rolloutPaused: string
  business: string
  adAccount: string
  currency: string
  permissions: string
  nextStep: string
  nextStepDescription: string
  guardrail: string
  requirements: string
  adsRead: string
  adsManagement: string
  businessManagement: string
  review: string
  connectMeta: string
  reconnectMeta: string
  connectedNotice: string
  oauthConfigError: string
  oauthSessionError: string
  oauthFailed: string
  selectAssetsTitle: string
  selectAssetsDescription: string
  noAdAccounts: string
  connecting: string
  confirmAssets: string
  sessionExpired: string
  assetUnavailable: string
  providerUnavailable: string
  connectionFailed: string
  noBusinessesTitle: string
  noBusinessesDescription: string
  backToMarketing: string
  providerUnavailableTitle: string
}

const copies: Record<'es' | 'ca' | 'en' | 'pt', MarketingCopy> = {
  es: {
    eyebrow: 'Marketing · Meta Ads',
    title: 'Marketing en Meta',
    description: 'Consulta campañas e Insights y prepara anuncios para revisión sin activar gasto desde TALIA.',
    status: 'Conexión de Meta',
    connected: 'Conectada',
    disconnected: 'Sin conectar',
    error: 'Requiere atención',
    revoked: 'Acceso revocado',
    disabled: 'Desactivada',
    rolloutReady: 'Piloto habilitado',
    rolloutPaused: 'Piloto pausado',
    business: 'Business Portfolio',
    adAccount: 'Cuenta publicitaria',
    currency: 'Moneda',
    permissions: 'Permisos autorizados',
    nextStep: 'Siguiente corte del MVP',
    nextStepDescription: 'Añadir el flujo OAuth de Meta y la selección supervisada de Business Portfolio y cuenta publicitaria.',
    guardrail: 'Toda campaña creada por TALIA nacerá en estado PAUSED. Este módulo no activará gasto automáticamente.',
    requirements: 'Accesos técnicos previstos',
    adsRead: 'ads_read para campañas, Insights y reporting.',
    adsManagement: 'ads_management para preparar campañas pausadas.',
    businessManagement: 'business_management para listar el Business Portfolio y sus cuentas publicitarias.',
    review: 'App Review, acceso avanzado y Business Verification antes del piloto con clientes.',
    connectMeta: 'Conectar con Meta',
    reconnectMeta: 'Cambiar conexión de Meta',
    connectedNotice: 'Meta se ha conectado correctamente. La cuenta queda preparada para el piloto, sin activar gasto.',
    oauthConfigError: 'No se puede iniciar la conexión porque falta configurar la app de Meta.',
    oauthSessionError: 'La sesión de conexión ha caducado. Inicia el proceso de nuevo.',
    oauthFailed: 'Meta no ha podido completar la conexión. Inténtalo de nuevo.',
    selectAssetsTitle: 'Elige qué cuenta analizar',
    selectAssetsDescription: 'Selecciona el Business Portfolio y la cuenta publicitaria que TALIA usará para leer campañas e Insights.',
    noAdAccounts: 'Este Business Portfolio no tiene cuentas publicitarias disponibles para tu usuario.',
    connecting: 'Guardando conexión…',
    confirmAssets: 'Confirmar cuenta publicitaria',
    sessionExpired: 'La sesión ha caducado. Vuelve a iniciar la conexión desde Marketing.',
    assetUnavailable: 'La cuenta seleccionada ya no está disponible para tu usuario de Meta.',
    providerUnavailable: 'No hemos podido consultar Meta en este momento. Vuelve a intentarlo desde Marketing.',
    connectionFailed: 'No hemos podido guardar la conexión. Inténtalo de nuevo.',
    noBusinessesTitle: 'No hay cuentas disponibles',
    noBusinessesDescription: 'Tu usuario de Meta no tiene acceso a ningún Business Portfolio. Revisa sus permisos en Meta Business Suite.',
    backToMarketing: 'Volver a Marketing',
    providerUnavailableTitle: 'Meta no está disponible',
  },
  ca: {
    eyebrow: 'Màrqueting · Meta Ads',
    title: 'Màrqueting a Meta',
    description: 'Consulta campanyes i Insights i prepara anuncis per revisar-los sense activar despesa des de TALIA.',
    status: 'Connexió de Meta',
    connected: 'Connectada',
    disconnected: 'Sense connectar',
    error: 'Requereix atenció',
    revoked: 'Accés revocat',
    disabled: 'Desactivada',
    rolloutReady: 'Pilot habilitat',
    rolloutPaused: 'Pilot pausat',
    business: 'Business Portfolio',
    adAccount: 'Compte publicitari',
    currency: 'Moneda',
    permissions: 'Permisos autoritzats',
    nextStep: 'Següent tall de l’MVP',
    nextStepDescription: 'Afegir el flux OAuth de Meta i la selecció supervisada de Business Portfolio i compte publicitari.',
    guardrail: 'Tota campanya creada per TALIA naixerà en estat PAUSED. Aquest mòdul no activarà despesa automàticament.',
    requirements: 'Accessos tècnics previstos',
    adsRead: 'ads_read per a campanyes, Insights i reporting.',
    adsManagement: 'ads_management per preparar campanyes pausades.',
    businessManagement: 'business_management per llistar el Business Portfolio i els seus comptes publicitaris.',
    review: 'App Review, accés avançat i Business Verification abans del pilot amb clients.',
    connectMeta: 'Connectar amb Meta',
    reconnectMeta: 'Canviar connexió de Meta',
    connectedNotice: 'Meta s’ha connectat correctament. El compte queda preparat per al pilot, sense activar despesa.',
    oauthConfigError: 'No es pot iniciar la connexió perquè falta configurar l’app de Meta.',
    oauthSessionError: 'La sessió de connexió ha caducat. Inicia el procés de nou.',
    oauthFailed: 'Meta no ha pogut completar la connexió. Torna-ho a provar.',
    selectAssetsTitle: 'Tria quin compte analitzar',
    selectAssetsDescription: 'Selecciona el Business Portfolio i el compte publicitari que TALIA utilitzarà per llegir campanyes i Insights.',
    noAdAccounts: 'Aquest Business Portfolio no té comptes publicitaris disponibles per al teu usuari.',
    connecting: 'Desant connexió…',
    confirmAssets: 'Confirmar compte publicitari',
    sessionExpired: 'La sessió ha caducat. Torna a iniciar la connexió des de Màrqueting.',
    assetUnavailable: 'El compte seleccionat ja no està disponible per al teu usuari de Meta.',
    providerUnavailable: 'No hem pogut consultar Meta en aquest moment. Torna-ho a provar des de Màrqueting.',
    connectionFailed: 'No hem pogut desar la connexió. Torna-ho a provar.',
    noBusinessesTitle: 'No hi ha comptes disponibles',
    noBusinessesDescription: 'El teu usuari de Meta no té accés a cap Business Portfolio. Revisa els permisos a Meta Business Suite.',
    backToMarketing: 'Tornar a Màrqueting',
    providerUnavailableTitle: 'Meta no està disponible',
  },
  en: {
    eyebrow: 'Marketing · Meta Ads',
    title: 'Meta marketing',
    description: 'Review campaigns and Insights and prepare ads for approval without starting spend from TALIA.',
    status: 'Meta connection',
    connected: 'Connected',
    disconnected: 'Not connected',
    error: 'Needs attention',
    revoked: 'Access revoked',
    disabled: 'Disabled',
    rolloutReady: 'Pilot enabled',
    rolloutPaused: 'Pilot paused',
    business: 'Business Portfolio',
    adAccount: 'Ad account',
    currency: 'Currency',
    permissions: 'Authorized permissions',
    nextStep: 'Next MVP slice',
    nextStepDescription: 'Add Meta OAuth and supervised Business Portfolio and ad-account selection.',
    guardrail: 'Every campaign created by TALIA will start in PAUSED. This module will not activate spend automatically.',
    requirements: 'Planned technical access',
    adsRead: 'ads_read for campaigns, Insights, and reporting.',
    adsManagement: 'ads_management to prepare paused campaigns.',
    businessManagement: 'business_management to list the Business Portfolio and its ad accounts.',
    review: 'App Review, advanced access, and Business Verification before the customer pilot.',
    connectMeta: 'Connect Meta',
    reconnectMeta: 'Change Meta connection',
    connectedNotice: 'Meta is connected. The ad account is ready for the pilot without enabling spend.',
    oauthConfigError: 'The connection cannot start because the Meta app is not configured.',
    oauthSessionError: 'The connection session has expired. Start the process again.',
    oauthFailed: 'Meta could not complete the connection. Please try again.',
    selectAssetsTitle: 'Choose the account to analyze',
    selectAssetsDescription: 'Select the Business Portfolio and ad account TALIA will use to read campaigns and Insights.',
    noAdAccounts: 'This Business Portfolio has no ad accounts available to your user.',
    connecting: 'Saving connection…',
    confirmAssets: 'Confirm ad account',
    sessionExpired: 'The session has expired. Start the connection again from Marketing.',
    assetUnavailable: 'The selected account is no longer available to your Meta user.',
    providerUnavailable: 'We could not reach Meta right now. Please try again from Marketing.',
    connectionFailed: 'We could not save the connection. Please try again.',
    noBusinessesTitle: 'No accounts available',
    noBusinessesDescription: 'Your Meta user does not have access to a Business Portfolio. Review its permissions in Meta Business Suite.',
    backToMarketing: 'Back to Marketing',
    providerUnavailableTitle: 'Meta is unavailable',
  },
  pt: {
    eyebrow: 'Marketing · Meta Ads',
    title: 'Marketing na Meta',
    description: 'Consulte campanhas e Insights e prepare anúncios para revisão sem ativar gastos pela TALIA.',
    status: 'Conexão da Meta',
    connected: 'Conectada',
    disconnected: 'Não conectada',
    error: 'Requer atenção',
    revoked: 'Acesso revogado',
    disabled: 'Desativada',
    rolloutReady: 'Piloto habilitado',
    rolloutPaused: 'Piloto pausado',
    business: 'Business Portfolio',
    adAccount: 'Conta de anúncios',
    currency: 'Moeda',
    permissions: 'Permissões autorizadas',
    nextStep: 'Próxima etapa do MVP',
    nextStepDescription: 'Adicionar o OAuth da Meta e a seleção supervisionada do Business Portfolio e da conta de anúncios.',
    guardrail: 'Toda campanha criada pela TALIA começará em PAUSED. Este módulo não ativará gastos automaticamente.',
    requirements: 'Acessos técnicos previstos',
    adsRead: 'ads_read para campanhas, Insights e relatórios.',
    adsManagement: 'ads_management para preparar campanhas pausadas.',
    businessManagement: 'business_management para listar o Business Portfolio e suas contas de anúncios.',
    review: 'App Review, acesso avançado e Business Verification antes do piloto com clientes.',
    connectMeta: 'Conectar à Meta',
    reconnectMeta: 'Alterar conexão da Meta',
    connectedNotice: 'A Meta foi conectada. A conta está preparada para o piloto, sem ativar gastos.',
    oauthConfigError: 'Não é possível iniciar a conexão porque o app da Meta não está configurado.',
    oauthSessionError: 'A sessão de conexão expirou. Inicie o processo novamente.',
    oauthFailed: 'A Meta não conseguiu concluir a conexão. Tente novamente.',
    selectAssetsTitle: 'Escolha a conta para analisar',
    selectAssetsDescription: 'Selecione o Business Portfolio e a conta de anúncios que a TALIA usará para ler campanhas e Insights.',
    noAdAccounts: 'Este Business Portfolio não tem contas de anúncios disponíveis para o seu usuário.',
    connecting: 'Salvando conexão…',
    confirmAssets: 'Confirmar conta de anúncios',
    sessionExpired: 'A sessão expirou. Inicie a conexão novamente em Marketing.',
    assetUnavailable: 'A conta selecionada não está mais disponível para o seu usuário da Meta.',
    providerUnavailable: 'Não foi possível consultar a Meta agora. Tente novamente em Marketing.',
    connectionFailed: 'Não foi possível salvar a conexão. Tente novamente.',
    noBusinessesTitle: 'Não há contas disponíveis',
    noBusinessesDescription: 'Seu usuário da Meta não tem acesso a nenhum Business Portfolio. Revise as permissões no Meta Business Suite.',
    backToMarketing: 'Voltar para Marketing',
    providerUnavailableTitle: 'A Meta não está disponível',
  },
}

export function getMarketingCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0]
  return copies[language === 'ca' || language === 'en' || language === 'pt' ? language : 'es']
}
