// Minimal RFC-4180-ish CSV serializer. Escapes quotes and wraps any
// field containing a comma, quote, or newline in double quotes.
export function toCSV(headers, rows) {
  const esc = (val) => {
    const s = val == null ? '' : String(val)
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const lines = []
  lines.push(headers.map(esc).join(','))
  for (const row of rows) {
    lines.push(row.map(esc).join(','))
  }
  // Prepend UTF-8 BOM so Excel reliably opens Arabic correctly.
  return '\uFEFF' + lines.join('\r\n')
}

export function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so some browsers actually trigger the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
