import ExcelJS from 'exceljs'
import { parse } from 'csv-parse/sync'

export async function parseKnowledgeSpreadsheet(fileName: string, contents: ArrayBuffer) {
  if (fileName.toLowerCase().endsWith('.csv')) {
    return parse(Buffer.from(contents), {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, unknown>>
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Buffer.from(contents) as unknown as ExcelJS.Buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet || worksheet.rowCount === 0) return []

  const headerValues = worksheet.getRow(1).values
  const headers = (Array.isArray(headerValues) ? headerValues : [])
    .slice(1)
    .map((value) => String(value ?? '').trim())

  const rows: Array<Record<string, unknown>> = []
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const record: Record<string, unknown> = {}
    let hasValue = false

    headers.forEach((header, index) => {
      if (!header) return
      const value = row.getCell(index + 1).text.trim()
      if (value) hasValue = true
      record[header] = value
    })

    if (hasValue) rows.push(record)
  }

  return rows
}
