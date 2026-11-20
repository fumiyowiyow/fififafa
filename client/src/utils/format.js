const ID_LOCALE = 'id-ID'

// null = angka SENGAJA disamarkan server (uang unit di luar wilayah peran) → "—"; undefined/NaN tetap "Rp 0".
export function formatRp(angka) {
  if (angka === null) return '—'
  if (angka == null || isNaN(angka)) return 'Rp 0'
  return 'Rp ' + new Intl.NumberFormat(ID_LOCALE).format(Math.round(angka))
}

export function formatRpShort(angka) {
  if (angka === null) return '—'
  if (angka == null || isNaN(angka)) return 'Rp 0'
  const n = Math.abs(angka)
  if (n >= 1_000_000_000) return `Rp ${(angka / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `Rp ${(angka / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `Rp ${(angka / 1_000).toFixed(1)}K`
  return formatRp(angka)
}

export function formatUSD(angka) {
  if (angka === null) return '—'
  if (angka == null || isNaN(angka)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(angka)
}

export function getBulanLabel(bulan, tahun) {
  const d = new Date(tahun, bulan - 1, 1)
  return d.toLocaleDateString(ID_LOCALE, { month: 'long', year: 'numeric' })
}

export function formatTanggal(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(ID_LOCALE, {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export function formatTanggalPendek(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(ID_LOCALE, {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}
