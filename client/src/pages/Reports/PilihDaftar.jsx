// DROPDOWN BERTEMA untuk memilih lingkup / unit usaha di pembuat laporan (arahan Owner
// 9 Okt 2026: "dibuat dropdown saja, tetap dengan gaya temanya"). Memakai <select> asli
// (keyboard & layar pembaca gratis) berkulit pil kartun: tanda warna circle di kiri,
// panah di kanan, grup per circle lewat <optgroup>.
import { warnaCircle } from '../../config/ekosistem'

/**
 * @param grup      [{ kunci, label|null, pilihan: [{ id, nama, ket?, slotWarna?, jenis?, emoji? }] }]
 * @param terpilih  pilihan yang sedang aktif (untuk tanda warna/emoji di kiri)
 */
export default function PilihDaftar({ id, label, nilai, onUbah, grup = [], terpilih = null, kosong = 'Pilih…' }) {
  const warna = terpilih?.slotWarna ? warnaCircle(terpilih.slotWarna) : null
  const opsi = (p) => <option key={p.id} value={p.id}>{p.ket ? `${p.nama} · ${p.ket}` : p.nama}</option>
  return (
    <label className="pl-select-wrap" htmlFor={id}>
      <span className="pl-select-tanda" aria-hidden>
        {terpilih?.emoji
          ? <span className="pl-emoji">{terpilih.emoji}</span>
          : <span className={`titik-circle${terpilih?.jenis === 'rumah-usaha' ? ' filter-org-titik-rumah' : ''}`} style={{ '--warna-circle': warna ?? 'var(--tinta-pekat)' }} />}
      </span>
      <select id={id} className="form-input pl-select" value={nilai ?? ''} onChange={e => onUbah(e.target.value)} aria-label={label}>
        {!nilai && <option value="" disabled>{kosong}</option>}
        {grup.map(g => (g.label
          ? <optgroup key={g.kunci} label={g.label}>{g.pilihan.map(opsi)}</optgroup>
          : g.pilihan.map(opsi)))}
      </select>
      <span className="pl-select-panah" aria-hidden>▾</span>
    </label>
  )
}
