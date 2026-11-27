/** Minimal CSV reader that understands quoted commas and doubled quotes. */
export const parseCsv = (input: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(cell.trim())
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell.trim())
      cell = ''
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      continue
    }
    cell += char
  }

  row.push(cell.trim())
  if (row.some((value) => value.length > 0)) rows.push(row)
  return rows
}

export const rowsToRecords = (rows: string[][]) => {
  const [header, ...rest] = rows
  if (!header) return []
  const keys = header.map((key) => key.trim())
  return rest.map((row, index) => {
    const record: Record<string, string> = {}
    keys.forEach((key, cellIndex) => {
      record[key] = row[cellIndex] ?? ''
    })
    return { row: index + 2, record }
  })
}
