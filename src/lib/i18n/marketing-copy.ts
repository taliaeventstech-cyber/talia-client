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
  syncNow: string
  syncing: string
  syncComplete: string
  syncReconnect: string
  syncProviderError: string
  syncSaveError: string
  insightsEyebrow: string
  insightsTitle: string
  last30Days: string
  lastUpdated: string
  neverSynced: string
  spend: string
  reach: string
  impressions: string
  linkClicks: string
  ctr: string
  cpc: string
  frequency: string
  date: string
  trendTitle: string
  trendDescription: string
  trendAccessibleTable: string
  whatHappened: string
  whatWorks: string
  whatReview: string
  noDeliveryReading: string
  happenedReading: string
  noWinnerReading: string
  winnerReading: string
  reviewNoDelivery: string
  reviewNoClicks: string
  reviewFrequency: string
  reviewHealthy: string
  neverSyncedTitle: string
  neverSyncedDescription: string
  noCampaignsTitle: string
  noCampaignsDescription: string
  campaignsTitle: string
  campaignsDescription: string
  campaign: string
  delivery: string
  readOnlyNotice: string
  staleDataNotice: string
  firstSyncErrorNotice: string
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
    syncNow: 'Actualizar desde Meta',
    syncing: 'Actualizando…',
    syncComplete: 'Datos actualizados.',
    syncReconnect: 'Meta ya no autoriza esta lectura. Vuelve a conectar la cuenta.',
    syncProviderError: 'Meta no ha respondido correctamente. Inténtalo de nuevo en unos minutos.',
    syncSaveError: 'No hemos podido guardar la actualización. Inténtalo de nuevo.',
    insightsEyebrow: 'Rendimiento',
    insightsTitle: 'Lectura de los últimos 30 días',
    last30Days: 'Últimos 30 días',
    lastUpdated: 'Actualizado',
    neverSynced: 'Pendiente de primera actualización',
    spend: 'Inversión',
    reach: 'Alcance',
    impressions: 'Impresiones',
    linkClicks: 'Clics en enlace',
    ctr: 'CTR',
    cpc: 'CPC',
    frequency: 'Frecuencia',
    date: 'Fecha',
    trendTitle: 'Evolución diaria',
    trendDescription: 'Selecciona una métrica para entender cómo cambió el rendimiento durante el periodo.',
    trendAccessibleTable: 'Datos diarios de inversión, clics en enlace y CTR.',
    whatHappened: 'Qué pasó',
    whatWorks: 'Qué funciona',
    whatReview: 'Qué revisar',
    noDeliveryReading: 'No hubo entrega publicitaria durante el periodo.',
    happenedReading: '{spend} de inversión generaron {impressions} impresiones, {reach} personas alcanzadas y {clicks} clics en enlace.',
    noWinnerReading: 'Todavía no hay suficientes clics para identificar una campaña ganadora.',
    winnerReading: '{campaign} consiguió el mayor número de clics en enlace ({clicks}).',
    reviewNoDelivery: 'No hay incidencias: la cuenta no tuvo actividad en este periodo.',
    reviewNoClicks: 'Hay inversión pero ningún clic en enlace. Revisa creatividad, mensaje y destino.',
    reviewFrequency: 'La frecuencia es alta ({frequency}). Revisa fatiga creativa y saturación de audiencia.',
    reviewHealthy: 'No detectamos señales básicas que requieran atención inmediata.',
    neverSyncedTitle: 'La cuenta está lista para leer datos',
    neverSyncedDescription: 'Haz la primera actualización para traer campañas y resultados de los últimos 30 días. TALIA solo realizará lecturas.',
    noCampaignsTitle: 'La cuenta está conectada, pero todavía no tiene campañas',
    noCampaignsDescription: 'La conexión funciona correctamente. Cuando existan campañas en Meta, aparecerán aquí después de actualizar.',
    campaignsTitle: 'Campañas',
    campaignsDescription: 'Estado y rendimiento por campaña durante el mismo periodo.',
    campaign: 'Campaña',
    delivery: 'Entrega',
    readOnlyNotice: 'Vista de solo lectura. Actualizar datos no crea ni modifica campañas en Meta.',
    staleDataNotice: 'La última actualización falló. Se muestran los datos anteriores mientras vuelves a intentarlo.',
    firstSyncErrorNotice: 'La primera actualización no se completó. Vuelve a intentarlo; la conexión permanece intacta.',
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
    syncNow: 'Actualitzar des de Meta',
    syncing: 'Actualitzant…',
    syncComplete: 'Dades actualitzades.',
    syncReconnect: 'Meta ja no autoritza aquesta lectura. Torna a connectar el compte.',
    syncProviderError: 'Meta no ha respost correctament. Torna-ho a provar d’aquí a uns minuts.',
    syncSaveError: 'No hem pogut desar l’actualització. Torna-ho a provar.',
    insightsEyebrow: 'Rendiment',
    insightsTitle: 'Lectura dels últims 30 dies',
    last30Days: 'Últims 30 dies',
    lastUpdated: 'Actualitzat',
    neverSynced: 'Pendent de la primera actualització',
    spend: 'Inversió',
    reach: 'Abast',
    impressions: 'Impressions',
    linkClicks: 'Clics a l’enllaç',
    ctr: 'CTR',
    cpc: 'CPC',
    frequency: 'Freqüència',
    date: 'Data',
    trendTitle: 'Evolució diària',
    trendDescription: 'Selecciona una mètrica per entendre com va canviar el rendiment durant el període.',
    trendAccessibleTable: 'Dades diàries d’inversió, clics a l’enllaç i CTR.',
    whatHappened: 'Què va passar',
    whatWorks: 'Què funciona',
    whatReview: 'Què revisar',
    noDeliveryReading: 'No hi va haver entrega publicitària durant el període.',
    happenedReading: '{spend} d’inversió van generar {impressions} impressions, {reach} persones assolides i {clicks} clics a l’enllaç.',
    noWinnerReading: 'Encara no hi ha prou clics per identificar una campanya guanyadora.',
    winnerReading: '{campaign} va aconseguir el nombre més alt de clics a l’enllaç ({clicks}).',
    reviewNoDelivery: 'No hi ha incidències: el compte no va tenir activitat en aquest període.',
    reviewNoClicks: 'Hi ha inversió però cap clic a l’enllaç. Revisa creativitat, missatge i destinació.',
    reviewFrequency: 'La freqüència és alta ({frequency}). Revisa fatiga creativa i saturació de l’audiència.',
    reviewHealthy: 'No detectem senyals bàsiques que requereixin atenció immediata.',
    neverSyncedTitle: 'El compte està llest per llegir dades',
    neverSyncedDescription: 'Fes la primera actualització per portar campanyes i resultats dels últims 30 dies. TALIA només farà lectures.',
    noCampaignsTitle: 'El compte està connectat, però encara no té campanyes',
    noCampaignsDescription: 'La connexió funciona correctament. Quan hi hagi campanyes a Meta, apareixeran aquí després d’actualitzar.',
    campaignsTitle: 'Campanyes',
    campaignsDescription: 'Estat i rendiment per campanya durant el mateix període.',
    campaign: 'Campanya',
    delivery: 'Entrega',
    readOnlyNotice: 'Vista només de lectura. Actualitzar dades no crea ni modifica campanyes a Meta.',
    staleDataNotice: 'L’última actualització ha fallat. Es mostren les dades anteriors mentre ho tornes a provar.',
    firstSyncErrorNotice: 'La primera actualització no s’ha completat. Torna-ho a provar; la connexió continua intacta.',
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
    syncNow: 'Refresh from Meta',
    syncing: 'Refreshing…',
    syncComplete: 'Data refreshed.',
    syncReconnect: 'Meta no longer authorizes this read. Reconnect the account.',
    syncProviderError: 'Meta did not respond correctly. Try again in a few minutes.',
    syncSaveError: 'We could not save the refresh. Please try again.',
    insightsEyebrow: 'Performance',
    insightsTitle: 'Last 30 days at a glance',
    last30Days: 'Last 30 days',
    lastUpdated: 'Updated',
    neverSynced: 'First refresh pending',
    spend: 'Spend',
    reach: 'Reach',
    impressions: 'Impressions',
    linkClicks: 'Link clicks',
    ctr: 'CTR',
    cpc: 'CPC',
    frequency: 'Frequency',
    date: 'Date',
    trendTitle: 'Daily trend',
    trendDescription: 'Select a metric to understand how performance changed during the period.',
    trendAccessibleTable: 'Daily spend, link click, and CTR data.',
    whatHappened: 'What happened',
    whatWorks: 'What works',
    whatReview: 'What to review',
    noDeliveryReading: 'There was no ad delivery during this period.',
    happenedReading: '{spend} in spend generated {impressions} impressions, reached {reach} people and produced {clicks} link clicks.',
    noWinnerReading: 'There are not enough clicks yet to identify a winning campaign.',
    winnerReading: '{campaign} generated the most link clicks ({clicks}).',
    reviewNoDelivery: 'No issues detected: the account had no activity during this period.',
    reviewNoClicks: 'There is spend but no link click. Review the creative, message, and destination.',
    reviewFrequency: 'Frequency is high ({frequency}). Review creative fatigue and audience saturation.',
    reviewHealthy: 'We found no basic signals requiring immediate attention.',
    neverSyncedTitle: 'The account is ready to read data',
    neverSyncedDescription: 'Run the first refresh to import campaigns and results from the last 30 days. TALIA will only read data.',
    noCampaignsTitle: 'The account is connected but has no campaigns yet',
    noCampaignsDescription: 'The connection works correctly. Campaigns will appear here after a refresh once they exist in Meta.',
    campaignsTitle: 'Campaigns',
    campaignsDescription: 'Campaign status and performance over the same period.',
    campaign: 'Campaign',
    delivery: 'Delivery',
    readOnlyNotice: 'Read-only view. Refreshing data does not create or modify campaigns in Meta.',
    staleDataNotice: 'The latest refresh failed. Previous data remains visible while you try again.',
    firstSyncErrorNotice: 'The first refresh did not complete. Try again; the connection remains intact.',
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
    syncNow: 'Atualizar da Meta',
    syncing: 'Atualizando…',
    syncComplete: 'Dados atualizados.',
    syncReconnect: 'A Meta não autoriza mais esta leitura. Reconecte a conta.',
    syncProviderError: 'A Meta não respondeu corretamente. Tente novamente em alguns minutos.',
    syncSaveError: 'Não foi possível salvar a atualização. Tente novamente.',
    insightsEyebrow: 'Desempenho',
    insightsTitle: 'Leitura dos últimos 30 dias',
    last30Days: 'Últimos 30 dias',
    lastUpdated: 'Atualizado',
    neverSynced: 'Primeira atualização pendente',
    spend: 'Investimento',
    reach: 'Alcance',
    impressions: 'Impressões',
    linkClicks: 'Cliques no link',
    ctr: 'CTR',
    cpc: 'CPC',
    frequency: 'Frequência',
    date: 'Data',
    trendTitle: 'Evolução diária',
    trendDescription: 'Selecione uma métrica para entender como o desempenho mudou durante o período.',
    trendAccessibleTable: 'Dados diários de investimento, cliques no link e CTR.',
    whatHappened: 'O que aconteceu',
    whatWorks: 'O que funciona',
    whatReview: 'O que revisar',
    noDeliveryReading: 'Não houve entrega de anúncios durante o período.',
    happenedReading: '{spend} de investimento geraram {impressions} impressões, alcançaram {reach} pessoas e produziram {clicks} cliques no link.',
    noWinnerReading: 'Ainda não há cliques suficientes para identificar uma campanha vencedora.',
    winnerReading: '{campaign} gerou o maior número de cliques no link ({clicks}).',
    reviewNoDelivery: 'Nenhum problema detectado: a conta não teve atividade neste período.',
    reviewNoClicks: 'Há investimento, mas nenhum clique no link. Revise o criativo, a mensagem e o destino.',
    reviewFrequency: 'A frequência está alta ({frequency}). Revise a fadiga criativa e a saturação do público.',
    reviewHealthy: 'Não encontramos sinais básicos que exijam atenção imediata.',
    neverSyncedTitle: 'A conta está pronta para ler dados',
    neverSyncedDescription: 'Faça a primeira atualização para importar campanhas e resultados dos últimos 30 dias. A TALIA fará apenas leituras.',
    noCampaignsTitle: 'A conta está conectada, mas ainda não tem campanhas',
    noCampaignsDescription: 'A conexão funciona corretamente. Quando houver campanhas na Meta, elas aparecerão aqui após a atualização.',
    campaignsTitle: 'Campanhas',
    campaignsDescription: 'Status e desempenho por campanha durante o mesmo período.',
    campaign: 'Campanha',
    delivery: 'Entrega',
    readOnlyNotice: 'Visualização somente leitura. Atualizar dados não cria nem modifica campanhas na Meta.',
    staleDataNotice: 'A atualização mais recente falhou. Os dados anteriores continuam visíveis enquanto você tenta novamente.',
    firstSyncErrorNotice: 'A primeira atualização não foi concluída. Tente novamente; a conexão continua intacta.',
  },
}

export function getMarketingCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0]
  return copies[language === 'ca' || language === 'en' || language === 'pt' ? language : 'es']
}
