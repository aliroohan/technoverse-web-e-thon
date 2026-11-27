export type CandidateRow = { name: string; email: string }

const parseCsv = (input: string): string[][] => {
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

const escapeCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

export function parseCandidateCsv(content: string): { rows: CandidateRow[]; skipped: number; error: string } {
  const table = parseCsv(content)
  if (table.length === 0) return { rows: [], skipped: 0, error: 'The file is empty.' }
  const header = table[0].map((cell) => cell.trim().toLowerCase())
  const nameIndex = header.indexOf('name')
  const emailIndex = header.indexOf('email')
  if (nameIndex < 0 || emailIndex < 0) {
    return { rows: [], skipped: 0, error: 'The file needs name and email columns.' }
  }

  let skipped = 0
  const rows: CandidateRow[] = []
  for (const cells of table.slice(1)) {
    const name = (cells[nameIndex] ?? '').trim()
    const email = (cells[emailIndex] ?? '').trim()
    if (!name || !email.includes('@')) {
      if (name || email) skipped += 1
      continue
    }
    rows.push({ name, email })
  }
  if (rows.length === 0) return { rows, skipped, error: 'No candidates with a name and email were found.' }
  return { rows, skipped, error: '' }
}

export function candidateCsv(rows: CandidateRow[]) {
  return ['name,email', ...rows.map((row) => `${escapeCell(row.name)},${escapeCell(row.email)}`)].join('\n')
}
