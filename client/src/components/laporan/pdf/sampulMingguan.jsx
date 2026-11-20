// ─────────────────────────────────────────────────────────────────────────
// SAMPUL WEEKLY REPORT (arahan Owner 11 Okt 2026): dibedakan dari Monthly — setiap
// gaya memajang FOTO PROFIL UNIT (Studio.logoUrl; belum diunggah → logo otomatis:
// ubin warna circle + inisial). Deret W1–W5 dihapus (Owner: "gausah pakai w1, w2"). Tujuh gaya + FOTO SENDIRI dengan enam tata letak (sama
// dengan Monthly: Bingkai, Penuh Gelap, Penuh Gradasi, Warna Circle, Belah Dua, Polaroid).
// Semua jalan di dua tema (Playground kertas · Kosmik).
// ─────────────────────────────────────────────────────────────────────────
import { Page, View, Image, Svg, Path, Circle } from '@react-pdf/renderer'
import { W, H, T, Stiker, Stabilo, Panah, Ikon, KisiTitik, campur, teksDi, useTema, useMetrik } from './primitif'
import { KopEkosistem, PilJenis, FotoPenuh, KanvasTema, StikerEmoji, Polaroid, jalurHalftone } from './latar'
import { ukuranPas } from './metrikHuruf'

const PUTIH = '#FFFFFF'
const inisialUnit = (nama = '') => String(nama).split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase() || '?'
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** Warna "pop" tema: Playground = stabilo kuning, Kosmik = merah muda gradasi. */
const warnaPop = (t) => (t.gelap ? (t.gradien?.[1] ?? '#DB2777') : t.sorot)
const tintaTema = (t) => (t.gelap ? t.teks : t.tinta)

/** Minggu berjalan (nomor) dari data.minggu + tanggal acuan laporan. */
function mingguKini(minggu = [], acuan) {
  const batas = acuan ? new Date(acuan).getTime() : Date.now()
  return [...minggu].reverse().find(m => new Date(m.periodeAwal).getTime() <= batas)?.nomor ?? 0
}

/** Foto profil unit — bingkai bertema; tanpa foto → ubin warna + inisial. */
export function AvatarUnit({ src, nama, ukuran = 200, bulat = false, garis, bayang = true, isi: isiLatar = null, rotasi = 0 }) {
  const t = useTema()
  const r = bulat ? ukuran / 2 : ukuran * 0.2
  const tebal = t.bersih ? 1.5 : t.gelap ? 2 : Math.max(3, Math.round(ukuran / 50))
  const warnaGaris = garis ?? (t.gelap || t.bersih ? t.hiasMuda : t.tinta)
  const geser = bayang && t.bayang ? Math.round(ukuran * 0.04) : 0
  const isi = isiLatar ?? t.palet.aksen
  return (
    <View style={{ width: ukuran + geser, height: ukuran + geser, position: 'relative', transform: rotasi ? `rotate(${rotasi}deg)` : undefined }}>
      {geser ? <View style={{ position: 'absolute', left: geser, top: geser, width: ukuran, height: ukuran, borderRadius: r, backgroundColor: t.bayang }} /> : null}
      <View style={{ position: 'absolute', left: 0, top: 0, width: ukuran, height: ukuran, borderRadius: r, backgroundColor: src ? PUTIH : isi, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {src
          ? <Image src={src} style={{ width: ukuran, height: ukuran, objectFit: 'cover', borderRadius: r }} />
          : <T pas f="judul" w={700} s={ukuran * 0.36} c={teksDi(isi)} style={{ lineHeight: 1 }}>{inisialUnit(nama)}</T>}
      </View>
      <View style={{ position: 'absolute', left: 0, top: 0, width: ukuran, height: ukuran, borderRadius: r, borderWidth: tebal, borderColor: warnaGaris }} />
    </View>
  )
}

function Judul({ nama, bulanLabel, warnaTeks, lebar, maks = 78, tengah = false }) {
  const t = useTema()
  const m = useMetrik()
  const NAMA = String(nama).toUpperCase()
  const c = warnaTeks ?? tintaTema(t)
  const gelap = c === PUTIH || t.gelap
  return (
    <View style={{ alignItems: tengah ? 'center' : 'flex-start' }}>
      <T pas f="judul" w={700} s={ukuranPas(NAMA, m.judul700, lebar, maks, 26)} c={c} style={{ lineHeight: 1, textAlign: tengah ? 'center' : 'left' }}>{NAMA}</T>
      <Stabilo style={{ marginTop: 10, alignSelf: tengah ? 'center' : 'flex-start' }} penuh={gelap}>
        <T f="judul" w={600} s={26} c={t.teksSorot}>Weekly Report</T>
      </Stabilo>
      {bulanLabel ? <T w={700} s={12.5} c={c} style={{ letterSpacing: 4.2, marginTop: 14 }}>{String(bulanLabel).toUpperCase()}</T> : null}
    </View>
  )
}

/** Bintang ledak (starburst) — jalur titik-titik bergantian jari luar/dalam. */
function jalurLedak(cx, cy, rLuar, rDalam, jari = 16) {
  let d = ''
  for (let i = 0; i < jari * 2; i++) {
    const r = i % 2 ? rDalam : rLuar
    const a = (Math.PI * i) / jari - Math.PI / 2
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  }
  return d + 'Z'
}

/** Kalender bulan itu — baris minggu berjalan disorot, minggu yang sudah lewat diarsir (tanpa label W, Owner 11 Okt 2026). */
function KartuKalender({ minggu = [], acuan, lebar = 420 }) {
  const t = useTema()
  const awal = minggu[0] ? new Date(minggu[0].periodeAwal) : new Date()
  const th = awal.getUTCFullYear(), bl = awal.getUTCMonth()
  const akhir = new Date(Date.UTC(th, bl + 1, 0)).getUTCDate()
  const kini = mingguKini(minggu, acuan)
  const hariAcuan = acuan ? new Date(acuan) : null
  const hariIni = hariAcuan && hariAcuan.getUTCFullYear() === th && hariAcuan.getUTCMonth() === bl ? hariAcuan.getUTCDate() : null
  // Baris = minggu kalender (Senin–Minggu); nomor W mengikuti periode laporan (maks W5).
  const baris = []
  for (let d = 1; d <= akhir; d++) {
    const hari = (new Date(Date.UTC(th, bl, d)).getUTCDay() + 6) % 7 // Senin = 0
    if (d === 1 || hari === 0) baris.push(Array(7).fill(null))
    baris[baris.length - 1][hari] = d
  }
  const sel = Math.floor((lebar - 40 - 12) / 7)
  const tinggi = Math.min(40, sel)
  const tinta = tintaTema(t)
  return (
    <Stiker bayang={8} sudut={22} isiStyle={{ paddingVertical: 16, paddingHorizontal: 20 }} style={{ width: lebar }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ikon e="🗓" ukuran={20} warna={tinta} />
        <T f="judul" w={700} s={18} c={tinta} style={{ marginLeft: 8 }}>{`${NAMA_BULAN[bl]} ${th}`}</T>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: 6, marginBottom: 4 }}>
        {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((h, i) => (
          <T key={i} w={700} s={9.5} c={t.redup} style={{ width: sel, textAlign: 'center' }}>{h}</T>
        ))}
      </View>
      {baris.map((b, i) => {
        const no = Math.min(i + 1, 5)
        const berjalan = no === kini
        const selesai = no < kini
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: tinggi, marginBottom: 3, borderRadius: 10, backgroundColor: berjalan ? t.sorot : selesai ? t.palet.lapis : 'transparent' }}>
            <View style={{ width: 6 }} />
            {b.map((d, j) => (
              <View key={j} style={{ width: sel, alignItems: 'center', justifyContent: 'center' }}>
                {d ? (
                  <View style={{ width: tinggi - 8, height: tinggi - 8, borderRadius: (tinggi - 8) / 2, alignItems: 'center', justifyContent: 'center', borderWidth: d === hariIni ? 2 : 0, borderColor: berjalan ? t.teksSorot : tinta }}>
                    <T w={berjalan ? 700 : 500} s={11} c={berjalan ? t.teksSorot : (selesai || !kini ? tinta : t.redup)}>{String(d)}</T>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )
      })}
    </Stiker>
  )
}

// ── Foto sendiri: enam tata letak (sama dengan Monthly) + foto profil unit ─────────
function SampulFoto({ tataFoto, foto, profil, nama, bulanLabel, ekosistemNama, jenisLabel, minggu, acuan }) {
  const t = useTema()
  const tinta = tintaTema(t)
  if (['gelap', 'gradasi', 'warna'].includes(tataFoto)) {
    const teks = tataFoto === 'warna' ? t.palet.teksAksen : PUTIH
    return (
      <Page size={[W, H]} style={{ backgroundColor: '#000000', position: 'relative' }}>
        <FotoPenuh foto={foto} lapisan={tataFoto} />
        <KopEkosistem pge nama={ekosistemNama} warna={teks} terang={teks === PUTIH} />
        <View style={{ position: 'absolute', left: 60, bottom: 112, flexDirection: 'row', alignItems: 'flex-end' }}>
          <AvatarUnit src={profil} nama={nama} ukuran={150} garis={teks} bayang={false} isi={tataFoto === 'warna' ? t.palet.lapis : null} />
          <View style={{ marginLeft: 28, marginBottom: 4 }}>
            <PilJenis teks={jenisLabel} terang />
            <Judul nama={nama} bulanLabel={bulanLabel} warnaTeks={teks} lebar={560} maks={66} />
          </View>
        </View>
      </Page>
    )
  }
  if (tataFoto === 'belah') {
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <KanvasTema />
        <Image src={foto} style={{ position: 'absolute', top: 0, right: 0, width: 500, height: H, objectFit: 'cover' }} />
        <View style={{ position: 'absolute', top: 0, left: 460, width: t.bersih ? 2 : t.gelap ? 3 : 6, height: H, backgroundColor: t.gelap || t.bersih ? t.hias : t.tinta }} />
        <KopEkosistem pge nama={ekosistemNama} />
        <View style={{ position: 'absolute', left: 52, top: 104 }}><AvatarUnit src={profil} nama={nama} ukuran={132} /></View>
        <View style={{ position: 'absolute', left: 52, top: 262, width: 380 }}>
          <Judul nama={nama} bulanLabel={bulanLabel} lebar={370} maks={54} />
        </View>
      </Page>
    )
  }
  if (tataFoto === 'polaroid') {
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <KanvasTema />
        <Polaroid foto={foto} label={bulanLabel} kiri={560} atas={96} />
        <KopEkosistem pge nama={ekosistemNama} />
        <View style={{ position: 'absolute', left: 60, top: 104 }}><AvatarUnit src={profil} nama={nama} ukuran={140} rotasi={-4} /></View>
        <View style={{ position: 'absolute', left: 60, top: 272, width: 470 }}>
          <Judul nama={nama} bulanLabel={bulanLabel} lebar={460} maks={64} />
        </View>
      </Page>
    )
  }
  // Bingkai (bawaan): foto berbingkai lebar, foto profil menindih tepi bawahnya.
  return (
    <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
      <KanvasTema />
      {t.bayang ? <View style={{ position: 'absolute', left: 74, top: 42, width: 828, height: 290, borderRadius: 26, backgroundColor: t.bayang }} /> : null}
      <Image src={foto} style={{ position: 'absolute', left: 66, top: 34, width: 828, height: 290, borderRadius: 26, objectFit: 'cover' }} />
      <View style={{ position: 'absolute', left: 66, top: 34, width: 828, height: 290, borderRadius: 26, borderWidth: (t.bersih ? 1 : t.gelap ? 1.5 : 3), borderColor: t.gelap || t.bersih ? t.hiasMuda : t.tinta }} />
      <View style={{ position: 'absolute', left: 84, top: 248 }}><AvatarUnit src={profil} nama={nama} ukuran={150} /></View>
      <View style={{ position: 'absolute', left: 262, top: 342, width: 640 }}>
        <Judul nama={nama} bulanLabel={bulanLabel} lebar={630} maks={52} />
      </View>
      <View style={{ position: 'absolute', right: 66, top: 44 }}><PilJenis teks={jenisLabel} /></View>
      {/* Foto mengisi bagian atas → kop (logo circle | logo PGE) pindah ke pojok kanan bawah. */}
      <KopEkosistem pge nama={ekosistemNama} kiri={720} atas={484} />
    </Page>
  )
}

/**
 * @param gaya     id GAYA_MINGGUAN (gayaLatar.js) | 'foto'
 * @param tataFoto tata letak foto sendiri (TATA_FOTO, sama dengan Monthly)
 * @param profil   data URL foto profil unit (null → logo otomatis)
 * @param minggu   data.minggu ({ nomor, periodeAwal, label }) · acuan = data.tanggalAcuan
 */
export function SampulMingguan({ gaya = 'mg-profil', tataFoto = 'bingkai', foto, profil, nama, bulanLabel, ekosistemNama, jenisLabel, minggu, acuan }) {
  const t = useTema()
  const tinta = tintaTema(t)
  const umum = { profil, nama, bulanLabel, ekosistemNama, jenisLabel, minggu, acuan }

  if (gaya === 'foto' && foto) return <SampulFoto tataFoto={tataFoto} foto={foto} {...umum} />

  // ── Poster Pop: bidang warna circle, pita miring, bintang ledak di balik foto profil ──
  if (gaya === 'mg-poster') {
    const latar = t.bersih ? t.palet.aksen : t.gelap ? '#1B1340' : t.palet.aksen
    const teks = t.gelap ? t.teks : t.palet.teksAksen
    const pop = warnaPop(t)
    return (
      <Page size={[W, H]} style={{ backgroundColor: latar, position: 'relative' }}>
        <KisiTitik warna={teks} opacity={0.08} />
        <View style={{ position: 'absolute', left: -140, top: 360, width: 1300, height: 96, backgroundColor: pop, transform: 'rotate(-10deg)', borderWidth: (t.bersih ? 1 : t.gelap ? 0 : 3), borderColor: t.tinta }} />
        <Svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
          <Path d={jalurLedak(728, 238, 214, 168, 18)} fill={pop} stroke={t.gelap ? 'none' : t.tinta} strokeWidth={3} />
          <Circle cx={728} cy={238} r={148} fill={campur(pop, PUTIH, 0.35)} />
        </Svg>
        <KopEkosistem pge nama={ekosistemNama} warna={teks} terang={teks === PUTIH} />
        <View style={{ position: 'absolute', left: 612, top: 120 }}>
          <AvatarUnit src={profil} nama={nama} ukuran={228} rotasi={-6} garis={t.gelap ? PUTIH : t.tinta} isi={t.gelap ? null : (latar === t.palet.aksen ? t.palet.lapis : null)} />
        </View>
        <StikerEmoji x={862} y={78} u={58} isi={t.gelap || t.bersih ? t.hias : t.kartu} e="✨" rot={10} />
        <StikerEmoji x={566} y={92} u={46} bentuk="kotak" isi={t.gelap && !t.bersih ? '#2A2352' : t.kartu} e="🚀" rot={-12} />
        <View style={{ position: 'absolute', left: 60, top: 128, width: 500 }}>
          <PilJenis teks={jenisLabel} terang />
          <Judul nama={nama} bulanLabel={bulanLabel} warnaTeks={teks} lebar={480} maks={84} />
        </View>
      </Page>
    )
  }

  // ── Komik: halftone + balon kata dari foto profil ──
  if (gaya === 'mg-komik') {
    const aksen = t.gelap || t.bersih ? t.hias : t.palet.aksen
    const balon = t.gelap ? t.kartu : PUTIH
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <KanvasTema />
        <Svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
          <Path d={jalurHalftone({ x0: 440, y0: 0, x1: W, y1: 380, pojokX: W, pojokY: 0, jangkau: 520, rMaks: 6 })} fill={aksen} fillOpacity={aksen === t.tinta ? 0.7 : 0.9} />
          <Path d={jalurHalftone({ x0: 0, y0: 360, x1: 360, y1: H, pojokX: 0, pojokY: H, jangkau: 300, rMaks: 4.6 })} fill={warnaPop(t)} fillOpacity={0.9} />
          {/* Ekor balon kata menunjuk foto profil */}
          <Path d="M292 300 L360 262 L372 318 Z" fill={balon} stroke={t.gelap || t.bersih ? t.garisKuat : t.tinta} strokeWidth={(t.bersih ? 1 : t.gelap ? 1.2 : 3)} strokeLinejoin="round" />
        </Svg>
        <KopEkosistem pge nama={ekosistemNama} />
        <View style={{ position: 'absolute', left: 64, top: 196 }}><AvatarUnit src={profil} nama={nama} ukuran={222} rotasi={-3} /></View>
        <View style={{ position: 'absolute', left: 352, top: 118, width: 540 }}>
          <Stiker bayang={8} tebal={t.gelap ? 1.2 : 3} sudut={30} isi={balon} isiStyle={{ paddingVertical: 24, paddingHorizontal: 30 }}>
            <PilJenis teks={jenisLabel} />
            <Judul nama={nama} bulanLabel={bulanLabel} lebar={470} maks={70} />
          </Stiker>
        </View>
        <Ikon e="💬" ukuran={44} warna={tinta} style={{ position: 'absolute', left: 860, top: 70 }} />
      </Page>
    )
  }

  // ── Stiker Ceria: foto profil miring dikelilingi stiker emoji ──
  if (gaya === 'mg-stiker') {
    const { aksen, lapis } = t.palet
    const kartu = t.gelap && !t.bersih ? '#2A2352' : t.kartu
    const sorot = warnaPop(t)
    const stiker = [
      { x: 44, y: 112, u: 64, isi: sorot, e: '🎉', rot: -10 },
      { x: 300, y: 92, u: 54, bentuk: 'kotak', isi: kartu, e: '✨', rot: 8 },
      { x: 330, y: 330, u: 70, isi: t.gelap || t.bersih ? t.hias : aksen, e: '🏆', rot: 10 },
      { x: 52, y: 380, u: 56, bentuk: 'kotak', isi: t.gelap ? kartu : lapis, e: '💡', rot: -6 },
      { x: 186, y: 430, u: 46, isi: kartu, e: '⭐' },
      { x: 860, y: 46, u: 52, isi: t.gelap ? kartu : lapis, e: '🎯', rot: 12 },
      { x: 892, y: 420, u: 44, bentuk: 'kotak', isi: sorot, e: '💚', rot: -8 },
    ]
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <KanvasTema />
        <View style={{ position: 'absolute', left: 92, top: 118, width: 300, height: 300, borderRadius: 150, backgroundColor: lapis, opacity: t.gelap ? 0.5 : 1 }} />
        <KopEkosistem pge nama={ekosistemNama} />
        <View style={{ position: 'absolute', left: 108, top: 140 }}><AvatarUnit src={profil} nama={nama} ukuran={238} rotasi={4} /></View>
        {stiker.map((s, i) => <StikerEmoji key={i} {...s} />)}
        <View style={{ position: 'absolute', left: 452, top: 150, width: 450 }}>
          <PilJenis teks={jenisLabel} />
          <Judul nama={nama} bulanLabel={bulanLabel} lebar={440} maks={74} />
        </View>
      </Page>
    )
  }

  // ── Kalender: foto profil + kalender bulan, minggu berjalan disorot ──
  if (gaya === 'mg-kalender') {
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <KanvasTema />
        <KopEkosistem pge nama={ekosistemNama} />
        <View style={{ position: 'absolute', left: 60, top: 100 }}><AvatarUnit src={profil} nama={nama} ukuran={140} /></View>
        <View style={{ position: 'absolute', left: 60, top: 268, width: 380 }}>
          <PilJenis teks={jenisLabel} />
          <Judul nama={nama} bulanLabel={bulanLabel} lebar={370} maks={58} />
        </View>
        <View style={{ position: 'absolute', left: 482, top: 54 }}>
          <KartuKalender minggu={minggu} acuan={acuan} lebar={420} />
        </View>
      </Page>
    )
  }

  if (gaya === 'mg-lencana') {
    const u = 186
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <KanvasTema />
        <View style={{ position: 'absolute', left: (W - 256) / 2, top: 35, width: 256, height: 256, borderRadius: 128, backgroundColor: t.palet.lapis, opacity: t.gelap ? 0.55 : 1 }} />
        <KopEkosistem pge nama={ekosistemNama} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 70, alignItems: 'center' }}>
          <AvatarUnit src={profil} nama={nama} ukuran={u} bulat />
        </View>
        <View style={{ position: 'absolute', left: 80, right: 80, top: 292, alignItems: 'center' }}>
          <Judul nama={nama} bulanLabel={bulanLabel} lebar={760} maks={60} tengah />
        </View>
      </Page>
    )
  }

  if (gaya === 'mg-pita') {
    const aksen = t.palet.aksen
    const teksPita = t.palet.teksAksen
    return (
      <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
        <KanvasTema />
        <View style={{ position: 'absolute', left: 0, top: 0, width: W, height: 206, backgroundColor: aksen }} />
        {!t.gelap ? <View style={{ position: 'absolute', left: 0, top: 206, width: W, height: 5, backgroundColor: t.tinta }} /> : null}
        <KopEkosistem pge nama={ekosistemNama} warna={teksPita} terang={teksPita === PUTIH} />
        <View style={{ position: 'absolute', right: 60, top: 44 }}><PilJenis teks={jenisLabel} terang /></View>
        <View style={{ position: 'absolute', left: 60, top: 112 }}>
          {/* Menindih pita warna circle: logo otomatis memakai warna terang supaya tidak larut. */}
          <AvatarUnit src={profil} nama={nama} ukuran={196} garis={t.gelap || t.bersih ? t.hiasMuda : t.tinta} isi={t.gelap ? null : t.palet.lapis} />
        </View>
        <View style={{ position: 'absolute', left: 300, top: 236, width: 600 }}>
          <Judul nama={nama} bulanLabel={bulanLabel} lebar={590} maks={70} />
        </View>
        <View style={{ position: 'absolute', right: 60, bottom: 54 }}><Panah warna={tinta} /></View>
      </Page>
    )
  }

  // mg-profil (bawaan): kartu foto profil besar di kiri, judul di kanan.
  return (
    <Page size={[W, H]} style={{ backgroundColor: t.kanvas, position: 'relative' }}>
      <KanvasTema />
      <View style={{ position: 'absolute', left: 0, top: 0, width: 372, height: H, backgroundColor: t.palet.lapis, opacity: t.gelap ? 0.5 : 1 }} />
      {!t.gelap ? <View style={{ position: 'absolute', left: 372, top: 0, width: 4, height: H, backgroundColor: t.tinta }} /> : null}
      <KopEkosistem pge nama={ekosistemNama} />
      <View style={{ position: 'absolute', left: 58, top: 118 }}>
        <Stiker bayang={8} sudut={28} isiStyle={{ padding: 14 }}>
          <AvatarUnit src={profil} nama={nama} ukuran={226} bayang={false} />
        </Stiker>
      </View>
      <View style={{ position: 'absolute', left: 420, top: 132, width: 480 }}>
        <PilJenis teks={jenisLabel} />
        <Judul nama={nama} bulanLabel={bulanLabel} lebar={470} maks={74} />
      </View>
    </Page>
  )
}
