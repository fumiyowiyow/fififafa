export function downloadCsv(filename, rows) {
  if (!rows?.length) return
  const headers = Object.keys(rows[0])
  const escape = (v) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers, ...rows.map(r => headers.map(h => escape(r[h])))]
  const csv   = lines.map(r => r.join(',')).join('\r\n')
  const blob  = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
