// PRATINJAU SAMPUL (HTML) — tiruan ringan sampul PDF untuk galeri gaya dan
// pratinjau besar di halaman Unduh Laporan. Ukuran memakai satuan container
// (cqw) sehingga satu komponen tampil benar dari ubin 120px sampai pratinjau
// penuh. Warnanya hex PDF (kertas cetak / kosmik) — yang terlihat = yang dicetak.
import { PDF_TINTA, PDF_KERTAS, PDF_SOROT } from '../../config/warna-pdf'
import { TEMA_PDF, paletTema } from './pdf/tema'
import './sampul-mini.css'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'

// Tata letak stiker gaya "Tempelan Stiker" (persen bidang; sama dengan pdf/latar.jsx).
const STIKER = [
  { x: 57.1, y: 11.9, u: 8.1, isi: 'aksen', e: '🎨', rot: -6 },
  { x: 70.4, y: 7.4, u: 6.5, bentuk: 'kotak', isi: 'sorot', e: '📈', rot: 8 },
  { x: 83.3, y: 15.6, u: 9, isi: 'kertas', e: '✨' },
  { x: 64.2, y: 31.9, u: 7.3, bentuk: 'kotak', isi: 'lapis', e: '💰', rot: -10 },
  { x: 77.9, y: 36.3, u: 10, isi: 'aksen', e: '🚀', rot: 6 },
  { x: 92.1, y: 43.7, u: 5.6, isi: 'sorot', e: '🏆', rot: 12 },
  { x: 58.3, y: 55.6, u: 6.5, isi: 'kertas', e: '🎯' },
  { x: 71.9, y: 62.2, u: 7.7, bentuk: 'kotak', isi: 'kertas', e: '🤝', rot: -4 },
  { x: 86.5, y: 68.1, u: 6.9, isi: 'lapis', e: '🎉' },
]
// Konstelasi (versi kosmik "stiker"): titik pusat stiker kaca, persen bidang.
const KONSTELASI = [
  { x: 58.3, y: 13, u: 7.3, e: '🎨' }, { x: 72.9, y: 8.5, u: 6, e: '📈' }, { x: 85.4, y: 19.3, u: 8.5, e: '✨' },
  { x: 64.6, y: 36.3, u: 6.9, e: '💰' }, { x: 79.2, y: 40.7, u: 9.6, e: '🚀' }, { x: 91.7, y: 55.6, u: 5.4, e: '🏆' },
  { x: 61.5, y: 61.1, u: 6.3, e: '🎯' }, { x: 75, y: 66.7, u: 7.3, e: '🤝' },
]

// Logo ekosistem (cermin LogoPge di PDF): ubin ungu berinisial + nama, warna tulisan ikut teks sampul.
function LogoMini() {
  return (
    <span className="sampul-logo" aria-hidden>
      <span className="sampul-logo-ubin">{ECOSYSTEM_NAME.charAt(0)}</span>{ECOSYSTEM_NAME}
    </span>
  )
}

function Panah() {
  return (
    <svg viewBox="0 0 40 13" className="sampul-panah" aria-hidden>
      {[0, 1, 2].map(i => <polygon key={i} points={`${i * 14},0 ${i * 14 + 10},6.5 ${i * 14},13`} fill="currentColor" />)}
    </svg>
  )
}

const PENUH = ['gelap', 'gradasi', 'warna']

export default function SampulMini({
  gaya = 'kisi', tema = 'playground', tataFoto = 'bingkai', font = null, slotWarna = 1,
  nama, judulDok = 'Progress Report', bulanLabel, jenisLabel, kopNama, foto = null, ringkas = false, warnaHuruf = null, skala = 1,
}) {
  const temaPdf = TEMA_PDF[tema] ?? TEMA_PDF.terang
  const kosmik = temaPdf.gelap
  const bersih = !!temaPdf.bersih
  const { aksen, lapis, teksAksen } = paletTema(temaPdf, slotWarna)
  const NAMA = String(nama || 'Nama Circle').toUpperCase()
  const pakaiFoto = gaya === 'foto'
  const isiWarna = { aksen, lapis, sorot: temaPdf.sorot ?? PDF_SOROT, kertas: temaPdf.kartu ?? PDF_KERTAS }
  const style = {
    '--aksen': aksen, '--lapis': lapis, '--teks-aksen': teksAksen,
    // Warna miniatur = warna tema PDF yang dipilih (dulu konstanta tema Kertas) supaya galeri
    // sama dengan berkas yang diunduh. Hiasan (--hias dkk) dipakai aturan .sampul-bersih.
    '--tinta-pdf': temaPdf.tinta ?? PDF_TINTA, '--huruf-pdf': warnaHuruf ?? temaPdf.tinta ?? PDF_TINTA,
    '--kertas-pdf': temaPdf.kartu ?? PDF_KERTAS, '--sorot-pdf': temaPdf.sorot ?? PDF_SOROT, '--kanvas-pdf': temaPdf.kanvas,
    '--teks-sorot-pdf': temaPdf.teksSorot ?? PDF_TINTA, '--garis-pdf': temaPdf.garis ?? PDF_TINTA,
    '--hias': temaPdf.hias ?? '#7C3AED', '--hias-muda': temaPdf.hiasMuda ?? '#C4B5FD', '--teks-di-hias': temaPdf.teksDiHias ?? '#FFFFFF',
    '--g1': temaPdf.gradien?.[0] ?? '#8B5CF6', '--g2': temaPdf.gradien?.[1] ?? '#DB2777',
    '--n': Math.max(6, NAMA.length), '--skala': skala,
    ...(font ? { '--font-sampul': font } : {}),
    ...(foto ? { '--foto': `url("${foto}")` } : {}),
  }
  const kelas = [
    'sampul-mini', `sampul-${gaya}`, kosmik ? 'sampul-kosmik' : 'sampul-kertas', bersih ? 'sampul-bersih' : '',
    pakaiFoto ? `tata-${foto ? tataFoto : 'kosong'}` : '', ringkas ? 'sampul-ringkas' : '',
  ].filter(Boolean).join(' ')
  const judul = (
    <div className="sampul-judul">
      {!ringkas && jenisLabel && <span className="sampul-jenis">{jenisLabel}</span>}
      <b className="sampul-nama">{NAMA}</b>
      <span className="sampul-pr">{judulDok}</span>
      {!ringkas && bulanLabel && <span className="sampul-bulan">{bulanLabel}</span>}
    </div>
  )

  let hiasan = null
  if (pakaiFoto) {
    hiasan = !foto ? (
      <span className="sampul-foto-bingkai kosong"><span><span className="sampul-emoji">📷</span>{!ringkas && ' Unggah fotomu'}</span></span>
    ) : PENUH.includes(tataFoto) ? <span className="sampul-foto-penuh" />
      : tataFoto === 'belah' ? <span className="sampul-foto-belah" />
      : tataFoto === 'polaroid' ? <span className="sampul-foto-polaroid"><span /></span>
      : <span className="sampul-foto-bingkai" />
  } else if (!kosmik) {
    hiasan = (
      <>
        {gaya === 'kisi' && (
          <>
            <span className="sampul-cakram"><span className="sampul-emoji">📈</span></span>
            <span className="sampul-st bulat" style={{ left: '57.1%', top: '9.6%', '--u': '5.4cqw', background: PDF_SOROT, rotate: '-8deg' }}><span className="sampul-emoji">✨</span></span>
            <span className="sampul-st kotak" style={{ left: '90.4%', top: '68.9%', '--u': '5.2cqw', background: PDF_KERTAS, rotate: '10deg' }}><span className="sampul-emoji">🎯</span></span>
          </>
        )}
        {gaya === 'stiker' && STIKER.map((s, i) => (
          <span key={i} className={`sampul-st ${s.bentuk ?? 'bulat'}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, '--u': `${s.u}cqw`, background: isiWarna[s.isi], rotate: `${s.rot ?? 0}deg`, color: s.isi === 'aksen' ? teksAksen : PDF_TINTA }}>
            <span className="sampul-emoji">{s.e}</span>
          </span>
        ))}
        {gaya === 'stabilo' && (
          <>
            <span className="sampul-sapu" style={{ left: '31%', top: '13%', width: '85%', height: '24%', background: lapis }} />
            <span className="sampul-sapu" style={{ left: '-6%', top: '46%', width: '117%', height: '18%', background: PDF_SOROT, opacity: 0.92 }} />
            <span className="sampul-sapu" style={{ left: '54%', top: '72.5%', width: '58%', height: '8.5%', background: aksen, opacity: 0.85 }} />
          </>
        )}
        {gaya === 'halftone' && (
          <>
            <span className="sampul-ht" />
            <span className="sampul-ht sampul-ht-bawah" />
            {!ringkas && <span className="sampul-balon"><span className="sampul-emoji">💡</span> Laporan bulan ini sudah siap dibaca!</span>}
          </>
        )}
        {gaya === 'kapur' && (
          <>
            <span className="sampul-kapur-lingkar" />
            <span className="sampul-kapur-cakram"><span className="sampul-emoji">🚀</span></span>
          </>
        )}
        {gaya === 'warna' && <span className="sampul-warna-bulat" />}
      </>
    )
  } else {
    hiasan = (
      <>
        {gaya === 'kisi' && (
          <>
            <span className="km-planet"><span className="sampul-emoji">📈</span></span>
            <span className="km-cincin" />
            <span className="km-bulan" />
          </>
        )}
        {gaya === 'stiker' && (
          <>
            <svg className="km-garis" viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden>
              <polyline points={KONSTELASI.map(k => `${k.x + k.u / 2},${(k.y / 100) * 56.25 + k.u / 2}`).join(' ')} />
            </svg>
            {KONSTELASI.map((k, i) => (
              <span key={i} className="km-st" style={{ left: `${k.x}%`, top: `${k.y}%`, '--u': `${k.u}cqw`, background: i % 3 === 1 ? aksen : undefined }}>
                <span className="sampul-emoji">{k.e}</span>
              </span>
            ))}
          </>
        )}
        {gaya === 'stabilo' && (
          <>
            <span className="km-aurora km-a1" /><span className="km-aurora km-a2" /><span className="km-aurora km-a3" />
          </>
        )}
        {gaya === 'halftone' && (
          <>
            <span className="sampul-ht km-ht" />
            {!ringkas && <span className="sampul-balon"><span className="sampul-emoji">💡</span> Laporan bulan ini sudah siap dibaca!</span>}
          </>
        )}
        {gaya === 'kapur' && (
          <>
            <span className="km-nebula" />
            <span className="sampul-kapur-lingkar" />
            <span className="km-cakram"><span className="sampul-emoji">🚀</span></span>
          </>
        )}
        {gaya === 'warna' && <span className="km-gradasi" />}
      </>
    )
  }

  const kartuJudul = !pakaiFoto && gaya === 'warna'
  return (
    <div className={kelas} style={style} aria-hidden>
      {hiasan}
      {!ringkas && !(pakaiFoto && foto && tataFoto === 'bingkai') && (
        <div className="sampul-kop" title={kopNama}><LogoMini /></div>
      )}
      {kartuJudul ? <div className="sampul-kartu">{judul}</div> : judul}
      {!ringkas && <Panah />}
    </div>
  )
}
