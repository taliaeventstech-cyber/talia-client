import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseKnowledgeSpreadsheet } from './spreadsheet'

describe('parseKnowledgeSpreadsheet', () => {
  it('parses CSV headers and rows', async () => {
    const bytes = Buffer.from('question,answer\nHorario,A las 20h\n')
    const contents = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

    await expect(parseKnowledgeSpreadsheet('knowledge.csv', contents)).resolves.toEqual([
      { question: 'Horario', answer: 'A las 20h' },
    ])
  })

  it('parses the first Excel worksheet and skips empty rows', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Knowledge')
    sheet.addRow(['question', 'answer'])
    sheet.addRow(['Precio', '19 EUR'])
    sheet.addRow([])
    const bytes = await workbook.xlsx.writeBuffer()
    const contents = Uint8Array.from(bytes as unknown as ArrayLike<number>).buffer

    await expect(parseKnowledgeSpreadsheet('knowledge.xlsx', contents)).resolves.toEqual([
      { question: 'Precio', answer: '19 EUR' },
    ])
  })
})
