// Tipe unit usaha (Studio.tipe) -- satu sumber label & warna badge.
// KORPORASI (8 Nov 2026) = unit berbadan hukum (PT) langsung di bawah ekosistem; boleh membawahi
// unit lain (Studio.indukId) yang angkanya dijumlah ke Korporasi, bukan ke circle.
export const TIPE_UNIT = ['KORPORASI', 'STUDIO', 'PROJECT']
export const LABEL_TIPE_UNIT = { STUDIO: 'Studio', PROJECT: 'Project', KORPORASI: 'Korporasi' }

const WARNA = {
  STUDIO:    { background: 'var(--cyan-subtle)',   color: 'var(--cyan)' },
  PROJECT:   { background: 'var(--accent-subtle)', color: 'var(--accent-light)' },
  KORPORASI: { background: 'var(--amber-subtle)',  color: 'var(--amber)' },
}
/** { background, color } untuk badge tipe unit. */
export const warnaTipe = (tipe) => WARNA[tipe] ?? WARNA.PROJECT
/** Kelas .badge (info/purple/warning) untuk tipe unit. */
export const kelasBadgeTipe = (tipe) => ({ STUDIO: 'info', KORPORASI: 'warning' }[tipe] ?? 'purple')

/** Nama naungan unit: circle / rumah usaha / korporasi induknya. */
export const naunganNama = (s) => (s.circle ?? s.rumahUsaha)?.nama ?? s.induk?.nama
  ?? (s.tipe === 'KORPORASI' ? 'Ekosistem' : '—')
