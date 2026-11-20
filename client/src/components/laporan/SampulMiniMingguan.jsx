// UBIN SAMPUL WEEKLY REPORT (HTML) — tiruan ringan pdf/sampulMingguan.jsx untuk galeri gaya
// di pembuat Weekly Report. Yang dibandingkan di ubin adalah TATA LETAK foto profil unit;
// hasil persisnya terlihat di Pratinjau Langsung (PDF asli) di kolom kanan.
import { PDF_TINTA, PDF_KERTAS, PDF_SOROT } from '../../config/warna-pdf'
import { TEMA_PDF, paletTema } from './pdf/tema'
import './sampul-mini.css'

const inisialUnit = (nama = '') => String(nama).split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase() || '?'
const STIKER = [
  { x: 4.6, y: 20.7, e: '🎉' }, { x: 31.2, y: 17, e: '✨' }, { x: 34.4, y: 61.1, e: '🏆' },
  { x: 5.4, y: 70.4, e: '💡' }, { x: 89.6, y: 8.5, e: '🎯' }, { x: 92.9, y: 77.8, e: '💚' },
]

function Avatar({ profil, nama, bulat = false }) {
  return (
    <span className={`smm-avatar${bulat ? ' bulat' : ''}${profil ? '' : ' otomatis'}`}>
      {profil ? <img src={profil} alt="" /> : <b>{inisialUnit(nama)}</b>}
    </span>
  )
}

export default function SampulMiniMingguan({
  gaya = 'mg-profil', tataFoto = 'bingkai', tema = 'terang', font = null, slotWarna = 1, nama, profil = null, foto = null,
  warnaHuruf = null, skala = 1, ringkas = false,
}) {
  const temaPdf = TEMA_PDF[tema] ?? TEMA_PDF.terang
  const { aksen, lapis, teksAksen } = paletTema(temaPdf, slotWarna)
  const NAMA = String(nama || 'Nama Unit').toUpperCase()
  const pakaiFoto = gaya === 'foto'
  const kosmik = temaPdf.gelap
  const bersih = !!temaPdf.bersih
  const style = {
    '--aksen': aksen, '--lapis': lapis, '--teks-aksen': teksAksen,
    // Tema bersih (Ekosistem): warna langsung dari tema PDF, sama seperti SampulMini.jsx.
    '--tinta-pdf': bersih ? temaPdf.tinta : kosmik ? '#A78BFA' : PDF_TINTA, '--huruf-pdf': warnaHuruf ?? (kosmik || bersih ? temaPdf.teks : PDF_TINTA),
    '--kertas-pdf': kosmik || bersih ? temaPdf.kartu : PDF_KERTAS, '--sorot-pdf': temaPdf.sorot ?? PDF_SOROT, '--kanvas-pdf': temaPdf.kanvas,
    '--pop': bersih ? temaPdf.sorot : kosmik ? (temaPdf.gradien?.[1] ?? '#DB2777') : PDF_SOROT,
    '--teks-sorot-pdf': temaPdf.teksSorot ?? PDF_TINTA, '--garis-pdf': temaPdf.garis ?? PDF_TINTA,
    '--hias': temaPdf.hias ?? '#7C3AED', '--hias-muda': temaPdf.hiasMuda ?? '#C4B5FD', '--teks-di-hias': temaPdf.teksDiHias ?? '#FFFFFF',
    '--n': Math.max(6, NAMA.length), '--skala': skala,
    ...(font ? { '--font-sampul': font } : {}),
    ...(foto ? { '--foto': `url("${foto}")` } : {}),
  }
  const id = pakaiFoto ? `foto smm-tata-${foto ? tataFoto : 'kosong'}` : gaya.replace('mg-', '')
  const kelas = ['sampul-mini', 'smm', `smm-${id}`, kosmik ? 'sampul-kosmik' : 'sampul-kertas', bersih ? 'sampul-bersih' : '', ringkas ? 'sampul-ringkas' : ''].filter(Boolean).join(' ')
  return (
    <div className={kelas} style={style} aria-hidden>
      {pakaiFoto && !foto ? <span className="smm-foto-kosong">📷</span> : null}
      {pakaiFoto && foto ? <span className="smm-foto-gambar" /> : null}
      <span className="smm-bidang" />
      {gaya === 'mg-poster' && <><span className="smm-ledak" /><span className="smm-pita-miring" /></>}
      {gaya === 'mg-stiker' && STIKER.map((s, i) => <span key={i} className="smm-stiker" style={{ left: `${s.x}%`, top: `${s.y}%` }}><span className="sampul-emoji">{s.e}</span></span>)}
      {gaya === 'mg-kalender' && (
        <span className="smm-kalender">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i === 1 ? 'kini' : i < 1 ? 'selesai' : ''} />)}</span>
      )}
      <Avatar profil={profil} nama={nama} bulat={gaya === 'mg-lencana'} />
      <span className="smm-judul">
        <b className="sampul-nama">{NAMA}</b>
        <span className="sampul-pr">Weekly Report</span>
      </span>
    </div>
  )
}
