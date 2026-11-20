// ─────────────────────────────────────────────────────────────────────────
// PROGRESS REPORT BULANAN — dokumen PDF 16:9 (arahan Owner 2 Okt 2026).
// Alur mengikuti template "Karsa Circle — Executive Summary":
//   Sampul → Executive Summary (pembatas, Progres & Kondisi, Leader & Key
//   Person, Omset & Kas) → Unit Report (per unit + Financial Forecasting satu
//   slide) → Terima Kasih. Lingkup ekosistem menyisipkan lapisan per circle.
// Putaran 2 (masukan Owner): alur Omset − Pengeluaran = Menabung (perkiraan); kas yang
// ditampilkan = KAS REKENING (saldo Bio Studio, angka yang sama dengan Dashboard, 1 Nov 2026);
// hanya unit usaha (tanpa Pos Kas Rumah); Niche = Jenis Usaha; kategori
// pengeluaran = profil unit; tema Playground/Kosmik & pilihan font.
// Data: GET /api/reports/progres. Tema: pdf/tema.js (context).
// ─────────────────────────────────────────────────────────────────────────
import React from 'react'
import { Document, View, Image } from '@react-pdf/renderer'
import { daftarkanFontPdf } from './fontPdf'
import {
  W, T, Stiker, Stabilo, Ikon, TitikCircle, HalamanIsi, JudulHalaman, Kicker,
  rp, rpBertanda, usd, rpRingkas, useTema, useMetrik, LencanaIkon,
} from './pdf/primitif'
import { TemaPdf, rakitTema, paletTema } from './pdf/tema'
import { Sampul, Penutup, StikerEmoji } from './pdf/latar'
import {
  KartuAngka, Cap, Operator, LEBAR_OPERATOR, BilahPorsi, porsiMarket, omsetGabungan, daftarMarket, StikerMarket,
  TabelPeringkat, GrafikOmset, Chip, KartuTokoh, KolomRincian, kelompokRincian, warnaKelompok, rincianMuat,
  NAMA_BULAN_PENDEK, LABEL_TIPE,
} from './pdf/komponen'
import { ukuranPas } from './pdf/metrikHuruf'
import { EKOSISTEM, EKOSISTEM_NAMA_PANJANG, EKOSISTEM_SLOGAN, SATU_CIRCLE } from '../../config/ekosistem'

daftarkanFontPdf()

const ISI_W = W - 88          // lebar bidang isi halaman
const ISI_H = 540 - 64 - 48    // tinggi bidang isi halaman

// ── Progres & Kondisi ────────────────────────────────────────────────────
function HalamanRingkasan({ judul, sorot, r, bagian, lingkupNama, bulanLabel, bulanNama }) {
  const t = useTema()
  const om = r.omset ?? { usd: 0, idr: 0 }
  const tanpaKas = (r.unitDihitung ?? 0) > 0 && (r.tanpaData ?? 0) >= r.unitDihitung
  const kosong = !(om.idr > 0) && !(r.beban > 0)
  const untung = (r.menabung ?? 0) >= 0
  const vonis = untung ? t.vonis.baik : t.vonis.kritis
  const uu = r.unitUsaha ?? { studio: 0, project: 0, korporasi: 0, total: 0 }
  const rincianUnit = [uu.korporasi ? `${uu.korporasi} Korporasi` : null, uu.studio ? `${uu.studio} Studio` : null, uu.project ? `${uu.project} Project` : null].filter(Boolean).join(' · ') || 'Belum ada unit aktif'
  const lebarAlur = (ISI_W - 3 * LEBAR_OPERATOR) / 4
  const lebarBawah = (ISI_W - 2 * 22) / 3
  const persen = r.beban > 0 ? Math.floor((om.idr / r.beban) * 100) : null
  return (
    <HalamanIsi bagian={bagian} lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <JudulHalaman judul={judul} sorot={sorot} ukuran={judul.length > 22 ? 30 : 36} />
      <Kicker style={{ marginBottom: 10 }}>{'Omset – Pengeluaran = Menabung (perkiraan)  ·  Kas rekening = saldo di Bio Studio, sama dengan Dashboard'}</Kicker>
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <KartuAngka e="📈" label="Omset" nilai={rp(om.idr)} sub={usd(om.usd)} lebar={lebarAlur} tinggi={150} besar={20} padat warnaNilai={om.idr > 0 ? t.vonis.baik : undefined} />
        <Operator simbol="–" />
        <KartuAngka e="🧾" label="Pengeluaran" nilai={rp(r.beban)} lebar={lebarAlur} tinggi={150} besar={20} padat warnaNilai={r.beban > 0 ? t.vonis.kritis : undefined}
          sub={`CPM ${rp(r.cpm)}`} sub2={`Tambahan ${rp(r.tambahan)}`} />
        <Operator simbol="=" />
        <KartuAngka e="🌱" label="Menabung" nilai={kosong ? '—' : rpBertanda(r.menabung)} warnaNilai={kosong ? undefined : vonis}
          sub="Perkiraan: omset – pengeluaran" lebar={lebarAlur} tinggi={150} besar={18} padat />
        <View style={{ width: LEBAR_OPERATOR }} />
        <View style={{ width: lebarAlur, height: 150, position: 'relative' }}>
          <KartuAngka e="🏦" label="Kas Rekening" nilai={tanpaKas ? '—' : rp(r.kasSekarang)} sorot
            sub="Saldo Bio Studio" sub2="sama dengan Dashboard" lebar={lebarAlur} tinggi={150} besar={20} padat />
          {/* Pernak-pernik (arahan Owner 9 Okt 2026): stiker emoji bertema di sudut kartu hasil akhir */}
          <StikerEmoji x={-13} y={-15} u={27} e="✨" isi={t.sorot} rot={-10} />
          <StikerEmoji x={lebarAlur - 19} y={-11} u={21} e="⭐" isi={t.gelap ? t.palet.aksen : t.palet.lapis} bentuk="kotak" rot={12} />
          <StikerEmoji x={lebarAlur - 27} y={150 - 17} u={25} e={untung ? '🎉' : '🧭'} isi={t.gelap ? t.kartu : '#FFFFFF'} rot={8} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 }}>
        <KartuAngka e="🎨" label="Unit Usaha" nilai={`${uu.total} Unit`} sub={rincianUnit} lebar={lebarBawah} tinggi={132} besar={30} />
        <KartuAngka e="👥" label="Tim Member" nilai={`${(r.anggota ?? 0) - (r.magang ?? 0)} Anggota`}
          sub={`+ ${r.magang ?? 0} Tim Magang · total ${r.anggota ?? 0} orang`} sub2="Anggota = Kepala, Koordinator, Kader & Karyawan aktif"
          lebar={lebarBawah} tinggi={132} besar={30} />
        <Stiker style={{ width: lebarBawah, height: 132 }} isiStyle={{ paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ width: lebarBawah - 30 - 112, marginRight: 6 }}>
            <Kicker>{`Kesimpulan ${bulanNama}`}</Kicker>
            {kosong ? (
              <T f="judul" w={600} s={13} c={t.redup} style={{ marginTop: 6 }}>Belum ada omset maupun pengeluaran tercatat.</T>
            ) : (
              <>
                <T f="judul" w={600} s={13} c={t.tinta} style={{ marginTop: 6, lineHeight: 1.25 }}>{untung ? 'Omset menutup seluruh pengeluaran.' : 'Pengeluaran melebihi omset.'}</T>
                {persen != null ? <T s={9} c={t.redup} style={{ marginTop: 4 }}>{`Omset = ${persen}% dari pengeluaran`}</T> : null}
              </>
            )}
          </View>
          {kosong ? null : <Cap teks={untung ? 'SURPLUS' : 'DEFISIT'} warna={vonis} />}
        </Stiker>
      </View>
    </HalamanIsi>
  )
}

// ── Angka utama ekosistem (setara halaman Executive Summary di Monthly Report manual) ─────
function HalamanAngkaUtama({ e, lingkupNama, bulanLabel, bulanNama }) {
  const t = useTema()
  const lebar = (ISI_W - 2 * 22) / 3
  const kartu = [
    { e: '💰', label: 'Total Kas Usaha', nilai: rp(e.kasUsaha), sub: 'Saldo rekening bank hari ini, seluruh unit usaha' },
    { e: '🏢', label: 'Total Ekuitas Usaha', nilai: rp(e.ekuitasUsaha), sub: 'Kas + dana di luar kas' },
    { e: '🧮', label: 'Total CPM', nilai: rp(e.cpm), sub: 'Biaya operasional rutin per bulan' },
    { e: '🌱', label: 'Dana Pengembangan', nilai: rp(e.danaPengembangan), sub: 'Nilai terkini seluruh unit dana' },
    { e: '💼', label: 'Dana PE', nilai: rp(e.danaPE), sub: e.danaPEDari ? `Dana Private Equity · data terakhir ${NAMA_BULAN_PENDEK[e.danaPEDari.bulan - 1]} ${e.danaPEDari.tahun}` : 'Dana Private Equity' },
    { e: '🏦', label: 'Total Ekuitas Ekosistem', nilai: rp(e.ekuitasEkosistem), sub: 'Ekuitas Usaha + Dana PE + Forum + Berkah', sub2: '+ Dana Circle & Rumah Usaha + Dana Pengembangan', sorot: true },
  ]
  return (
    <HalamanIsi bagian="Executive Summary" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <JudulHalaman judul="Angka Utama Ekosistem" sorot={bulanNama} ukuran={34} />
      <Kicker style={{ marginBottom: 12 }}>{`Gambaran singkat progres dan kondisi ekosistem per ${bulanLabel}`}</Kicker>
      <View style={{ flexGrow: 1, justifyContent: 'space-between' }}>
        {[0, 3].map(mulai => (
          <View key={mulai} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {kartu.slice(mulai, mulai + 3).map(k => (
              <KartuAngka key={k.label} e={k.e} label={k.label} nilai={k.nilai} sub={k.sub} sub2={k.sub2} sorot={k.sorot} lebar={lebar} tinggi={150} besar={24} />
            ))}
          </View>
        ))}
      </View>
      {/* Rincian lengkap total (supaya jumlahnya bisa diperiksa; Dashboard memakai rumus yang sama) */}
      <T s={8.5} c={t.redup} style={{ marginTop: 10, lineHeight: 1.4 }}>
        {`Total Ekuitas Ekosistem = Ekuitas Usaha ${rp(e.ekuitasUsaha)} + Dana Pengembangan ${rp(e.danaPengembangan)} + Dana PE ${rp(e.danaPE)} + Dana Forum ${rp(e.danaForum ?? 0)} + Dana Berkah ${rp(e.danaBerkah ?? 0)} + Dana Circle ${rp(e.danaCircle ?? 0)} + Dana Rumah Usaha ${rp(e.danaRumahUsaha ?? 0)}`}
      </T>
    </HalamanIsi>
  )
}

// ── Tren omset ekosistem 5 bulan terakhir (USD + persen naik/turun) ─────────────────────────
function HalamanTrenEkosistem({ units, deretBulan, lingkupNama, bulanLabel }) {
  const t = useTema()
  const lima = (deretBulan ?? []).slice(-5)
  const riwayat = lima.map(mo => {
    let usd = 0, idr = 0
    for (const u of units) {
      const r = (u.riwayat ?? []).find(x => x.bulan === mo.bulan && x.tahun === mo.tahun)
      usd += r?.usd ?? 0; idr += r?.idr ?? 0
    }
    return { bulan: mo.bulan, tahun: mo.tahun, usd, idr, label: `${NAMA_BULAN_PENDEK[mo.bulan - 1]} ${mo.tahun}` }
  })
  const lebarKolom = (ISI_W - 40) / Math.max(1, riwayat.length)
  return (
    <HalamanIsi bagian="Executive Summary" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <JudulHalaman judul="Monthly Performance" sorot="Omset" ukuran={34} />
      <Kicker style={{ marginBottom: 8 }}>Total omset seluruh unit usaha · 5 bulan terakhir (USD)</Kicker>
      <Stiker style={{ flexGrow: 1 }} isiStyle={{ paddingVertical: 14, paddingHorizontal: 20 }}>
        <GrafikOmset riwayat={riwayat} satuan="usd" lebar={ISI_W - 44} tinggi={ISI_H - 150} />
        <View style={{ flexDirection: 'row', marginTop: 8, paddingLeft: 42 }}>
          {riwayat.map((r, i) => {
            const prev = i > 0 ? riwayat[i - 1].usd : null
            const persen = prev > 0 ? ((r.usd - prev) / prev) * 100 : null
            const naik = persen != null && persen >= 0
            return (
              <View key={r.label} style={{ width: (lebarKolom * riwayat.length - 42) / riwayat.length, alignItems: 'center' }}>
                <T w={700} s={11} c={t.tinta}>{usd(r.usd)}</T>
                {persen == null ? <T s={9} c={t.redup}>—</T>
                  : <T w={700} s={9.5} c={naik ? t.vonis.baik : t.vonis.kritis}>{`${naik ? '▲' : '▼'} ${Math.abs(persen).toFixed(1)}%`}</T>}
              </View>
            )
          })}
        </View>
      </Stiker>
    </HalamanIsi>
  )
}

// ── Tim Kerja & Pemagang per unit (nama + posisi, seperti Monthly Report manual) ───────────
const LEBAR_KARTU_TIM = 124
function KartuOrang({ o, pemagang }) {
  const t = useTema()
  const m = useMetrik()
  const koord = o.peran === 'KOORDINATOR' && !pemagang
  const isi = pemagang ? t.palet.lapis : (koord ? t.palet.aksen : t.kartu)
  const sNama = ukuranPas(o.nama, m.judul600, LEBAR_KARTU_TIM - 18, 10, 7)
  return (
    <Stiker isi={isi} bayang={0} style={{ width: LEBAR_KARTU_TIM, marginRight: 8, marginBottom: 8 }} isiStyle={{ paddingVertical: 6, paddingHorizontal: 9, height: 44, justifyContent: 'center' }}>
      <T s={7.5} c={koord ? t.palet.teksAksen : t.redup} style={{ marginBottom: 1 }}>{o.peran === 'KOORDINATOR' ? (o.posisi && o.posisi.trim().toLowerCase() !== 'koordinator' ? `Koordinator · ${o.posisi}` : 'Koordinator') : (o.posisi || (pemagang ? 'Magang' : 'Anggota'))}</T>
      <T pas f="judul" w={600} s={sNama} c={koord ? t.palet.teksAksen : t.tinta}>{o.nama}</T>
    </Stiker>
  )
}

function HalamanTim({ u, lingkupNama, bulanLabel, advisorUmum = [] }) {
  const t = useTema()
  const m = useMetrik()
  const tim0 = u.timRinci ?? { advisor: [], pendamping: [], kerja: [], magang: [] }
  // Advisor yang sama di semua unit cukup disebut sekali di halaman Leader & Key Person.
  const tim = { ...tim0, advisor: (tim0.advisor ?? []).filter(n => !advisorUmum.includes(n)) }
  const MAKS_KERJA = 18, MAKS_MAGANG = 12
  const kerja = tim.kerja.slice(0, MAKS_KERJA), magang = tim.magang.slice(0, MAKS_MAGANG)
  const sisa = (tim.kerja.length - kerja.length) + (tim.magang.length - magang.length)
  const kiri = 190
  const wKerja = 3 * (LEBAR_KARTU_TIM + 8)
  const wMagang = 2 * (LEBAR_KARTU_TIM + 8)
  return (
    <HalamanIsi bagian="Unit Report" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <View style={{ flexDirection: 'row', flexGrow: 1 }}>
        <View style={{ width: kiri }}>
          <T pas f="judul" w={700} s={ukuranPas(u.nama, m.judul700, kiri - 10, 36, 20)} c={t.tinta} style={{ lineHeight: 1.02 }}>{u.nama}</T>
          <Kicker style={{ marginTop: 6 }}>{LABEL_TIPE[u.tipe] ?? u.tipe}</Kicker>
          {tim.advisor?.length ? (
            <>
              <Kicker style={{ marginTop: 22 }}>Advisor</Kicker>
              {tim.advisor.map(n => (
                <View key={n} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.palet.aksen, marginRight: 6 }} />
                  <T w={600} s={10} c={t.tinta}>{n}</T>
                </View>
              ))}
            </>
          ) : null}
          <Kicker style={{ marginTop: tim.advisor?.length ? 16 : 22 }}>Pendamping</Kicker>
          {tim.pendamping.length ? tim.pendamping.map(n => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.palet.aksen, marginRight: 6 }} />
              <T w={600} s={10} c={t.tinta}>{n}</T>
            </View>
          )) : <T s={9.5} c={t.redup} style={{ marginTop: 5 }}>Belum ada pendamping tercatat</T>}
          {sisa > 0 ? <T s={9} c={t.redup} style={{ marginTop: 14 }}>{`+${sisa} anggota lain tidak ditampilkan`}</T> : null}
        </View>
        <View style={{ width: wKerja, marginRight: 14 }}>
          <View style={{ flexDirection: 'row' }}><Chip teks="TIM KERJA" isi={t.isiTinta} c={t.teksDiTinta} /></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {kerja.length ? kerja.map(o => <KartuOrang key={o.nama} o={o} />) : <T s={10} c={t.redup}>Belum ada anggota tim tercatat</T>}
          </View>
        </View>
        <View style={{ width: wMagang }}>
          <View style={{ flexDirection: 'row' }}><Chip teks="PEMAGANG" isi={t.isiTinta} c={t.teksDiTinta} /></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {magang.length ? magang.map(o => <KartuOrang key={o.nama} o={o} pemagang />) : <T s={10} c={t.redup}>Tidak ada pemagang</T>}
          </View>
        </View>
      </View>
    </HalamanIsi>
  )
}

// ── Leader & Key Person ──────────────────────────────────────────────────
function HalamanTokoh({ tokoh, lingkupNama, bulanLabel, advisorUmum = [] }) {
  const t = useTema()
  const tampil = tokoh.slice(0, 8)
  const sisa = tokoh.length - tampil.length
  const duaBaris = tampil.length > 4
  const foto = duaBaris ? 104 : 150
  const baris = duaBaris ? [tampil.slice(0, 4), tampil.slice(4)] : [tampil]
  return (
    <HalamanIsi bagian="Executive Summary" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <JudulHalaman judul="Leader & Key Person" />
      <View style={{ flexGrow: 1, justifyContent: 'center' }}>
        {baris.map((b, bi) => (
          <View key={bi} style={{ flexDirection: 'row', justifyContent: 'center', marginTop: bi ? 22 : 0 }}>
            {b.map((tk, i) => <KartuTokoh key={tk.userId} tokoh={tk} i={bi * 4 + i} foto={foto} lebar={ISI_W / 4} />)}
          </View>
        ))}
      </View>
      {advisorUmum.length > 0 && <T s={10.5} c={t.redup} style={{ textAlign: 'center', marginTop: 10 }}>{`Advisor semua unit: ${advisorUmum.join(', ')}`}</T>}
      {sisa > 0 && <T s={10} c={t.redup} style={{ textAlign: 'right' }}>{`+${sisa} lainnya`}</T>}
    </HalamanIsi>
  )
}

// ── Omset & Kas (circle) ─────────────────────────────────────────────────
function HalamanOmsetKas({ units, lingkupNama, bulanLabel, bulanNama, tahun }) {
  const t = useTema()
  const omset = [...units].sort((a, b) => (b.omset?.usd ?? 0) - (a.omset?.usd ?? 0))
  const kas = [...units].sort((a, b) => (b.kasSekarang ?? -1e15) - (a.kasSekarang ?? -1e15))
  const totalUsd = units.reduce((a, u) => a + (u.omset?.usd ?? 0), 0)
  const totalIdr = units.reduce((a, u) => a + (u.omset?.idr ?? 0), 0)
  const kasRekening = units.reduce((a, u) => a + (u.kasSekarang ?? 0), 0)
  const menabung = units.reduce((a, u) => a + (u.menabung ?? 0), 0)
  const lebar = (ISI_W - 24) / 2
  return (
    <HalamanIsi bagian="Executive Summary" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <JudulHalaman judul="Omset & Kas" sorot={`${bulanNama} ${tahun}`} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <TabelPeringkat lebar={lebar} judulKolom="UNIT" nilaiKolom="OMSET (USD)" kosong="Belum ada unit usaha."
          baris={omset.map((u, i) => ({
            nama: u.nama, sub: u.omset?.jumlahLaporan ? `${LABEL_TIPE[u.tipe]} · ${rp(u.omset.idr)}` : LABEL_TIPE[u.tipe],
            nilai: u.omset?.jumlahLaporan ? usd(u.omset.usd) : 'belum lapor', redup: !u.omset?.jumlahLaporan,
            sorot: i === 0 && (u.omset?.usd ?? 0) > 0,
          }))}
          kaki={[{ label: 'TOTAL', nilai: usd(totalUsd), besar: true }, { label: 'IDR', nilai: rp(totalIdr) }]} />
        <TabelPeringkat lebar={lebar} judulKolom="UNIT" nilaiKolom="KAS REKENING" kosong="Belum ada unit usaha."
          baris={kas.map(u => ({
            nama: u.nama,
            sub: `Menabung (perkiraan) ${rpBertanda(u.menabung)}`,
            nilai: u.kasSekarang != null ? rp(u.kasSekarang) : '—', redup: u.kasSekarang == null,
          }))}
          kaki={[
            { label: 'TOTAL KAS REKENING', nilai: rp(kasRekening), besar: true },
            { label: 'Menabung', nilai: rpBertanda(menabung), warna: menabung >= 0 ? t.vonis.baik : t.vonis.kritis },
          ]} />
      </View>
      {Math.max(omset.length, kas.length) <= 6 ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Stiker style={{ width: lebar }} isiStyle={{ paddingVertical: 11, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ikon e="🛒" ukuran={13} />
              <T f="judul" w={600} s={12} c={t.tinta} style={{ marginLeft: 6 }}>{`Porsi Omset per Market · ${bulanNama}`}</T>
            </View>
            <BilahPorsi bagian={porsiMarket(omsetGabungan(units))} kosong="Belum ada laporan omset bulan ini." />
          </Stiker>
          <Stiker style={{ width: lebar }} isiStyle={{ paddingVertical: 11, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ikon e="🏦" ukuran={13} />
              <T f="judul" w={600} s={12} c={t.tinta} style={{ marginLeft: 6 }}>Porsi Kas Rekening per Unit</T>
            </View>
            <BilahPorsi kosong="Belum ada data kas bulan ini." bagian={kas.filter(u => (u.kasSekarang ?? 0) > 0).map((u, i) => ({
              label: u.nama, nilai: u.kasSekarang, warna: warnaUrut(t, i), teksNilai: `Rp ${rpRingkas(u.kasSekarang)}`,
            }))} />
          </Stiker>
        </View>
      ) : null}
    </HalamanIsi>
  )
}

// ── Omset & Kas per tipe unit (laporan satu ekosistem, 13 Okt 2026) ─────────
// Tabel ringkas seperti slide manual tim: judul besar di kiri, tabel di kanan — semua Studio
// (atau Project) urut omset terbesar; kolom Kas Hari Ini = u.kasSekarang (saldo rekening bank) dari server.
const BARIS_PER_HALAMAN = 16
// Dolar bulat gaya slide tim: $8.749 (titik ribuan, tanpa sen).
const usdBulat = (v) => `$${Math.round(Number(v) || 0).toLocaleString('id-ID')}`
function HalamanDaftarTipe({ units, label, lingkupNama, bulanLabel, bulanNama, halamanKe = 1, jumlahHalaman = 1, semua }) {
  const t = useTema()
  const total = semua ?? units
  const totalUsd = total.reduce((a, u) => a + (u.omset?.usd ?? 0), 0)
  const totalIdr = total.reduce((a, u) => a + (u.omset?.idr ?? 0), 0)
  const totalKas = total.reduce((a, u) => a + (u.kasSekarang ?? 0), 0)
  const terakhir = halamanKe === jumlahHalaman
  const baris = units.length + (terakhir ? 2 : 0) + 1
  // Tinggi baris SUDAH termasuk garis tepi 1pt per baris + bingkai tabel (rumus lama mengabaikannya:
  // 16 studio + total = 19 baris meluap sampai menyentuh kaki halaman, terlebih pada ukuran huruf "Besar").
  const h = Math.max(17, Math.min(26, Math.floor((ISI_H - 12) / baris) - 1))
  const sTeks = h >= 20 ? 10.5 : 9
  const lebarTabel = 560
  const kol = { no: 40, nama: 220, omset: 130, kas: lebarTabel - 40 - 220 - 130 }
  const sel = (w, isi, opsi = {}) => (
    <View style={{ width: w, height: h, justifyContent: 'center', alignItems: opsi.kiri ? 'flex-start' : 'center', paddingHorizontal: 8, borderRightWidth: opsi.akhir ? 0 : 1, borderRightColor: t.garis }}>
      <T w={opsi.tebal ? 700 : 400} s={opsi.s ?? sTeks} c={opsi.c ?? t.teks}>{isi}</T>
    </View>
  )
  const garisBaris = { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.garis }
  const judulBesar = `OMSET &\nKAS ${label.toUpperCase()}\n${bulanNama.toUpperCase()}${jumlahHalaman > 1 ? ` (${halamanKe}/${jumlahHalaman})` : ''}`
  return (
    <HalamanIsi bagian="Executive Summary" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexGrow: 1 }}>
        <T f="judul" w={800} s={40} c={t.tinta} style={{ width: ISI_W - lebarTabel - 30, lineHeight: 1.12 }}>{judulBesar}</T>
        <View style={{ width: lebarTabel, borderWidth: 1, borderColor: t.garis, backgroundColor: t.kartu }}>
          <View style={[garisBaris, { backgroundColor: t.sorot }]}>
            {sel(kol.no, 'NO', { tebal: true, c: t.teksSorot })}
            {sel(kol.nama, label.toUpperCase(), { tebal: true, c: t.teksSorot })}
            {sel(kol.omset, 'OMSET', { tebal: true, c: t.teksSorot })}
            {sel(kol.kas, 'KAS HARI INI', { tebal: true, c: t.teksSorot, akhir: true })}
          </View>
          {units.map((u, i) => (
            <View key={u.id} style={garisBaris}>
              {sel(kol.no, String((halamanKe - 1) * BARIS_PER_HALAMAN + i + 1))}
              {sel(kol.nama, `${diKorporasi(u) && u.tipe !== 'KORPORASI' ? '– ' : ''}${String(u.nama).toUpperCase()}`)}
              {sel(kol.omset, u.omset?.jumlahLaporan ? usdBulat(u.omset.usd) : '—', { c: u.omset?.jumlahLaporan ? t.teks : t.redup })}
              {sel(kol.kas, rp(u.kasSekarang ?? 0), { akhir: true })}
            </View>
          ))}
          {terakhir ? (
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: kol.no + kol.nama + kol.omset }}>
                <View style={garisBaris}>
                  {sel(kol.no + kol.nama, 'TOTAL', { tebal: true })}
                  {sel(kol.omset, usdBulat(totalUsd), { tebal: true })}
                </View>
                <View style={{ flexDirection: 'row' }}>
                  {sel(kol.no + kol.nama, 'IDR', { tebal: true })}
                  {sel(kol.omset, rp(totalIdr), { tebal: true })}
                </View>
              </View>
              <View style={{ width: kol.kas, height: h * 2, justifyContent: 'center', alignItems: 'center' }}>
                <T w={800} s={sTeks + 3} c={t.tinta}>{rp(totalKas)}</T>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </HalamanIsi>
  )
}

/** Satu tipe unit → satu halaman (atau lebih kalau lebih dari BARIS_PER_HALAMAN). */
// Unit di bawah Korporasi (organisasi.jenis 'korporasi') tidak masuk halaman Studio/Project, tapi
// halaman Korporasi: per PT, Korporasinya dulu lalu unit di bawahnya (namanya diberi tanda "–").
const diKorporasi = (u) => u.organisasi?.jenis === 'korporasi'
function HalamanPerTipe({ units, tipe, label, ...bersama }) {
  const perOmset = (a, b) => (b.omset?.usd ?? 0) - (a.omset?.usd ?? 0)
  const daftar = tipe === 'KORPORASI'
    ? units.filter(diKorporasi).sort((a, b) => String(a.organisasi.nama).localeCompare(String(b.organisasi.nama), 'id')
      || Number(a.tipe !== 'KORPORASI') - Number(b.tipe !== 'KORPORASI') || perOmset(a, b))
    : units.filter(u => u.tipe === tipe && !diKorporasi(u)).sort(perOmset)
  if (!daftar.length) return null
  const potongan = []
  for (let i = 0; i < daftar.length; i += BARIS_PER_HALAMAN) potongan.push(daftar.slice(i, i + BARIS_PER_HALAMAN))
  return potongan.map((p, i) => (
    <HalamanDaftarTipe key={`${tipe}-${i}`} units={p} semua={daftar} label={label} halamanKe={i + 1} jumlahHalaman={potongan.length} {...bersama} />
  ))
}

/** Warna irisan berurutan (unit tak punya warna identitas): tangga tinta / ungu. */
function warnaUrut(t, i) {
  const tangga = t.gelap
    ? ['#8B5CF6', '#EC4899', '#06B6D4', '#A78BFA', '#F472B6', '#22D3EE', '#C4B5FD', '#64748B']
    : [t.palet.aksen === '#141414' ? '#141414' : t.palet.aksen, '#5A5A5A', '#9A9A95', '#FFE45C', '#C9C9C3', '#2E2E2E', '#E3E3DE', '#7A7A75']
  return tangga[i % tangga.length]
}

// ── Ekosistem: Omset & Kas per Circle ────────────────────────────────────
function HalamanPetaCircle({ kelompok, lingkupNama, bulanLabel, bulanNama, tahun }) {
  const t = useTema()
  const isi = kelompok.filter(k => k.unitUsaha.total > 0)
  const maks = Math.max(1, ...isi.map(k => k.omset?.idr ?? 0))
  const lebarKiri = 452, lebarKanan = ISI_W - lebarKiri - 24
  const tinggi = isi.length <= 6 ? 40 : isi.length <= 9 ? 30 : 22
  const tanpaKas = (k) => (k.unitDihitung ?? 0) > 0 && (k.tanpaData ?? 0) >= k.unitDihitung
  return (
    <HalamanIsi bagian="Executive Summary" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <JudulHalaman judul="Omset & Kas per Circle" sorot={`${bulanNama} ${tahun}`} ukuran={32} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Stiker style={{ width: lebarKiri }} isiStyle={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ikon e="📈" ukuran={14} />
            <T f="judul" w={600} s={12.5} c={t.tinta} style={{ marginLeft: 6 }}>{`Omset ${bulanNama}`}</T>
          </View>
          {isi.map(k => {
            const p = paletTema(t, k.slotWarna)
            const lebarBilah = (k.omset?.idr ?? 0) > 0 ? Math.max(4, (k.omset.idr / maks) * 250) : 0
            return (
              <View key={k.kunci} style={{ flexDirection: 'row', alignItems: 'center', height: tinggi }}>
                <View style={{ width: 120, flexDirection: 'row', alignItems: 'center' }}>
                  <TitikCircle warna={p.aksen} ukuran={9} style={{ marginRight: 6 }} />
                  <T w={600} s={9.5} c={t.teks} style={{ flexShrink: 1 }}>{k.nama}</T>
                </View>
                {lebarBilah ? <View style={{ width: lebarBilah, height: Math.min(18, tinggi - 10), backgroundColor: p.aksen, borderWidth: t.gelap ? 0 : 1.5, borderColor: t.tinta, borderRadius: 4 }} /> : null}
                <View style={{ marginLeft: lebarBilah ? 8 : 0 }}>
                  <T w={700} s={9.5} c={t.tinta}>{usd(k.omset?.usd ?? 0)}</T>
                  {tinggi >= 30 ? <T s={7.5} c={t.redup}>{`Rp ${rpRingkas(k.omset?.idr ?? 0)}`}</T> : null}
                </View>
              </View>
            )
          })}
        </Stiker>
        <TabelPeringkat lebar={lebarKanan} judulKolom="CIRCLE" nilaiKolom="KAS REKENING" kosong="Belum ada circle aktif."
          baris={isi.map(k => ({
            nama: k.nama, titik: paletTema(t, k.slotWarna).aksen,
            sub: `${k.unitUsaha.total} unit · ${k.anggota - (k.magang ?? 0)} anggota · ${k.magang ?? 0} magang · Menabung ${rpBertanda(k.menabung)}`,
            nilai: tanpaKas(k) ? '—' : rp(k.kasSekarang), redup: tanpaKas(k),
          }))}
          kaki={[
            { label: 'TOTAL KAS REKENING', nilai: rp(isi.reduce((a, k) => a + (k.kasSekarang ?? 0), 0)), besar: true },
            { label: 'Total Pengeluaran', nilai: rp(isi.reduce((a, k) => a + (k.beban ?? 0), 0)) },
          ]} />
      </View>
      {isi.length <= 6 ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Stiker style={{ width: lebarKiri }} isiStyle={{ paddingVertical: 11, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ikon e="🛒" ukuran={13} />
              <T f="judul" w={600} s={12} c={t.tinta} style={{ marginLeft: 6 }}>{`Porsi Omset per Market · ${bulanNama}`}</T>
            </View>
            <BilahPorsi bagian={porsiMarket(omsetGabungan(isi.map(k => ({ omset: k.omset }))))} kosong="Belum ada laporan omset bulan ini." />
          </Stiker>
          <Stiker style={{ width: lebarKanan }} isiStyle={{ paddingVertical: 11, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ikon e="🏦" ukuran={13} />
              <T f="judul" w={600} s={12} c={t.tinta} style={{ marginLeft: 6 }}>Porsi Kas Rekening per Circle</T>
            </View>
            <BilahPorsi kosong="Belum ada data kas bulan ini." bagian={isi.map(k => ({
              label: k.nama, nilai: Math.max(0, k.kasSekarang ?? 0), warna: paletTema(t, k.slotWarna).aksen,
            }))} />
          </Stiker>
        </View>
      ) : null}
    </HalamanIsi>
  )
}

// ── Halaman per unit ─────────────────────────────────────────────────────
/** Niche = Jenis Usaha (arahan Owner) — deskripsi panjang tidak muat; ringkas jadi poin. */
function poinUsaha(u) {
  const potong = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1).trim()}…` : s)
  const niche = u.jenisUsaha || potong(String(u.niche ?? '').split(/[.\n]/)[0].trim(), 48) || '—'
  const lain = [
    u.bidangUsaha ? { k: 'Bidang', v: u.bidangUsaha } : null,
    u.kategoriPasar ? { k: 'Pasar', v: u.kategoriPasar } : null,
  ].filter(Boolean)
  return { niche, lain }
}

function HalamanUnit({ u, lingkupNama, bulanLabel, bulanNama, ekosistem, rincianAda }) {
  const t = useTema()
  const m = useMetrik()
  const kiri = 318
  const kanan = ISI_W - kiri - 26
  const sNama = ukuranPas(u.nama, m.judul700, kiri, 46, 22)
  const market = daftarMarket(u)
  const untung = (u.menabung ?? 0) >= 0
  const kartuW = (kanan - 22) / 2
  const { niche, lain } = poinUsaha(u)
  return (
    <HalamanIsi bagian="Unit Report" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexGrow: 1 }}>
        <View style={{ width: kiri }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Chip teks={LABEL_TIPE[u.tipe] ?? u.tipe} isi={t.palet.lapis} c={t.gelap ? t.teks : '#141414'} />
            {ekosistem && u.organisasi ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TitikCircle warna={t.palet.aksen} ukuran={9} style={{ marginRight: 5 }} />
                <T f="judul" w={600} s={10.5} c={t.tinta}>{u.organisasi.nama}</T>
              </View>
            ) : null}
          </View>
          {u.logoUrl ? <Image src={u.logoUrl} style={{ height: 40, width: 130, objectFit: 'contain', objectPositionX: 0, marginBottom: 6 }} /> : null}
          <T pas f="judul" w={700} s={sNama} c={t.tinta} style={{ lineHeight: 1.02 }}>{u.nama}</T>
          <Kicker style={{ marginTop: 16 }}>Niche</Kicker>
          <T f="judul" w={600} s={16} c={t.tinta} style={{ marginTop: 3 }}>{niche}</T>
          {lain.map(p => (
            <View key={p.k} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.palet.aksen, marginRight: 6 }} />
              <T s={9.5} c={t.redup}>{`${p.k}: `}</T>
              <T w={600} s={9.5} c={t.teks}>{p.v}</T>
            </View>
          ))}
          <Kicker style={{ marginTop: 14, marginBottom: 6 }}>Market</Kicker>
          <StikerMarket daftar={market} />
          {porsiMarket(u.omset?.perMarket).length ? (
            <View style={{ marginTop: 6 }}>
              <Kicker>{`Omset per Market · ${bulanNama}`}</Kicker>
              <View style={{ marginTop: 7, width: kiri - 10 }}>
                {/* Nama akun ditempel ke tiap market sebagai sumber pendapatannya (arahan Owner 9 Okt 2026) */}
                <BilahPorsi bagian={porsiMarket(u.omset?.perMarket, u.omset?.akunPerMarket)} tinggi={13} />
              </View>
            </View>
          ) : null}
          <View style={{ flexGrow: 1 }} />
          {/* Kas rekening = saldo Bio Studio, angka yang sama dengan Dashboard (1 Nov 2026; dulu "Est. Kas Akhir" = rumus) */}
          <Stiker isi={t.isiTinta} garis={t.isiTinta} bayang={0} isiStyle={{ paddingVertical: 12, paddingHorizontal: 15 }}>
            <Kicker c={t.teksDiTintaRedup}>Kas Rekening</Kicker>
            <T pas w={800} s={ukuranPas(u.kasSekarang != null ? rp(u.kasSekarang) : '—', m.angka, kiri - 34, 23, 14)} c={t.teksDiTinta} style={{ marginTop: 4 }}>{u.kasSekarang != null ? rp(u.kasSekarang) : '—'}</T>
            <T s={8.5} c={t.teksDiTintaRedup} style={{ marginTop: 3 }}>{`Saldo Bio Studio · Menabung (perkiraan) ${rpBertanda(u.menabung)}`}</T>
          </Stiker>
        </View>
        <View style={{ width: kanan }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <KartuAngka e="📈" label={`Omset ${bulanNama}`} nilai={rp(u.omset?.idr ?? 0)} sub={usd(u.omset?.usd ?? 0)} lebar={kartuW} tinggi={96} besar={22}
              warnaNilai={(u.omset?.idr ?? 0) > 0 ? t.vonis.baik : undefined} />
            <KartuAngka e="🧾" label={`Pengeluaran ${bulanNama}`} nilai={rp(u.beban)} lebar={kartuW} tinggi={96} besar={22}
              warnaNilai={u.beban > 0 ? t.vonis.kritis : undefined}
              sub={rincianAda ? 'CPM + tambahan: lihat Rincian Pengeluaran' : `CPM ${rp(u.cpm ?? 0)} + Tambahan ${rp(u.tambahan)}`} />
          </View>
          <Stiker style={{ marginTop: 20, flexGrow: 1 }} isiStyle={{ paddingTop: 10, paddingBottom: 10, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ikon e="📈" ukuran={13} />
                <T f="judul" w={600} s={12} c={t.tinta} style={{ marginLeft: 6 }}>Omset 7 Bulan Terakhir (Rp)</T>
              </View>
              <T w={700} s={9.5} c={t.tinta}>{`${bulanNama}: ${usd(u.omset?.usd ?? 0)}`}</T>
            </View>
            <GrafikOmset riwayat={u.riwayat ?? []} lebar={kanan - 32} tinggi={196} />
          </Stiker>
          {/* Tim & Menabung dibesarkan (arahan Owner 9 Okt 2026: "terlalu kecil") */}
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <Stiker style={{ marginRight: 12 }} isiStyle={{ paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
              <LencanaIkon e="👥" ukuran={24} bayang={0} />
              <T f="judul" w={700} s={15} c={t.tinta} style={{ marginLeft: 9 }}>{`Tim ${u.tim} orang`}</T>
            </Stiker>
            <Stiker isi={untung ? t.vonis.baikLapis : t.vonis.kritisLapis} isiStyle={{ paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
              <LencanaIkon e={untung ? '🌱' : '💸'} ukuran={24} bayang={0} />
              <T f="judul" w={700} s={15} c={untung ? t.vonis.baik : t.vonis.kritis} style={{ marginLeft: 9 }}>{`Menabung ${rpBertanda(u.menabung)}`}</T>
            </Stiker>
          </View>
        </View>
      </View>
    </HalamanIsi>
  )
}

// ── Rincian Pengeluaran (dulu "Financial Forecasting") — SATU slide, kategori profil unit ─────────────
function HalamanRincian({ u, lingkupNama, bulanLabel, bulanNama }) {
  const t = useTema()
  const m = useMetrik()
  const r = u.rincian
  const kelompok = kelompokRincian(r)
  const total = (r?.totalCpm ?? 0) + (r?.totalTambahan ?? 0)
  const beda = r && u.cpm != null && Math.abs((r.totalCpm ?? 0) - u.cpm) >= 1
  const tinggiTabel = ISI_H - 132
  const kolom = rincianMuat(kelompok, tinggiTabel, 2) ? 2 : 3
  return (
    <HalamanIsi bagian="Rincian Pengeluaran" lingkup={lingkupNama} bulanLabel={bulanLabel}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexShrink: 1, marginRight: 16 }}>
          <T pas f="judul" w={700} s={ukuranPas(u.nama, m.judul700, 380, 34, 18)} c={t.tinta} style={{ lineHeight: 1.02 }}>{u.nama}</T>
          <Stabilo warna={t.gelap ? undefined : t.palet.lapis} style={{ marginTop: 6 }}>
            <T f="judul" w={700} s={20} c={t.gelap ? t.teksSorot : t.tinta}>Rincian Pengeluaran</T>
          </Stabilo>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {[
            { l: 'CPM', v: rp(r?.totalCpm ?? 0) },
            { l: `Tambahan ${bulanNama}`, v: rp(r?.totalTambahan ?? 0) },
          ].map(x => (
            <Stiker key={x.l} style={{ marginRight: 12 }} isiStyle={{ paddingVertical: 7, paddingHorizontal: 12 }}>
              <Kicker s={8}>{x.l}</Kicker>
              <T w={800} s={13} c={t.tinta} style={{ marginTop: 2 }}>{x.v}</T>
            </Stiker>
          ))}
          <Stiker isi={t.isiTinta} garis={t.isiTinta} bayang={0} isiStyle={{ paddingVertical: 7, paddingHorizontal: 14 }}>
            <Kicker s={8} c={t.teksDiTintaRedup}>Total Pengeluaran</Kicker>
            <T w={800} s={15} c={t.teksDiTinta} style={{ marginTop: 2 }}>{rp(total)}</T>
          </Stiker>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <BilahPorsi tinggi={12} kosong="Belum ada pengeluaran tercatat." bagian={kelompok.map(k => ({ label: k.label, nilai: k.subtotal, warna: warnaKelompok(t, k.id) }))} />
      </View>
      <Stiker style={{ marginTop: 8, flexGrow: 1 }} isiStyle={{ paddingVertical: 10, paddingHorizontal: 12 }}>
        {kelompok.length ? (
          <KolomRincian kelompok={kelompok} lebar={ISI_W - 24 - 2 * t.tebalGaris} tinggi={tinggiTabel - 26} jumlahKolom={kolom} />
        ) : (
          <T s={10} c={t.redup}>Belum ada komponen CPM maupun pengeluaran tambahan tercatat.</T>
        )}
      </Stiker>
      {beda || r?.gajiDirinci === false ? (
        <T s={7.8} c={t.redup} style={{ marginTop: 6 }}>
          {[
            beda ? `Rincian memakai susunan CPM saat ini; CPM ${u.sah ? 'resmi (disahkan)' : 'tercatat'} ${bulanNama}: ${rp(u.cpm)}.` : null,
            r?.gajiDirinci === false ? 'Gaji anggota digabung per unit (tidak dirinci per orang).' : null,
          ].filter(Boolean).join(' ')}
        </T>
      ) : null}
    </HalamanIsi>
  )
}

function HalamanSatuUnit({ u, isi, ...bersama }) {
  return (
    <>
      {isi.unit && <HalamanUnit u={u} rincianAda={!!(isi.rincian && u.rincian)} {...bersama} />}
      {isi.unit && <HalamanTim u={u} {...bersama} />}
      {isi.rincian && u.rincian && <HalamanRincian u={u} {...bersama} />}
    </>
  )
}

/** Unit tanpa omset, pengeluaran, tim, dan kas bulan ini: tidak diberi 3 halaman kosong (cukup disebut satu baris). */
const tanpaAktivitas = (u) => !((u.omset?.jumlahLaporan ?? 0) > 0) && !((u.beban ?? 0) > 0) && !((u.tim ?? 0) > 0)
  && !((u.kas?.total ?? 0) > 0) && !((u.kasAkhir ?? 0) > 0)

const urutUnit = (a, b) => ((b.omset?.usd ?? 0) - (a.omset?.usd ?? 0)) || a.nama.localeCompare(b.nama, 'id')

// ══════════════════════════════════════════════════════════════════════════
/**
 * @param tema     'playground' | 'kosmik' (sudah dipilih pemanggil; "otomatis" diselesaikan di buatProgressReport)
 * @param font     'tema' | kunci FONT_PDF
 * @param gaya     id gaya latar | 'foto';  tataFoto: tata letak foto
 */
export default function ProgressReportPDF({ skala = 1, warnaHuruf = null, data, tema = 'playground', font = 'tema', gaya = 'kisi', tataFoto = 'bingkai', foto = null, isi = { tokoh: true, unit: true, rincian: true } }) {
  const ekosistem = data.lingkup.jenis === 'ekosistem'
  const temaAktif = rakitTema({ temaId: tema, fontId: font, slotWarna: data.lingkup.slotWarna, skala, warnaHuruf, identitas: { logoCircle: data.lingkup.logoUrl ?? null, nama: data.lingkup.jenis === 'ekosistem' ? null : data.lingkup.nama } })
  const nama = data.lingkup.nama
  const bulanNama = data.labelBulan.split(' ')[0]
  const bulanLabel = data.labelBulan
  const sorotBulan = `${NAMA_BULAN_PENDEK[data.bulan - 1]} ${data.tahun}`
  const units = [...(data.units ?? [])].filter(u => u.tipe !== 'RUMAH').sort(urutUnit)
  const jenisLabel = ekosistem ? 'Laporan Satu Ekosistem' : data.lingkup.jenis === 'rumah-usaha' ? 'Laporan Rumah Usaha' : 'Laporan Circle'
  const bersama = { lingkupNama: nama, bulanLabel, bulanNama, ekosistem }
  const ekoNama = EKOSISTEM?.nama ?? EKOSISTEM_NAMA_PANJANG
  const latar = { gaya, tataFoto, foto }
  const adaUnit = isi.unit || isi.rincian
  const tokohAda = !!(isi.tokoh && data.tokoh?.length > 0)
  // Advisor yang menjabat di SEMUA unit aktif → disebut sekali di halaman Leader, tidak diulang tiap unit.
  const unitAktif = units.filter(u => !tanpaAktivitas(u))
  const advisorUmum = (tokohAda && unitAktif.length > 1)
    ? (unitAktif[0].timRinci?.advisor ?? []).filter(n => unitAktif.every(u => (u.timRinci?.advisor ?? []).includes(n)))
    : []
  const bersamaUnit = { ...bersama, advisorUmum }
  const tampilUnit = (daftar) => daftar.filter(u => !tanpaAktivitas(u)).filter(u => isi.unit || (isi.rincian && u.rincian)).map(u => (
    <HalamanSatuUnit key={u.id} u={u} isi={isi} {...bersamaUnit} />
  ))

  return (
    <Document title={`${nama} — Progress Report ${bulanLabel}`} author={EKOSISTEM_NAMA_PANJANG} subject={`Progress Report ${bulanLabel}`} creator={EKOSISTEM_NAMA_PANJANG} producer={EKOSISTEM_NAMA_PANJANG}>
      <TemaPdf.Provider value={temaAktif}>
        <Sampul {...latar} nama={nama} judulDok="Progress Report" bulanLabel={bulanLabel} ekosistemNama={ekoNama} jenisLabel={jenisLabel} />

        {ekosistem && data.ringkas.eksekutif && <HalamanAngkaUtama e={data.ringkas.eksekutif} {...bersama} />}
        {ekosistem && <HalamanTrenEkosistem units={units} deretBulan={data.deretBulan} {...bersama} />}
        <HalamanRingkasan judul="Progres & Kondisi" sorot={sorotBulan} r={data.ringkas} bagian="Executive Summary" {...bersama} />
        {tokohAda && <HalamanTokoh tokoh={data.tokoh} advisorUmum={advisorUmum} {...bersama} />}
        {ekosistem
          ? <>
              <HalamanPetaCircle kelompok={data.kelompok ?? []} tahun={data.tahun} {...bersama} />
              <HalamanPerTipe units={units} tipe="KORPORASI" label="Korporasi" {...bersama} />
              <HalamanPerTipe units={units} tipe="STUDIO" label="Studio" {...bersama} />
              <HalamanPerTipe units={units} tipe="PROJECT" label="Project" {...bersama} />
            </>
          : <HalamanOmsetKas units={units} tahun={data.tahun} {...bersama} />}

        {ekosistem ? (
          <>
            {(data.kelompok ?? []).map(k => {
              const unitK = units.filter(u => k.unitIds.includes(u.id))
              // Tiap circle memakai warnanya sendiri di seluruh halamannya.
              const temaCircle = { ...temaAktif, palet: paletTema(temaAktif, k.slotWarna) }
              return (
                <TemaPdf.Provider key={k.kunci} value={temaCircle}>
                  <HalamanRingkasan judul={k.nama} sorot={sorotBulan} r={k} bagian={k.jenis === 'korporasi' ? 'Korporasi Report' : 'Circle Report'} {...bersama} lingkupNama={k.nama} />
                  {adaUnit && tampilUnit(unitK)}
                </TemaPdf.Provider>
              )
            })}
          </>
        ) : adaUnit && units.length > 0 ? (
          <>
            {tampilUnit(units)}
          </>
        ) : null}

        <Penutup {...latar} nama={nama} bulanLabel={bulanLabel} slogan={SATU_CIRCLE ? null : EKOSISTEM_SLOGAN} ekosistemNama={ekoNama} />
      </TemaPdf.Provider>
    </Document>
  )
}
