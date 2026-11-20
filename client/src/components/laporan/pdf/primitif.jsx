// ─────────────────────────────────────────────────────────────────────────
// PRIMITIF PDF BERTEMA (Progress Report, SKB). Semua warna/font dibaca dari
// tema aktif (pdf/tema.js, useTema): Playground = kertas kartun PGE — tinta
// 2pt, BAYANG CAP, stabilo kuning, stiker; Kosmik = rumahpara.app — latar
// bintang & nebula, kartu kaca, aksen ungu→magenta. Teks selalu tinta/terang;
// warna vonis hanya untuk untung-rugi.
// ─────────────────────────────────────────────────────────────────────────
import { Page, View, Text, Image, Svg, Path, Rect, Circle, Polygon, Defs, LinearGradient, RadialGradient, Stop } from '@react-pdf/renderer'
import { IKON_EMOJI } from './ikonEmoji'
import { useTema, rapikanTeks } from './tema'
import { teksDi } from '../warnaLaporan'
import { ECOSYSTEM_NAME } from '../../../config/ecosystem'

export { KANVAS, campur, luminans, teksDi, paletLingkup } from '../warnaLaporan'
export { useTema } from './tema'
export const W = 960
export const H = 540
/** Nama keluarga font yang didaftarkan (fontPdf.js). */
export const HURUF = { fredoka: 'Fredoka PGE', jakarta: 'Jakarta PGE', sora: 'Sora PGE' }

// ── Angka ────────────────────────────────────────────────────────────────
const fmtId = new Intl.NumberFormat('id-ID')
const fmtUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
// NBSP: "Rp" tidak pernah terpisah dari angkanya saat baris dipatahkan.
export const rp = (n) => (n == null ? '—' : `Rp ${fmtId.format(Math.round(n))}`)
export const rpBertanda = (n) => (n == null ? '—' : `${n < 0 ? '–' : '+'}${rp(Math.abs(n))}`)
export const usd = (n) => (n == null ? '—' : fmtUsd.format(n))
/** Rupiah ringkas untuk label grafik: "51,2 jt", "1,16 M", "850 rb". */
export function rpRingkas(n) {
  const a = Math.abs(n ?? 0)
  if (a >= 1e9) return `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (a >= 1e3) return `${Math.round(n / 1e3)} rb`
  return String(Math.round(n ?? 0))
}

// ── Teks ─────────────────────────────────────────────────────────────────
// Tanpa pemenggalan: pemenggal bawaan react-pdf berbahasa Inggris dan memotong
// kata Indonesia di tempat yang salah ("Penge-luaran").
export const tanpaPenggal = (kata) => [kata]

/** Kunci metrik untuk memaskan ukuran (pdf/metrikHuruf.js) sesuai font aktif. */
export function useMetrik() {
  const { font } = useTema()
  return { judul600: font.m600, judul700: font.m700, angka: font.angka }
}

/** Teks bertema: f = 'judul' | 'badan', w = ketebalan, s = ukuran, c = warna (bawaan teks tema).
 *  `pas` = ukuran sudah dipaskan ke lebar bidang (ukuranPas) → tidak ikut skala huruf pemakai. */
export function T({ f = 'badan', w = 400, s = 11, c, pas = false, style, children, ...rest }) {
  const tema = useTema()
  const ukuran = pas ? s : s * (tema.skala ?? 1)
  const font = tema.font
  const judul = f === 'judul'
  const keluarga = judul ? font.judul : font.badan
  // Jakarta sebagai huruf judul dinaikkan setingkat supaya tetap terbaca "judul".
  const bobot = font.standar ? (w >= 600 ? 700 : 400) : (judul && font.naikkanJudul ? Math.min(800, w + 100) : w)
  const isi = typeof children === 'string' ? rapikanTeks(children, font)
    : Array.isArray(children) ? children.map(c2 => (typeof c2 === 'string' ? rapikanTeks(c2, font) : c2)) : children
  return (
    <Text hyphenationCallback={tanpaPenggal} style={[{ fontFamily: keluarga, fontWeight: bobot, fontSize: ukuran, color: c ?? tema.teks }, ...[].concat(style ?? [])]} {...rest}>
      {isi}
    </Text>
  )
}

// ── Bentuk ───────────────────────────────────────────────────────────────
/**
 * KARTU/STIKER bertema. Playground: garis tinta + BAYANG CAP (garis tepi kedua);
 * Kosmik: kaca gelap bergaris tipis tanpa bayang. `isiStyle` = gaya bidang
 * dalam (padding, arah flex); `style` = kotak luar (ukuran, posisi).
 */
export function Stiker({ children, style, isiStyle, isi, garis, tebal, bayang, sudut, rotasi = 0 }) {
  const t = useTema()
  const warnaBayang = t.bayang
  const geser = bayang ?? (warnaBayang ? 5 : 0)
  const r = sudut == null ? t.sudut : (typeof sudut === 'number' ? { borderRadius: sudut } : sudut)
  return (
    <View style={[{ position: 'relative' }, rotasi ? { transform: `rotate(${rotasi}deg)` } : {}, ...[].concat(style ?? [])]}>
      {geser > 0 && warnaBayang ? <View style={[{ position: 'absolute', top: geser, left: geser, right: -geser, bottom: -geser, backgroundColor: garis ?? warnaBayang }, r]} /> : null}
      <View style={[{ flexGrow: 1, backgroundColor: isi ?? t.kartu, borderWidth: tebal ?? t.tebalGaris, borderStyle: 'solid', borderColor: garis ?? t.garis }, r, ...[].concat(isiStyle ?? [])]}>
        {children}
      </View>
    </View>
  )
}

/** STABILO: coretan miring di BALIK teks. `penuh` = setinggi teks (latar gelap). */
export function Stabilo({ children, warna, miring = -1.5, style, tebal = '46%', penuh = false }) {
  const t = useTema()
  const kotak = penuh || t.gelap ? { top: t.gelap ? 2 : -1, bottom: -3 } : { bottom: -2, height: tebal }
  return (
    <View style={[{ position: 'relative', alignSelf: 'flex-start' }, ...[].concat(style ?? [])]}>
      <View style={{ position: 'absolute', left: -7, right: -7, ...kotak, backgroundColor: warna ?? t.sorot, borderRadius: t.gelap ? 6 : 3, opacity: t.gelap ? 0.85 : 1, transform: `rotate(${t.gelap ? 0 : miring}deg)` }} />
      {children}
    </View>
  )
}

/** Emoji PGE sebagai jalur vektor (lihat ikonEmoji.js). */
export function Ikon({ e, ukuran = 18, warna, style }) {
  const t = useTema()
  const d = IKON_EMOJI[e]
  if (!d) return null
  return (
    <Svg viewBox="0 0 100 100" style={[{ width: ukuran, height: ukuran }, ...[].concat(style ?? [])]}>
      <Path d={d} fill={warna ?? t.ikon} />
    </Svg>
  )
}

/** Lencana bulat berisi emoji (stiker kecil). */
export function LencanaIkon({ e, ukuran = 30, isi, warnaIkon, bayang = 2, style }) {
  const t = useTema()
  const latar = isi ?? t.lencana
  const geser = t.bayang ? bayang : 0
  return (
    <View style={[{ width: ukuran + geser, height: ukuran + geser, position: 'relative' }, ...[].concat(style ?? [])]}>
      {geser > 0 && <View style={{ position: 'absolute', top: geser, left: geser, width: ukuran, height: ukuran, borderRadius: ukuran / 2, backgroundColor: t.bayang }} />}
      <View style={{ position: 'absolute', top: 0, left: 0, width: ukuran, height: ukuran, borderRadius: ukuran / 2, backgroundColor: latar, borderWidth: t.gelap ? 1 : 2, borderColor: t.lencanaGaris, alignItems: 'center', justifyContent: 'center' }}>
        <Ikon e={e} ukuran={ukuran * 0.56} warna={warnaIkon ?? (t.gelap ? t.teks : t.tinta)} />
      </View>
    </View>
  )
}

/** Titik circle: BULAT bergaris (aturan bentuk identitas circle). */
export function TitikCircle({ warna, ukuran = 10, style }) {
  const t = useTema()
  return <View style={[{ width: ukuran, height: ukuran, borderRadius: ukuran / 2, backgroundColor: warna, borderWidth: 1.5, borderColor: t.tinta }, ...[].concat(style ?? [])]} />
}

/**
 * Logo ekosistem (13 Okt 2026, ganti logo kata PGE dari modul asal): ubin ungu berhuruf
 * inisial + nama ekosistem, cermin logo di sidebar aplikasi. Warna TULISAN ikut tema (tinta di
 * kertas, terang di gelap) kecuali `warna` diberi; ubin selalu ungu. `ukuran` = TINGGI.
 */
export function LogoPge({ ukuran = 20, warna }) {
  const t = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: ukuran, height: ukuran, borderRadius: ukuran * 0.26, backgroundColor: t.logo?.ubin ?? '#0FC1BD', alignItems: 'center', justifyContent: 'center' }}>
        <T pas f="judul" w={700} s={ukuran * 0.56} c={t.logo?.isi ?? '#08302F'} style={{ lineHeight: 1 }}>{ECOSYSTEM_NAME.charAt(0)}</T>
      </View>
      <T pas f="judul" w={700} s={ukuran * 0.6} c={warna ?? (t.gelap ? t.teks : t.tinta)} style={{ marginLeft: ukuran * 0.3, lineHeight: 1, letterSpacing: ukuran * 0.03 }}>{ECOSYSTEM_NAME}</T>
    </View>
  )
}

const inisialNama = (nama = '') => String(nama).split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase() || '?'

/**
 * Logo laporan (arahan Owner 9 Okt 2026): logo circle yang diunggah (gambar, lebar bebas, dipaskan ke
 * tinggi `ukuran`); belum punya logo → logo otomatis sederhana (ubin warna circle + inisial); dokumen
 * ekosistem (tanpa circle) → logo Playground. `identitas` datang dari rakitTema.
 */
export function LogoLaporan({ ukuran = 20, ubin, isi }) {
  const t = useTema()
  const id = t.identitas ?? {}
  if (id.logoCircle) return <Image src={id.logoCircle} style={{ height: ukuran, width: ukuran * 2.6, objectFit: 'contain', objectPositionX: 0 }} />
  // Dokumen tingkat ekosistem (tanpa circle) → logo ekosistem; `ubin` PUTIH = di atas foto/latar gelap.
  if (!id.nama) return <LogoPge ukuran={ukuran} warna={ubin} />
  const warna = ubin ?? t.palet.aksen
  const ins = inisialNama(id.nama)
  return (
    <View style={{ width: ukuran, height: ukuran, borderRadius: ukuran * 0.24, backgroundColor: warna, borderWidth: t.bersih ? 1 : ukuran >= 30 ? 2 : 1.2, borderColor: t.bersih || t.gelap ? t.garisKuat : t.tinta, alignItems: 'center', justifyContent: 'center' }}>
      <T pas f="judul" w={700} s={ukuran * (ins.length > 1 ? 0.42 : 0.54)} c={isi ?? teksDi(warna)} style={{ lineHeight: 1 }}>{ins}</T>
    </View>
  )
}

/** Tiga segitiga ▸▸▸ (penanda "berlanjut" template). */
export function Panah({ warna, ukuran = 13 }) {
  const t = useTema()
  const w = ukuran * 0.8
  return (
    <Svg viewBox={`0 0 ${w * 3 + 8} ${ukuran}`} style={{ width: w * 3 + 8, height: ukuran }}>
      {[0, 1, 2].map(i => (
        <Polygon key={i} points={`${i * (w + 4)},0 ${i * (w + 4) + w},${ukuran / 2} ${i * (w + 4)},${ukuran}`} fill={warna ?? t.tinta} />
      ))}
    </Svg>
  )
}

/** Panah tebal "⇒" sebagai gambar (glyph-nya tak ada di semua font). */
export function PanahHasil({ warna, ukuran = 14 }) {
  const t = useTema()
  return (
    <Svg viewBox="0 0 24 24" style={{ width: ukuran, height: ukuran }}>
      <Path d="M3 9h11V4l8 8-8 8v-5H3z" fill={warna ?? t.tinta} />
    </Svg>
  )
}

// ── Pola latar ───────────────────────────────────────────────────────────
// Kisi titik kertas: SATU <Path> berisi ribuan persegi mungil (bukan ribuan
// <Circle>) — tata letak react-pdf tetap cepat; pada ukuran baca terbaca titik.
const cache = new Map()
function simpan(kunci, buat) { if (!cache.has(kunci)) cache.set(kunci, buat()); return cache.get(kunci) }
function jalurKisi(jarak, sisi) {
  return simpan(`kisi:${jarak}:${sisi}`, () => {
    let d = ''
    for (let y = jarak / 2; y < H; y += jarak) for (let x = jarak / 2; x < W; x += jarak) d += `M${x} ${y}h${sisi}v${sisi}h-${sisi}Z`
    return d
  })
}
export function KisiTitik({ warna, jarak = 20, sisi = 1.4, opacity = 0.13 }) {
  const t = useTema()
  if (t.pola === 'polos') return null // tema bersih (Ekosistem): tanpa pola kisi
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}>
      <Path d={jalurKisi(jarak, sisi)} fill={warna ?? t.tinta} fillOpacity={opacity} />
    </Svg>
  )
}

/** Bintang deterministik (LCG berbenih) — tiga lapis terang. */
function jalurBintang(benih, jumlah, ukuran) {
  return simpan(`bintang:${benih}:${jumlah}:${ukuran}`, () => {
    let s = benih >>> 0
    const acak = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
    let d = ''
    for (let i = 0; i < jumlah; i++) {
      const x = (acak() * W).toFixed(1), y = (acak() * H).toFixed(1), u = (ukuran * (0.6 + acak() * 0.8)).toFixed(2)
      d += `M${x} ${y}h${u}v${u}h-${u}Z`
    }
    return d
  })
}

/** Latar luar angkasa tema Kosmik: nebula (gradien radial) + tiga lapis bintang. */
export function LatarBintang({ kuat = 1, nebula = true, benih = 7 }) {
  const t = useTema()
  if (t.pola === 'polos') return null // tema bersih (Ekosistem): tanpa bintang
  const [a, b] = t.gradien ?? ['#8B5CF6', '#DB2777']
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}>
      {nebula ? (
        <>
          <Defs>
            <RadialGradient id={`neb1-${benih}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={a} stopOpacity={0.32 * kuat} />
              <Stop offset="1" stopColor={a} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`neb2-${benih}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={b} stopOpacity={0.24 * kuat} />
              <Stop offset="1" stopColor={b} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`neb3-${benih}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#06B6D4" stopOpacity={0.12 * kuat} />
              <Stop offset="1" stopColor="#06B6D4" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={W * 0.82} cy={H * 0.18} r={330} fill={`url(#neb1-${benih})`} />
          <Circle cx={W * 0.12} cy={H * 0.92} r={300} fill={`url(#neb2-${benih})`} />
          <Circle cx={W * 0.45} cy={H * 0.5} r={260} fill={`url(#neb3-${benih})`} />
        </>
      ) : null}
      <Path d={jalurBintang(benih, 170, 1.1)} fill="#FFFFFF" fillOpacity={0.35 * kuat} />
      <Path d={jalurBintang(benih + 11, 60, 1.7)} fill="#FFFFFF" fillOpacity={0.6 * kuat} />
      <Path d={jalurBintang(benih + 23, 14, 2.4)} fill="#E9D5FF" fillOpacity={0.85 * kuat} />
    </Svg>
  )
}

/** Latar halaman isi sesuai tema. */
export function LatarIsi() {
  const t = useTema()
  if (t.pola === 'polos') return null
  return t.pola === 'bintang' ? <LatarBintang kuat={0.55} /> : <KisiTitik />
}

/** Bidang bergradien (tema Kosmik) — persegi membulat sebagai latar kartu/sorotan. */
export function BidangGradien({ lebar, tinggi, warna, radius = 16, arah = 'miring', id = 'g', style }) {
  const t = useTema()
  const [a, b] = warna ?? t.gradien ?? ['#8B5CF6', '#DB2777']
  const [x2, y2] = arah === 'datar' ? [1, 0] : arah === 'tegak' ? [0, 1] : [1, 1]
  return (
    <Svg viewBox={`0 0 ${lebar} ${tinggi}`} style={[{ position: 'absolute', top: 0, left: 0, width: lebar, height: tinggi }, ...[].concat(style ?? [])]}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={String(x2)} y2={String(y2)}>
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={lebar} height={tinggi} rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  )
}

// ── Rangka halaman isi ───────────────────────────────────────────────────
/** Halaman isi: latar bertema, kepala (logo + bagian | lingkup), kaki (bulan | nomor). */
export function HalamanIsi({ bagian, lingkup, palet, bulanLabel, children, isiStyle }) {
  const t = useTema()
  const p = palet ?? t.palet
  return (
    <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
      <LatarIsi />
      <View style={{ position: 'absolute', top: 26, left: 44, right: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LogoLaporan ukuran={18} />
          <T w={600} s={12} style={{ marginLeft: 9 }}>{bagian}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TitikCircle warna={p.aksen} ukuran={11} style={{ marginRight: 7 }} />
          <T f="judul" w={600} s={12.5} c={t.tinta}>{lingkup}</T>
        </View>
      </View>
      <View style={[{ position: 'absolute', top: 64, left: 44, right: 44, bottom: 48 }, ...[].concat(isiStyle ?? [])]}>
        {children}
      </View>
      <View style={{ position: 'absolute', bottom: 18, left: 44, right: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T w={700} s={8.5} c={t.redup} style={{ letterSpacing: 2.6 }}>{String(bulanLabel ?? '').toUpperCase()}</T>
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, borderWidth: t.gelap ? 1 : 1.5, borderColor: t.gelap ? t.garis : t.tinta, backgroundColor: t.kartu, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
          <Text hyphenationCallback={tanpaPenggal} style={{ fontFamily: t.font.judul, fontWeight: t.font.standar ? 700 : 600, fontSize: 9.5, color: t.tinta }}
            render={({ pageNumber }) => String(pageNumber)} />
        </View>
      </View>
      {/* Kredit ekosistem (arahan Owner 10–11 Okt 2026): logo circle di kepala, Playground Ecosystem di kaki —
          TEPAT di tengah halaman (mutlak, bukan ikut deretan kiri–kanan yang lebarnya tak sama), warna penuh
          tanpa transparansi. Dokumen tingkat ekosistem sudah berlogo PGE di kepala → tidak diulang. */}
      {t.identitas?.nama ? (
        <View style={{ position: 'absolute', bottom: 12, left: 0, right: 0, alignItems: 'center' }}>
          <LogoPge ukuran={28} />
        </View>
      ) : null}
    </Page>
  )
}

/** Judul halaman isi: teks besar + label (bulan) berstabilo di sampingnya. */
export function JudulHalaman({ judul, sorot, ukuran = 36, style }) {
  const t = useTema()
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 }, ...[].concat(style ?? [])]}>
      <T f="judul" w={700} s={ukuran} c={t.tinta} style={{ lineHeight: 1.05 }}>{judul}</T>
      {sorot ? (
        <Stabilo style={{ marginLeft: 16, marginBottom: ukuran * 0.12 }}>
          <T f="judul" w={600} s={ukuran * 0.52} c={t.teksSorot} style={t.gelap ? { paddingHorizontal: 2 } : null}>{sorot}</T>
        </Stabilo>
      ) : null}
    </View>
  )
}

/** Label kecil berhuruf kapital renggang (kicker). */
export function Kicker({ children, c, s = 9, style }) {
  const t = useTema()
  return <T w={700} s={s} c={c ?? t.redup} style={[{ letterSpacing: 1.6, textTransform: 'uppercase' }, ...[].concat(style ?? [])]}>{children}</T>
}
