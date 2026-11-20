// ─────────────────────────────────────────────────────────────────────────
// LATAR dokumen (Progress Report & SKB): SAMPUL, PEMBATAS BAGIAN, PENUTUP.
// Enam gaya × dua tema (Playground: Kertas Kisi, Tempelan Stiker, Coretan
// Stabilo, Halftone Komik, Papan Kapur, Blok Warna · Kosmik: Orbit,
// Konstelasi, Aurora, Debu Bintang, Nebula, Gradasi) + FOTO SENDIRI dengan
// enam tata letak (Bingkai, Penuh Gelap, Penuh Gradasi, Warna Circle, Belah
// Dua, Polaroid). Halaman isi tidak memakai latar ini. Semua hiasan vektor.
// ─────────────────────────────────────────────────────────────────────────
import { Page, View, Image, Svg, Path, Circle, Ellipse, Line, G, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer'
import {
  W, H, T, Stiker, Stabilo, Ikon, LogoPge, LogoLaporan, Panah, KisiTitik, LatarBintang, TitikCircle,
  campur, teksDi, useTema, useMetrik,
} from './primitif'
import { ukuranPas } from './metrikHuruf'

const PUTIH = '#FFFFFF'
const HITAM = '#000000'

// ── Pola ─────────────────────────────────────────────────────────────────
/** Halftone: titik membesar ke arah satu pojok (satu Path berisi busur). */
export function jalurHalftone({ x0, y0, x1, y1, pojokX, pojokY, jangkau, rMaks, jarak = 13 }) {
  let d = ''
  for (let y = y0; y <= y1; y += jarak) {
    for (let x = x0 + ((Math.round((y - y0) / jarak) % 2) * jarak) / 2; x <= x1; x += jarak) {
      const r = rMaks * (1 - Math.hypot(x - pojokX, y - pojokY) / jangkau)
      if (r < 0.5) continue
      d += `M${(x - r).toFixed(1)} ${y}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`
    }
  }
  return d
}

/** Stiker bulat/persegi berisi emoji. Playground: bayang cap; Kosmik: kaca. */
export function StikerEmoji({ x, y, u, bentuk = 'bulat', isi, e, rot = 0, warnaIkon }) {
  const t = useTema()
  const r = bentuk === 'bulat' ? u / 2 : u * 0.2
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: u + 5, height: u + 5, transform: `rotate(${rot}deg)` }}>
      {t.bayang ? <View style={{ position: 'absolute', left: 5, top: 5, width: u, height: u, borderRadius: r, backgroundColor: t.bayang }} /> : null}
      <View style={{ position: 'absolute', left: 0, top: 0, width: u, height: u, borderRadius: r, backgroundColor: isi, borderWidth: (t.bersih ? 1 : t.gelap ? 1.2 : 2.5), borderColor: t.bersih ? t.garisKuat : t.gelap ? t.garisKuat : t.tinta, alignItems: 'center', justifyContent: 'center' }}>
        <Ikon e={e} ukuran={u * 0.52} warna={warnaIkon ?? teksDi(isi)} />
      </View>
    </View>
  )
}

const UTUH = { position: 'absolute', top: 0, left: 0, width: W, height: H }

/** Gambar latar + hiasan satu gaya. varian 'sampul' | 'penutup' (penutup lebih tenang). */
function LatarGaya({ gaya, varian = 'sampul' }) {
  const t = useTema()
  return t.gelap ? <LatarKosmik gaya={gaya} varian={varian} /> : <LatarKertas gaya={gaya} varian={varian} />
}

function LatarKertas({ gaya, varian }) {
  const t = useTema()
  const { aksen, lapis, teksAksen } = t.palet
  const sampul = varian === 'sampul'
  switch (gaya) {
    case 'stiker': {
      const daftar = sampul
        ? [
            { x: 548, y: 64, u: 78, isi: aksen, e: '🎨', rot: -6 },
            { x: 676, y: 40, u: 62, bentuk: 'kotak', isi: t.sorot, e: '📈', rot: 8 },
            { x: 800, y: 84, u: 86, isi: t.kartu, e: '✨' },
            { x: 616, y: 172, u: 70, bentuk: 'kotak', isi: lapis, e: '💰', rot: -10 },
            { x: 748, y: 196, u: 96, isi: aksen, e: '🚀', rot: 6 },
            { x: 884, y: 236, u: 54, isi: t.sorot, e: '🏆', rot: 12 },
            { x: 560, y: 300, u: 62, isi: t.kartu, e: '🎯' },
            { x: 690, y: 336, u: 74, bentuk: 'kotak', isi: t.kartu, e: '🤝', rot: -4 },
            { x: 830, y: 368, u: 66, isi: lapis, e: '🎉' },
          ]
        : [
            { x: 640, y: 70, u: 70, isi: aksen, e: '🎉', rot: -6 },
            { x: 780, y: 120, u: 84, isi: t.sorot, e: '👋', rot: 8 },
            { x: 690, y: 250, u: 64, bentuk: 'kotak', isi: lapis, e: '💚', rot: -8 },
            { x: 840, y: 300, u: 60, isi: t.kartu, e: '✨' },
          ]
      return (
        <>
          <View style={[UTUH, { backgroundColor: t.kanvas }]} />
          <KisiTitik opacity={0.15} />
          {daftar.map((s, i) => <StikerEmoji key={i} {...s} />)}
        </>
      )
    }
    case 'stabilo':
      return (
        <>
          <View style={[UTUH, { backgroundColor: t.kanvas }]} />
          <KisiTitik opacity={0.08} />
          <View style={{ position: 'absolute', left: 300, top: sampul ? 70 : 60, width: 820, height: 130, backgroundColor: lapis, borderRadius: 60, transform: 'rotate(-9deg)' }} />
          <View style={{ position: 'absolute', left: -60, top: sampul ? 250 : 230, width: 1120, height: 96, backgroundColor: t.sorot, borderRadius: 48, transform: 'rotate(-9deg)', opacity: 0.92 }} />
          <View style={{ position: 'absolute', left: 520, top: sampul ? 392 : 380, width: 560, height: 46, backgroundColor: aksen, borderRadius: 23, transform: 'rotate(-9deg)', opacity: 0.85 }} />
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Path d="M612 120c40-26 84-30 120-6s70 22 104-4" stroke={t.bersih ? t.hiasMuda : t.tinta} strokeWidth={t.bersih ? 2 : 3} fill="none" strokeLinecap="round" />
          </Svg>
        </>
      )
    case 'halftone':
      return (
        <>
          <View style={[UTUH, { backgroundColor: t.kanvas }]} />
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Path d={jalurHalftone({ x0: 470, y0: 0, x1: W, y1: 360, pojokX: W, pojokY: 0, jangkau: 470, rMaks: 5.6 })} fill={aksen} fillOpacity={aksen === t.tinta ? 0.75 : 0.95} />
            <Path d={jalurHalftone({ x0: 640, y0: 430, x1: W, y1: H, pojokX: W, pojokY: H, jangkau: 260, rMaks: 4 })} fill={t.tinta} fillOpacity={0.35} />
          </Svg>
          {sampul && <Balon />}
        </>
      )
    case 'kapur':
      return (
        <>
          <View style={[UTUH, { backgroundColor: t.tinta }]} />
          <KisiTitik warna={PUTIH} opacity={0.07} />
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Circle cx={760} cy={sampul ? 232 : 250} r={176} stroke={PUTIH} strokeOpacity={0.45} strokeWidth={2} strokeDasharray="10 9" fill="none" />
            <Path d="M560 92c30-40 92-46 120-10" stroke={PUTIH} strokeOpacity={0.6} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Path d="M672 70l10 14-16 4" stroke={PUTIH} strokeOpacity={0.6} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={780} cy={sampul ? 240 : 258} r={104} fill={aksen === t.tinta ? '#2E2E2E' : aksen} stroke={PUTIH} strokeWidth={3} />
          </Svg>
          <Ikon e={sampul ? '🚀' : '👋'} ukuran={96} warna={aksen === t.tinta ? PUTIH : teksAksen} style={{ position: 'absolute', left: 780 - 48, top: (sampul ? 240 : 258) - 48 }} />
          <Ikon e="✨" ukuran={34} warna={t.sorot} style={{ position: 'absolute', left: 890, top: 70 }} />
          <Ikon e="⭐" ukuran={22} warna={PUTIH} style={{ position: 'absolute', left: 612, top: 380 }} />
        </>
      )
    case 'warna':
      return (
        <View style={[UTUH, { backgroundColor: aksen }]}>
          <KisiTitik warna={teksAksen} opacity={0.08} />
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Circle cx={800} cy={150} r={220} fill={campur(aksen, teksAksen, 0.1)} />
            <Circle cx={900} cy={470} r={120} fill={campur(aksen, teksAksen, 0.07)} />
          </Svg>
        </View>
      )
    case 'kisi':
    default: {
      const cy = sampul ? 231 : 253
      return (
        <>
          <View style={[UTUH, { backgroundColor: t.kanvas }]} />
          <KisiTitik opacity={0.17} />
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            {!t.bersih && <Circle cx={744} cy={cy + 9} r={180} fill={t.tinta} />}
            <Circle cx={735} cy={cy} r={180} fill={aksen} stroke={t.bersih ? aksen : t.tinta} strokeWidth={t.bersih ? 0 : 3} />
            <Circle cx={735} cy={cy} r={142} stroke={teksAksen} strokeOpacity={0.5} strokeWidth={1.6} strokeDasharray="7 7" fill="none" />
          </Svg>
          <Ikon e={sampul ? '📈' : '👋'} ukuran={118} warna={teksAksen} style={{ position: 'absolute', left: 735 - 59, top: cy - 59 }} />
          <StikerEmoji x={548} y={52} u={52} isi={t.sorot} e="✨" rot={-8} />
          <StikerEmoji x={868} y={372} u={50} bentuk="kotak" isi={t.kartu} e={sampul ? '🎯' : '💚'} rot={10} />
          {sampul && <StikerEmoji x={578} y={366} u={44} isi={lapis} e="💰" />}
        </>
      )
    }
  }
}

function Balon() {
  const t = useTema()
  return (
    <View style={{ position: 'absolute', left: 600, top: 330, width: 290 }}>
      <Stiker isiStyle={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }} bayang={6}>
        <Ikon e="💡" ukuran={30} />
        <T f="judul" w={600} s={17} c={t.tinta} style={{ marginLeft: 12, flexShrink: 1 }}>Laporan bulan ini sudah siap dibaca!</T>
      </Stiker>
      <Svg viewBox="0 0 40 30" style={{ position: 'absolute', left: 40, bottom: -24, width: 40, height: 30 }}>
        <Path d="M2 0L14 26L26 0Z" fill={t.kartu} stroke={t.gelap ? t.garis : t.tinta} strokeWidth={(t.bersih ? 1 : t.gelap ? 1.2 : 2.5)} strokeLinejoin="round" />
        <Path d="M1 0L27 0" stroke={t.kartu} strokeWidth={4} />
      </Svg>
    </View>
  )
}

/** Versi KOSMIK keenam gaya (rumahpara.app): luar angkasa, kaca, gradien ungu→magenta. */
function LatarKosmik({ gaya, varian }) {
  const t = useTema()
  const { aksen } = t.palet
  const [g1, g2] = t.gradien
  const sampul = varian === 'sampul'
  const dasar = (kuat = 1, benih = 7) => (
    <>
      <View style={[UTUH, { backgroundColor: t.kanvas }]} />
      <LatarBintang kuat={kuat} benih={benih} />
    </>
  )
  switch (gaya) {
    case 'stiker': { // Konstelasi
      const titik = sampul
        ? [{ x: 560, y: 70, u: 70, e: '🎨' }, { x: 700, y: 46, u: 58, e: '📈' }, { x: 820, y: 104, u: 82, e: '✨' }, { x: 620, y: 196, u: 66, e: '💰' }, { x: 760, y: 220, u: 92, e: '🚀' }, { x: 880, y: 300, u: 52, e: '🏆' }, { x: 590, y: 330, u: 60, e: '🎯' }, { x: 720, y: 360, u: 70, e: '🤝' }]
        : [{ x: 650, y: 80, u: 70, e: '🎉' }, { x: 790, y: 140, u: 84, e: '👋' }, { x: 700, y: 270, u: 64, e: '💚' }, { x: 850, y: 310, u: 60, e: '✨' }]
      const pusat = titik.map(s => [s.x + s.u / 2, s.y + s.u / 2])
      return (
        <>
          {dasar(0.9, 13)}
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            {pusat.slice(1).map(([x, y], i) => (
              <Line key={i} x1={pusat[i][0]} y1={pusat[i][1]} x2={x} y2={y} stroke={t.hiasMuda} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 5" />
            ))}
          </Svg>
          {titik.map((s, i) => <StikerEmoji key={i} x={s.x} y={s.y} u={s.u} e={s.e} isi={i % 3 === 1 ? aksen : t.kartu} warnaIkon={PUTIH} />)}
        </>
      )
    }
    case 'stabilo': // Aurora
      return (
        <>
          {dasar(0.8, 17)}
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Defs>
              <LinearGradient id="aur1" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={g1} stopOpacity={0} /><Stop offset="0.5" stopColor={g1} stopOpacity={0.75} /><Stop offset="1" stopColor={g2} stopOpacity={0.1} /></LinearGradient>
              <LinearGradient id="aur2" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={t.hiasKedua} stopOpacity={0.05} /><Stop offset="0.6" stopColor={t.hiasKedua} stopOpacity={0.55} /><Stop offset="1" stopColor={g1} stopOpacity={0} /></LinearGradient>
              <LinearGradient id="aur3" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={g2} stopOpacity={0} /><Stop offset="0.7" stopColor={g2} stopOpacity={0.7} /><Stop offset="1" stopColor={g2} stopOpacity={0} /></LinearGradient>
            </Defs>
            <G transform="rotate(-9 480 270)">
              <Rect x={260} y={sampul ? 80 : 70} width={900} height={120} rx={60} fill="url(#aur1)" />
              <Rect x={-80} y={sampul ? 258 : 240} width={1120} height={84} rx={42} fill="url(#aur2)" />
              <Rect x={480} y={sampul ? 392 : 380} width={620} height={46} rx={23} fill="url(#aur3)" />
            </G>
          </Svg>
        </>
      )
    case 'halftone': // Debu Bintang
      return (
        <>
          {dasar(0.7, 19)}
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Path d={jalurHalftone({ x0: 470, y0: 0, x1: W, y1: 360, pojokX: W, pojokY: 0, jangkau: 470, rMaks: 5.2 })} fill={g1} fillOpacity={0.85} />
            <Path d={jalurHalftone({ x0: 640, y0: 430, x1: W, y1: H, pojokX: W, pojokY: H, jangkau: 260, rMaks: 4 })} fill={g2} fillOpacity={0.6} />
          </Svg>
          {sampul && <Balon />}
        </>
      )
    case 'kapur': // Nebula
      return (
        <>
          {dasar(1.6, 23)}
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Defs>
              <LinearGradient id="neb-cakram" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={g1} /><Stop offset="1" stopColor={g2} /></LinearGradient>
            </Defs>
            <Circle cx={760} cy={sampul ? 232 : 250} r={176} stroke={t.hiasMuda} strokeOpacity={0.4} strokeWidth={1.5} strokeDasharray="8 8" fill="none" />
            <Circle cx={780} cy={sampul ? 240 : 258} r={104} fill="url(#neb-cakram)" />
          </Svg>
          <Ikon e={sampul ? '🚀' : '👋'} ukuran={96} warna={PUTIH} style={{ position: 'absolute', left: 780 - 48, top: (sampul ? 240 : 258) - 48 }} />
          <Ikon e="✨" ukuran={30} warna={t.hiasKilau} style={{ position: 'absolute', left: 890, top: 70 }} />
        </>
      )
    case 'warna': // Gradasi
      return (
        <>
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Defs>
              <LinearGradient id="gradasi" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={g1} /><Stop offset="1" stopColor={g2} /></LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill="url(#gradasi)" />
            <Circle cx={800} cy={150} r={220} fill={PUTIH} fillOpacity={0.07} />
            <Circle cx={900} cy={470} r={120} fill={PUTIH} fillOpacity={0.05} />
          </Svg>
          <LatarBintang kuat={0.7} nebula={false} benih={29} />
        </>
      )
    case 'kisi': // Orbit
    default: {
      const cy = sampul ? 231 : 253
      return (
        <>
          {dasar(1, 7)}
          <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
            <Defs>
              <LinearGradient id="planet" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={aksen === t.hias ? g1 : aksen} /><Stop offset="1" stopColor={g2} /></LinearGradient>
            </Defs>
            <Circle cx={735} cy={cy} r={170} fill="url(#planet)" />
            <G transform={`rotate(-16 735 ${cy})`}>
              <Ellipse cx={735} cy={cy} rx={250} ry={62} stroke={t.hiasMuda} strokeOpacity={0.6} strokeWidth={2} fill="none" />
            </G>
            <Circle cx={512} cy={cy + 40} r={12} fill={t.hiasKedua} />
          </Svg>
          <Ikon e={sampul ? '📈' : '👋'} ukuran={112} warna={PUTIH} style={{ position: 'absolute', left: 735 - 56, top: cy - 56 }} />
        </>
      )
    }
  }
}

// ── Blok judul ───────────────────────────────────────────────────────────
function BlokJudul({ nama, judulDok, bulanLabel, warnaTeks, lebar = 470, maks = 88, kecil = false }) {
  const t = useTema()
  const m = useMetrik()
  const NAMA = String(nama).toUpperCase()
  const s = ukuranPas(NAMA, m.judul700, lebar, maks, 30)
  const latarGelap = (warnaTeks ?? t.tinta) === PUTIH || t.gelap
  const logoUnit = t.identitas?.logoUnit
  return (
    <View>
      {/* Logo unit yang diunggah (9 Okt 2026) di atas nama — dipaskan ke tinggi, rata kiri */}
      {logoUnit ? <Image src={logoUnit} style={{ height: kecil ? 44 : 58, width: kecil ? 160 : 210, objectFit: 'contain', objectPositionX: 0, marginBottom: kecil ? 8 : 12 }} /> : null}
      <T pas f="judul" w={700} s={s} c={warnaTeks ?? t.tinta} style={{ lineHeight: 1 }}>{NAMA}</T>
      <Stabilo style={{ marginTop: kecil ? 8 : 12 }} penuh={latarGelap}>
        <T f="judul" w={600} s={kecil ? 22 : 28} c={t.teksSorot}>{judulDok}</T>
      </Stabilo>
      {bulanLabel ? <T w={700} s={13} c={warnaTeks ?? t.tinta} style={{ letterSpacing: 4.5, marginTop: 16 }}>{String(bulanLabel).toUpperCase()}</T> : null}
    </View>
  )
}

/**
 * Logo + nama di pojok kiri atas. `pge` (kop ekosistem, arahan Owner 10 Okt 2026): logo circle tetap
 * di depan, lalu garis pemisah + logo kata Playground Ecosystem menggantikan teks namanya; dokumen
 * tingkat ekosistem (tanpa circle) cukup logo PGE saja.
 */
export function KopEkosistem({ nama, warna, terang = false, kiri = 60, atas = 40, pge = false }) {
  const t = useTema()
  if (pge) {
    const tinta = warna ?? (terang ? PUTIH : (t.gelap ? t.teks : t.tinta))
    const adaCircle = !!t.identitas?.nama
    return (
      <View style={{ position: 'absolute', left: kiri, top: atas, flexDirection: 'row', alignItems: 'center' }}>
        {adaCircle ? (
          <>
            <LogoLaporan ukuran={t.identitas?.logoCircle ? 30 : 24} ubin={terang ? PUTIH : undefined} isi={terang ? HITAM : undefined} />
            <View style={{ width: 1.5, height: 26, marginHorizontal: 12, backgroundColor: tinta, opacity: 0.45 }} />
            <LogoPge ukuran={30} warna={tinta} />
          </>
        ) : <LogoPge ukuran={40} warna={tinta} />}
      </View>
    )
  }
  return (
    <View style={{ position: 'absolute', left: kiri, top: atas, flexDirection: 'row', alignItems: 'center' }}>
      <LogoLaporan ukuran={t.identitas?.logoCircle ? 30 : 22} ubin={terang ? PUTIH : undefined} isi={terang ? HITAM : undefined} />
      <T w={700} s={10.5} c={warna ?? t.tinta} style={{ marginLeft: 10, letterSpacing: 1.6, textTransform: 'uppercase' }}>{nama}</T>
    </View>
  )
}

export function PilJenis({ teks, terang = false }) {
  const t = useTema()
  const isi = t.gelap || t.bersih ? t.hias : terang ? PUTIH : t.palet.aksen
  return (
    <View style={{ alignSelf: 'flex-start', marginBottom: 14 }}>
      <Stiker bayang={t.bayang ? 3 : 0} sudut={12} isi={isi} isiStyle={{ paddingVertical: 5, paddingHorizontal: 12 }}>
        <T f="judul" w={600} s={11.5} c={teksDi(isi)}>{teks}</T>
      </Stiker>
    </View>
  )
}

// ── Foto ─────────────────────────────────────────────────────────────────
/** Foto penuh + lapisan (gelap 50%, gradasi bawah, atau warna circle). */
export function FotoPenuh({ foto, lapisan }) {
  const t = useTema()
  return (
    <>
      <Image src={foto} style={[UTUH, { objectFit: 'cover' }]} />
      {lapisan === 'gelap' && <View style={[UTUH, { backgroundColor: HITAM, opacity: 0.5 }]} />}
      {lapisan === 'warna' && <View style={[UTUH, { backgroundColor: t.palet.aksen, opacity: 0.72 }]} />}
      {lapisan === 'gradasi' && (
        <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
          <Defs>
            <LinearGradient id="gradasi-foto" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.25" stopColor={HITAM} stopOpacity={0} />
              <Stop offset="1" stopColor={HITAM} stopOpacity={0.88} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="url(#gradasi-foto)" />
        </Svg>
      )}
    </>
  )
}

export function Polaroid({ foto, label, kiri = 560, atas = 92 }) {
  const t = useTema()
  return (
    <View style={{ position: 'absolute', left: kiri, top: atas, width: 340, height: 300, transform: 'rotate(4deg)' }}>
      {t.bayang ? <View style={{ position: 'absolute', left: 8, top: 8, width: 340, height: 300, backgroundColor: t.bayang, borderRadius: 6 }} /> : null}
      <View style={{ position: 'absolute', left: 0, top: 0, width: 340, height: 300, backgroundColor: PUTIH, borderRadius: 6, borderWidth: (t.bersih ? 1 : t.gelap ? 0 : 2.5), borderColor: t.tinta }} />
      <Image src={foto} style={{ position: 'absolute', left: 16, top: 16, width: 308, height: 222, objectFit: 'cover' }} />
      <T f="judul" w={600} s={14} c="#141414" style={{ position: 'absolute', left: 16, right: 16, top: 252, textAlign: 'center' }}>{label}</T>
    </View>
  )
}

/** Kerangka halaman latar: kanvas tema + (Playground) kisi / (Kosmik) bintang. */
export function KanvasTema() {
  const t = useTema()
  return (
    <>
      <View style={[UTUH, { backgroundColor: t.kanvas }]} />
      {t.gelap ? <LatarBintang kuat={0.9} /> : <KisiTitik opacity={0.15} />}
    </>
  )
}

// ── SAMPUL ───────────────────────────────────────────────────────────────
/**
 * @param gaya      id gaya latar | 'foto'
 * @param tataFoto  'bingkai' | 'gelap' | 'gradasi' | 'warna' | 'belah' | 'polaroid'
 * @param judulDok  'Progress Report' | 'Studi Kelayakan Bisnis'
 */
export function Sampul({ gaya, tataFoto = 'bingkai', foto, nama, judulDok = 'Progress Report', bulanLabel, ekosistemNama, jenisLabel }) {
  const t = useTema()
  if (gaya === 'foto' && foto) {
    const penuh = ['gelap', 'gradasi', 'warna'].includes(tataFoto)
    if (penuh) {
      const teksFoto = tataFoto === 'warna' ? t.palet.teksAksen : PUTIH
      return (
        <Page size={[W, H]} style={{ backgroundColor: HITAM, position: 'relative' }}>
          <FotoPenuh foto={foto} lapisan={tataFoto} />
          <KopEkosistem pge nama={ekosistemNama} warna={teksFoto} terang={teksFoto === PUTIH} />
          <View style={{ position: 'absolute', left: 60, bottom: 64 }}>
            <PilJenis teks={jenisLabel} terang />
            <BlokJudul nama={nama} judulDok={judulDok} bulanLabel={bulanLabel} warnaTeks={teksFoto} lebar={640} />
          </View>
          <View style={{ position: 'absolute', right: 60, bottom: 68 }}><Panah warna={teksFoto} /></View>
        </Page>
      )
    }
    if (tataFoto === 'belah') {
      return (
        <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
          <KanvasTema />
          <Image src={foto} style={{ position: 'absolute', top: 0, right: 0, width: 520, height: H, objectFit: 'cover' }} />
          <View style={{ position: 'absolute', top: 0, left: 440, width: (t.bersih ? 1 : t.gelap ? 3 : 6), height: H, backgroundColor: t.gelap || t.bersih ? t.hias : t.tinta }} />
          <KopEkosistem pge nama={ekosistemNama} />
          <View style={{ position: 'absolute', left: 52, bottom: 64, width: 370 }}>
            <PilJenis teks={jenisLabel} />
            <BlokJudul nama={nama} judulDok={judulDok} bulanLabel={bulanLabel} lebar={360} maks={64} kecil />
          </View>
        </Page>
      )
    }
    if (tataFoto === 'polaroid') {
      return (
        <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
          <KanvasTema />
          <Polaroid foto={foto} label={bulanLabel} kiri={548} atas={86} />
          <KopEkosistem pge nama={ekosistemNama} />
          <View style={{ position: 'absolute', left: 60, bottom: 64 }}>
            <PilJenis teks={jenisLabel} />
            <BlokJudul nama={nama} judulDok={judulDok} bulanLabel={bulanLabel} lebar={450} maks={80} />
          </View>
        </Page>
      )
    }
    // Bingkai (bawaan): foto berbingkai, judul di stiker yang menindih tepi bawahnya.
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <KanvasTema />
        {t.bayang ? <View style={{ position: 'absolute', left: 74, top: 42, width: 828, height: 318, borderRadius: 26, backgroundColor: t.bayang }} /> : null}
        <Image src={foto} style={{ position: 'absolute', left: 66, top: 34, width: 828, height: 318, borderRadius: 26, objectFit: 'cover' }} />
        <View style={{ position: 'absolute', left: 66, top: 34, width: 828, height: 318, borderRadius: 26, borderWidth: (t.bersih ? 1 : t.gelap ? 1.5 : 3), borderColor: t.gelap || t.bersih ? t.hiasMuda : t.tinta }} />
        <View style={{ position: 'absolute', left: 50, top: 300 }}>
          <Stiker bayang={7} isiStyle={{ paddingTop: 16, paddingBottom: 18, paddingHorizontal: 24 }}>
            <BlokJudul nama={nama} judulDok={judulDok} lebar={560} maks={66} kecil />
          </Stiker>
        </View>
        <View style={{ position: 'absolute', left: 66, bottom: 36, flexDirection: 'row', alignItems: 'center' }}>
          <LogoLaporan ukuran={18} />
          <T w={700} s={12} c={t.tinta} style={{ marginLeft: 10, letterSpacing: 4.2 }}>{String(bulanLabel ?? '').toUpperCase()}</T>
          {/* Kredit ekosistem: logo kata PGE menggantikan teks nama (dokumen ekosistem sudah berlogo PGE di depan). */}
          {t.identitas?.nama ? <View style={{ marginLeft: 14 }}><LogoPge ukuran={20} /></View> : null}
        </View>
        <View style={{ position: 'absolute', right: 66, bottom: 40 }}><Panah /></View>
        <View style={{ position: 'absolute', right: 66, top: 372 }}><PilJenis teks={jenisLabel} /></View>
      </Page>
    )
  }
  const kapur = !t.gelap && gaya === 'kapur'
  const warna = gaya === 'warna'
  const warnaTeks = kapur || t.gelap ? (t.gelap ? t.teks : PUTIH) : t.tinta
  return (
    <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
      <LatarGaya gaya={gaya} varian="sampul" />
      <KopEkosistem pge nama={ekosistemNama} warna={warna && !t.gelap ? t.palet.teksAksen : warnaTeks} terang={kapur || (warna && t.palet.teksAksen === PUTIH && !t.gelap)} />
      {warna ? (
        <View style={{ position: 'absolute', left: 52, bottom: 58, maxWidth: 620 }}>
          <Stiker bayang={8} tebal={(t.bersih ? 1 : t.gelap ? 1.2 : 3)} isiStyle={{ paddingTop: 22, paddingBottom: 24, paddingHorizontal: 30 }}>
            <BlokJudul nama={nama} judulDok={judulDok} bulanLabel={bulanLabel} lebar={540} maks={80} />
          </Stiker>
        </View>
      ) : (
        <View style={{ position: 'absolute', left: 60, bottom: 64 }}>
          <PilJenis teks={jenisLabel} terang={kapur} />
          <BlokJudul nama={nama} judulDok={judulDok} bulanLabel={bulanLabel} warnaTeks={warnaTeks} />
        </View>
      )}
      <View style={{ position: 'absolute', right: 60, bottom: 68 }}>
        <Panah warna={warna && !t.gelap ? t.palet.teksAksen : warnaTeks} />
      </View>
    </Page>
  )
}

// ── PEMBATAS BAGIAN ──────────────────────────────────────────────────────
/** Halaman pembatas (template: hijau penuh "EXECUTIVE SUMMARY"). Playground: latar
 *  tinta (Blok Warna: warna circle) + cakram warna circle; Kosmik: nebula + cakram gradien. */
export function Pembatas({ gaya, nomor, judul, sub, ikon = '📊', lingkupNama, bulanLabel, paletBagian, labelNomor = 'BAGIAN' }) {
  const t = useTema()
  const m = useMetrik()
  const p = paletBagian ?? t.palet
  const NOMOR = String(nomor).padStart(2, '0')
  const s = ukuranPas(judul, m.judul700, 520, 66, 30)
  // Tema bersih (Ekosistem Terang & Gelap) memakai tata letak ini juga: semua warnanya dari tema.
  if (t.gelap || t.bersih) {
    const [g1, g2] = t.gradien
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <LatarBintang kuat={1.3} benih={31 + Number(nomor)} />
        <T f="judul" w={700} s={250} c={t.nomorBesar} style={{ position: 'absolute', right: 34, bottom: -36 }}>{NOMOR}</T>
        <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
          <Defs>
            <LinearGradient id={`cakram-${NOMOR}`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={p.aksen === t.hias ? g1 : p.aksen} /><Stop offset="1" stopColor={g2} /></LinearGradient>
          </Defs>
          <Circle cx={772} cy={238} r={112} fill={`url(#cakram-${NOMOR})`} />
          <Circle cx={772} cy={238} r={136} stroke={t.hiasMuda} strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="6 7" fill="none" />
        </Svg>
        <Ikon e={ikon} ukuran={92} warna={PUTIH} style={{ position: 'absolute', left: 772 - 46, top: 238 - 46 }} />
        <KopEkosistem nama={lingkupNama} warna={t.teks} />
        <View style={{ position: 'absolute', left: 60, top: 196, width: 560 }}>
          <View style={{ alignSelf: 'flex-start', marginBottom: 16, backgroundColor: t.hias, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 12 }}>
            <T w={800} s={10} c={t.teksDiHias} style={{ letterSpacing: 2.4 }}>{`${labelNomor} ${NOMOR}`}</T>
          </View>
          <T pas f="judul" w={700} s={s} c={t.teks} style={{ lineHeight: 1.02 }}>{judul}</T>
          {sub ? <T w={400} s={14} c={t.redup} style={{ marginTop: 14, lineHeight: 1.4 }}>{sub}</T> : null}
        </View>
        <T w={700} s={11} c={t.redup} style={{ position: 'absolute', left: 60, bottom: 40, letterSpacing: 4.2 }}>{String(bulanLabel ?? '').toUpperCase()}</T>
        <View style={{ position: 'absolute', right: 60, bottom: 42 }}><Panah warna={t.redup} /></View>
      </Page>
    )
  }
  const latar = gaya === 'warna' ? p.aksen : t.tinta
  const teks = teksDi(latar)
  const cakram = latar === p.aksen ? t.sorot : (p.aksen === t.tinta ? '#2E2E2E' : p.aksen)
  const ikonWarna = cakram === t.sorot ? t.tinta : (p.aksen === t.tinta ? PUTIH : p.teksAksen)
  return (
    <Page size={[W, H]} style={{ backgroundColor: latar, position: 'relative' }}>
      <KisiTitik warna={teks} opacity={0.07} />
      <T f="judul" w={700} s={250} c={campur(latar, teks, 0.08)} style={{ position: 'absolute', right: 34, bottom: -36 }}>{NOMOR}</T>
      <Svg viewBox={`0 0 ${W} ${H}`} style={UTUH}>
        <Circle cx={772} cy={238} r={112} fill={cakram} stroke={teks} strokeWidth={3} />
      </Svg>
      <Ikon e={ikon} ukuran={92} warna={ikonWarna} style={{ position: 'absolute', left: 772 - 46, top: 238 - 46 }} />
      <KopEkosistem nama={lingkupNama} warna={teks} terang={teks === PUTIH} />
      <View style={{ position: 'absolute', left: 60, top: 196, width: 560 }}>
        <View style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
          <Stiker bayang={0} sudut={12} isi={t.sorot} garis={teks === PUTIH ? t.sorot : t.tinta} isiStyle={{ paddingVertical: 4, paddingHorizontal: 12 }}>
            <T w={800} s={10} c={t.tinta} style={{ letterSpacing: 2.4 }}>{`${labelNomor} ${NOMOR}`}</T>
          </Stiker>
        </View>
        <T pas f="judul" w={700} s={s} c={teks} style={{ lineHeight: 1.02 }}>{judul}</T>
        {sub ? <T w={400} s={14} c={campur(teks, latar, 0.22)} style={{ marginTop: 14, lineHeight: 1.4 }}>{sub}</T> : null}
      </View>
      <T w={700} s={11} c={teks} style={{ position: 'absolute', left: 60, bottom: 40, letterSpacing: 4.2 }}>{String(bulanLabel ?? '').toUpperCase()}</T>
      <View style={{ position: 'absolute', right: 60, bottom: 42 }}><Panah warna={teks} /></View>
    </Page>
  )
}

// ── PENUTUP ──────────────────────────────────────────────────────────────
export function Penutup({ gaya, tataFoto = 'bingkai', foto, nama, bulanLabel, slogan, ekosistemNama, judul = 'TERIMA KASIH', sub = 'Mohon bimbingannya!' }) {
  const t = useTema()
  const m = useMetrik()
  const pakaiFoto = gaya === 'foto' && foto
  const fotoPenuh = pakaiFoto && ['gelap', 'gradasi', 'warna'].includes(tataFoto)
  const kapur = !t.gelap && !pakaiFoto && gaya === 'kapur'
  const warna = !pakaiFoto && gaya === 'warna'
  const warnaTeks = fotoPenuh ? (tataFoto === 'warna' ? t.palet.teksAksen : PUTIH) : (kapur ? PUTIH : (t.gelap ? t.teks : t.tinta))
  const teksIsi = warna && !t.gelap ? t.tinta : warnaTeks
  const latarGelap = teksIsi === PUTIH || t.gelap
  const isi = (
    <View>
      <T pas f="judul" w={700} s={ukuranPas(judul, m.judul700, warna ? 560 : 470, 84, 36)} c={teksIsi} style={{ lineHeight: 1 }}>{judul}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
        <Stabilo penuh={latarGelap}><T f="judul" w={600} s={26} c={t.teksSorot}>{sub}</T></Stabilo>
        <Ikon e="👋" ukuran={30} warna={teksIsi} style={{ marginLeft: 16 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 26 }}>
        <TitikCircle warna={t.palet.aksen} ukuran={12} style={{ marginRight: 8, borderColor: teksIsi }} />
        <T f="judul" w={600} s={15} c={teksIsi}>{nama}</T>
        {slogan ? <T w={400} s={12} c={teksIsi} style={{ marginLeft: 12, opacity: 0.75 }}>{`· ${slogan}`}</T> : null}
      </View>
    </View>
  )
  return (
    <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
      {fotoPenuh ? <FotoPenuh foto={foto} lapisan={tataFoto} />
        : pakaiFoto ? (<><KanvasTema /><Polaroid foto={foto} label={bulanLabel} /></>)
        : <LatarGaya gaya={gaya} varian="penutup" />}
      <KopEkosistem pge nama={ekosistemNama} warna={warna && !t.gelap ? t.palet.teksAksen : warnaTeks} terang={kapur || (fotoPenuh && warnaTeks === PUTIH) || (warna && !t.gelap && t.palet.teksAksen === PUTIH)} />
      {warna ? (
        <View style={{ position: 'absolute', left: 52, top: 150 }}>
          <Stiker bayang={8} tebal={(t.bersih ? 1 : t.gelap ? 1.2 : 3)} isiStyle={{ paddingTop: 24, paddingBottom: 26, paddingHorizontal: 30 }}>{isi}</Stiker>
        </View>
      ) : (
        <View style={{ position: 'absolute', left: 60, top: 170 }}>{isi}</View>
      )}
      <T w={700} s={11} c={warna && !t.gelap ? t.palet.teksAksen : warnaTeks} style={{ position: 'absolute', left: 60, bottom: 40, letterSpacing: 4.2 }}>{String(bulanLabel ?? '').toUpperCase()}</T>
    </Page>
  )
}
