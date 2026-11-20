// Buka Keuangan › Pengeluaran dari mana saja (form laporan, popup Update Kas) tanpa perlu
// mengoper onNavigate turun-temurun: tulis URL-nya lalu picu popstate -- App.jsx membaca ulang
// lokasi persis seperti tombol Back/Forward (readLocation + slug 'keuangan').
export function bukaPengeluaran(studioId) {
  const q = new URLSearchParams({ tab: 'pengeluaran', ...(studioId ? { studioId } : {}) })
  window.history.pushState(null, '', `/keuangan?${q}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
