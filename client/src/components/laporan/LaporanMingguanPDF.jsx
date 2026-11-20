// ─────────────────────────────────────────────────────────────────────────
// WEEKLY REPORT satu unit usaha, PDF 16:9 (arahan Owner 8 Okt 2026: "set untuk
// weekly reportnya seperti ini" — acuan Weekly Report Zanshin Studio & Vahcyn
// Studio per 30 September 2026). Alur mengikuti acuan:
//   Sampul → Financial Forecasting (pengeluaran bercentang · estimasi pendapatan ·
//   laba; pengeluaran tambahan diringkas seperti Progress Report) → Financial Overview
//   (equity awal & est. akhir bulan, kas bank vs luar bank) → Progres Omset
//   (akun × minggu + grafik bulanan) → Renstra/KPI (4 kategori, bila diisi) →
//   Potensi Pendapatan (antrean order per akun, bila ada) → Team (satu halaman per
//   orang: evaluasi teknis & non-teknis) → Terima Kasih.
// Tema, huruf, latar sampul & foto = pilihan yang sama dengan Progress Report/SKB.
// Data: GET /api/reports/mingguan (controllers/laporanMingguan.js) — angka apa adanya.
// KUSTOMISASI (arahan Owner 8 Okt 2026, dipilah dari PDF acuan — bagian yang bukan data
// aplikasi): halaman yang dicetak (`isi`), pendapatan lain (pengembalian pinjaman/modal),
// dana lain di Overview (pengamanan aset, piutang, money in transit), sebutan & butir per
// anggota, judul penutup (`kustom`, fotoSampul.js). Angka server tidak dihitung ulang;
// isian pemakai hanya DITAMBAHKAN dan selalu diberi keterangan di halamannya.
// SATU RUMUS (masukan Owner 9 Okt 2026): pengeluaran & laba di Forecasting, Catatan
// Pengeluaran, dan Overview dibaca dari satu tempat (`angkaUang`) — server sudah menyamakan
// CPM bulan ini dengan peta keuangan (CPM + pengeluaran tambahan = total yang terdata).
// ─────────────────────────────────────────────────────────────────────────
import React from 'react'
import { Document, View, Image, Svg, Path, Rect } from '@react-pdf/renderer'
import { daftarkanFontPdf } from './fontPdf'
import {
  W, T, Stiker, Stabilo, Ikon, LencanaIkon, HalamanIsi, JudulHalaman, Kicker,
  rp, rpBertanda, rpRingkas, usd, useTema, useMetrik,
} from './pdf/primitif'
import { TemaPdf, rakitTema, SUDUT_GAMBAR } from './pdf/tema'
import { Penutup } from './pdf/latar'
import { SampulMingguan } from './pdf/sampulMingguan'
import { KartuAngka, Cap, Chip, GrafikOmset, usdRingkas, warnaKelompok, inisial, LABEL_TIPE } from './pdf/komponen'
import { ukuranPas, lebarTeks } from './pdf/metrikHuruf'
import { warnaMarketPdf } from '../../config/warna-pdf'
import { EKOSISTEM, EKOSISTEM_NAMA_PANJANG } from '../../config/ekosistem'
import { ISI_MINGGUAN_BAWAAN, dasarMingguan } from './gayaLatar'

daftarkanFontPdf()

/** Baris isian pemakai [{label, jumlah}] → hanya yang berisi, jumlah bulat. */
const barisLain = (arr) => (Array.isArray(arr) ? arr : [])
  .map(b => ({ label: String(b?.label ?? '').trim(), jumlah: Math.round(Number(b?.jumlah) || 0) }))
  .filter(b => b.label || b.jumlah)
const jumlahLain = (arr) => barisLain(arr).reduce((a, b) => a + b.jumlah, 0)

/**
 * SATU sumber angka uang untuk semua halaman (Forecasting, Catatan Pengeluaran, Overview):
 * server sudah menyamakan CPM/tambahan/pengeluaran/laba bulan ini dengan peta keuangan;
 * di sini hanya ditambah pendapatan lain isian pembuat — ke pendapatan, laba, dan est. kas akhir
 * sekaligus, supaya tidak ada dua laba yang berbeda di dokumen yang sama.
 */
function angkaUang(data, kustom) {
  const f = data.forecasting, k = data.keuangan
  const lain = barisLain(kustom?.pendapatanLain)
  const totalLain = jumlahLain(lain)
  return {
    lain, totalLain,
    omset: f.pendapatan.totalIdr, pendapatan: f.pendapatan.totalIdr + totalLain,
    cpm: f.totalCpm, tambahan: f.totalTambahan, pengeluaran: f.totalPengeluaran,
    laba: f.laba + totalLain,
    kasAwal: k.kas?.total ?? null,
    estKasAkhir: k.estKasAkhir != null ? k.estKasAkhir + totalLain : null,
  }
}
/** Tanggal Catat Pengeluaran disimpan tengah malam UTC → baca dengan getter UTC. */
const tglPendek = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${BULAN_PENDEK[d.getUTCMonth()]}` }


const ISI_W = W - 88
const ISI_H = 540 - 64 - 48
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const STATUS_TIM = {
  BAIK: { teks: 'BAIK', kunci: 'baik' },
  PERHATIAN: { teks: 'PERHATIAN', kunci: 'perhatian' },
  KRITIS: { teks: 'KRITIS', kunci: 'kritis' },
}

// ── Kotak centang & tanda silang (vektor — glyph ✓/✗ tak ada di semua font) ──
function Centang({ nyala, ukuran = 9.5, style }) {
  const t = useTema()
  const tepi = t.gelap || t.bersih ? t.hiasMuda : t.tinta
  const isi = nyala ? (t.gelap || t.bersih ? t.hias : t.tinta) : (t.gelap ? t.kartu : '#FFFFFF')
  return (
    <Svg viewBox="0 0 12 12" style={[{ width: ukuran, height: ukuran }, ...[].concat(style ?? [])]}>
      <Rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2" fill={isi} stroke={tepi} strokeWidth="1.2" />
      {nyala ? <Path d="M3 6.2l2 2 4-4.4" stroke="#FFFFFF" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  )
}
function Silang({ ukuran = 9.5, warna, style }) {
  const t = useTema()
  return (
    <Svg viewBox="0 0 12 12" style={[{ width: ukuran, height: ukuran }, ...[].concat(style ?? [])]}>
      <Rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2" fill={warna ?? t.vonis.kritisLapis} stroke={warna ?? t.vonis.kritis} strokeWidth="1.2" />
      <Path d="M3.6 3.6l4.8 4.8M8.4 3.6l-4.8 4.8" stroke={t.vonis.kritis} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  )
}

// ── Financial Forecasting ────────────────────────────────────────────────
const TINGKAT = [{ h: 16.5, s: 9.4 }, { h: 14.5, s: 8.6 }, { h: 12.8, s: 7.9 }, { h: 11.4, s: 7.2 }]
const jumlahBaris = (kelompok) => kelompok.reduce((a, k) => a + k.baris.length + 1, 0)

/** Susun kelompok pos ke kolom-kolom; kepala kelompok tak pernah jadi baris terakhir kolom. */
function susunKolom(kelompok, tinggi, jumlahKolom) {
  const total = jumlahBaris(kelompok)
  let pilih = TINGKAT[TINGKAT.length - 1]
  for (const k of TINGKAT) { if (Math.floor(tinggi / k.h) * jumlahKolom >= total + jumlahKolom) { pilih = k; break } }
  // Daftar pendek di satu kolom: baris dilonggarkan (maks 24 pt) supaya kartu tidak kosong.
  if (jumlahKolom === 1 && pilih === TINGKAT[0]) {
    const h = Math.min(24, Math.floor(tinggi / (total + 1)))
    if (h > pilih.h) pilih = { h, s: h >= 22 ? 10.6 : h >= 19 ? 10 : 9.4 }
  }
  const muat = Math.max(4, Math.floor(tinggi / pilih.h))
  const kolom = [[]]
  const akhir = () => kolom[kolom.length - 1]
  for (const k of kelompok) {
    if (akhir().length && akhir().length >= muat - 1) kolom.push([])
    akhir().push({ kepala: true, judul: k.judul, sub: k.sub, jenis: k.jenis, subtotal: k.subtotal })
    for (const b of k.baris) {
      if (akhir().length >= muat) { kolom.push([]); akhir().push({ kepala: true, judul: `${k.judul} (lanj.)`, jenis: k.jenis }) }
      akhir().push(b)
    }
  }
  const sisa = kolom.slice(jumlahKolom).flat().filter(b => !b.kepala).length
  return { kolom: kolom.slice(0, jumlahKolom), pilih, sisa }
}

function DaftarCentang({ kelompok, lebar, tinggi, jumlahKolom, celah = 14 }) {
  const t = useTema()
  const { kolom, pilih, sisa } = susunKolom(kelompok, tinggi, jumlahKolom)
  const lebarKolom = (lebar - celah * (jumlahKolom - 1)) / jumlahKolom
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: lebar }}>
        {Array.from({ length: jumlahKolom }, (_, ci) => (
          <View key={ci} style={{ width: lebarKolom }}>
            {(kolom[ci] ?? []).map((b, i) => b.kepala ? (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: pilih.h, paddingHorizontal: 6, marginTop: i ? 3 : 0, backgroundColor: t.gelap || t.bersih ? t.kartuAksen : t.palet.lapis, borderRadius: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: warnaKelompok(t, b.jenis), marginRight: 5, borderWidth: 1, borderColor: t.gelap || t.bersih ? t.garis : t.tinta }} />
                <T w={700} s={pilih.s - 0.6} c={t.gelap ? t.teksLembut : t.tinta} style={{ flexShrink: 1, letterSpacing: 0.4 }}>{b.judul}</T>
                {b.sub && jumlahKolom === 1 ? <T s={pilih.s - 1.2} c={t.gelap ? t.hiasMuda : t.redup} style={{ marginLeft: 5, flexShrink: 1 }}>{`(${b.sub})`}</T> : null}
                <View style={{ flexGrow: 1 }} />
                {b.subtotal != null ? <T w={700} s={pilih.s - 0.4} c={t.gelap ? t.teksLembut : t.tinta}>{rp(b.subtotal)}</T> : null}
              </View>
            ) : (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: pilih.h, paddingHorizontal: 6, borderBottomWidth: 0.6, borderBottomColor: t.garisTipis }}>
                <Centang nyala={!!b.centang} ukuran={pilih.s + 0.6} style={{ marginRight: 6 }} />
                {b.tanggal ? <T s={pilih.s - 1.6} c={t.redup} style={{ marginRight: 4, width: 38 }}>{tglPendek(b.tanggal)}</T> : null}
                <T s={pilih.s} c={t.teks} style={{ flexGrow: 1, flexShrink: 1 }}>{b.label}</T>
                <T w={600} s={pilih.s} c={t.tinta}>{rp(b.jumlah)}</T>
              </View>
            ))}
          </View>
        ))}
      </View>
      {sisa > 0 ? <T s={7.8} c={t.redup} style={{ marginTop: 4 }}>{`+${sisa} pos lain tidak muat di halaman — totalnya tetap dihitung.`}</T> : null}
    </View>
  )
}

function HalamanForecasting({ data, kustom, bersama }) {
  const t = useTema()
  const f = data.forecasting
  const bulanNama = data.labelBulan.split(' ')[0]
  const kiriW = 548
  const kananW = ISI_W - kiriW - 18
  const tinggiDaftar = ISI_H - 58 - 54
  const jumlahKolom = Math.floor(tinggiDaftar / TINGKAT[0].h) >= jumlahBaris(f.kelompok) + 1 ? 1 : 2
  const pend = f.pendapatan
  // Pendapatan lain = isian pemakai (acuan: "Pengembalian Pinjaman", "Pengembalian Modal") —
  // ditambahkan di bawah omset per akun; total & laba ikut bertambah, diberi keterangan.
  const a = angkaUang(data, kustom)
  const { lain, totalLain, pendapatan: totalPendapatan, laba } = a
  const untung = laba >= 0
  const totalPos = f.totalPos ?? f.totalPengeluaran
  const tercentangPersen = totalPos > 0 ? Math.round((f.totalTercentang / totalPos) * 100) : 0
  const kartuH = 92 // cukup untuk angka + dua baris keterangan tanpa bertumpuk (Owner 9 Okt: "teks mepet")
  const maksAkun = Math.max(3, 9 - lain.length)
  return (
    <HalamanIsi bagian="Financial Forecasting" {...bersama}>
      <JudulHalaman judul="Financial Forecasting" sorot={data.labelBulan} ukuran={32} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexGrow: 1 }}>
        <Stiker style={{ width: kiriW }} isiStyle={{ paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <LencanaIkon e="🧾" ukuran={20} bayang={0} />
            <Kicker s={9.5} c={t.tinta} style={{ marginLeft: 7 }}>Estimasi Pengeluaran</Kicker>
            <View style={{ flexGrow: 1 }} />
            <T s={8.2} c={t.redup}>{`${f.jumlahPos} pos · ${tercentangPersen}% sudah ditransfer`}</T>
          </View>
          {f.kelompok.length ? (
            <DaftarCentang kelompok={f.kelompok} lebar={kiriW - 24 - 2 * t.tebalGaris} tinggi={tinggiDaftar - 40} jumlahKolom={jumlahKolom} />
          ) : (
            <T s={10} c={t.redup}>Belum ada Pendapatan Anggota maupun pengeluaran rutin di Bio Unit.</T>
          )}
          <View style={{ flexGrow: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTopWidth: (t.bersih ? 1 : t.gelap ? 1 : 1.5), borderTopColor: t.gelap || t.bersih ? t.garis : t.tinta }}>
            <View style={{ flexGrow: 1 }}>
              <T f="judul" w={700} s={11} c={t.tinta}>TOTAL PENGELUARAN</T>
              <T s={7.6} c={t.redup}>{`CPM ${rp(f.totalCpm)} + pengeluaran tambahan ${rp(f.totalTambahan)}`}</T>
            </View>
            <T w={800} s={12} c={t.tinta}>{rp(f.totalPengeluaran)}</T>
          </View>
        </Stiker>
        <View style={{ width: kananW, justifyContent: 'space-between' }}>
          <Stiker style={{ flexGrow: 1, marginBottom: 8 }} isiStyle={{ paddingVertical: 10, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <LencanaIkon e="📈" ukuran={20} bayang={0} />
              <Kicker s={9.5} c={t.tinta} style={{ marginLeft: 7 }}>Estimasi Pendapatan</Kicker>
            </View>
            {pend.baris.length ? pend.baris.slice(0, maksAkun).map((b, i) => {
              const market = b.kunci.split('|')[0]
              return (
                <View key={b.kunci} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderTopWidth: i ? 0.6 : 0, borderTopColor: t.garisTipis }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: warnaMarketPdf(market, 'utuh'), borderWidth: 1, borderColor: t.gelap || t.bersih ? t.garis : t.tinta, marginRight: 6, transform: 'rotate(-8deg)' }} />
                  <View style={{ flexGrow: 1, flexShrink: 1 }}>
                    <T w={600} s={8.8} c={t.teks}>{b.label}</T>
                    <T s={7.4} c={t.redup}>{usd(b.usd)}</T>
                  </View>
                  <T w={700} s={9} c={t.tinta}>{rp(b.idr)}</T>
                </View>
              )
            }) : <T s={9} c={t.redup}>{lain.length ? 'Belum ada laporan omset bulan ini.' : 'Belum ada laporan omset bulan ini.'}</T>}
            {pend.baris.length > maksAkun ? <T s={7.4} c={t.redup} style={{ marginTop: 3 }}>{`+${pend.baris.length - maksAkun} akun lain (${rp(pend.baris.slice(maksAkun).reduce((a, b) => a + b.idr, 0))})`}</T> : null}
            {lain.map((b, i) => (
              <View key={`lain-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderTopWidth: 0.6, borderTopColor: t.garisTipis }}>
                <Ikon e="💵" ukuran={9} warna={t.redup} style={{ marginRight: 6 }} />
                <View style={{ flexGrow: 1, flexShrink: 1 }}>
                  <T w={600} s={8.8} c={t.teks}>{b.label || 'Pendapatan lain'}</T>
                  <T s={7.4} c={t.redup}>isian pembuat</T>
                </View>
                <T w={700} s={9} c={t.tinta}>{rp(b.jumlah)}</T>
              </View>
            ))}
            <View style={{ flexGrow: 1 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTopWidth: (t.bersih ? 1 : t.gelap ? 1 : 1.5), borderTopColor: t.gelap || t.bersih ? t.garis : t.tinta }}>
              <T f="judul" w={700} s={11} c={t.tinta} style={{ flexGrow: 1 }}>TOTAL</T>
              <T w={800} s={12} c={t.tinta}>{rp(totalPendapatan)}</T>
            </View>
          </Stiker>
          <KartuAngka e="🧾" label="Estimasi Pengeluaran" nilai={rp(f.totalPengeluaran)} lebar={kananW} tinggi={kartuH} besar={15} padat warnaNilai={f.totalPengeluaran > 0 ? t.vonis.kritis : undefined}
            sub={`CPM ${rp(f.totalCpm)}${f.totalTambahan ? ` + tambahan ${rp(f.totalTambahan)}` : ''}`} />
          <View style={{ height: 8 }} />
          <KartuAngka e="📈" label="Estimasi Pendapatan" nilai={rp(totalPendapatan)} lebar={kananW} tinggi={kartuH} besar={15} padat warnaNilai={totalPendapatan > 0 ? t.vonis.baik : undefined}
            sub={lain.length ? `Omset ${rp(pend.totalIdr)} + lain ${rp(totalLain)}` : `${usd(pend.totalUsd)} · ${data.omset.jumlahLaporan} laporan ${bulanNama}`} />
          <View style={{ height: 8 }} />
          <KartuAngka e={untung ? '🌱' : '💸'} label="Laba" nilai={rpBertanda(laba)} lebar={kananW} tinggi={kartuH} besar={16} padat sorot sub="Pendapatan – Pengeluaran (= Menabung)" />
        </View>
      </View>
      {/* Paragraf penjelasan dihapus (Owner 11 Okt 2026: "tidak perlu ada penjelasan ini di weekly report"). */}
    </HalamanIsi>
  )
}

// ── Financial Overview ───────────────────────────────────────────────────
// (Owner 9 Okt 2026 sore) Dua sorotan: "Total Equity Awal Bulan" & "Est. Total Equity Akhir Bulan"
// beserta sumbernya; di bawahnya omset / pengeluaran / menabung; status diperbesar; Sumber Dana
// dipisah Kas Bank vs Luar Bank (dana ditahan) + dana lain isian pembuat.
// Luar Bank (Owner 11 Okt 2026): tiap pos menulis dolar & kurs yang dipakai — "$1.250 × Rp 16.500" di
// bawah rupiahnya. Kas Bank tetap rupiah saja.
function KelompokSumber({ judul, e, ket, baris, subtotal, tinggiBaris, sNama, sAngka, pertama, kurs = null }) {
  const t = useTema()
  return (
    <View style={{ marginTop: pertama ? 0 : 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 20, paddingHorizontal: 6, backgroundColor: t.gelap || t.bersih ? t.kartuAksen : t.palet.lapis, borderRadius: 4 }}>
        <Ikon e={e} ukuran={9} warna={t.gelap ? t.teksLembut : t.tinta} style={{ marginRight: 5 }} />
        <T w={700} s={8.4} c={t.gelap ? t.teksLembut : t.tinta} style={{ letterSpacing: 0.4 }}>{judul.toUpperCase()}</T>
        {ket ? <T s={7.4} c={t.gelap ? t.hiasMuda : t.redup} style={{ marginLeft: 6 }}>{ket}</T> : null}
        <View style={{ flexGrow: 1 }} />
        <T w={700} s={9} c={t.gelap ? t.teksLembut : t.tinta}>{rp(subtotal)}</T>
      </View>
      {baris.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: tinggiBaris, paddingHorizontal: 4, borderTopWidth: i ? 0.6 : 0, borderTopColor: t.garisTipis }}>
          <LencanaIkon e={r.e ?? e} ukuran={tinggiBaris >= 29 ? 18 : 14} bayang={0} />
          <T f="judul" w={600} s={sNama} c={t.tinta} style={{ marginLeft: 7, flexGrow: 1, flexShrink: 1 }}>{r.nama}</T>
          {r.saldoUsd != null && kurs ? (
            tinggiBaris >= 24 ? (
              <View style={{ alignItems: 'flex-end' }}>
                <T w={800} s={sAngka} c={t.tinta}>{rp(r.saldo)}</T>
                <T s={8.4} c={t.redup}>{`${usd(r.saldoUsd)} × ${rp(kurs)}`}</T>
              </View>
            ) : <T w={800} s={sAngka - 1.5} c={t.tinta}>{`${usd(r.saldoUsd)} × ${rp(kurs)} = ${rp(r.saldo)}`}</T>
          ) : <T w={800} s={sAngka} c={t.tinta}>{rp(r.saldo)}</T>}
        </View>
      ))}
    </View>
  )
}

function HalamanOverview({ data, kustom, bersama }) {
  const t = useTema()
  const k = data.keuangan
  const kas = k.kas
  const a = angkaUang(data, kustom)
  const bulanNama = data.labelBulan.split(' ')[0]
  const kiriW = 400 // lebih lebar supaya tiga kartu kecil memuat angka penuh tanpa terpotong
  const kananW = ISI_W - kiriW - 20
  const untung = a.laba >= 0
  const tanpaKas = !kas
  const rek = k.rekening ?? []
  const bank = rek.filter(r => r.jenis !== 'LUAR')
  const luar = rek.filter(r => r.jenis === 'LUAR')
  const danaLain = barisLain(kustom?.danaLain)
  const totalDanaLain = jumlahLain(danaLain)
  const equityAwal = (kas?.total ?? 0) + totalDanaLain
  const equityAkhir = a.estKasAkhir != null ? a.estKasAkhir + totalDanaLain : null
  // Ekosistem tidak memakai pengesahan bulanan: daftar sumber dana = saldo rekening terkini.
  const asalSaldo = k.rekeningDari === 'pengesahan' ? `saldo saat pengesahan ${bulanNama}` : 'saldo Rekening Bank terkini'
  const jumlahBaris = rek.length + danaLain.length + (bank.length ? 1 : 0) + (luar.length ? 1 : 0) + (danaLain.length ? 1 : 0)
  const tinggiBaris = jumlahBaris <= 6 ? 36 : jumlahBaris <= 9 ? 29 : jumlahBaris <= 12 ? 24 : 20
  const sNama = tinggiBaris >= 29 ? 11 : 9.6
  const sAngka = tinggiBaris >= 29 ? 11.5 : 10
  const kecilW = (kiriW - 2 * 8) / 3
  const Pil = ({ e, teks, isi, c }) => (
    <Stiker isi={isi} style={{ marginRight: 8, marginBottom: 5 }} isiStyle={{ paddingVertical: 5, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }}>
      <LencanaIkon e={e} ukuran={17} bayang={0} />
      <T f="judul" w={700} s={10.5} c={c ?? t.tinta} style={{ marginLeft: 7 }}>{teks}</T>
    </Stiker>
  )
  return (
    <HalamanIsi bagian="Financial Overview" {...bersama}>
      <JudulHalaman judul="Financial Overview" sorot={data.labelBulan} ukuran={32} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexGrow: 1 }}>
        <View style={{ width: kiriW, justifyContent: 'space-between' }}>
          <KartuAngka e="💰" label="Total Equity Awal Bulan" nilai={tanpaKas && !danaLain.length ? '—' : rp(equityAwal)} lebar={kiriW} tinggi={102} besar={22} sorot
            sub={tanpaKas ? 'Belum ada data kas bulan ini' : `Kas bank ${rp(kas.bank)} + luar bank ${rp(kas.luar)}${danaLain.length ? ` + dana lain ${rp(totalDanaLain)}` : ''}`}
            sub2={tanpaKas ? null : `Sumber: ${asalSaldo}`} />
          <KartuAngka e="🏦" label="Est. Total Equity Akhir Bulan" nilai={equityAkhir != null ? rp(equityAkhir) : '—'} lebar={kiriW} tinggi={102} besar={22} sorot
            sub={equityAkhir != null ? `Equity awal ${rp(equityAwal)} ${untung ? '+' : '–'} menabung ${rp(Math.abs(a.laba))}` : 'Belum bisa diperkirakan tanpa data kas'}
            sub2={equityAkhir != null ? `Menabung = omset ${bulanNama} – pengeluaran${a.lain.length ? ' + pendapatan lain' : ''}; perkiraan, bukan saldo nyata` : null} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <KartuAngka e="📈" label="Omset" nilai={rp(a.omset)} lebar={kecilW} tinggi={78} besar={14} padat warnaNilai={a.omset > 0 ? t.vonis.baik : undefined}
              sub={`${usd(k.omset?.usd ?? 0)} · ${data.omset.jumlahLaporan} laporan ${bulanNama}`} />
            <KartuAngka e="🧾" label="Pengeluaran" nilai={rp(a.pengeluaran)} lebar={kecilW} tinggi={78} besar={14} padat warnaNilai={a.pengeluaran > 0 ? t.vonis.kritis : undefined}
              sub={`CPM ${rpRingkas(a.cpm)} + tamb. ${rpRingkas(a.tambahan)}`} />
            <KartuAngka e={untung ? '🌱' : '💸'} label="Menabung" nilai={rpBertanda(a.laba)} lebar={kecilW} tinggi={78} besar={14} padat warnaNilai={untung ? t.vonis.baik : t.vonis.kritis}
              sub={a.lain.length ? 'Omset + lain – pengeluaran' : 'Omset – pengeluaran'} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Pil e="📈" teks={`Omset ${bulanNama} ${usd(k.omset?.usd ?? 0)}`} isi={t.vonis.baikLapis} c={t.vonis.baik} />
            <Pil e={untung ? '🌱' : '💸'} teks={`${untung ? 'SURPLUS' : 'DEFISIT'} ${rpBertanda(a.laba)}`} isi={untung ? t.vonis.baikLapis : t.vonis.kritisLapis} c={untung ? t.vonis.baik : t.vonis.kritis} />
            <Pil e={k.sah ? '✅' : '⏳'} teks={k.sah ? `Disahkan ${bulanNama}` : k.berjalan ? 'Bulan berjalan · angka hari ini' : 'Angka tercatat'} isi={k.sah ? t.vonis.baikLapis : undefined} c={k.sah ? t.vonis.baik : t.tinta} />
          </View>
        </View>
        <Stiker style={{ width: kananW }} isiStyle={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <LencanaIkon e="🔑" ukuran={22} bayang={0} />
            <Kicker s={9.5} c={t.tinta} style={{ marginLeft: 7 }}>Sumber Dana</Kicker>
            <View style={{ flexGrow: 1 }} />
            <T s={8} c={t.redup}>{`${rek.length} sumber · ${asalSaldo}`}</T>
          </View>
          {rek.length ? (
            <>
              {bank.length ? <KelompokSumber pertama judul="Kas Bank" e="🏦" ket="rekening bank · kas tabungan" baris={bank} subtotal={bank.reduce((x, r) => x + r.saldo, 0)} tinggiBaris={tinggiBaris} sNama={sNama} sAngka={sAngka} /> : null}
              {luar.length ? <KelompokSumber pertama={!bank.length} judul="Luar Bank" e="🌐" ket="marketplace / dompet · dana ditahan" kurs={data.kursLuar} baris={luar} subtotal={luar.reduce((x, r) => x + r.saldo, 0)} tinggiBaris={tinggiBaris} sNama={sNama} sAngka={sAngka} /> : null}
            </>
          ) : <T s={9.5} c={t.redup} style={{ marginTop: 10 }}>Belum ada Sumber Dana di Bio Unit.</T>}
          {danaLain.length ? (
            <KelompokSumber pertama={!rek.length} judul="Dana Lain" e="🔑" ket="isian pembuat · ikut equity" baris={danaLain.map(b => ({ nama: b.label || 'Dana lain', saldo: b.jumlah }))} subtotal={totalDanaLain} tinggiBaris={Math.max(22, tinggiBaris - 8)} sNama={sNama} sAngka={sAngka} />
          ) : null}
          <View style={{ flexGrow: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTopWidth: (t.bersih ? 1 : t.gelap ? 1 : 1.5), borderTopColor: t.gelap || t.bersih ? t.garis : t.tinta }}>
            <T f="judul" w={700} s={11} c={t.tinta} style={{ flexGrow: 1 }}>TOTAL EQUITY AWAL BULAN</T>
            <T w={800} s={12} c={t.tinta}>{tanpaKas && !danaLain.length ? '—' : rp(equityAwal)}</T>
          </View>
        </Stiker>
      </View>
    </HalamanIsi>
  )
}

// ── Progres Omset ────────────────────────────────────────────────────────
function HalamanOmset({ data, bersama }) {
  const t = useTema()
  const o = data.omset
  const minggu = data.minggu
  const n = minggu.length
  const kiriW = 520
  const kananW = ISI_W - kiriW - 18
  const lebarAkun = 150, lebarTotal = 78
  const lebarMinggu = (kiriW - 2 * t.tebalGaris - lebarAkun - lebarTotal) / n
  const baris = o.baris
  // Diperjelas (Owner 9 Okt 2026): huruf tabel lebih besar; tinggi baris menyesuaikan jumlah akun.
  const tinggiBaris = baris.length <= 3 ? 42 : baris.length <= 5 ? 36 : baris.length <= 7 ? 29 : baris.length <= 9 ? 23 : 18
  const sTeks = baris.length <= 5 ? 11.5 : baris.length <= 7 ? 10.5 : baris.length <= 9 ? 9.6 : 8.4
  const sorotIsi = t.gelap || t.bersih ? t.sorotGelap : t.sorot
  const riwayat = o.riwayat ?? []
  // Enam bulan ke belakang (Owner 9 Okt 2026) — kartu & grafik memakai deret yang sama.
  const kartu = riwayat.slice(-6)
  const kartuW = (kananW - (kartu.length - 1) * 6) / Math.max(kartu.length, 1)
  const sel = (v) => (v > 0 ? usdRingkas(v) : '–')
  return (
    <HalamanIsi bagian="Progres Omset" {...bersama}>
      <JudulHalaman judul="Progres Omset" sorot={data.labelBulan} ukuran={32} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexGrow: 1 }}>
        <View style={{ width: kiriW }}>
          <Stiker sudut={t.sudutKecil} isiStyle={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: t.kepalaTabel, paddingVertical: 7, paddingHorizontal: 8 }}>
              <T f="judul" w={600} s={10.5} c={t.teksKepalaTabel} style={{ width: lebarAkun }}>AKUN · MARKET</T>
              {minggu.map(m => <T key={m.nomor} f="judul" w={600} s={10.5} c={t.teksKepalaTabel} style={{ width: lebarMinggu, textAlign: 'center' }}>{`W${m.nomor}`}</T>)}
              <T f="judul" w={600} s={10.5} c={t.teksKepalaTabel} style={{ width: lebarTotal, textAlign: 'right' }}>TOTAL</T>
            </View>
            {baris.length === 0 ? (
              <View style={{ paddingVertical: 18, paddingHorizontal: 12 }}><T s={10} c={t.redup}>Belum ada laporan omset bulan ini.</T></View>
            ) : baris.map((b, i) => (
              <View key={b.kunci} style={{ flexDirection: 'row', alignItems: 'center', minHeight: tinggiBaris, paddingHorizontal: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.garisTipis, backgroundColor: i % 2 ? t.kartuSelang : t.kartu }}>
                <View style={{ width: lebarAkun, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: warnaMarketPdf(b.market, 'utuh'), borderWidth: 1, borderColor: t.gelap || t.bersih ? t.garis : t.tinta, marginRight: 6, transform: 'rotate(-8deg)' }} />
                  <View style={{ flexShrink: 1 }}>
                    <T w={600} s={sTeks} c={t.teks}>{b.akun ?? b.marketLabel}</T>
                    {b.akun && tinggiBaris >= 23 ? <T s={8.4} c={t.redup}>{b.marketLabel}</T> : null}
                  </View>
                </View>
                {b.perMinggu.map((v, j) => <T key={j} w={v > 0 ? 600 : 400} s={sTeks} c={v > 0 ? t.teks : t.redup} style={{ width: lebarMinggu, textAlign: 'center' }}>{sel(v)}</T>)}
                <T w={700} s={sTeks} c={t.tinta} style={{ width: lebarTotal, textAlign: 'right' }}>{usdRingkas(b.totalUsd)}</T>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: (t.bersih ? 1 : t.gelap ? 1.2 : 2), borderTopColor: t.bersih ? t.garis : t.tinta, backgroundColor: sorotIsi }}>
              <T f="judul" w={700} s={10.5} c={t.gelap ? '#FFFFFF' : t.tinta} style={{ width: lebarAkun }}>TOTAL</T>
              {o.perMinggu.map((v, j) => <T key={j} w={700} s={sTeks} c={t.gelap ? '#FFFFFF' : t.tinta} style={{ width: lebarMinggu, textAlign: 'center' }}>{sel(v)}</T>)}
              <T w={800} s={10.5} c={t.gelap ? '#FFFFFF' : t.tinta} style={{ width: lebarTotal, textAlign: 'right' }}>{usdRingkas(o.totalUsd)}</T>
            </View>
          </Stiker>
          <T s={8.6} c={t.redup} style={{ marginTop: 6 }}>{`Periode minggu: ${minggu.map(m => `W${m.nomor} = ${m.label}`).join(' · ')} ${data.labelBulan.split(' ')[0]} (sama dengan Leaderboard). Angka = USD per akun dari laporan mingguan.`}</T>
          <View style={{ flexGrow: 1 }} />
          <Stiker isi={t.isiTinta} garis={t.isiTinta} bayang={0} isiStyle={{ paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flexGrow: 1 }}>
              <Kicker s={8.5} c={t.teksDiTintaRedup}>{`Total Omset ${data.labelBulan.split(' ')[0]}`}</Kicker>
              <T w={800} s={26} c={t.teksDiTinta} style={{ marginTop: 2, lineHeight: 1.1 }}>{usd(o.totalUsd)}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T w={700} s={11} c={t.teksDiTinta}>{rp(o.totalIdr)}</T>
              <T s={8} c={t.teksDiTintaRedup} style={{ marginTop: 2 }}>{`${o.jumlahLaporan} laporan mingguan · kurs tiap laporan`}</T>
            </View>
          </Stiker>
        </View>
        <View style={{ width: kananW }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {kartu.map((r, i) => {
              const kini = i === kartu.length - 1
              return (
                <Stiker key={`${r.tahun}-${r.bulan}`} style={{ width: kartuW }} isi={kini ? t.isiTinta : undefined} garis={kini ? t.isiTinta : undefined} bayang={kini ? 0 : undefined}
                  isiStyle={{ paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center' }}>
                  <T w={700} s={7.8} c={kini ? t.teksDiTintaRedup : t.redup} style={{ letterSpacing: 0.6 }}>{BULAN_PENDEK[r.bulan - 1].toUpperCase()}</T>
                  <T pas w={800} s={ukuranPas(usdRingkas(r.usd), 'jakarta-800', kartuW - 14, 13, 8)} c={kini ? t.teksDiTinta : t.tinta} style={{ marginTop: 3 }}>{r.usd > 0 ? usdRingkas(r.usd) : '–'}</T>
                </Stiker>
              )
            })}
          </View>
          <Stiker style={{ marginTop: 12, flexGrow: 1 }} isiStyle={{ paddingTop: 10, paddingBottom: 10, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ikon e="📊" ukuran={13} />
              <T f="judul" w={600} s={11.5} c={t.tinta} style={{ marginLeft: 6 }}>Monthly Revenue Growth · 6 Bulan Terakhir (USD)</T>
            </View>
            <GrafikOmset riwayat={riwayat} lebar={kananW - 28} tinggi={ISI_H - 58 - 72 - 56} satuan="usd" kosong="Belum ada laporan omset 6 bulan terakhir." />
          </Stiker>
        </View>
      </View>
    </HalamanIsi>
  )
}

// ── Renstra / KPI ────────────────────────────────────────────────────────
export const KATEGORI_RENSTRA = [
  { id: 'produksi', label: 'Produksi', e: '🎨' },
  { id: 'marketing', label: 'Marketing', e: '🚀' },
  { id: 'finance', label: 'Finance', e: '💰' },
  { id: 'sdm', label: 'SDM', e: '👥' },
]

/** "v Asseting mascot" → tercapai; "x Target $5000" → belum; "VGen KaeLyn:" atau "# VGen
 *  KaeLyn" → subjudul (acuan Vahcyn: Marketing dibagi per akun); selain itu butir biasa. */
export function uraiButir(teks) {
  return String(teks ?? '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const sub = /^#\s*(.+)$/.exec(s) ?? /^(.{2,60}):$/.exec(s)
    if (sub) return { teks: sub[1].trim(), judul: true }
    const m = /^(?:\[(x| )\]|(v|x|✓|✔|✗|✘|-|•))\s+(.*)$/i.exec(s)
    if (!m) return { teks: s, keadaan: null }
    const tanda = (m[1] ?? m[2]).toLowerCase()
    const keadaan = tanda === 'x' && m[1] != null ? 'ya' : ['v', '✓', '✔'].includes(tanda) ? 'ya' : ['x', '✗', '✘'].includes(tanda) ? 'tidak' : null
    return { teks: m[3], keadaan }
  })
}

function HalamanRenstra({ data, renstra, bersama }) {
  const t = useTema()
  const kolom = KATEGORI_RENSTRA.map(k => ({ ...k, butir: uraiButir(renstra?.[k.id]) }))
  const goal = data.goal ?? []
  const adaTeks = kolom.some(k => k.butir.length)
  if (!adaTeks && !goal.length) return null
  const lebarKolom = (ISI_W - 3 * 14) / 4
  const terbanyak = Math.max(...kolom.map(k => k.butir.length), 0)
  const s = terbanyak > 10 ? 8.2 : terbanyak > 7 ? 9 : 10
  const tinggiGoal = goal.length ? 74 : 0
  return (
    <HalamanIsi bagian="Renstra / KPI" {...bersama}>
      <JudulHalaman judul="Renstra / KPI" sorot={data.labelBulan.split(' ')[0].toUpperCase()} ukuran={32} />
      {adaTeks ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', height: ISI_H - 58 - tinggiGoal - (goal.length ? 12 : 0) }}>
          {kolom.map(k => (
            <View key={k.id} style={{ width: lebarKolom }}>
              <Stiker isi={t.isiTinta} garis={t.isiTinta} bayang={0} sudut={14} isiStyle={{ paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ikon e={k.e} ukuran={12} warna={t.teksDiTinta} />
                <T f="judul" w={700} s={13} c={t.teksDiTinta} style={{ marginLeft: 6 }}>{k.label}</T>
              </Stiker>
              <View style={{ marginTop: 10, paddingHorizontal: 2 }}>
                {k.butir.length ? k.butir.map((b, i) => b.judul ? (
                  <T key={i} f="judul" w={700} s={s + 0.5} c={t.tinta} style={{ marginTop: i ? 6 : 0, marginBottom: 4 }}>{b.teks}</T>
                ) : (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
                    {b.keadaan === 'ya' ? <Centang nyala ukuran={s + 1.5} style={{ marginTop: 1.5, marginRight: 6 }} />
                      : b.keadaan === 'tidak' ? <Silang ukuran={s + 1.5} style={{ marginTop: 1.5, marginRight: 6 }} />
                        : <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.palet.aksen, marginTop: s * 0.45, marginRight: 7, marginLeft: 2 }} />}
                    <T s={s} c={t.teks} style={{ flexShrink: 1, lineHeight: 1.35 }}>{b.teks}</T>
                  </View>
                )) : <T s={9} c={t.redup}>—</T>}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {goal.length ? (
        <Stiker style={{ marginTop: adaTeks ? 12 : 0, flexGrow: adaTeks ? 0 : 1 }} isiStyle={{ paddingVertical: 10, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <LencanaIkon e="🎯" ukuran={20} bayang={0} />
            <Kicker s={9.5} c={t.tinta} style={{ marginLeft: 7 }}>Goal Unit</Kicker>
            <View style={{ flexGrow: 1 }} />
            <T s={8} c={t.redup}>{`${goal.filter(g => g.tercapai).length}/${goal.length} tercapai`}</T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {goal.slice(0, adaTeks ? 6 : 10).map((g, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', width: adaTeks ? (ISI_W - 28) / 3 : (ISI_W - 28) / 2, paddingVertical: adaTeks ? 3 : 8, paddingRight: 10 }}>
                {g.tercapai ? <Centang nyala ukuran={11} style={{ marginRight: 7 }} /> : <Centang nyala={false} ukuran={11} style={{ marginRight: 7 }} />}
                <View style={{ flexShrink: 1 }}>
                  <T w={600} s={adaTeks ? 9 : 11} c={t.teks}>{g.nama}</T>
                  <T s={adaTeks ? 7.4 : 8.5} c={t.redup}>{`${g.persen}% · ${g.kini} / ${g.target} ${g.satuan ?? ''}`.trim()}</T>
                </View>
              </View>
            ))}
          </View>
        </Stiker>
      ) : null}
    </HalamanIsi>
  )
}

// ── Potensi Pendapatan ───────────────────────────────────────────────────
const STATUS_ORDER = { antre: 'Antre', proses: 'Proses', revisi: 'Revisi' }
function HalamanPotensi({ data, bersama }) {
  const t = useTema()
  const m = useMetrik()
  const p = data.potensi
  if (!p.jumlah && !p.prospek?.jumlah) return null
  const akun = p.akun.slice(0, 6)
  const perBaris = akun.length <= 3 ? Math.max(1, akun.length) : 3
  const barisKartu = Math.ceil(akun.length / perBaris)
  const kartuW = (ISI_W - (perBaris - 1) * 14) / perBaris
  const kartuH = barisKartu > 1 ? (ISI_H - 58 - 40 - 12) / 2 : ISI_H - 58 - 40
  const maksOrder = barisKartu > 1 ? 2 : 4
  const nilaiAkun = (g) => (g.usd > 0 ? usd(g.usd) : rp(g.idr))
  return (
    <HalamanIsi bagian="Potensi Pendapatan" {...bersama}>
      <JudulHalaman judul="Potensi Pendapatan" sorot={`${p.jumlah} Order Antre`} ukuran={32} />
      {akun.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {akun.map((g, i) => (
            <Stiker key={g.kunci} style={{ width: kartuW, height: kartuH, marginBottom: 12 }} isiStyle={{ paddingVertical: 12, paddingHorizontal: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: warnaMarketPdf(String(g.platform).toLowerCase(), 'utuh'), borderWidth: 1, borderColor: t.gelap || t.bersih ? t.garis : t.tinta, marginRight: 6, transform: 'rotate(-8deg)' }} />
                <Kicker s={9} c={t.tinta}>{g.label.toUpperCase()}</Kicker>
              </View>
              <Stabilo style={{ marginTop: 10, marginLeft: 6 }}>
                <T pas w={800} s={ukuranPas(nilaiAkun(g), m.angka, kartuW - 50, 24, 13)} c={t.gelap ? t.teksSorot : t.tinta} style={{ lineHeight: 1.1 }}>{nilaiAkun(g)}</T>
              </Stabilo>
              <T s={9} c={t.redup} style={{ marginTop: 6 }}>{`${g.jumlah} order antre${g.usd > 0 && g.idr > 0 ? ` · + ${rp(g.idr)}` : ''}`}</T>
              <View style={{ marginTop: 8 }}>
                {g.order.slice(0, maksOrder).map((o, j) => (
                  <View key={j} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderTopWidth: j ? 0.6 : 0, borderTopColor: t.garisTipis }}>
                    <View style={{ flexGrow: 1, flexShrink: 1 }}>
                      <T w={600} s={8.6} c={t.teks}>{o.klien}</T>
                      {o.brief ? <T s={7.4} c={t.redup}>{o.brief}</T> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
                      <T w={700} s={8.6} c={t.tinta}>{o.mataUang === 'IDR' ? rp(o.nilai) : usd(o.nilai)}</T>
                      <T s={7} c={t.redup}>{STATUS_ORDER[o.status] ?? o.status}</T>
                    </View>
                  </View>
                ))}
                {g.order.length > maksOrder ? <T s={7.4} c={t.redup} style={{ marginTop: 3 }}>{`+${g.jumlah - maksOrder} order lain`}</T> : null}
              </View>
            </Stiker>
          ))}
        </View>
      ) : (
        <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ikon e="📋" ukuran={40} warna={t.redup} />
          <T s={11} c={t.redup} style={{ marginTop: 8 }}>Tidak ada order yang sedang antre.</T>
        </View>
      )}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' }}>
        <Chip e="💵" teks={`Antrean ${p.totalUsd > 0 ? usd(p.totalUsd) : ''}${p.totalUsd > 0 && p.totalIdr > 0 ? ' + ' : ''}${p.totalIdr > 0 ? rp(p.totalIdr) : ''}${!p.totalUsd && !p.totalIdr ? '—' : ''}`} />
        {p.prospek?.jumlah ? <Chip e="💬" teks={`${p.prospek.jumlah} prospek di Pesan Masuk · ${p.prospek.usd > 0 ? usd(p.prospek.usd) : rp(p.prospek.idr)}`} /> : null}
        <View style={{ flexGrow: 1 }} />
        <T s={7.6} c={t.redup}>Nilai = order Admin berstatus antre/proses/revisi.</T>
      </View>
    </HalamanIsi>
  )
}

// ── Team: satu halaman per orang ─────────────────────────────────────────
// Tinggi teks DIUKUR dengan metrik huruf asli (pdf/metrikHuruf.js) supaya tidak ada butir yang
// menembus tepi bawah halaman / menimpa kaki halaman (bug 13 Okt 2026: perkiraan lama 0,55×ukuran
// terlalu optimis). Ukuran terbesar yang muat dalam SATU halaman dipakai; kalau catatannya terlalu
// panjang bahkan pada ukuran terkecil, sisanya pindah ke halaman lanjutan (bukan dipotong).
const UKURAN_BUTIR = [17, 16, 15, 14, 13, 12, 11]
const UKURAN_LANJUT = 12          // ukuran huruf bila terpaksa lebih dari satu halaman
const TINGGI_KEPALA_TIM = 62      // tinggi tetap kepala (judul + label), supaya tata letak pasti
const AMAN = 0.98                 // cadangan lebar: pemenggalan react-pdf tak persis metrik
const RUANG_TIM_1 = ISI_H - TINGGI_KEPALA_TIM - 22 - 6
const RUANG_TIM_LANJUT = ISI_H - 40 - 14 - 6

const metrikIsi = (font) => (font.standar ? `${font.id}-400` : 'jakarta-400')

/** Jumlah baris teks setelah dibungkus per kata pada lebar tertentu (pt). */
function barisTeks(teks, metrik, ukuran, lebar) {
  const maks = lebar * AMAN
  const spasi = lebarTeks(' ', metrik, ukuran)
  let baris = 1, sisa = maks
  for (const kata of String(teks ?? '').split(/\s+/).filter(Boolean)) {
    const w = lebarTeks(kata, metrik, ukuran)
    if (w > maks) { // kata lebih panjang dari baris (URL, dll.): dipatahkan per baris
      baris += Math.ceil(w / maks) - (sisa === maks ? 1 : 0)
      sisa = maks - (w % maks)
    } else if (w <= sisa) sisa -= w + spasi
    else { baris += 1; sisa = maks - w - spasi }
  }
  return baris
}

/** Pecah catatan Team menjadi halaman-halaman: [[{ tipe, teks }]]; halaman 1 selebar kolom kanan. */
function susunHalamanTim(teknis, nonTeknis, { s, skala, metrik, lebar1, lebarLanjut, ruang1, ruangLanjut }) {
  const se = s * skala
  const sBagian = Math.max(16, s + 4)
  const tJudul = sBagian * skala * 1.3 + 6
  const butir = (teks, lebar) => barisTeks(teks, metrik, se, lebar - 15) * se * 1.4 + 6
  const item = (daftar, judul) => [
    { tipe: 'judul', teks: judul },
    ...(daftar.length ? daftar.map(b => ({ tipe: 'butir', teks: b })) : [{ tipe: 'kosong', teks: '—' }]),
  ]
  const semua = [...item(teknis, 'Teknis'), ...item(nonTeknis, 'Non Teknis')]
  const hItem = (x, lebar) => (x.tipe === 'judul' ? tJudul : x.tipe === 'kosong' ? se * 1.4 + 6 : butir(x.teks, lebar))
  const halaman = [[]]
  let sisa = ruang1, lebar = lebar1
  semua.forEach((x, i) => {
    const pertama = !halaman[halaman.length - 1].length
    const gap = x.tipe === 'judul' && x.teks === 'Non Teknis' && !pertama ? 16 : 0
    // judul tak boleh sendirian di dasar halaman: harus muat bersama butir pertamanya
    const butuh = hItem(x, lebar) + gap + (x.tipe === 'judul' && semua[i + 1] ? hItem(semua[i + 1], lebar) : 0)
    if (!pertama && butuh > sisa) { // halaman baru: tinggi dihitung ulang pada lebar halaman baru
      halaman.push([]); sisa = ruangLanjut; lebar = lebarLanjut; x.gap = 0
    } else x.gap = gap
    sisa -= hItem(x, lebar) + x.gap
    x.lebar = lebar
    halaman[halaman.length - 1].push(x)
  })
  return { halaman, muat: halaman.length === 1, sBagian }
}

/** Ukuran terbesar yang muat satu halaman; bila tak ada, UKURAN_LANJUT dengan halaman lanjutan. */
function rencanaTim(teknis, nonTeknis, { skala, metrik, kananW }) {
  const opsi = (s) => ({ s, skala, metrik, lebar1: kananW, lebarLanjut: ISI_W, ruang1: RUANG_TIM_1, ruangLanjut: RUANG_TIM_LANJUT })
  for (const s of UKURAN_BUTIR) {
    const r = susunHalamanTim(teknis, nonTeknis, opsi(s))
    if (r.muat) return { s, ...r }
  }
  return { s: UKURAN_LANJUT, ...susunHalamanTim(teknis, nonTeknis, opsi(UKURAN_LANJUT)) }
}

// Lebar teks DIPATOK (lebar kolom − 15 untuk titik butir): dengan flexShrink saja react-pdf membiarkan
// baris melebar sampai ±14pt melewati margin kanan, dan perkiraan jumlah barisnya jadi meleset.
function Butir({ teks, s, lebar }) {
  const t = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.palet.aksen, marginTop: s * 0.45, marginRight: 9 }} />
      <T s={s} c={t.teks} style={{ width: lebar - 15, lineHeight: 1.4 }}>{teks}</T>
    </View>
  )
}

/** Isi satu halaman catatan Team (judul bagian + butir). */
function IsiCatatan({ item, s, sBagian }) {
  const t = useTema()
  return item.map((x, i) => x.tipe === 'judul'
    ? <T key={i} f="judul" w={700} s={sBagian} c={t.tinta} style={{ marginTop: x.gap, marginBottom: 6 }}>{x.teks}</T>
    : x.tipe === 'kosong'
      ? <T key={i} s={s - 1} c={t.redup} style={{ marginBottom: 6 }}>—</T>
      : <Butir key={i} teks={x.teks} s={s} lebar={x.lebar} />)
}

/** Butir hasil suntingan pembuat (satu baris = satu butir); undefined = pakai evaluasi server. */
const butirKustom = (teks) => String(teks ?? '').split('\n').map(x => x.trim().replace(/^[-•·]\s*/, '')).filter(Boolean).slice(0, 10)

// Tanggal penilaian ("21 Sep 2026") untuk keterangan halaman Team — pakai tahun, karena
// penilaian terakhir bisa dari bulan/tahun sebelumnya.
const tglPenilaian = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })

function HalamanTim({ orang, data, bersama }) {
  const t = useTema()
  const m = useMetrik()
  const foto = 232
  const kananW = ISI_W - foto - 36
  const judulW = ISI_W - 190 // sisanya untuk cap status
  const judul = `Team – ${orang.nama}`
  const sJudul = ukuranPas(judul, m.judul700, judulW * AMAN, 30, 17)
  const status = orang.status ? STATUS_TIM[orang.status] : null
  const adaCatatan = orang.teknis.length || orang.nonTeknis.length
  const rencana = adaCatatan ? rencanaTim(orang.teknis, orang.nonTeknis, { skala: t.skala ?? 1, metrik: metrikIsi(t.font), kananW }) : null
  const bulanNama = data.labelBulan.split(' ')[0]
  const disunting = orang.disunting
  return (
    <>
      <HalamanIsi bagian="Team" {...bersama}>
        <View style={{ position: 'relative', height: TINGGI_KEPALA_TIM }}>
          <View style={{ width: judulW }}>
            <T pas f="judul" w={700} s={sJudul} c={t.tinta} style={{ lineHeight: 1.05 }}>{judul}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Stiker isi={t.isiTinta} garis={t.isiTinta} bayang={0} sudut={12} isiStyle={{ paddingVertical: 4, paddingHorizontal: 12 }}>
                <T w={700} s={11} c={t.teksDiTinta}>{orang.label}</T>
              </Stiker>
              <T s={10} c={t.redup} style={{ marginLeft: 10 }}>{disunting ? `Catatan disunting pembuat · ${bulanNama}` : orang.mingguDinilai ? `${orang.mingguDinilai}× dinilai · ${bulanNama}` : orang.tanggalPenilaian ? `Penilaian terakhir ${tglPenilaian(orang.tanggalPenilaian)}` : 'Belum pernah dinilai'}</T>
            </View>
          </View>
          {/* Cap DIPOSISIKAN MUTLAK: sebagai anak flex-row ia (elemen berputar) membuat judul terbungkus
              dua baris walau lebarnya cukup, lalu label di bawahnya tertimpa foto (bug 13 Okt 2026). */}
          {status ? <View style={{ position: 'absolute', top: 2, right: 6 }}><Cap teks={status.teks} warna={t.vonis[status.kunci]} /></View> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 22 }}>
          <View style={{ width: foto + 8, height: foto + 8, position: 'relative' }}>
            {t.bayang ? <View style={[{ position: 'absolute', left: 8, top: 8, width: foto, height: foto, backgroundColor: t.bayang }, SUDUT_GAMBAR]} /> : null}
            {!t.gelap ? <View style={{ position: 'absolute', left: -10, top: -10, width: 54, height: 54, borderTopWidth: 3, borderLeftWidth: 3, borderColor: t.palet.aksen === '#141414' ? t.sorot : t.palet.aksen, borderTopLeftRadius: 14 }} /> : null}
            {orang.fotoUrl ? (
              <Image src={orang.fotoUrl} style={[{ position: 'absolute', left: 0, top: 0, width: foto, height: foto, objectFit: 'cover' }, SUDUT_GAMBAR]} />
            ) : (
              <View style={[{ position: 'absolute', left: 0, top: 0, width: foto, height: foto, backgroundColor: t.palet.lapis, alignItems: 'center', justifyContent: 'center' }, SUDUT_GAMBAR]}>
                <T f="judul" w={700} s={76} c={t.gelap ? '#FFFFFF' : t.tinta}>{inisial(orang.nama)}</T>
              </View>
            )}
            <View style={[{ position: 'absolute', left: 0, top: 0, width: foto, height: foto, borderWidth: (t.bersih ? 1 : t.gelap ? 1.5 : 2.5), borderColor: t.gelap || t.bersih ? t.hiasMuda : t.tinta }, SUDUT_GAMBAR]} />
          </View>
          <View style={{ width: kananW, marginLeft: 36 }}>
            {rencana ? (
              <IsiCatatan item={rencana.halaman[0]} s={rencana.s} sBagian={rencana.sBagian} />
            ) : (
              <Stiker isiStyle={{ paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center' }}>
                <Ikon e="📝" ukuran={30} warna={t.redup} />
                <T s={12.5} c={t.redup} style={{ marginTop: 8, textAlign: 'center' }}>{`${orang.nama.split(' ')[0]} belum pernah dinilai lewat Penilaian Kader.`}</T>
                <T s={10} c={t.redup} style={{ marginTop: 4, textAlign: 'center' }}>Isi lewat SDM › Performa Kader — catatan & skor akan tampil di sini.</T>
              </Stiker>
            )}
          </View>
        </View>
      </HalamanIsi>
      {/* Halaman lanjutan: catatan yang tak muat di halaman pertama (lebar penuh, tanpa foto) */}
      {rencana?.halaman.slice(1).map((isi, i) => (
        <HalamanIsi key={i} bagian="Team" {...bersama}>
          <View style={{ height: 40 }}>
            <T pas f="judul" w={700} s={ukuranPas(`Team – ${orang.nama} (lanjutan)`, m.judul700, ISI_W * AMAN, 26, 15)} c={t.tinta} style={{ lineHeight: 1.05 }}>{`Team – ${orang.nama} (lanjutan)`}</T>
          </View>
          <View style={{ marginTop: 14, width: ISI_W }}>
            <IsiCatatan item={isi} s={rencana.s} sBagian={rencana.sBagian} />
          </View>
        </HalamanIsi>
      ))}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
/**
 * @param tema     'playground' | 'kosmik' (sudah diselesaikan pemanggil)
 * @param font     'tema' | kunci FONT_PDF
 * @param gaya     id gaya latar | 'foto' (+ tataFoto, foto = data URL)
 * @param renstra  { produksi, marketing, finance, sdm } — isian pembuat, satu baris = satu butir
 * @param isi      halaman yang dicetak { forecasting, overview, omset, renstra, potensi, tim }
 * @param kustom   { pendapatanLain, danaLain, tim: { [userId]: { sembunyi, sebutan, teknis, nonTeknis } }, penutup: { judul, sub } }
 */
export default function LaporanMingguanPDF({ skala = 1, warnaHuruf = null, data, tema = 'playground', font = 'tema', gaya = 'kisi', tataFoto = 'bingkai', foto = null, renstra = {}, isi = ISI_MINGGUAN_BAWAAN, kustom = {} }) {
  const temaAktif = rakitTema({ temaId: tema, fontId: font, slotWarna: data.lingkup?.slotWarna ?? 1, skala, warnaHuruf, identitas: { logoCircle: data.lingkup?.logoUrl ?? null, nama: data.lingkup?.nama ?? null, logoUnit: data.unit?.logoUrl ?? null, namaUnit: data.unit?.nama ?? null } })
  const u = data.unit
  const ekoNama = EKOSISTEM?.nama ?? EKOSISTEM_NAMA_PANJANG
  const bulanLabel = `Per ${data.tanggalLabel}`
  const bersama = { lingkup: u.nama, bulanLabel }
  const latar = { gaya, tataFoto, foto }
  const jenisLabel = [LABEL_TIPE[u.tipe] ?? 'Unit Usaha', data.lingkup?.nama].filter(Boolean).join(' · ')
  const cetak = { ...ISI_MINGGUAN_BAWAAN, ...(isi ?? {}) }
  // Team: suntingan pembuat per orang (sembunyikan, sebutan, butir) di atas data evaluasi.
  const tim = (data.tim ?? []).map(o => {
    const k = kustom?.tim?.[o.userId]
    if (!k) return o
    const teknis = typeof k.teknis === 'string' ? butirKustom(k.teknis) : o.teknis
    const nonTeknis = typeof k.nonTeknis === 'string' ? butirKustom(k.nonTeknis) : o.nonTeknis
    return { ...o, sembunyi: !!k.sembunyi, label: String(k.sebutan ?? '').trim() || o.label, teknis, nonTeknis, disunting: typeof k.teknis === 'string' || typeof k.nonTeknis === 'string' }
  }).filter(o => !o.sembunyi)
  const penutup = { judul: String(kustom?.penutup?.judul ?? '').trim() || 'TERIMA KASIH', sub: String(kustom?.penutup?.sub ?? '').trim() || 'Mari tumbuh bersama!' }
  return (
    <Document title={`${u.nama} — Weekly Report ${data.labelBulan}`} author={EKOSISTEM_NAMA_PANJANG} subject={`Weekly Report ${u.nama} ${data.labelBulan}`} creator={EKOSISTEM_NAMA_PANJANG} producer={EKOSISTEM_NAMA_PANJANG}>
      <TemaPdf.Provider value={temaAktif}>
        {/* Sampul Weekly berfoto profil unit + deret minggu (Owner 11 Okt 2026) */}
        <SampulMingguan gaya={gaya} tataFoto={tataFoto} foto={foto} profil={u.logoUrl ?? null} nama={u.nama} bulanLabel={bulanLabel} ekosistemNama={ekoNama}
          jenisLabel={jenisLabel} minggu={data.minggu} acuan={data.tanggalAcuan} />
        {cetak.forecasting && <HalamanForecasting data={data} kustom={kustom} bersama={bersama} />}
        {cetak.overview && <HalamanOverview data={data} kustom={kustom} bersama={bersama} />}
        {cetak.omset && <HalamanOmset data={data} bersama={bersama} />}
        {cetak.renstra && <HalamanRenstra data={data} renstra={renstra} bersama={bersama} />}
        {cetak.potensi && <HalamanPotensi data={data} bersama={bersama} />}
        {cetak.tim && tim.map(o => <HalamanTim key={o.userId} orang={o} data={data} bersama={bersama} />)}
        <Penutup {...latar} gaya={dasarMingguan(gaya)} nama={u.nama} bulanLabel={bulanLabel} slogan={data.lingkup?.nama ?? null} ekosistemNama={ekoNama} judul={penutup.judul} sub={penutup.sub} />
      </TemaPdf.Provider>
    </Document>
  )
}
