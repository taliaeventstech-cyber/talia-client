'use client'

import { ChevronDown, Info, Trash2 } from 'lucide-react'
import { useActionState, useState, useTransition, useEffect, useRef } from 'react'
import { createKnowledgeItem, uploadKnowledgeExcel, updateScrapeUrls, updateKnowledgeItem, deleteKnowledgeItem, type SettingsFormState, type ExcelUploadState } from './actions'

type KnowledgeItem = {
  id: string
  question: string
  answer: string
  category: string | null
  language: string
  priority: number
}

type KnowledgeFormProps = {
  tenantId: string
  items: KnowledgeItem[]
  scrapeUrls: string[]
}

const initialState: SettingsFormState = {
  ok: false,
  message: '',
}

const excelInitialState: ExcelUploadState = {
  ok: false,
  message: '',
}

export function KnowledgeForm({ tenantId, items, scrapeUrls }: KnowledgeFormProps) {
  const [isFaqOpen, setIsFaqOpen] = useState(true)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isUrlsOpen, setIsUrlsOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createKnowledgeItem.bind(null, tenantId), initialState)
  const [excelState, excelFormAction, excelPending] = useActionState(uploadKnowledgeExcel.bind(null, tenantId), excelInitialState)
  const [urlsState, urlsFormAction, urlsPending] = useActionState(updateScrapeUrls.bind(null, tenantId), initialState)
  const [urls, setUrls] = useState<string[]>(scrapeUrls.length ? scrapeUrls : [''])

  return (
    <>
      <section className="card stack">
        <button
          type="button"
          className="collapsible-header"
          aria-expanded={isFaqOpen}
          onClick={() => setIsFaqOpen((open) => !open)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2>Respuestas oficiales</h2>
            <span
              className="tooltip-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <Info size={15} strokeWidth={2} className="tooltip-icon" aria-label="Cómo funciona" />
              <span className="tooltip-tip" role="tooltip">
                Si una pregunta coincide con una respuesta oficial, TALIA responde con esta información antes de consultar la web o el agente externo.
              </span>
            </span>
          </span>
          <ChevronDown className="collapsible-chevron" data-open={isFaqOpen} aria-hidden="true" size={20} strokeWidth={2} />
        </button>

        {isFaqOpen ? (
          <>

            <form action={formAction} className="stack">
              {state.message ? (
                <p role="status" className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
                  {state.message}
                </p>
              ) : null}

              <div className="form-grid">
                <label className="field">
                  Pregunta del visitante
                  <input name="question" placeholder="Ej. On és el teatre?" required />
                  <span className="field-hint">Escribe la pregunta como la haría una persona real.</span>
                </label>

                <label className="field">
                  Tema
                  <select name="category" defaultValue="">
                    <option value="">Sin tema específico</option>
                    <option value="agenda">Programación / cartelera</option>
                    <option value="entradas">Entradas</option>
                    <option value="precios">Precios y descuentos</option>
                    <option value="horarios">Horarios</option>
                    <option value="ubicacion">Ubicación / cómo llegar</option>
                    <option value="accesibilidad">Accesibilidad</option>
                    <option value="visita">Visita / experiencia</option>
                  </select>
                  <span className="field-hint">Ayuda a TALIA a encontrar antes la respuesta adecuada.</span>
                </label>

                <label className="field">
                  Idioma
                  <select name="language" defaultValue="ca">
                    <option value="ca">Català</option>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                  <span className="field-hint">Idioma en el que está escrita la respuesta oficial.</span>
                </label>

                <label className="field">
                  Confianza de respuesta
                  <select name="priority" defaultValue="50">
                    <option value="80">Alta: usar casi siempre</option>
                    <option value="50">Normal: usar cuando encaje</option>
                    <option value="20">Baja: usar solo si coincide mucho</option>
                  </select>
                  <span className="field-hint">Súbela para información oficial crítica como ubicación, precios o accesibilidad.</span>
                </label>
              </div>

              <label className="field">
                Respuesta oficial
                <textarea name="answer" rows={5} placeholder="Ej. El TNC está en la Plaça de les Arts, 1, 08013 Barcelona." required />
                <span className="field-hint">TALÍA usará este texto como fuente fiable. Evita notas internas.</span>
              </label>

              <button className="button-primary" type="submit" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
                {pending ? 'Añadiendo...' : 'Añadir FAQ'}
              </button>
            </form>

            {items.length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pregunta</th>
                    <th>Tema</th>
                    <th>Idioma</th>
                    <th>Confianza</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <KnowledgeItemRow key={item.id} tenantId={tenantId} item={item} />
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Aún no hay respuestas oficiales cargadas.</p>
            )}
          </>
        ) : null}
      </section>

      <section className="card stack">
        <button
          type="button"
          className="collapsible-header"
          aria-expanded={isImportOpen}
          onClick={() => setIsImportOpen((open) => !open)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2>Importar desde Excel</h2>
            <span className="tooltip-wrap" onClick={(e) => e.stopPropagation()}>
              <Info size={15} strokeWidth={2} className="tooltip-icon" aria-label="Cómo funciona la importación" />
              <span className="tooltip-tip" role="tooltip">
                Columnas requeridas: <code>question</code>, <code>answer</code>. Opcionales: <code>category</code>, <code>language</code>, <code>priority</code>.
              </span>
            </span>
          </span>
          <ChevronDown className="collapsible-chevron" data-open={isImportOpen} aria-hidden="true" size={20} strokeWidth={2} />
        </button>

        {isImportOpen ? (
          <form action={excelFormAction} className="stack">
            {excelState.message ? (
              <p role="status" className={`notice ${excelState.ok ? 'notice-success' : 'notice-error'}`}>
                {excelState.message}
              </p>
            ) : null}

            <p className="notice notice-warning">
              Si ya tienes un Excel importado, sus respuestas serán reemplazadas por las del nuevo archivo. Las FAQs añadidas manualmente no se ven afectadas.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="field" style={{ flex: 1, margin: 0 }}>
                <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
              </label>
              <button className="button-primary" type="submit" disabled={excelPending} style={{ opacity: excelPending ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                {excelPending ? 'Importando...' : 'Importar Excel'}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="card stack">
        <button
          type="button"
          className="collapsible-header"
          aria-expanded={isUrlsOpen}
          onClick={() => setIsUrlsOpen((open) => !open)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2>URLs scrapeables</h2>
            <span className="tooltip-wrap" onClick={(e) => e.stopPropagation()}>
              <Info size={15} strokeWidth={2} className="tooltip-icon" aria-label="Qué son las URLs scrapeables" />
              <span className="tooltip-tip" role="tooltip">
                URLs que TALIA puede consultar para obtener información actualizada de tu web.
              </span>
            </span>
          </span>
          <ChevronDown className="collapsible-chevron" data-open={isUrlsOpen} aria-hidden="true" size={20} strokeWidth={2} />
        </button>

        {isUrlsOpen ? (
          <form action={urlsFormAction} className="stack">
            {urlsState.message ? (
              <p role="status" className={`notice ${urlsState.ok ? 'notice-success' : 'notice-error'}`}>
                {urlsState.message}
              </p>
            ) : null}

            <div className="stack" style={{ gap: 8 }}>
              {urls.map((url, index) => (
                <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    name={`scrape_url_${index + 1}`}
                    value={url}
                    onChange={(e) => setUrls((prev) => prev.map((u, i) => (i === index ? e.target.value : u)))}
                    placeholder="https://..."
                    style={{ flex: 1 }}
                  />
                  {urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setUrls((prev) => prev.filter((_, i) => i !== index))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                      aria-label="Eliminar URL"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {urls.length < 4 && (
                <button
                  type="button"
                  className="button-outline"
                  onClick={() => setUrls((prev) => [...prev, ''])}
                >
                  + Añadir URL
                </button>
              )}
              <button className="button-primary" type="submit" disabled={urlsPending} style={{ opacity: urlsPending ? 0.7 : 1 }}>
                {urlsPending ? 'Guardando...' : 'Guardar URLs'}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </>
  )
}

const SPRING = '600ms cubic-bezier(0.16, 1, 0.3, 1)'

function KnowledgeItemRow({ tenantId, item }: { tenantId: string; item: KnowledgeItem }) {
  const [expanded, setExpanded] = useState(false)
  const [state, formAction, pending] = useActionState(
    updateKnowledgeItem.bind(null, tenantId, item.id),
    { ok: false, message: '' }
  )

  // Key based on current item values so defaultValue resets after server revalidation
  const formKey = `${item.question}|${item.answer}|${item.category}|${item.language}|${item.priority}`

  return (
    <>
      <tr
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <td>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChevronDown
              size={13}
              strokeWidth={2}
              aria-hidden="true"
              style={{
                flexShrink: 0,
                color: 'var(--color-text-tertiary)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 300ms ease',
              }}
            />
            {item.question}
          </span>
        </td>
        <td>{getCategoryLabel(item.category)}</td>
        <td>{getLanguageLabel(item.language)}</td>
        <td>{getPriorityLabel(item.priority)}</td>
        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
          <DeleteKnowledgeItemButton tenantId={tenantId} itemId={item.id} />
        </td>
      </tr>
      <tr>
        <td colSpan={5} style={{ padding: 0, border: 'none' }}>
          <div
            style={{
              maxHeight: expanded ? 640 : 0,
              overflow: 'hidden',
              transition: `max-height ${SPRING}`,
            }}
          >
            <form
              key={formKey}
              action={formAction}
              className="stack"
              style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}
            >
              {state.message ? (
                <p role="status" className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
                  {state.message}
                </p>
              ) : null}

              <div className="form-grid">
                <label className="field">
                  Pregunta del visitante
                  <input name="question" defaultValue={item.question} required />
                </label>

                <label className="field">
                  Tema
                  <select name="category" defaultValue={item.category ?? ''}>
                    <option value="">Sin tema específico</option>
                    <option value="agenda">Programación / cartelera</option>
                    <option value="entradas">Entradas</option>
                    <option value="precios">Precios y descuentos</option>
                    <option value="horarios">Horarios</option>
                    <option value="ubicacion">Ubicación / cómo llegar</option>
                    <option value="accesibilidad">Accesibilidad</option>
                    <option value="visita">Visita / experiencia</option>
                  </select>
                </label>

                <label className="field">
                  Idioma
                  <select name="language" defaultValue={item.language}>
                    <option value="ca">Català</option>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </label>

                <label className="field">
                  Confianza de respuesta
                  <select name="priority" defaultValue={item.priority >= 70 ? '80' : item.priority <= 30 ? '20' : '50'}>
                    <option value="80">Alta: usar casi siempre</option>
                    <option value="50">Normal: usar cuando encaje</option>
                    <option value="20">Baja: usar solo si coincide mucho</option>
                  </select>
                </label>
              </div>

              <label className="field">
                Respuesta oficial
                <textarea name="answer" rows={4} defaultValue={item.answer} required />
              </label>

              <button
                className="button-primary"
                type="submit"
                disabled={pending}
                style={{ opacity: pending ? 0.7 : 1, alignSelf: 'flex-start' }}
              >
                {pending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </td>
      </tr>
    </>
  )
}

function DeleteKnowledgeItemButton({ tenantId, itemId }: { tenantId: string; itemId: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confirming) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setConfirming(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [confirming])

  function handleConfirm() {
    startTransition(async () => {
      await deleteKnowledgeItem(tenantId, itemId)
      setConfirming(false)
    })
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: confirming ? 180 : 0,
          opacity: confirming ? 1 : 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: `max-width ${SPRING}, opacity ${SPRING}`,
        }}
      >
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 13, fontWeight: 500, padding: '4px 4px 4px 2px', whiteSpace: 'nowrap' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: isPending ? 'default' : 'pointer', color: 'var(--color-error)', fontSize: 13, fontWeight: 600, padding: '4px 2px', opacity: isPending ? 0.5 : 1, whiteSpace: 'nowrap' }}
        >
          <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
          {isPending ? 'Eliminando...' : 'Confirmar'}
        </button>
      </div>

      <button
        onClick={() => setConfirming(true)}
        aria-label="Eliminar FAQ"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', borderRadius: 4, display: 'grid', placeItems: 'center', maxWidth: confirming ? 0 : 22, opacity: confirming ? 0 : 1, overflow: 'hidden', padding: confirming ? 0 : 4, transition: `max-width ${SPRING}, opacity ${SPRING}, padding ${SPRING}` }}
        onMouseEnter={(e) => { if (!confirming) e.currentTarget.style.color = 'var(--color-error)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}

function getCategoryLabel(category: string | null) {
  const labels: Record<string, string> = {
    agenda: 'Programación',
    entradas: 'Entradas',
    precios: 'Precios',
    horarios: 'Horarios',
    ubicacion: 'Ubicación',
    accesibilidad: 'Accesibilidad',
    visita: 'Visita',
  }

  return category ? labels[category] ?? category : '-'
}

function getLanguageLabel(language: string) {
  const labels: Record<string, string> = {
    ca: 'Català',
    es: 'Español',
    en: 'English',
  }

  return labels[language] ?? language
}

function getPriorityLabel(priority: number) {
  if (priority >= 70) return 'Alta'
  if (priority <= 30) return 'Baja'
  return 'Normal'
}
