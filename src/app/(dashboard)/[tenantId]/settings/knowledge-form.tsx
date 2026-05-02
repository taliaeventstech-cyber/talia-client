'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { createKnowledgeItem, uploadKnowledgeExcel, type SettingsFormState, type ExcelUploadState } from './actions'

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
}

const initialState: SettingsFormState = {
  ok: false,
  message: '',
}

const excelInitialState: ExcelUploadState = {
  ok: false,
  message: '',
}

export function KnowledgeForm({ tenantId, items }: KnowledgeFormProps) {
  const [state, formAction, pending] = useActionState(createKnowledgeItem.bind(null, tenantId), initialState)
  const [excelState, excelFormAction, excelPending] = useActionState(uploadKnowledgeExcel.bind(null, tenantId), excelInitialState)
  const [open, setOpen] = useState(true)

  return (
    <section className="card stack">
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <p className="section-label">Base de Conocimiento</p>
          <h2>Respuestas oficiales</h2>
          <p className="muted">Añade respuestas que TALIA debe usar como fuente principal cuando el visitante haga una pregunta parecida.</p>
        </div>
        <ChevronDown
          size={20}
          aria-hidden="true"
          style={{
            transition: 'transform 150ms ease',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        />
      </button>

      {open ? (
        <>
      <div className="knowledge-help">
        <strong>Cómo funciona</strong>
        <span>Si una pregunta coincide con una respuesta oficial, TALIA responde con esta información antes de consultar la web o el agente externo.</span>
      </div>

      <form action={formAction} className="stack">
        {state.message ? (
          <p
            role="status"
            className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}
          >
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
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.question}</td>
                <td>{getCategoryLabel(item.category)}</td>
                <td>{getLanguageLabel(item.language)}</td>
                <td>{getPriorityLabel(item.priority)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Aún no hay respuestas oficiales cargadas para este tenant.</p>
      )}

      <div className="knowledge-divider" />

      <div>
        <p className="section-label">Importar desde Excel</p>
        <p className="muted" style={{ marginTop: 4 }}>Columnas requeridas: <code>question</code>, <code>answer</code>. Opcionales: <code>category</code>, <code>language</code>, <code>priority</code>.</p>
      </div>

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
        </>
      ) : null}
    </section>
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
