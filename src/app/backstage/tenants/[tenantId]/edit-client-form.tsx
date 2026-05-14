'use client'

import { ChevronDown } from 'lucide-react'
import { useActionState, useState } from 'react'
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
]

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
  const [openSections, setOpenSections] = useState({
    basic: true,
    modules: true,
    voice: activeModules.has('voice'),
    email: activeModules.has('email'),
  })

  function toggleSection(section: keyof typeof openSections) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  return (
    <form action={action} className="card stack">
      <input type="hidden" name="tenant_id" value={client.id} />

      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <CollapsibleSection
        title="Datos de la venue"
        eyebrow="Configuración"
        description="Información base, contacto fallback y plan comercial de esta venue."
        open={openSections.basic}
        onToggle={() => toggleSection('basic')}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Módulos contratados"
        eyebrow="Producto"
        description="Activa solamente los módulos incluidos en el contrato de esta venue."
        open={openSections.modules}
        onToggle={() => toggleSection('modules')}
      >
        <fieldset className="module-checkbox-grid">
          <legend className="sr-only">Módulos contratados</legend>
          {editableModules.map((module) => (
            <label key={module.key}>
              <input
                type="checkbox"
                name="modules"
                value={module.key}
                defaultChecked={module.locked || activeModules.has(module.key)}
                disabled={module.locked}
                onChange={
                  module.key === 'voice'
                    ? (event) => {
                      setVoiceEnabled(event.currentTarget.checked)
                      if (event.currentTarget.checked) {
                        setOpenSections((current) => ({ ...current, voice: true }))
                      }
                    }
                    : module.key === 'email'
                      ? (event) => {
                        setEmailEnabled(event.currentTarget.checked)
                        if (event.currentTarget.checked) {
                          setOpenSections((current) => ({ ...current, email: true }))
                        }
                      }
                      : undefined
                }
              />
              {module.label}
            </label>
          ))}
        </fieldset>
      </CollapsibleSection>

      {voiceEnabled ? (
        <CollapsibleSection
          title="Telefonía operativa"
          eyebrow="Agente de voz"
          description="Configuración interna de TALIA para provisión, desvíos, portabilidad y soporte."
          open={openSections.voice}
          onToggle={() => toggleSection('voice')}
        >
          <VoiceOperationsFields client={client} />
        </CollapsibleSection>
      ) : (
        <HiddenVoiceOperationsFields client={client} />
      )}

      {emailEnabled ? (
        <CollapsibleSection
          title="Buzón y borradores"
          eyebrow="Agente de email"
          description="Configuración interna para conectar Gmail/Outlook y crear borradores supervisados."
          open={openSections.email}
          onToggle={() => toggleSection('email')}
        >
          <EmailOperationsFields client={client} connection={emailConnection} />
        </CollapsibleSection>
      ) : (
        <HiddenEmailOperationsFields connection={emailConnection} />
      )}

      <button className="button-primary button-fit" type="submit" disabled={pending}>
        {pending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function CollapsibleSection({
  eyebrow,
  title,
  description,
  open,
  onToggle,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className={`settings-collapse ${open ? 'settings-collapse-open' : ''}`}>
      <button className="settings-collapse-trigger" type="button" aria-expanded={open} onClick={onToggle}>
        <span>
          <span className="eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
          <span className="muted">{description}</span>
        </span>
        <ChevronDown className="settings-collapse-icon" size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      <div className="settings-collapse-body" aria-hidden={!open}>
        <div className="settings-collapse-content">
          {children}
        </div>
      </div>
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

  return (
    <>
      <div className="form-row">
        <label className="field">
          Buzón a conectar
          <input
            name="email_mailbox_email"
            type="email"
            required
            defaultValue={connection?.mailbox_email ?? client.fallback_email ?? ''}
            placeholder="info@teatro.com"
          />
        </label>
        <label className="field">
          Proveedor
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
            <option value="revoked">Revocado</option>
            <option value="disabled">Desactivado</option>
          </select>
        </label>
        <label className="field">
          Modo de borrador
          <select name="email_draft_mode" defaultValue={connection?.draft_mode ?? 'provider_drafts'}>
            <option value="provider_drafts">Crear borradores en el buzón</option>
            <option value="agora_review">Revisión primero en Àgora</option>
            <option value="disabled">Sin borradores</option>
          </select>
        </label>
      </div>

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
        <label className="field">
          Frecuencia automática
          <select name="email_sync_frequency_minutes" defaultValue={String(metadata.syncFrequencyMinutes)}>
            <option value="15">Cada 15 minutos</option>
            <option value="30">Cada 30 minutos</option>
            <option value="60">Cada hora</option>
            <option value="240">Cada 4 horas</option>
          </select>
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          Límite por sincronización
          <select name="email_sync_limit" defaultValue={String(metadata.syncLimit)}>
            <option value="10">10 emails</option>
            <option value="25">25 emails</option>
            <option value="50">50 emails</option>
          </select>
        </label>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          value="on"
          name="email_auto_process_after_sync"
          defaultChecked={metadata.autoProcessAfterSync}
        />
        Procesar automáticamente después de sincronizar
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          value="on"
          name="email_exclude_automated"
          defaultChecked={metadata.excludeAutomated}
        />
        Ignorar newsletters, rebotes y respuestas automáticas
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
        Query Gmail avanzada
        <input
          name="email_gmail_sync_query"
          defaultValue={metadata.gmailSyncQuery}
          placeholder="in:inbox newer_than:14d"
        />
        <span className="field-hint">
          Solo Backstage. Si se deja vacío, TALIA genera una query segura con la ventana seleccionada.
        </span>
      </label>

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
      <input type="hidden" name="email_sync_limit" value="10" />
      <input type="hidden" name="email_gmail_sync_query" value="" />
      <input type="hidden" name="email_blocked_senders" value="" />
      <input type="hidden" name="email_blocked_domains" value="" />
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
    : 10
  const syncFrequencyMinutes = typeof record.sync_frequency_minutes === 'number'
    ? record.sync_frequency_minutes
    : 15

  return {
    syncWindowDays: [1, 7, 14, 30].includes(syncWindowDays) ? syncWindowDays : 14,
    syncLimit: [10, 25, 50].includes(syncLimit) ? syncLimit : 10,
    syncFrequencyMinutes: [15, 30, 60, 240].includes(syncFrequencyMinutes) ? syncFrequencyMinutes : 15,
    autoProcessAfterSync: record.auto_process_after_sync === true,
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

function normalizePlan(plan: string) {
  const value = plan.toLowerCase()
  if (value === 'professional' || value === 'profesional') return 'professional'
  if (value === 'enterprise' || value === 'empresa') return 'enterprise'
  return 'essential'
}
