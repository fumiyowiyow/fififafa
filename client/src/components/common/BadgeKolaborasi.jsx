// Lencana "Kolaborasi · {mitra}" untuk studio yang angkanya dihitung di circle mitra
// (Studio.hitungDiEkosistem === false) — 13 Okt 2026. Studionya tetap terpantau, hanya tidak
// ikut total ekosistem; lencana ini menjelaskan kenapa.
export default function BadgeKolaborasi({ studio, style }) {
  if (!studio || studio.hitungDiEkosistem !== false) return null
  const mitra = studio.mitraKolaborasi ?? studio.mitra
  return (
    <span
      className="badge info"
      title="Angkanya dihitung di circle mitra — tidak masuk total ekosistem & Monthly Report"
      style={{ fontSize: 10.5, whiteSpace: 'normal', maxWidth: '100%', lineHeight: 1.3, ...style }}
    >
      🤝 Kolaborasi{mitra ? ` · ${mitra}` : ''}
    </span>
  )
}

/** Studio yang ikut dihitung di total ekosistem (bawaan true bila field belum ada). */
export const dihitungDiEkosistem = (s) => s?.hitungDiEkosistem !== false
