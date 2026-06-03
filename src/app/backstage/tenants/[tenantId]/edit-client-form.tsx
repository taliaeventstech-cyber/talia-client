'use client'

import { Bot, Cable, ListChecks, RefreshCw } from 'lucide-react'
import { useActionState, useState } from 'react'
import { ActionToast } from '@/components/ui/action-toast'
import { defaultEmailClassificationTopics, getEmailAgentSettings } from '@/lib/email/settings'
import { updateTenantAction, type UpdateTenantState } from '../../actions'

const initialState: UpdateTenantState = { ok: false, message: '' }

type Client = {
  id: string
  name: string
  entity_type: string
  primary_language: string
  plan: string
  website_url: string | null
  fallback_email: string | null
  fallback_phone: string | null
  n8n_webhook_url: string | null
  system_prompt: string | null
  scrape_urls: unknown
  widget_config: unknown
  voice_phone_number: string | null
  voice_phone_provider: string
  voice_phone_mode: string
  voice_public_phone_number: string | null
  voice_forwarding_notes: string | null
  voice_operational_status: string
}

type Module = {
  module_key: string
  status: string
}

type EmailConnection = {
  id: string
  provider: string
  mailbox_email: string
  status: string
  sync_mode: string
  draft_mode: string
  error_message: string | null
  metadata: unknown
}

const editableModules = [
  { key: 'chatbot', label: 'Chatbot', locked: true },
  { key: 'data', label: 'Data', locked: true },
  { key: 'voice', label: 'Voz' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'marketing', label: 'Marketing' },
] as const

type EditableModuleKey = (typeof editableModules)[number]['key']
type SettingsTabKey = 'basic' | 'modules' | EditableModuleKey
type EmailTabKey = 'connection' | 'sync' | 'agent' | 'rules'

export function EditClientForm({
  client,
  modules,
  emailConnection,
}: {
  client: Client
  modules: Module[]
  emailConnection: EmailConnection | null
}) {
  const [state, action, pending] = useActionState(updateTenantAction, initialState)
  const activeModules = new Set(
    modules
      .filter((module) => module.status === 'active' || module.status === 'trial')
      .map((module) => module.module_key)
  )
  const [voiceEnabled, setVoiceEnabled] = useState(activeModules.has('voice'))
  const [emailEnabled, setEmailEnabled] = useState(activeModules.has('email'))
  const [selectedModuleKeys, setSelectedModuleKeys] = useState<Set<string>>(() => {
    const selected = new Set(activeModules)
    selected.add('chatbot')
    selected.add('data')
    return selected
  })
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('basic')
  const isModuleEnabled = (key: EditableModuleKey) => {
    if (key === 'voice') return voiceEnabled
    if (key === 'email') return emailEnabled
    return selectedModuleKeys.has(key)
  }
  const settingsTabs = [
    {
      key: 'basic',
      label: 'Datos',
      description: 'Venue y contacto',
      enabled: true,
    },
    {
      key: 'modules',
      label: 'Módulos',
      description: 'Producto contratado',
      enabled: true,
    },
    ...editableModules.map((module) => ({
      key: module.key,
      label: module.label,
      description: getModuleTabDescription(module.key),
      enabled: isModuleEnabled(module.key),
    })),
  ] satisfies Array<{
    key: SettingsTabKey
    label: string
    description: string
    enabled: boolean
  }>

  return (
    <form action={action} className="card stack">
      <ActionToast state={state} />

      <input type="hidden" name="tenant_id" value={client.id} />

      <div className="settings-tabs" role="tablist" aria-label="Configuración de la venue">
        {settingsTabs.map((tab) => (
          <button
            key={tab.key}
            id={`settings-tab-${tab.key}`}
            className={`settings-tab ${activeTab === tab.key ? 'settings-tab-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`settings-panel-${tab.key}`}
            disabled={!tab.enabled}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.label}</span>
            <small>{tab.description}</small>
          </button>
        ))}
      </div>

      <SettingsTabPanel id="basic" active={activeTab === 'basic'}>
        <PanelHeader
          eyebrow="Bandeja"
          title="Datos de la venue"
          description="Información base, contacto fallback y plan comercial de esta venue."
        />
        <div className="form-row">
          <label className="field">
            Nombre de la entidad
            <input name="name" required defaultValue={client.name} />
          </label>
          <label className="field">
            Tipo
            <select name="entity_type" defaultValue={client.entity_type}>
              <option value="theatre">Teatro</option>
              <option value="museum">Museo</option>
              <option value="cinema">Cine</option>
              <option value="auditorium">Auditorio</option>
              <option value="festival">Festival</option>
              <option value="cultural_center">Centro cultural</option>
              <option value="other">Otro</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            Idioma principal
            <select name="primary_language" defaultValue={client.primary_language}>
              <option value="es">Español</option>
              <option value="ca">Català</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="field">
            Plan
            <select name="plan" required defaultValue={normalizePlan(client.plan)}>
              <option value="essential">Esencial</option>
              <option value="professional">Profesional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>
        </div>

        <label className="field">
          Web oficial
          <input name="website_url" type="url" defaultValue={client.website_url ?? ''} />
        </label>

        <div className="form-row">
          <label className="field">
            Email fallback
            <input name="fallback_email" type="email" defaultValue={client.fallback_email ?? ''} />
          </label>
          <label className="field">
            Teléfono fallback
            <input name="fallback_phone" defaultValue={client.fallback_phone ?? ''} />
          </label>
        </div>
      </SettingsTabPanel>

      <SettingsTabPanel id="modules" active={activeTab === 'modules'}>
        <PanelHeader
          eyebrow="Producto"
          title="Módulos contratados"
          description="Activa solamente los módulos incluidos en el contrato de esta venue."
        />
        <fieldset className="module-checkbox-grid">
          <legend className="sr-only">Módulos contratados</legend>
          {editableModules.map((module) => (
            <label key={module.key}>
              <input
                type="checkbox"
                name="modules"
                value={module.key}
                checked={selectedModuleKeys.has(module.key)}
                disabled={'locked' in module && module.locked}
                onChange={(event) => {
                  const checked = event.currentTarget.checked
                  setSelectedModuleKeys((current) => {
                    const next = new Set(current)
                    if (checked) {
                      next.add(module.key)
                    } else {
                      next.delete(module.key)
                    }
                    return next
                  })
                  if (module.key === 'voice') setVoiceEnabled(checked)
                  if (module.key === 'email') setEmailEnabled(checked)
                  if (checked) {
                    setActiveTab(module.key)
                  } else if (activeTab === module.key) {
                    setActiveTab('modules')
                  }
                }}
              />
              {module.label}
            </label>
          ))}
        </fieldset>
      </SettingsTabPanel>

      {voiceEnabled ? (
        <SettingsTabPanel id="voice" active={activeTab === 'voice'}>
          <PanelHeader
            eyebrow="Agente de voz"
            title="Telefonía operativa"
            description="Configuración interna de TALIA para provisión, desvíos, portabilidad y soporte."
          />
          <VoiceOperationsFields client={client} />
        </SettingsTabPanel>
      ) : (
        <HiddenVoiceOperationsFields client={client} />
      )}

      {emailEnabled ? (
        <SettingsTabPanel id="email" active={activeTab === 'email'}>
          <PanelHeader
            eyebrow="Agente de email"
            title="Buzón y borradores"
            description="Configuración interna para conectar Gmail/Outlook y crear borradores supervisados."
          />
          <EmailOperationsFields client={client} connection={emailConnection} />
        </SettingsTabPanel>
      ) : (
        <HiddenEmailOperationsFields connection={emailConnection} />
      )}

      {selectedModuleKeys.has('chatbot') ? (
        <SettingsTabPanel id="chatbot" active={activeTab === 'chatbot'}>
          <ChatbotOperationsPanel client={client} />
        </SettingsTabPanel>
      ) : null}

      {selectedModuleKeys.has('data') ? (
        <SettingsTabPanel id="data" active={activeTab === 'data'}>
          <ModulePlaceholderPanel
            eyebrow="Data"
            title="Datos y conocimiento"
            description="La gestión granular de fuentes, análisis y reglas de datos quedará separada de la configuración general."
          />
        </SettingsTabPanel>
      ) : null}

      {selectedModuleKeys.has('whatsapp') ? (
        <SettingsTabPanel id="whatsapp" active={activeTab === 'whatsapp'}>
          <ModulePlaceholderPanel
            eyebrow="WhatsApp"
            title="Configuración de WhatsApp"
            description="Pendiente de activar cuando trabajemos el canal de mensajería y sus reglas operativas."
          />
        </SettingsTabPanel>
      ) : null}

      {selectedModuleKeys.has('instagram') ? (
        <SettingsTabPanel id="instagram" active={activeTab === 'instagram'}>
          <ModulePlaceholderPanel
            eyebrow="Instagram"
            title="Configuración de Instagram"
            description="Pendiente de activar cuando conectemos el canal social y su flujo de atención."
          />
        </SettingsTabPanel>
      ) : null}

      {selectedModuleKeys.has('marketing') ? (
        <SettingsTabPanel id="marketing" active={activeTab === 'marketing'}>
          <ModulePlaceholderPanel
            eyebrow="Marketing"
            title="Configuración de marketing"
            description="Pendiente de activar cuando definamos campañas, automatizaciones y reporting."
          />
        </SettingsTabPanel>
      ) : null}

      <button className="button-primary button-fit" type="submit" disabled={pending}>
        {pending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function SettingsTabPanel({
  id,
  active,
  children,
}: {
  id: SettingsTabKey
  active: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={`settings-panel-${id}`}
      className={`settings-tab-panel ${active ? 'settings-tab-panel-active' : ''}`}
      role="tabpanel"
      aria-hidden={!active}
      aria-labelledby={`settings-tab-${id}`}
    >
      {children}
    </section>
  )
}

function ModulePlaceholderPanel({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <>
      <PanelHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="module-placeholder">
        <strong>Configuración pendiente</strong>
        <p className="muted">El módulo ya puede marcarse en contrato. Su pantalla específica se añadirá cuando el flujo esté definido.</p>
      </div>
    </>
  )
}

function ChatbotOperationsPanel({ client }: { client: Client }) {
  const widgetConfig = getWidgetConfig(client.widget_config)
  const scrapeUrls = getStringList(client.scrape_urls)

  return (
    <>
      <PanelHeader
        eyebrow="Chatbot"
        title="Configuración del chatbot"
        description="Estado operativo del widget, webhook y base de conocimiento usada por el chatbot."
      />

      <div className="chatbot-config-grid">
        <div className="chatbot-config-card">
          <p className="eyebrow">Widget</p>
          <dl className="compact-definition-list">
            <div>
              <dt>Asistente</dt>
              <dd>{widgetConfig.assistantName}</dd>
            </div>
            <div>
              <dt>Mensaje inicial</dt>
              <dd>{widgetConfig.initialMessage}</dd>
            </div>
            <div>
              <dt>Color</dt>
              <dd>
                <span className="color-swatch" style={{ background: widgetConfig.primaryColor }} aria-hidden="true" />
                {widgetConfig.primaryColor}
              </dd>
            </div>
            <div>
              <dt>Autoapertura</dt>
              <dd>{widgetConfig.autoOpen ? `Sí, ${widgetConfig.autoOpenDelay}s` : 'No'}</dd>
            </div>
          </dl>
        </div>

        <div className="chatbot-config-card">
          <p className="eyebrow">Operación</p>
          <label className="field field-important">
            Webhook n8n
            <input
              name="chatbot_webhook_url"
              type="url"
              defaultValue={client.n8n_webhook_url ?? ''}
              placeholder="https://n8n.talia.ai/webhook/..."
            />
            <span className="field-hint">Endpoint técnico que recibe los mensajes del widget.</span>
          </label>
          <div className="compact-status-row">
            <span>Prompt {client.system_prompt ? 'personalizado' : 'por defecto'}</span>
            <span>{scrapeUrls.length} fuentes web</span>
          </div>
        </div>
      </div>

      <label className="field">
        Prompt sistema del chatbot
        <textarea
          name="chatbot_system_prompt"
          defaultValue={client.system_prompt ?? ''}
          rows={4}
          placeholder="Instrucciones operativas internas para el comportamiento del chatbot."
        />
        <span className="field-hint">Campo técnico de soporte. El tono visible y el contenido deben seguir gestionándose desde el panel cliente.</span>
      </label>

      <label className="field">
        Fuentes web de conocimiento
        <textarea
          name="chatbot_scrape_urls"
          defaultValue={scrapeUrls.join('\n')}
          rows={4}
          placeholder="https://venue.com/programacion&#10;https://venue.com/entradas"
        />
        <span className="field-hint">Una URL por línea. Se usan como fuentes para la base de conocimiento del chatbot.</span>
      </label>
    </>
  )
}

function PanelHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <header className="settings-panel-header">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
    </header>
  )
}

function EmailConfigGroup({
  id,
  title,
  description,
  summary,
  active,
  important = false,
  children,
}: {
  id: EmailTabKey
  title: string
  description: string
  summary: string
  active: boolean
  important?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={`email-config-panel-${id}`}
      className={`email-config-group ${active ? 'email-config-group-open' : ''} ${important ? 'email-config-group-important' : ''}`}
      role="tabpanel"
      aria-hidden={!active}
      aria-labelledby={`email-config-tab-${id}`}
    >
      <header className="email-config-group-header">
        <span className="email-config-group-title">
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <span className="email-config-group-meta">{summary}</span>
      </header>
      <div className="email-config-group-content">{children}</div>
    </section>
  )
}

function VoiceOperationsFields({ client }: { client: Client }) {
  return (
    <>
      <div className="form-row">
        <label className="field">
          Número TALIA asignado
          <input name="voice_phone_number" defaultValue={client.voice_phone_number ?? ''} placeholder="+34931234567" />
        </label>
        <label className="field">
          Número público del cliente
          <input name="voice_public_phone_number" defaultValue={client.voice_public_phone_number ?? ''} placeholder="+34900123456" />
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          Proveedor telefónico
          <select name="voice_phone_provider" defaultValue={client.voice_phone_provider}>
            <option value="elevenlabs">ElevenLabs Phone Numbers</option>
            <option value="twilio">Twilio</option>
            <option value="external">Externo / cliente</option>
          </select>
        </label>
        <label className="field">
          Modo de número
          <select name="voice_phone_mode" defaultValue={client.voice_phone_mode}>
            <option value="talia_number">Número gestionado por TALIA</option>
            <option value="client_forwarding">Desvío desde número del cliente</option>
            <option value="portability">Portabilidad</option>
          </select>
        </label>
      </div>

      <label className="field">
        Estado operativo
        <select name="voice_operational_status" defaultValue={client.voice_operational_status}>
          <option value="draft">Borrador</option>
          <option value="provisioning">Provisionando</option>
          <option value="active">Activo</option>
          <option value="paused">Pausado</option>
          <option value="error">Error</option>
        </select>
      </label>

      <label className="field">
        Notas internas de desvío y operación
        <textarea
          name="voice_forwarding_notes"
          defaultValue={client.voice_forwarding_notes ?? ''}
          rows={4}
          placeholder="Ej. El cliente desvía su número público al número TALIA fuera de horario."
        />
      </label>
    </>
  )
}

function HiddenVoiceOperationsFields({ client }: { client: Client }) {
  return (
    <>
      <input type="hidden" name="voice_phone_number" value={client.voice_phone_number ?? ''} />
      <input type="hidden" name="voice_public_phone_number" value={client.voice_public_phone_number ?? ''} />
      <input type="hidden" name="voice_phone_provider" value={client.voice_phone_provider} />
      <input type="hidden" name="voice_phone_mode" value={client.voice_phone_mode} />
      <input type="hidden" name="voice_operational_status" value={client.voice_operational_status} />
      <input type="hidden" name="voice_forwarding_notes" value={client.voice_forwarding_notes ?? ''} />
    </>
  )
}

function EmailOperationsFields({ client, connection }: { client: Client; connection: EmailConnection | null }) {
  const metadata = getEmailMetadata(connection?.metadata)
  const agentSettings = getEmailAgentSettings(connection?.metadata)
  const [activeEmailTab, setActiveEmailTab] = useState<EmailTabKey>('connection')
  const emailTabs = [
    {
      key: 'connection',
      label: 'Conexión',
      summary: `${connection?.mailbox_email ?? client.fallback_email ?? 'Sin buzón'} · ${formatDraftMode(connection?.draft_mode ?? 'provider_drafts')}`,
      icon: Cable,
    },
    {
      key: 'sync',
      label: 'Sincronización',
      summary: `${metadata.syncLimit} emails · cada ${metadata.syncFrequencyMinutes} min`,
      icon: RefreshCw,
    },
    {
      key: 'agent',
      label: 'Agente',
      summary: `${formatAgentTone(agentSettings.tone)} · borrador ${agentSettings.draftStyle}`,
      icon: Bot,
    },
    {
      key: 'rules',
      label: 'Reglas',
      summary: `${agentSettings.classificationTopics.length} temas · ${agentSettings.humanReviewTopics.length} sensibles`,
      icon: ListChecks,
    },
  ] satisfies Array<{ key: EmailTabKey; label: string; summary: string; icon: React.ElementType }>

  return (
    <>
      <div className="email-config-tabs" role="tablist" aria-label="Configuración del agente de email">
        {emailTabs.map((tab) => {
          const Icon = tab.icon

          return (
            <button
              key={tab.key}
              id={`email-config-tab-${tab.key}`}
              className={`email-config-tab ${activeEmailTab === tab.key ? 'email-config-tab-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeEmailTab === tab.key}
              aria-controls={`email-config-panel-${tab.key}`}
              onClick={() => setActiveEmailTab(tab.key)}
            >
              <span className="email-config-tab-label">
                <Icon size={15} strokeWidth={2} aria-hidden="true" />
                <span>{tab.label}</span>
              </span>
              <small>{tab.summary}</small>
            </button>
          )
        })}
      </div>

      <EmailConfigGroup
        id="connection"
        title="Conexión"
        description="Define qué buzón se conecta y dónde se crean los borradores."
        summary={`${connection?.mailbox_email ?? client.fallback_email ?? 'Sin buzón'} · ${formatDraftMode(connection?.draft_mode ?? 'provider_drafts')}`}
        active={activeEmailTab === 'connection'}
        important
      >
        <div className="form-row">
          <label className="field field-important">
            <span className="field-label-row">
              Buzón a conectar
            </span>
            <input
              name="email_mailbox_email"
              type="email"
              defaultValue={connection?.mailbox_email ?? client.fallback_email ?? ''}
              placeholder="info@teatro.com"
            />
            <span className="field-hint">Es el buzón desde el que TALIA leerá emails y preparará borradores.</span>
          </label>
          <label className="field field-important">
            <span className="field-label-row">
              Proveedor
            </span>
            <select name="email_provider" defaultValue={connection?.provider ?? 'google'}>
              <option value="google">Google Workspace / Gmail</option>
              <option value="microsoft">Microsoft 365 / Outlook</option>
              <option value="imap">IMAP</option>
              <option value="forwarding">Forwarding TALIA</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            Estado de conexión
            <select name="email_status" defaultValue={connection?.status ?? 'draft'}>
              <option value="draft">Borrador</option>
              <option value="connected">Conectado</option>
              <option value="syncing">Sincronizando</option>
              <option value="error">Error</option>
              <option value="revoked">Desconectado</option>
              <option value="disabled">Desactivado</option>
            </select>
          </label>
          <label className="field field-important">
            <span className="field-label-row">
              Modo de borrador
            </span>
            <select name="email_draft_mode" defaultValue={connection?.draft_mode ?? 'provider_drafts'}>
              <option value="provider_drafts">Crear borradores en el buzón</option>
              <option value="agora_review">Revisión primero en Àgora</option>
              <option value="disabled">Sin borradores</option>
            </select>
            <span className="field-hint">Determina si la respuesta vive solo en Àgora o también en Gmail/Outlook.</span>
          </label>
        </div>
      </EmailConfigGroup>

      <EmailConfigGroup
        id="sync"
        title="Sincronización"
        description="Controla cuánto mira TALIA y cada cuánto se actualiza la bandeja."
        summary={`${metadata.syncLimit} emails · cada ${metadata.syncFrequencyMinutes} min · ${metadata.cronEnabled ? 'cron activo' : 'cron pausado'}`}
        active={activeEmailTab === 'sync'}
        important
      >
        <label className="field">
          Modo de sincronización
          <select name="email_sync_mode" defaultValue={connection?.sync_mode ?? 'polling'}>
            <option value="polling">Polling incremental</option>
            <option value="webhook">Webhook provider</option>
            <option value="manual">Manual</option>
          </select>
        </label>

        <div className="form-row">
          <label className="field">
            Ventana de lectura
            <select name="email_sync_window_days" defaultValue={String(metadata.syncWindowDays)}>
              <option value="1">Últimas 24 horas</option>
              <option value="7">Últimos 7 días</option>
              <option value="14">Últimos 14 días</option>
              <option value="30">Últimos 30 días</option>
            </select>
          </label>
          <label className="field field-important">
            <span className="field-label-row">
              Frecuencia automática
            </span>
            <select name="email_sync_frequency_minutes" defaultValue={String(metadata.syncFrequencyMinutes)}>
              <option value="15">Cada 15 minutos</option>
              <option value="30">Cada 30 minutos</option>
              <option value="60">Cada hora</option>
              <option value="240">Cada 4 horas</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="field field-important">
            <span className="field-label-row">
              Máximo a inspeccionar por sync
            </span>
            <select name="email_sync_limit" defaultValue={String(metadata.syncLimit)}>
              <option value="10">10 emails</option>
              <option value="25">25 emails</option>
              <option value="50">50 emails</option>
              <option value="100">100 emails</option>
              <option value="250">250 emails</option>
              <option value="500">500 emails</option>
            </select>
          </label>
        </div>

        <div className="email-config-toggle-grid">
          <label className="checkbox-row checkbox-row-card">
            <input
              type="checkbox"
              value="on"
              name="email_cron_enabled"
              defaultChecked={metadata.cronEnabled}
            />
            <span>
              <strong>Activar cron automático</strong>
              <small>Permite que n8n despierte la sincronización sin acción manual.</small>
            </span>
          </label>

          <label className="checkbox-row checkbox-row-card">
            <input
              type="checkbox"
              value="on"
              name="email_auto_classify_after_sync"
              defaultChecked={metadata.autoClassifyAfterSync}
            />
            <span>
              <strong>Clasificar tras sincronizar</strong>
              <small>Analiza tema, prioridad y si requiere revisión humana cuando entra un email nuevo.</small>
            </span>
          </label>

          <label className="checkbox-row checkbox-row-card">
            <input
              type="checkbox"
              value="on"
              name="email_auto_draft_after_sync"
              defaultChecked={metadata.autoDraftAfterSync}
            />
            <span>
              <strong>Crear borrador tras clasificar</strong>
              <small>Si el clasificador decide que hay que responder, genera el borrador automáticamente.</small>
            </span>
          </label>
        </div>
      </EmailConfigGroup>

      <EmailConfigGroup
        id="agent"
        title="Comportamiento del agente"
        description="Separa el estilo del canal email de la base de conocimiento común."
        summary={`${formatAgentTone(agentSettings.tone)} · borrador ${agentSettings.draftStyle}`}
        active={activeEmailTab === 'agent'}
        important
      >
        <div className="form-row">
          <label className="field field-important">
            <span className="field-label-row">
              Tono del agente
            </span>
            <select name="email_agent_tone" defaultValue={agentSettings.tone}>
              <option value="professional_cercano">Profesional y cercano</option>
              <option value="formal">Formal</option>
              <option value="directo">Directo y operativo</option>
            </select>
            <span className="field-hint">Afecta solo a los borradores de email.</span>
          </label>
          <label className="field field-important">
            <span className="field-label-row">
              Estilo de borrador
            </span>
            <select name="email_agent_draft_style" defaultValue={agentSettings.draftStyle}>
              <option value="breve">Breve</option>
              <option value="detallado">Detallado</option>
            </select>
            <span className="field-hint">Define si TALIA debe responder de forma concisa o con más contexto.</span>
          </label>
        </div>

        <label className="field">
          Firma o cierre preferido
          <input
            name="email_agent_signature"
            defaultValue={agentSettings.signature ?? ''}
            placeholder="Equipo de atención de la venue"
          />
          <span className="field-hint">Opcional. Se envía al agente como pauta de cierre del borrador.</span>
        </label>

        <label className="field field-important">
          <span className="field-label-row">
            Prompt del agente de email
          </span>
          <textarea
            name="email_channel_prompt"
            defaultValue={agentSettings.channelPrompt ?? ''}
            rows={4}
            placeholder="Instrucciones específicas para redactar y preparar borradores de email."
          />
          <span className="field-hint">Instrucciones propias del canal email. La base de conocimiento común se gestiona en Conocimiento.</span>
        </label>
      </EmailConfigGroup>

      <EmailConfigGroup
        id="rules"
        title="Reglas y exclusiones"
        description="Define cómo clasifica TALIA los emails, qué debe ignorarse y qué debe llegar marcado para revisión humana."
        summary={`${agentSettings.classificationTopics.length} temas · ${metadata.excludeAutomated ? 'automáticos ignorados' : 'automáticos incluidos'}`}
        active={activeEmailTab === 'rules'}
      >
        <label className="checkbox-row checkbox-row-card">
          <input
            type="checkbox"
            value="on"
            name="email_exclude_automated"
            defaultChecked={metadata.excludeAutomated}
          />
          <span>
            <strong>Ignorar newsletters, rebotes y respuestas automáticas</strong>
            <small>Se filtran antes de llamar al agente para reducir ruido y coste.</small>
          </span>
        </label>

        <div className="form-row">
          <label className="field">
            Remitentes bloqueados
            <textarea
              name="email_blocked_senders"
              defaultValue={metadata.blockedSenders.join('\n')}
              rows={3}
              placeholder="newsletter@proveedor.com&#10;marketing@dominio.com"
            />
            <span className="field-hint">Uno por línea. También puedes usar dominios en el campo siguiente.</span>
          </label>
          <label className="field">
            Dominios bloqueados
            <textarea
              name="email_blocked_domains"
              defaultValue={metadata.blockedDomains.join('\n')}
              rows={3}
              placeholder="proveedor.com&#10;mailchimp.com"
            />
            <span className="field-hint">Uno por línea, sin @. Se ignorarán antes de llamar al agente.</span>
          </label>
        </div>

        <label className="field">
          Query avanzada del buzón
          <input
            name="email_gmail_sync_query"
            defaultValue={metadata.gmailSyncQuery}
            placeholder="in:inbox newer_than:14d"
          />
          <span className="field-hint">
            Solo Backstage. En Gmail sustituye la query generada; en Outlook se usa la ventana seleccionada.
          </span>
        </label>

        <label className="field field-important">
          <span className="field-label-row">
            Temas de clasificación
          </span>
          <textarea
            name="email_classification_topics"
            defaultValue={agentSettings.classificationTopics.join('\n')}
            rows={5}
            placeholder="entradas&#10;horarios&#10;devoluciones&#10;partnerships&#10;otro"
          />
          <span className="field-hint">
            Uno por línea. El clasificador elegirá uno de estos temas; deja “otro” como fallback.
          </span>
        </label>

        <div className="form-row">
          <label className="field field-important">
            <span className="field-label-row">
              Temas que requieren revisión humana
            </span>
            <textarea
              name="email_human_review_topics"
              defaultValue={agentSettings.humanReviewTopics.join('\n')}
              rows={3}
              placeholder="devoluciones&#10;quejas&#10;grupos"
            />
            <span className="field-hint">Uno por línea. El clasificador los marcará como sensibles.</span>
          </label>
          <label className="field">
            Reglas adicionales de clasificación
            <textarea
              name="email_classification_rules"
              defaultValue={agentSettings.classificationRules ?? ''}
              rows={3}
              placeholder="Ej: las solicitudes de prensa deben requerir revisión humana."
            />
            <span className="field-hint">Pautas internas para el agente clasificador, sin mezclar con FAQs.</span>
          </label>
        </div>
      </EmailConfigGroup>

      {connection?.error_message ? (
        <p className="notice notice-error">{connection.error_message}</p>
      ) : null}
    </>
  )
}

function HiddenEmailOperationsFields({ connection }: { connection: EmailConnection | null }) {
  return (
    <>
      <input type="hidden" name="email_mailbox_email" value={connection?.mailbox_email ?? ''} />
      <input type="hidden" name="email_provider" value={connection?.provider ?? 'google'} />
      <input type="hidden" name="email_status" value="disabled" />
      <input type="hidden" name="email_draft_mode" value={connection?.draft_mode ?? 'provider_drafts'} />
      <input type="hidden" name="email_sync_mode" value={connection?.sync_mode ?? 'polling'} />
      <input type="hidden" name="email_sync_window_days" value="14" />
      <input type="hidden" name="email_sync_frequency_minutes" value="15" />
      <input type="hidden" name="email_sync_limit" value="100" />
      <input type="hidden" name="email_cron_enabled" value="" />
      <input type="hidden" name="email_auto_classify_after_sync" value="" />
      <input type="hidden" name="email_auto_draft_after_sync" value="" />
      <input type="hidden" name="email_gmail_sync_query" value="" />
      <input type="hidden" name="email_blocked_senders" value="" />
      <input type="hidden" name="email_blocked_domains" value="" />
      <input type="hidden" name="email_agent_tone" value="professional_cercano" />
      <input type="hidden" name="email_agent_draft_style" value="breve" />
      <input type="hidden" name="email_agent_signature" value="" />
      <input type="hidden" name="email_channel_prompt" value="" />
      <input type="hidden" name="email_classification_topics" value={defaultEmailClassificationTopics.join('\n')} />
      <input type="hidden" name="email_human_review_topics" value={'devoluciones\nquejas\ngrupos'} />
      <input type="hidden" name="email_classification_rules" value="" />
    </>
  )
}

function getEmailMetadata(value: unknown) {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const syncWindowDays = typeof record.gmail_sync_window_days === 'number'
    ? record.gmail_sync_window_days
    : 14
  const syncLimit = typeof record.gmail_sync_limit === 'number'
    ? record.gmail_sync_limit
    : 100
  const syncFrequencyMinutes = typeof record.sync_frequency_minutes === 'number'
    ? record.sync_frequency_minutes
    : 15

  return {
    syncWindowDays: [1, 7, 14, 30].includes(syncWindowDays) ? syncWindowDays : 14,
    syncLimit: [10, 25, 50, 100, 250, 500].includes(syncLimit) ? syncLimit : 100,
    syncFrequencyMinutes: [15, 30, 60, 240].includes(syncFrequencyMinutes) ? syncFrequencyMinutes : 15,
    cronEnabled: record.cron_enabled !== false,
    autoProcessAfterSync: record.auto_process_after_sync === true,
    autoClassifyAfterSync: typeof record.auto_classify_after_sync === 'boolean'
      ? record.auto_classify_after_sync
      : record.auto_process_after_sync === true,
    autoDraftAfterSync: typeof record.auto_draft_after_sync === 'boolean'
      ? record.auto_draft_after_sync
      : record.auto_process_after_sync === true,
    excludeAutomated: record.exclude_automated !== false,
    blockedSenders: getStringList(record.blocked_senders),
    blockedDomains: getStringList(record.blocked_domains),
    gmailSyncQuery: typeof record.gmail_sync_query === 'string' ? record.gmail_sync_query : '',
  }
}

function getStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function getWidgetConfig(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      assistantName: 'TALIA',
      initialMessage: 'Hola, soc TALIA. En què et puc ajudar?',
      primaryColor: '#000000',
      autoOpen: false,
      autoOpenDelay: 3,
    }
  }

  const config = value as {
    assistantName?: unknown
    initialMessage?: unknown
    primaryColor?: unknown
    autoOpen?: unknown
    autoOpenDelay?: unknown
  }

  return {
    assistantName: typeof config.assistantName === 'string' ? config.assistantName : 'TALIA',
    initialMessage: typeof config.initialMessage === 'string' ? config.initialMessage : 'Hola, soc TALIA. En què et puc ajudar?',
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : '#000000',
    autoOpen: config.autoOpen === true,
    autoOpenDelay: typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3,
  }
}

function normalizePlan(plan: string) {
  const value = plan.toLowerCase()
  if (value === 'professional' || value === 'profesional') return 'professional'
  if (value === 'enterprise' || value === 'empresa') return 'enterprise'
  return 'essential'
}

function formatDraftMode(value: string) {
  if (value === 'agora_review') return 'Revisión en Àgora'
  if (value === 'disabled') return 'Sin borradores'
  return 'Borradores en buzón'
}

function formatAgentTone(value: string) {
  if (value === 'formal') return 'Formal'
  if (value === 'directo') return 'Directo'
  return 'Profesional cercano'
}

function getModuleTabDescription(key: EditableModuleKey) {
  if (key === 'chatbot') return 'Conversaciones web'
  if (key === 'data') return 'Conocimiento'
  if (key === 'voice') return 'Telefonía operativa'
  if (key === 'email') return 'Buzón y borradores'
  if (key === 'whatsapp') return 'Mensajería'
  if (key === 'instagram') return 'Social'
  return 'Campañas'
}
