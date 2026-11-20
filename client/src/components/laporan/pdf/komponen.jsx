// ─────────────────────────────────────────────────────────────────────────
// KOMPONEN ISI BERSAMA Progress Report & SKB — kartu angka, cap vonis, bilah
// porsi, tabel peringkat, grafik omset, kartu tokoh, rincian pengeluaran
// berkolom. Semuanya bertema (useTema); angka datang dari server apa adanya.
// ─────────────────────────────────────────────────────────────────────────
import { View, Image, Svg, Circle, Rect, Path, G } from '@react-pdf/renderer'
import {
  T, Stiker, Ikon, LencanaIkon, TitikCircle, BidangGradien, Kicker,
  rp, usd, rpRingkas, teksDi, useTema, useMetrik,
} from './primitif'
import { paletTema } from './tema'
import { ukuranPas } from './metrikHuruf'
import { warnaMarketPdf } from '../../../config/warna-pdf'
import { kunciMarket } from '../../../config/ekosistem'

export const NAMA_BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const LABEL_TIPE = { STUDIO: 'Studio', PROJECT: 'Project', KORPORASI: 'Korporasi', RUMAH: 'Pos Kas Rumah' }
export const LABEL_MARKET = { vgen: 'VGen', fiverr: 'Fiverr', komunitas: 'Komunitas', etsy: 'Etsy', ltk: 'LTK', upwork: 'Upwork', lainnya: 'Lainnya' }

// ── Kartu angka ──────────────────────────────────────────────────────────
/**
 * Kartu satu angka. `sorot` = kartu kesimpulan: Playground diisi warna circle,
 * Kosmik bergradien ungu→magenta. `lebar`/`tinggi` wajib (gradien butuh ukuran).
 */
export function KartuAngka({ e, label, nilai, sub, sub2, lebar, tinggi, sorot = false, warnaNilai, besar = 25, padat = false }) {
  const t = useTema()
  const m = useMetrik()
  const gradien = sorot && t.gelap
  const isi = sorot && !t.gelap ? t.palet.aksen : t.kartu
  const teks = sorot ? (t.gelap ? '#FFFFFF' : t.palet.teksAksen) : t.tinta
  const redup = sorot ? (t.gelap ? t.teksLembut : (teks === '#FFFFFF' ? '#E8E8E8' : '#3A3A3A')) : t.redup
  const pad = padat ? 11 : 15
  const s = ukuranPas(String(nilai), m.angka, lebar - pad * 2 - 4, besar, 11)
  return (
    <Stiker style={{ width: lebar, height: tinggi }} isi={gradien ? 'transparent' : isi} garis={gradien ? t.hiasMuda : undefined}
      isiStyle={{ paddingVertical: padat ? 10 : 12, paddingHorizontal: pad, justifyContent: 'space-between', overflow: 'hidden' }}>
      {gradien ? <BidangGradien lebar={lebar} tinggi={tinggi} radius={16} id={'k' + String(label).replace(/[^A-Za-z0-9]/g, '')} style={{ top: -1.2, left: -1.2 }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <LencanaIkon e={e} ukuran={padat ? 20 : 24} isi={sorot ? '#FFFFFF' : undefined} warnaIkon={sorot ? '#141414' : undefined} bayang={0} />
        <Kicker c={teks} s={padat ? 8 : 9} style={{ marginLeft: 7, flexShrink: 1 }}>{label}</Kicker>
      </View>
      <T pas w={800} s={s} c={warnaNilai ?? teks} style={{ lineHeight: 1.1 }}>{nilai}</T>
      <View>
        {sub ? <T s={padat ? 8 : 9} c={redup} style={{ lineHeight: 1.3 }}>{sub}</T> : null}
        {sub2 ? <T s={padat ? 8 : 9} c={redup} style={{ lineHeight: 1.3 }}>{sub2}</T> : null}
      </View>
    </Stiker>
  )
}

/** CAP vonis (huruf kapital dua garis, miring) — satu-satunya tempat warna vonis jadi teks besar. */
export function Cap({ teks, warna }) {
  return (
    <View style={{ transform: 'rotate(-8deg)', borderWidth: 2.5, borderColor: warna, borderRadius: 6, padding: 2 }}>
      <View style={{ borderWidth: 1.2, borderColor: warna, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 10 }}>
        <T f="judul" w={700} s={15} c={warna} style={{ letterSpacing: 2.5 }}>{teks}</T>
      </View>
    </View>
  )
}

export const LEBAR_OPERATOR = 34
// Simbol digambar sebagai VEKTOR, bukan teks: teks satu karakter di dalam
// lingkaran 22pt kerap lenyap dari tata letak react-pdf (terbukti di HalamanIsi).
const BENTUK_OPERATOR = {
  '·': <Circle cx="11" cy="11" r="2.4" />,
  '–': <Rect x="5.5" y="9.6" width="11" height="2.8" rx="1.4" />,
  '=': <><Rect x="5.5" y="7" width="11" height="2.6" rx="1.3" /><Rect x="5.5" y="12.4" width="11" height="2.6" rx="1.3" /></>,
  '+': <><Rect x="5.5" y="9.7" width="11" height="2.6" rx="1.3" /><Rect x="9.7" y="5.5" width="2.6" height="11" rx="1.3" /></>,
  '»': <Path d="M6.5 6.5l5 4.5-5 4.5M11 6.5l5 4.5-5 4.5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
}
/** Operator di antara kartu alur (· – = »), gaya Dashboard. */
export function Operator({ simbol, atas }) {
  const t = useTema()
  const latar = t.gelap || t.bersih ? t.lencana : t.tinta
  const tanda = t.bersih ? t.ikon : t.gelap ? t.teksLembut : '#FFFFFF'
  const bentuk = BENTUK_OPERATOR[simbol]
  return (
    <View style={{ width: LEBAR_OPERATOR, alignItems: 'center', justifyContent: 'center', paddingLeft: t.bayang ? 4 : 0 }}>
      {atas ? <T w={700} s={7} c={t.redup} style={{ marginBottom: 3 }}>{atas}</T> : null}
      <Svg viewBox="0 0 22 22" style={{ width: 22, height: 22 }}>
        <Circle cx="11" cy="11" r={t.gelap ? 10.5 : 11} fill={latar} stroke={t.gelap || t.bersih ? t.lencanaGaris : latar} strokeWidth={(t.bersih ? 1 : t.gelap ? 1 : 0)} />
        <G fill={tanda} stroke={tanda}>{bentuk}</G>
      </Svg>
    </View>
  )
}

// ── Bilah porsi bertumpuk + legenda ──────────────────────────────────────
/** bagian: [{ label, nilai, warna, teksNilai }] — irisan bergaris, legenda persegi. */
export function BilahPorsi({ bagian, tinggi = 16, kosong = 'Belum ada data.' }) {
  const t = useTema()
  const isi = bagian.filter(b => b.nilai > 0)
  const total = isi.reduce((a, b) => a + b.nilai, 0)
  if (!total) return <T s={9.5} c={t.redup}>{kosong}</T>
  const tepi = t.gelap ? t.garis : t.tinta
  return (
    <View>
      <View style={{ flexDirection: 'row', height: tinggi, borderWidth: (t.bersih ? 1 : t.gelap ? 1 : 2), borderColor: tepi, borderRadius: 5, backgroundColor: t.kartu }}>
        {isi.map((b, i) => (
          <View key={b.label + i} style={{
            width: `${(b.nilai / total) * 100}%`, backgroundColor: b.warna,
            borderLeftWidth: i ? 1.5 : 0, borderLeftColor: tepi,
            borderTopLeftRadius: i ? 0 : 3, borderBottomLeftRadius: i ? 0 : 3,
            borderTopRightRadius: i === isi.length - 1 ? 3 : 0, borderBottomRightRadius: i === isi.length - 1 ? 3 : 0,
          }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 7 }}>
        {isi.map((b, i) => (
          <View key={b.label + i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 3 }}>
            <View style={{ width: 9, height: 9, backgroundColor: b.warna, borderWidth: 1.5, borderColor: tepi, borderRadius: 2, transform: 'rotate(-8deg)', marginRight: 5 }} />
            <T w={600} s={8.8} c={t.teks}>{b.label}</T>
            <T w={700} s={8.8} c={t.tinta} style={{ marginLeft: 4 }}>{`${Math.round((b.nilai / total) * 100)}%`}</T>
            {b.teksNilai ? <T s={8.3} c={t.redup} style={{ marginLeft: 4 }}>{b.teksNilai}</T> : null}
          </View>
        ))}
      </View>
    </View>
  )
}

/** @param akunPerMarket { [key]: [nama akun] } — nama akun ditempel ke label sebagai sumber pendapatan (Owner 9 Okt 2026) */
export const porsiMarket = (perMarket = [], akunPerMarket = null) => perMarket
  .filter(m => (m.usd ?? 0) > 0)
  .sort((a, b) => b.usd - a.usd)
  .map(m => {
    const akun = akunPerMarket?.[m.key]
    const label = LABEL_MARKET[kunciMarket(m.key)] ?? m.label
    return { label: Array.isArray(akun) && akun.length ? `${label} · ${akun.join(', ')}` : label, nilai: m.usd, warna: warnaMarketPdf(m.key, 'utuh'), teksNilai: usd(m.usd) }
  })

/** Jumlah omset per market beberapa unit (perMarket dari peta keuangan). */
export function omsetGabungan(units) {
  const peta = new Map()
  for (const u of units) for (const m of (u.omset?.perMarket ?? [])) {
    const ada = peta.get(m.key) ?? { key: m.key, label: m.label, usd: 0, idr: 0 }
    ada.usd += m.usd ?? 0; ada.idr += m.idr ?? 0
    peta.set(m.key, ada)
  }
  return [...peta.values()]
}

/** Pecah teks market bebas ("Fiverr, VGen, LTK") jadi stiker market. */
export function daftarMarket(u) {
  const dariTeks = String(u.market ?? '').split(/[,;/&]+|\bdan\b/i).map(s => s.trim()).filter(Boolean)
  const hasil = []
  const sudah = new Set()
  for (const tx of dariTeks) {
    const k = kunciMarket(tx)
    const label = LABEL_MARKET[k] && k !== 'lainnya' ? LABEL_MARKET[k] : tx
    if (sudah.has(label.toLowerCase())) continue
    sudah.add(label.toLowerCase())
    hasil.push({ k, label })
  }
  if (!hasil.length) for (const m of (u.omset?.perMarket ?? [])) if (m.usd > 0) hasil.push({ k: kunciMarket(m.key), label: LABEL_MARKET[kunciMarket(m.key)] ?? m.label })
  return hasil.slice(0, 6)
}

export function StikerMarket({ daftar }) {
  const t = useTema()
  if (!daftar.length) return <T f="judul" w={600} s={14} c={t.tinta}>—</T>
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {daftar.map((m, i) => (
        <View key={i} style={{ transform: `rotate(${i % 2 ? 2 : -2}deg)`, marginRight: 8, marginBottom: 8, borderWidth: (t.bersih ? 1 : t.gelap ? 1 : 2), borderColor: t.bersih || t.gelap ? t.garisKuat : t.tinta, borderRadius: 4, backgroundColor: warnaMarketPdf(m.k, 'stabilo'), paddingVertical: 3, paddingHorizontal: 9 }}>
          <T f="judul" w={600} s={11} c="#141414">{m.label}</T>
        </View>
      ))}
    </View>
  )
}

// ── Tabel peringkat ──────────────────────────────────────────────────────
export function TabelPeringkat({ judulKolom, nilaiKolom, baris, kaki, lebar, kosong }) {
  const t = useTema()
  const n = Math.max(1, baris.length)
  const tinggiBaris = n <= 8 ? 30 : n <= 11 ? 24 : 19
  const sTeks = n <= 11 ? 10.5 : 9.2
  const sorotIsi = t.gelap || t.bersih ? t.sorotGelap : t.sorot
  return (
    <Stiker style={{ width: lebar }} sudut={t.sudutKecil} isiStyle={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', backgroundColor: t.kepalaTabel, paddingVertical: 8, paddingHorizontal: 10 }}>
        <T f="judul" w={600} s={11} c={t.teksKepalaTabel} style={{ width: 30 }}>NO</T>
        <T f="judul" w={600} s={11} c={t.teksKepalaTabel} style={{ flexGrow: 1, flexShrink: 1 }}>{judulKolom}</T>
        <T f="judul" w={600} s={11} c={t.teksKepalaTabel} style={{ width: 160, textAlign: 'right' }}>{nilaiKolom}</T>
      </View>
      {baris.length === 0 ? (
        <View style={{ paddingVertical: 18, paddingHorizontal: 12 }}><T s={10} c={t.redup}>{kosong}</T></View>
      ) : baris.map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', minHeight: tinggiBaris, paddingHorizontal: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.garisTipis, backgroundColor: b.sorot ? sorotIsi : (i % 2 ? t.kartuSelang : t.kartu) }}>
          <T w={600} s={sTeks} c={b.sorot && !t.gelap ? t.tinta : t.redup} style={{ width: 30 }}>{`${i + 1}.`}</T>
          <View style={{ flexGrow: 1, flexShrink: 1, flexDirection: 'row', alignItems: 'center' }}>
            {b.titik ? <TitikCircle warna={b.titik} ukuran={8} style={{ marginRight: 6 }} /> : null}
            <View style={{ flexShrink: 1 }}>
              <T w={600} s={sTeks} c={t.teks}>{b.nama}</T>
              {b.sub && tinggiBaris >= 24 ? <T s={7.8} c={b.sorot && !t.gelap ? '#3A3A3A' : t.redup}>{b.sub}</T> : null}
            </View>
          </View>
          <T w={b.redup ? 400 : 700} s={sTeks} c={b.redup ? t.redup : (b.warna ?? t.tinta)} style={{ width: 160, textAlign: 'right' }}>{b.nilai}</T>
        </View>
      ))}
      {kaki.map((k, i) => (
        <View key={`k${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10, borderTopWidth: i ? 1 : ((t.bersih ? 1 : t.gelap ? 1.2 : 2)), borderTopColor: i ? t.garisTipis : t.tinta, backgroundColor: i ? t.kartu : t.kaki }}>
          <T f="judul" w={700} s={11} c={t.tinta} style={{ flexGrow: 1 }}>{k.label}</T>
          <T w={800} s={k.besar ? 12.5 : 10.5} c={k.warna ?? t.tinta} style={{ textAlign: 'right' }}>{k.nilai}</T>
        </View>
      ))}
    </Stiker>
  )
}

// ── Grafik omset ─────────────────────────────────────────────────────────
/** Batas atas sumbu yang "bulat": 1/2/2,5/5 × 10^n. */
function batasBulat(v) {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p
  return 10 * p
}

/** Dolar ringkas untuk label grafik: "$4.021", "$12,5k". */
export const usdRingkas = (n) => (Math.abs(n ?? 0) >= 10_000
  ? `$${(n / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}k`
  : `$${Math.round(n ?? 0).toLocaleString('id-ID')}`)

/** Grafik batang omset per bulan. `satuan` 'idr' (bawaan, label rupiah ringkas) | 'usd'. */
export function GrafikOmset({ riwayat, lebar, tinggi, satuan = 'idr', kosong }) {
  const t = useTema()
  const ambil = (r) => r[satuan] ?? 0
  const ringkas = satuan === 'usd' ? usdRingkas : rpRingkas
  const nilai = riwayat.map(ambil)
  const adaData = nilai.some(v => v > 0)
  const atas = batasBulat(Math.max(...nilai, 0) * 1.08)
  const tinggiBilah = tinggi - 34
  const lebarSumbu = 42
  const kolom = (lebar - lebarSumbu) / Math.max(1, riwayat.length)
  if (!adaData) {
    return (
      <View style={{ height: tinggi, alignItems: 'center', justifyContent: 'center' }}>
        <Ikon e="📈" ukuran={34} warna={t.redup} />
        <T s={10} c={t.redup} style={{ marginTop: 8 }}>{kosong ?? `Belum ada laporan omset ${riwayat.length} bulan terakhir.`}</T>
      </View>
    )
  }
  return (
    <View style={{ width: lebar, height: tinggi, position: 'relative' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <View key={f} style={{ position: 'absolute', left: 0, right: 0, top: 16 + tinggiBilah * (1 - f), flexDirection: 'row', alignItems: 'center' }}>
          <T s={7.5} c={t.redup} style={{ width: lebarSumbu - 6, textAlign: 'right', marginTop: -4 }}>{f ? ringkas(atas * f) : '0'}</T>
          <View style={{ flexGrow: 1, height: f ? 0.8 : 1.6, backgroundColor: f ? t.garisTipis : t.tinta, marginLeft: 6 }} />
        </View>
      ))}
      <View style={{ position: 'absolute', left: lebarSumbu, right: 0, top: 0, height: 16 + tinggiBilah, flexDirection: 'row', alignItems: 'flex-end' }}>
        {riwayat.map((r, i) => {
          const kini = i === riwayat.length - 1
          const v = ambil(r)
          const h = Math.max(v > 0 ? 3 : 0, (v / atas) * tinggiBilah)
          return (
            <View key={i} style={{ width: kolom, alignItems: 'center', justifyContent: 'flex-end' }}>
              {v > 0 ? <T w={700} s={7.6} c={t.tinta} style={{ marginBottom: 3 }}>{ringkas(v)}</T> : null}
              <View style={{ width: Math.min(44, kolom - 12), height: h, backgroundColor: kini ? t.bilahKini : t.bilah, borderWidth: kini ? ((t.bersih ? 1 : t.gelap ? 1 : 2)) : 0, borderColor: t.bilahKiniGaris, borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
            </View>
          )
        })}
      </View>
      <View style={{ position: 'absolute', left: lebarSumbu, right: 0, bottom: 0, flexDirection: 'row' }}>
        {riwayat.map((r, i) => (
          <T key={i} w={i === riwayat.length - 1 ? 800 : 600} s={8.5} c={t.tinta} style={{ width: kolom, textAlign: 'center', letterSpacing: 0.8 }}>
            {NAMA_BULAN_PENDEK[r.bulan - 1].toUpperCase()}
          </T>
        ))}
      </View>
    </View>
  )
}

export function Chip({ e, teks, isi, c }) {
  const t = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: (t.bersih ? 1 : t.gelap ? 1 : 1.5), borderColor: t.gelap ? t.garis : t.tinta, borderRadius: 12, backgroundColor: isi ?? t.kartu, paddingVertical: 3.5, paddingHorizontal: 9, marginRight: 8 }}>
      {e ? <Ikon e={e} ukuran={10} style={{ marginRight: 5 }} warna={isi && !t.gelap ? '#141414' : undefined} /> : null}
      <T w={600} s={9} c={c ?? (isi && !t.gelap ? '#141414' : t.teks)}>{teks}</T>
    </View>
  )
}

// ── Kartu tokoh ──────────────────────────────────────────────────────────
export const inisial = (nama = '') => nama.split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase() || '?'
const MIRING = [-2.2, 1.6, -1.2, 2.4, 1.2, -2, 2, -1.4]

export function KartuTokoh({ tokoh, i, foto = 104, lebar = 218 }) {
  const t = useTema()
  const m = useMetrik()
  const p = tokoh.org ? paletTema(t, tokoh.org.slotWarna) : t.palet
  const sNama = ukuranPas(tokoh.nama, m.judul600, lebar - 40, foto >= 140 ? 13.5 : 12, 8.5)
  const r = t.gelap ? foto / 2 : 16
  const miring = t.gelap ? 0 : MIRING[i % MIRING.length]
  return (
    <View style={{ width: lebar, alignItems: 'center' }}>
      <View style={{ width: foto + 6, height: foto + 6, transform: `rotate(${miring}deg)` }}>
        {t.bayang ? <View style={{ position: 'absolute', left: 6, top: 6, width: foto, height: foto, borderRadius: r, backgroundColor: t.bayang }} /> : null}
        {tokoh.fotoUrl ? (
          <Image src={tokoh.fotoUrl} style={{ position: 'absolute', left: 0, top: 0, width: foto, height: foto, borderRadius: r, objectFit: 'cover' }} />
        ) : (
          <View style={{ position: 'absolute', left: 0, top: 0, width: foto, height: foto, borderRadius: r, backgroundColor: p.lapis, alignItems: 'center', justifyContent: 'center' }}>
            <T f="judul" w={700} s={foto * 0.34} c={teksDi(p.lapis)}>{inisial(tokoh.nama)}</T>
          </View>
        )}
        <View style={{ position: 'absolute', left: 0, top: 0, width: foto, height: foto, borderRadius: r, borderWidth: (t.bersih ? 1 : t.gelap ? 2 : 2.5), borderColor: t.gelap || t.bersih ? t.hiasMuda : t.tinta }} />
      </View>
      <View style={{ marginTop: 11, borderWidth: (t.bersih ? 1 : t.gelap ? 1 : 2), borderColor: t.gelap ? t.garis : t.tinta, borderRadius: 14, backgroundColor: t.kartu, paddingVertical: 3.5, paddingHorizontal: 11, maxWidth: lebar - 18 }}>
        <T pas f="judul" w={600} s={sNama} c={t.tinta} style={{ textAlign: 'center' }}>{tokoh.nama}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, maxWidth: lebar - 18 }}>
        {tokoh.org ? <TitikCircle warna={p.aksen} ukuran={8} style={{ marginRight: 5 }} /> : null}
        <T w={600} s={9} c={t.redup} style={{ textAlign: 'center' }}>{tokoh.label}</T>
      </View>
    </View>
  )
}

// ── Rincian pengeluaran berkolom (satu slide) ────────────────────────────
// Kategori = profil unit (Bio Unit › Pengeluaran Rutin: Support System,
// Subscription/Langganan, Lainnya) + Pendapatan Anggota, SHU, Tambahan.
export const KELOMPOK_RINCIAN = [
  { id: 'THP', label: 'Pendapatan Anggota' },
  { id: 'SUPPORT', label: 'Support System' },
  { id: 'SUBSCRIPTION', label: 'Subscription/Langganan' },
  { id: 'LAINNYA', label: 'Lainnya' },
  { id: 'SHU', label: 'SHU' },
  { id: 'TAMBAHAN', label: 'Pengeluaran Tambahan' },
]

/** Kelompok berurutan + subtotal dari rincian server. */
export function kelompokRincian(r) {
  const semua = [...(r?.baris ?? []), ...(r?.tambahan ?? [])]
  return KELOMPOK_RINCIAN.map(k => {
    const isi = semua.filter(b => (b.kelompok ?? 'LAINNYA') === k.id || (k.id === 'LAINNYA' && !KELOMPOK_RINCIAN.some(x => x.id === b.kelompok)))
    return { ...k, isi, subtotal: isi.reduce((a, b) => a + (b.jumlah ?? 0), 0) }
  }).filter(k => k.isi.length)
}

/** Warna irisan komposisi per kelompok (circle, tinta, sorot, lapis, …). */
export function warnaKelompok(t, id) {
  const p = t.palet
  const peta = t.warnaRincian ?? (t.gelap
    ? { THP: '#8B5CF6', SUPPORT: '#EC4899', SUBSCRIPTION: '#06B6D4', LAINNYA: '#64748B', SHU: '#FBBF24', TAMBAHAN: '#F472B6' }
    : { THP: p.aksen === '#141414' ? '#5A5A5A' : p.aksen, SUPPORT: '#141414', SUBSCRIPTION: '#9BD1FF', LAINNYA: '#C9C9C3', SHU: '#FFE45C', TAMBAHAN: p.lapis })
  return peta[id] ?? '#8C8C87'
}

/**
 * Daftar berkelompok dalam kolom-kolom (diisi berurutan; kelompok yang tidak
 * muat berlanjut ke kolom berikut). Mengembalikan null bila tidak muat sama
 * sekali di `jumlahKolom` (pemanggil boleh memecah halaman).
 */
export function KolomRincian({ kelompok, lebar, tinggi, jumlahKolom = 3, celah = 16 }) {
  const t = useTema()
  const barisTotal = kelompok.reduce((a, k) => a + k.isi.length + 1, 0)
  const lebarKolom = (lebar - celah * (jumlahKolom - 1)) / jumlahKolom
  // Pilih kerapatan terbesar yang memuat semuanya.
  const tingkat = [{ h: 17, s: 9.6 }, { h: 15, s: 9 }, { h: 13.2, s: 8.4 }, { h: 11.8, s: 7.8 }]
  let pilih = tingkat[tingkat.length - 1]
  for (const k of tingkat) { if (Math.floor(tinggi / k.h) * jumlahKolom >= barisTotal + jumlahKolom) { pilih = k; break } }
  const muat = Math.max(4, Math.floor(tinggi / pilih.h))
  const kolom = [[]]
  const tambah = (item) => {
    if (kolom[kolom.length - 1].length >= muat) kolom.push([])
    kolom[kolom.length - 1].push(item)
  }
  for (const k of kelompok) {
    // Kepala kelompok tidak boleh jadi baris terakhir kolom (yatim, isinya terlempar ke
    // kolom berikut sebagai "(lanj.)") — pindahkan ke kolom baru. Cadangan satu baris per
    // kolom di pemilihan kerapatan di atas sudah menampungnya.
    const kini = kolom[kolom.length - 1]
    if (kini.length && kini.length >= muat - 1) kolom.push([])
    tambah({ kepala: true, label: k.label, subtotal: k.subtotal, id: k.id })
    k.isi.forEach(b => {
      if (kolom[kolom.length - 1].length >= muat) { kolom.push([]); kolom[kolom.length - 1].push({ kepala: true, label: `${k.label} (lanj.)`, id: k.id }) }
      kolom[kolom.length - 1].push(b)
    })
  }
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: lebar }}>
      {Array.from({ length: jumlahKolom }, (_, ci) => (
        <View key={ci} style={{ width: lebarKolom }}>
          {(kolom[ci] ?? []).map((b, i) => b.kepala ? (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: pilih.h, paddingHorizontal: 6, marginTop: i ? 3 : 0, backgroundColor: t.gelap || t.bersih ? t.kartuAksen : t.palet.lapis, borderRadius: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: warnaKelompok(t, b.id), marginRight: 5, borderWidth: 1, borderColor: t.gelap ? t.garis : t.tinta }} />
              <T w={700} s={pilih.s - 0.6} c={t.gelap ? t.teksLembut : t.tinta} style={{ flexGrow: 1, letterSpacing: 0.6, textTransform: 'uppercase' }}>{b.label}</T>
              {b.subtotal != null ? <T w={700} s={pilih.s - 0.4} c={t.gelap ? t.teksLembut : t.tinta}>{rp(b.subtotal)}</T> : null}
            </View>
          ) : (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: pilih.h, paddingHorizontal: 6, borderBottomWidth: 0.6, borderBottomColor: t.garisTipis }}>
              <T s={pilih.s} c={t.teks} style={{ flexGrow: 1, flexShrink: 1 }}>{b.label}</T>
              <T w={600} s={pilih.s} c={t.tinta}>{rp(b.jumlah)}</T>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

/** Apakah rincian muat satu halaman di `jumlahKolom` kolom setinggi `tinggi`. */
export function rincianMuat(kelompok, tinggi, jumlahKolom = 3) {
  const barisTotal = kelompok.reduce((a, k) => a + k.isi.length + 1, 0)
  return Math.floor(tinggi / 11.8) * jumlahKolom >= barisTotal + jumlahKolom
}
