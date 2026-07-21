// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { sanitizeClearViewResponse, type ClearViewRequest, type ClearViewResponse } from './clear-view'
import {
  getClearViewInputLength,
  isClearViewInputTooLarge,
} from './clear-view-security'

const tenantId = '00000000-0000-4000-8000-000000000001'

describe('clear view response sanitizing', () => {
  it('keeps only actions that existed in the extracted page input', () => {
    const allowedActions: ClearViewRequest['page']['actions'] = [
      { label: 'Comprar entradas', href: 'https://example.com/tickets' },
      { label: 'Contacto', href: 'mailto:info@example.com' },
    ]

    const response: ClearViewResponse = {
      title: 'Programacion clara',
      summary: ['Compra entradas y revisa horarios.', 'Compra entradas y revisa horarios.'],
      actions: [
        { label: 'Entradas', href: 'https://example.com/tickets' },
        { label: 'Inventado', href: 'https://evil.example/phishing' },
        { label: 'Entradas duplicadas', href: 'https://example.com/tickets' },
      ],
      sections: [
        { type: 'important', title: 'Claves', items: ['Horario 20:00', 'Horario 20:00'] },
        { type: 'other', title: 'Vacio', items: [] },
      ],
      warnings: ['No sustituye una auditoria.', 'No sustituye una auditoria.'],
    }

    expect(sanitizeClearViewResponse(response, allowedActions)).toEqual({
      title: 'Programacion clara',
      summary: ['Compra entradas y revisa horarios.'],
      actions: [
        { label: 'Entradas', href: 'https://example.com/tickets' },
        { label: 'Entradas duplicadas', href: 'https://example.com/tickets' },
      ],
      sections: [
        { type: 'important', title: 'Claves', items: ['Horario 20:00'] },
      ],
      warnings: ['No sustituye una auditoria.'],
    })
  })
})

describe('clear view request guards', () => {
  it('detects oversized extracted page input before provider calls', () => {
    const request: ClearViewRequest = {
      tenantId,
      url: 'https://example.com/agenda',
      language: 'es',
      page: {
        title: 'Agenda',
        summary: ['x'.repeat(300), 'y'.repeat(300)],
        actions: [{ label: 'Entradas', href: 'https://example.com/tickets' }],
        sections: Array.from({ length: 8 }, (_, index) => ({
          type: 'other',
          title: `Seccion ${index}`,
          items: Array.from({ length: 6 }, () => 'z'.repeat(240)),
        })),
      },
    }

    expect(getClearViewInputLength(request)).toBeGreaterThan(12_000)
    expect(isClearViewInputTooLarge(request)).toBe(true)
  })
})
