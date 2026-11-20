import { jamKerja, nada, kunciTanggalWIB } from './jamKerja.js'
import { jenisNormal, FASE, JENIS_REVISI } from './alur.js'
import { JENIS_KERJA } from './penugasan.js' // satu definisi antrean talent (KERJA, revisi, FINALISASI)

// ANALITIK PRODUKSI web circle (20 Okt 2026) — adaptasi OGS ProductionPulseService, ProductionPerformanceService,
// RevisionCountReportService, HomeChartSeriesService. MURNI (tanpa database): pemanggil memberi order + riwayat tahap.
// Catatan atribusi: OGS mencatat penugasan PER TAHAP per orang; Ekosistem masih per ORDER. Karena itu waktu kerja sebuah
// tahap dihitung untuk SEMUA orang yang ditugaskan di order itu (fase 2: penugasan per tahap akan mempertajamnya).
// Tanpa angka uang di modul ini.

const median = (a) => { const x = a.filter(v => v != null).sort((p, q) => p - q); if (!x.length) return null; const m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : Math.round(((x[m - 1] + x[m]) / 2) * 100) / 100 }
const bulat1 = (v) => Math.round(v * 10) / 10
const FASE_ALIR = ['antrian', 'produksi', 'qc', 'revisi', 'klien', 'finalisasi'] // delivery digabung ke finalisasi (OGS)
const faseDariJenis = (jenis) => FASE.find(f => f.jenis.includes(jenisNormal(jenis)))?.kunci ?? null

/** Interval tahap sebuah order dari riwayat (baris terbuka berakhir di `sekarang`). Order lama tanpa riwayat → 1 interval dari tanggalMasuk. */
export function intervalOrder(order, riwayat, sekarang) {
  if (riwayat?.length) {
    return riwayat.map(r => ({ nama: r.namaTahap, jenis: jenisNormal(r.jenis), mulai: new Date(r.mulai), selesai: r.selesai ? new Date(r.selesai) : null, terbuka: !r.selesai }))
      .map(r => ({ ...r, akhir: r.selesai ?? sekarang }))
  }
  const jenis = jenisNormal(order.tahap?.jenis ?? (order.status === 'MASUK' ? 'MASUK' : order.status === 'SELESAI' ? 'SELESAI' : 'KERJA'))
  const selesai = order.status === 'SELESAI' ? (order.tanggalSelesai ? new Date(order.tanggalSelesai) : null) : null
  return [{ nama: order.tahap?.nama ?? jenis, jenis, mulai: new Date(order.tanggalMasuk), selesai, terbuka: !selesai, akhir: selesai ?? sekarang }]
}
const tahapSekarang = (iv) => iv.filter(i => i.terbuka).at(-1) ?? iv.at(-1)

// ── Papan nadi (OGS ProductionPulseService::snapshot) ───────────────────────────────────────────────────────────────
export function susunNadi({ orders, riwayatByOrder, penugasanByOrder = new Map(), namaPengguna = new Map(), sekarang, libur, jadwal }) {
  const awalHari = new Date(kunciTanggalWIB(sekarang) + 'T00:00:00+07:00')
  const terbuka = orders.filter(o => !['SELESAI', 'BATAL'].includes(o.status))
  const orang = new Map()
  const ambil = (u) => { if (!orang.has(u.id)) orang.set(u.id, { userId: u.id, nama: u.nama, wip: [], antre: 0, selesaiHariIni: 0 }); return orang.get(u.id) }
  const alir = Object.fromEntries(FASE_ALIR.map(k => [k, { jumlah: 0, tertua: null, order: [] }]))
  let selesaiHariIni = 0

  for (const o of orders) {
    const baris = penugasanByOrder.get(o.id)
    if (baris?.length) { // penugasan per tahap (OGS): atribusi per orang yang sebenarnya mengerjakan
      for (const b of baris) if (b.status === 'SELESAI' && b.selesaiPada && new Date(b.selesaiPada) >= awalHari && new Date(b.selesaiPada) <= sekarang) { selesaiHariIni += 1; ambil({ id: b.userId, nama: namaPengguna.get(b.userId) ?? '—' }).selesaiHariIni += 1 }
      continue
    }
    const iv = intervalOrder(o, riwayatByOrder.get(o.id), sekarang)
    // selesai hari ini = tahap kerja yang ditutup hari ini (dihitung untuk tiap orang yang ditugaskan)
    const tutupHariIni = iv.filter(i => JENIS_KERJA.includes(i.jenis) && i.selesai && i.selesai >= awalHari && i.selesai <= sekarang).length
    if (tutupHariIni) { selesaiHariIni += tutupHariIni; for (const a of o.assignments ?? []) if (a.user) ambil(a.user).selesaiHariIni += tutupHariIni }
  }
  for (const o of terbuka) {
    const iv = intervalOrder(o, riwayatByOrder.get(o.id), sekarang)
    const kini = tahapSekarang(iv)
    if (!kini) continue
    const jam = jamKerja(kini.mulai, sekarang, libur, jadwal)
    const fase = faseDariJenis(kini.jenis)
    const kunci = fase === 'delivery' ? 'finalisasi' : fase
    if (alir[kunci]) { alir[kunci].jumlah += 1; if (alir[kunci].tertua == null || jam > alir[kunci].tertua) alir[kunci].tertua = jam; alir[kunci].order.push({ orderId: o.id, judul: o.judul, klien: o.klien ?? null, tahap: kini.nama, jam, nada: nada(jam) }) }
    const barisAktif = (penugasanByOrder.get(o.id) ?? []).filter(b => b.status !== 'SELESAI')
    if (penugasanByOrder.get(o.id)?.length && JENIS_KERJA.includes(kini.jenis)) {
      for (const b of barisAktif) { const j = jamKerja(b.mulaiPada ?? b.ditugaskanPada, sekarang, libur, jadwal); ambil({ id: b.userId, nama: namaPengguna.get(b.userId) ?? '—' }).wip.push({ orderId: o.id, judul: o.judul, tahap: b.namaTahap, jam: j, nada: nada(j) }) }
      continue
    }
    for (const a of o.assignments ?? []) {
      if (!a.user) continue
      const p = ambil(a.user)
      if (JENIS_KERJA.includes(kini.jenis)) p.wip.push({ orderId: o.id, judul: o.judul, tahap: kini.nama, jam, nada: nada(jam) })
      else if (kini.jenis === 'MASUK') p.antre += 1
    }
  }
  const maks = Math.max(1, ...Object.values(alir).map(a => a.jumlah))
  const orangList = [...orang.values()].map(p => {
    const wip = p.wip.sort((a, b) => b.jam - a.jam)
    return { userId: p.userId, nama: p.nama, wip: wip.slice(0, 8), jumlahWip: wip.length, wipLebih: Math.max(0, wip.length - 8), antre: p.antre, selesaiHariIni: p.selesaiHariIni, macet: wip.filter(w => w.nada === 'bad').length, jamTerlama: wip[0]?.jam ?? 0 }
  }).sort((a, b) => b.macet - a.macet || b.jamTerlama - a.jamTerlama || b.jumlahWip - a.jumlahWip || a.nama.localeCompare(b.nama))
  const alirList = FASE_ALIR.map(k => ({ kunci: k, label: FASE.find(f => f.kunci === k).label, jumlah: alir[k].jumlah, jamTertua: alir[k].tertua, isiPersen: Math.round((alir[k].jumlah / maks) * 100), nada: nada(alir[k].tertua ?? 0), order: alir[k].order.sort((a, b) => b.jam - a.jam) })) // order per fase: untuk daftar saat batang diklik (tanpa uang)
  const wipAktif = orangList.reduce((a, p) => a + p.jumlahWip, 0)
  return {
    nadi: { selesaiHariIni, wipAktif, antre: orangList.reduce((a, p) => a + p.antre, 0), macet: orangList.reduce((a, p) => a + p.macet, 0) },
    alir: alirList, orang: orangList, ambang: { setengahHari: 3.5, sehari: 7 },
  }
}

// ── Kinerja per orang (OGS ProductionPerformanceService::summarize) ──────────────────────────────────────────────────
export function susunKinerja({ orders, riwayatByOrder, penugasanByOrder = new Map(), namaPengguna = new Map(), dari, sampai, sekarang, libur, jadwal }) {
  const orang = new Map()
  const ambil = (u) => { if (!orang.has(u.id)) orang.set(u.id, { userId: u.id, nama: u.nama, tahap: 0, jam: { produksi: [], qc: [], revisi: [], semua: [] }, antre: [], perTahap: new Map(), order: new Set(), selesai: [], tepatWaktu: 0, adaDeadline: 0, revisiTotal: 0, wip: 0, antreOrder: 0 }); return orang.get(u.id) }
  for (const o of orders) {
    const aset = (o.assignments ?? []).filter(a => a.user)
    const barisTahap = penugasanByOrder.get(o.id) ?? []
    if (!aset.length && !barisTahap.length) continue
    const iv = intervalOrder(o, riwayatByOrder.get(o.id), sekarang)
    const kini = tahapSekarang(iv)
    const pakaiBaris = barisTahap.length > 0
    // penugasan per tahap (OGS): waktu kerja dihitung HANYA untuk orang yang mengerjakan tahap itu
    for (const b of barisTahap) {
      const p = ambil({ id: b.userId, nama: namaPengguna.get(b.userId) ?? '—' })
      if (b.status !== 'SELESAI') { if (JENIS_KERJA.includes(jenisNormal(b.jenisTahap))) p.wip += 1; continue }
      if (!b.selesaiPada || new Date(b.selesaiPada) < dari || new Date(b.selesaiPada) > sampai) continue
      const jam = jamKerja(b.mulaiPada ?? b.ditugaskanPada, b.selesaiPada, libur, jadwal)
      p.tahap += 1
      const kel = jenisNormal(b.jenisTahap) === 'KERJA' ? 'produksi' : 'revisi'
      p.jam[kel].push(jam); p.jam.semua.push(jam)
      const e = p.perTahap.get(b.namaTahap) ?? { nama: b.namaTahap, jumlah: 0, jam: [] }
      e.jumlah += 1; e.jam.push(jam); p.perTahap.set(b.namaTahap, e)
      if (b.mulaiPada && b.ditugaskanPada && new Date(b.mulaiPada) > new Date(b.ditugaskanPada)) p.antre.push(jamKerja(b.ditugaskanPada, b.mulaiPada, libur, jadwal))
      p.order.add(o.id)
    }
    for (const a of aset) {
      const p = ambil(a.user)
      p.order.add(o.id)
      p.revisiTotal += o.revisiKe ?? 0
      if (!['SELESAI', 'BATAL'].includes(o.status) && kini) { if (JENIS_KERJA.includes(kini.jenis)) p.wip += 1; else if (kini.jenis === 'MASUK') p.antreOrder += 1 }
      if (o.status === 'SELESAI' && o.tanggalSelesai && new Date(o.tanggalSelesai) >= dari && new Date(o.tanggalSelesai) <= sampai) {
        p.selesai.push(o.id)
        if (o.deadline) { p.adaDeadline += 1; if (new Date(o.tanggalSelesai) <= new Date(o.deadline)) p.tepatWaktu += 1 }
      }
      if (pakaiBaris) continue // waktu tahap sudah diatribusi lewat baris penugasan per tahap
      for (const i of iv) {
        if (!i.selesai || i.selesai < dari || i.selesai > sampai) continue
        if (i.jenis === 'MASUK') { p.antre.push(jamKerja(i.mulai, i.selesai, libur, jadwal)); continue }
        if (!JENIS_KERJA.includes(i.jenis) && i.jenis !== 'QC') continue
        const jam = jamKerja(i.mulai, i.selesai, libur, jadwal)
        p.tahap += 1
        const jenisKelompok = i.jenis === 'KERJA' ? 'produksi' : i.jenis === 'QC' ? 'qc' : 'revisi'
        p.jam[jenisKelompok].push(jam); p.jam.semua.push(jam)
        const e = p.perTahap.get(i.nama) ?? { nama: i.nama, jumlah: 0, jam: [] }
        e.jumlah += 1; e.jam.push(jam); p.perTahap.set(i.nama, e)
      }
    }
  }
  const baris = [...orang.values()].map(p => {
    const persen = (n) => (p.tahap ? Math.round((n / p.tahap) * 100) : null)
    return {
      userId: p.userId, nama: p.nama, order: p.order.size, selesai: p.selesai.length, tahapSelesai: p.tahap,
      porsiProduksi: persen(p.jam.produksi.length), porsiQc: persen(p.jam.qc.length), porsiRevisi: persen(p.jam.revisi.length),
      medianJam: median(p.jam.semua), medianProduksi: median(p.jam.produksi), medianQc: median(p.jam.qc), medianRevisi: median(p.jam.revisi), medianAntre: median(p.antre),
      sampelDurasi: p.jam.semua.length, tepatWaktu: p.adaDeadline ? Math.round((p.tepatWaktu / p.adaDeadline) * 100) : null, sampelDeadline: p.adaDeadline,
      revisiTotal: p.revisiTotal, wipAktif: p.wip, antreOrder: p.antreOrder,
      perTahap: [...p.perTahap.values()].sort((a, b) => b.jumlah - a.jumlah).slice(0, 10).map(e => ({ nama: e.nama, jumlah: e.jumlah, medianJam: median(e.jam) })),
    }
  }).sort((a, b) => b.tahapSelesai - a.tahapSelesai || b.selesai - a.selesai || a.nama.localeCompare(b.nama))
  return { dari: dari.toISOString(), sampai: sampai.toISOString(), orang: baris, total: { orang: baris.length, tahap: baris.reduce((a, p) => a + p.tahapSelesai, 0), selesai: baris.reduce((a, p) => a + p.selesai, 0), wipAktif: baris.reduce((a, p) => a + p.wipAktif, 0) } }
}

// ── Laporan jumlah revisi (OGS RevisionCountReportService) ────────────────────────────────────────────────────────────
export function susunRevisi({ orders, riwayatByOrder, sekarang }) {
  const baris = orders.map(o => {
    const iv = intervalOrder(o, riwayatByOrder.get(o.id), sekarang)
    const dariRiwayat = (j) => iv.filter(i => i.jenis === j).length
    const internal = dariRiwayat('REVISI_INTERNAL'), klien = dariRiwayat('REVISI_KLIEN')
    return { orderId: o.id, judul: o.judul, klien: o.klien, status: o.status, revisiKe: o.revisiKe ?? 0, revisiInternal: internal, revisiKlien: klien, total: Math.max(o.revisiKe ?? 0, internal + klien) }
  })
  const dgnRevisi = baris.filter(b => b.total > 0).sort((a, b) => b.total - a.total || a.judul.localeCompare(b.judul))
  const perBulan = new Map()
  for (const o of orders) { const k = kunciTanggalWIB(o.tanggalMasuk).slice(0, 7); const e = perBulan.get(k) ?? { bulan: k, order: 0, denganRevisi: 0, totalRevisi: 0 }; const b = baris.find(x => x.orderId === o.id); e.order += 1; if (b.total > 0) e.denganRevisi += 1; e.totalRevisi += b.total; perBulan.set(k, e) }
  const totalRevisi = baris.reduce((a, b) => a + b.total, 0)
  return {
    ringkasan: { order: baris.length, denganRevisi: dgnRevisi.length, totalRevisi, rataPerOrder: baris.length ? bulat1(totalRevisi / baris.length) : 0, persenDenganRevisi: baris.length ? Math.round((dgnRevisi.length / baris.length) * 100) : 0, revisiInternal: baris.reduce((a, b) => a + b.revisiInternal, 0), revisiKlien: baris.reduce((a, b) => a + b.revisiKlien, 0) },
    teratas: dgnRevisi.slice(0, 20), perBulan: [...perBulan.values()].sort((a, b) => a.bulan.localeCompare(b.bulan)),
  }
}

// ── Tren (OGS HomeChartSeriesService: grain minggu/bulan) — order masuk, selesai, revisi ─────────────────────────────────
function awalMingguWIB(d) { const w = new Date(new Date(d).getTime() + 7 * 3600000); const dow = (w.getUTCDay() + 6) % 7; w.setUTCDate(w.getUTCDate() - dow); return w.toISOString().slice(0, 10) }
export function susunTren({ orders, grain = 'minggu', jumlah = 12, sekarang }) {
  const kunci = (d) => (grain === 'bulan' ? kunciTanggalWIB(d).slice(0, 7) : awalMingguWIB(d))
  const daftar = []
  const cur = new Date(sekarang)
  for (let i = jumlah - 1; i >= 0; i--) {
    const d = new Date(cur)
    if (grain === 'bulan') d.setUTCMonth(d.getUTCMonth() - i, 1); else d.setUTCDate(d.getUTCDate() - i * 7)
    const k = kunci(d); if (!daftar.includes(k)) daftar.push(k)
  }
  const idx = new Map(daftar.map(k => [k, { kunci: k, masuk: 0, selesai: 0, revisi: 0 }]))
  for (const o of orders) {
    const m = idx.get(kunci(o.tanggalMasuk)); if (m) { m.masuk += 1; m.revisi += o.revisiKe ?? 0 }
    if (o.tanggalSelesai) { const s = idx.get(kunci(o.tanggalSelesai)); if (s) s.selesai += 1 }
  }
  return { grain, titik: daftar.map(k => idx.get(k)) }
}
