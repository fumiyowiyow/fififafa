import prisma from '../prisma.js'
import { Prisma } from '@prisma/client'
import { atasanLingkup, kelolaStudio } from '../utils/roles.js'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { peranKerja, studioBolehDilihat, peranStudio, saringAkun } from './circle.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import * as H from '../utils/kehadiran.js'
import { jamKerjaUnit, jadwalUnit, unitPresensi, jadwalKeTeks, validasiJadwal, keMenit, NAMA_HARI } from '../utils/jamKerjaUnit.js'
import { statusAwal, validasiAturan, hitungLembur, validasiProgres, nilaiLevel, MODE_LEMBUR, MODE_JAM, pilihanMode, PEMBULATAN, ATURAN_BAWAAN } from '../utils/lembur.js'

// KEHADIRAN web circle (20 Okt 2026) — adaptasi OGS: presensi (masuk/keluar-kembali/pulang, WFO/WFA), cuti + persetujuan, lembur (otomatis
// dari jam pulang + manual), roster/rekap/terlambat untuk koordinator, kalender kerja (libur/WFA, acara berulang), check-in harian.
// Data pribadi: milik sendiri hanya dilihat orangnya; koordinator unit melihat roster/rekap unitnya. Check-in harian PRIBADI: koordinator hanya
// melihat partisipasi + agregat (bukan emosi per orang). Jam & tanggal WIB.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const atasanWeb = (req, web) => atasanLingkup(peranKerja(req), web.lingkup) // Kepala Circle/Rumah Usaha alamat INI ke atas (21 Okt 2026)
const dt = (s) => new Date(s + 'T00:00:00.000Z')
const tglOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(dt(s))
const bulanOk = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(b ?? '')
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'

/** Hanya untuk web circle (token circle terikat alamat). */
async function sesi(req, res) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  return web
}
async function hariKhususMap(dari, sampai) {
  const baris = await prisma.hariLiburKerja.findMany({ where: { tanggal: { gte: dt(dari), lte: dt(sampai) } }, select: { tanggal: true, jenis: true } })
  return new Map(baris.map(b => [ISO(b.tanggal), b.jenis]))
}
const rapiEvent = (e) => ({ id: e.id, jenis: e.jenis, jenisKeluar: e.jenisKeluar, label: e.jenisKeluar ? H.JENIS_KELUAR[e.jenisKeluar] : null, modeKerja: e.modeKerja, lokasiWfa: e.lokasiWfa, waktu: H.jamTeks(e.dicatatPada), catatan: e.catatan })
const rapiCuti = (c) => ({ id: c.id, jenis: c.jenis, label: H.JENIS_CUTI[c.jenis], mulai: ISO(c.mulai), selesai: ISO(c.selesai), durasi: c.durasi, labelDurasi: H.DURASI_CUTI[c.durasi], alasan: c.alasan, status: c.status, ditinjauOleh: c.ditinjauOleh, ditinjauPada: c.ditinjauPada, catatanPeninjau: c.catatanPeninjau, diajukan: c.createdAt })

/** Ringkasan satu orang satu hari dari data yang sudah dimuat (dipakai hari-ini, riwayat, roster). */
function ringkasHari({ tgl, hariIni, events, cuti, lembur, hariKhusus, sekarang = new Date(), jadwal }) {
  const ss = H.statusSesi(events)
  const disetujui = cuti.find(c => c.status === 'DISETUJUI' && H.cutiMencakup(c, tgl)) ?? null
  const menunggu = cuti.find(c => c.status === 'MENUNGGU' && H.cutiMencakup(c, tgl)) ?? null
  const masuk = ss.masuk?.dicatatPada ?? null, pulang = ss.pulang?.dicatatPada ?? null
  const pasang = H.pasangKeluar(events, sekarang)
  const potongan = H.potonganIstirahat({ tgl, masuk, pulang, pasang, sekarang, hariKhusus, jadwal })
  // Lupa pulang (11 Nov 2026, laporan tim: 188 jam): sesi hari LAMPAU tanpa jam pulang tidak dihitung sampai "sekarang" — jamnya tak diketahui sampai dikoreksi koordinator
  const lupaPulang = !!masuk && !pulang && tgl < hariIni
  const kerja = lupaPulang ? 0 : H.menitKerjaBersih({ masuk, pulang, potongan, sekarang })
  const jam = H.jamResmi(tgl, hariKhusus, jadwal)
  const status = H.statusPresensi({ tgl, hariIni, sesi: ss, cutiDisetujui: disetujui, cutiMenunggu: menunggu, adaMasuk: !!masuk, hariKhusus })
  const totalLembur = lembur.reduce((s, l) => s + l.menit, 0)
  return {
    tanggal: tgl, jenisHari: H.jenisHari(tgl, hariKhusus), status, labelStatus: H.LABEL_STATUS[status] ?? status, sesi: ss.status,
    modeKerja: ss.masuk?.modeKerja ?? null, lokasiWfa: ss.masuk?.lokasiWfa ? H.LOKASI_WFA[ss.masuk.lokasiWfa] : null, jamResmi: jam?.label ?? null, jamIstirahat: jam?.labelIstirahat ?? null,
    masuk: masuk ? H.jamTeks(masuk) : null, pulang: pulang ? H.jamTeks(pulang) : null, pulangOtomatis: !!ss.pulang?.otomatis,
    menitKerja: kerja, labelKerja: lupaPulang ? 'Lupa pulang' : H.formatMenit(kerja), lupaPulang, menitKeluar: H.ringkasKeluar(pasang).total, labelKeluar: H.formatMenit(H.ringkasKeluar(pasang).total), istirahatOtomatis: potongan.info ? { ...potongan.info, label: H.formatMenit(potongan.otomatis) } : null,
    pasanganKeluar: pasang.map(p => ({ label: p.label, keluar: H.jamTeks(p.keluar), kembali: p.kembali ? H.jamTeks(p.kembali) : null, menit: p.menit, berjalan: !!p.berjalan })),
    menitLembur: totalLembur, labelLembur: H.formatMenit(totalLembur), lembur: lembur.map(l => ({ id: l.id, sumber: l.sumber, status: l.status, mulai: H.jamTeks(l.mulai), selesai: H.jamTeks(l.selesai), menit: l.menit, label: H.formatMenit(l.menit), catatan: l.catatan, catatanPeninjau: l.catatanPeninjau })),
    bisaCatatLembur: ss.status === 'pulang' || H.hariLibur(tgl, hariKhusus),
    cutiDisetujui: disetujui ? rapiCuti(disetujui) : null, cutiMenunggu: menunggu ? rapiCuti(menunggu) : null,
    lini: events.map(rapiEvent),
  }
}
async function muatHari(userId, dari, sampai) {
  const [events, cuti, lembur] = await Promise.all([
    prisma.kehadiranEvent.findMany({ where: { userId, tanggalKerja: { gte: dt(dari), lte: dt(sampai) } }, orderBy: [{ dicatatPada: 'asc' }, { id: 'asc' }] }),
    prisma.cutiKehadiran.findMany({ where: { userId, mulai: { lte: dt(sampai) }, selesai: { gte: dt(dari) } } }),
    prisma.lemburKehadiran.findMany({ where: { userId, tanggalKerja: { gte: dt(dari), lte: dt(sampai) } }, orderBy: { mulai: 'asc' } }),
  ])
  return { events, cuti, lembur }
}
// Jadwal yang berlaku untuk presensi seseorang pada hari itu (16 Nov 2026): unit di presensi MASUK → unit di sidebar → satu-satunya unitnya → bawaan
async function jadwalHari(req, web, events, diminta) {
  const masuk = events.find(e => e.jenis === 'MASUK')
  const studioId = await unitPresensi(req.user.id, { studioMasuk: masuk?.studioId ?? null, diminta, whereStudio: whereLingkup(web.lingkup) })
  return { studioId, ...(await jamKerjaUnit(studioId)) }
}
const per = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x) } return m }

// ══ Diri sendiri ═════════════════════════════════════════════════════════════════════════════════════════════════════════
export const getHariIni = wrap(async (req, res) => {
  const web = await sesi(req, res); if (!web) return
  const tgl = H.hariIniWIB(), hk = await hariKhususMap(tgl, tgl), m = await muatHari(req.user.id, tgl, tgl)
  const j = await jadwalHari(req, web, m.events, req.query.studioId)
  return res.json({ success: true, data: { ...ringkasHari({ tgl, hariIni: tgl, events: m.events, cuti: m.cuti, lembur: m.lembur, hariKhusus: hk, jadwal: j.jadwal }), pulangOtomatisJam: j.pulangOtomatis ? j.batasPulang : null, pilihan: { keluar: H.JENIS_KELUAR, lokasiWfa: H.LOKASI_WFA } } })
})
// Pilihan order untuk lembur manual (9 Nov 2026, lembur per project): order terbuka unit yang ia kerjakan / pegang (pengelola: semua).
// Hanya judul & klien — tanpa nilai uang.
export const getOrderLembur = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  const [p, aturan] = await Promise.all([peranStudio(req, studioId), prisma.pengaturanLembur.findUnique({ where: { studioId }, select: { mode: true } })])
  const milik = p.manajer && !p.lihatSaja ? (p.akunAdmin ? { OR: [saringAkun(p), { assignments: { some: { userId: req.user.id } } }, { marketerId: req.user.id }] } : {}) : { OR: [{ assignments: { some: { userId: req.user.id } } }, { marketerId: req.user.id }, { penugasanTahap: { some: { userId: req.user.id } } }] }
  const semua = await prisma.orderProduksi.findMany({ where: { studioId, status: { in: ['MASUK', 'PROSES'] }, ...milik }, orderBy: [{ deadline: 'asc' }, { tanggalMasuk: 'desc' }], take: 200, select: { id: true, judul: true, klien: true } })
  // Lembur diambil dari tugas yang DITUNDA (tidak masuk antrean hari itu) — 13 Nov 2026, masukan tim: tugas tunda milik orang ini ditandai & di atas
  const tunda = new Set((await prisma.penugasanTahap.findMany({ where: { userId: req.user.id, tunda: true, status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, orderId: { in: semua.map(o => o.id) } }, select: { orderId: true } })).map(t => t.orderId))
  const order = [...semua.filter(o => tunda.has(o.id)).map(o => ({ ...o, ditunda: true })), ...semua.filter(o => !tunda.has(o.id))]
  // Mode PER_LEVEL: daftar level aktif unit (tanpa fee — anggota tidak melihat tarif)
  const level = aturan?.mode === 'PER_LEVEL' ? await prisma.levelLembur.findMany({ where: { studioId, aktif: true }, orderBy: [{ urutan: 'asc' }, { nama: 'asc' }], select: { id: true, nama: true, produk: true, keterangan: true } }) : []
  const tahap = aturan?.mode === 'PER_LEVEL' ? await prisma.tahapLembur.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }, { persen: 'asc' }], select: { id: true, nama: true, persen: true } }) : []
  const wajibLevel = aturan?.mode === 'PER_LEVEL'
  return res.json({ success: true, data: { mode: aturan?.mode ?? null, wajibOrder: aturan?.mode === 'PER_PROYEK' || wajibLevel, wajibLevel, jamWajib: MODE_JAM.includes(aturan?.mode), level, tahap, order } })
})
export const catatKehadiran = wrap(async (req, res) => {
  const web = await sesi(req, res); if (!web) return
  const tgl = H.hariIniWIB(), hk = await hariKhususMap(tgl, tgl), m = await muatHari(req.user.id, tgl, tgl)
  const ss = H.statusSesi(m.events)
  const b = req.body ?? {}
  const galat = H.validasiCatat(b, { sesi: ss, tgl, hariKhusus: hk, cutiDisetujui: m.cuti.find(c => c.status === 'DISETUJUI' && H.cutiMencakup(c, tgl)), cutiMenunggu: m.cuti.find(c => c.status === 'MENUNGGU' && H.cutiMencakup(c, tgl)) })
  if (galat) return gagal(res, 422, galat)
  // unit hari ini (jadwalnya dipakai untuk jam resmi, istirahat, terlambat, lembur otomatis, pulang otomatis) — dipilih saat MASUK dari unit sidebar
  const j = await jadwalHari(req, web, m.events, b.studioId)
  const e = await prisma.kehadiranEvent.create({ data: { userId: req.user.id, studioId: j.studioId, tanggalKerja: dt(tgl), jenis: b.jenis, jenisKeluar: b.jenis === 'KELUAR' ? b.jenisKeluar : null, modeKerja: b.jenis === 'MASUK' ? b.modeKerja : null, lokasiWfa: b.jenis === 'MASUK' && b.modeKerja === 'WFA' ? b.lokasiWfa : null, catatan: b.catatan ? String(b.catatan).slice(0, 300) : null } })
  if (b.jenis === 'PULANG') { // lembur otomatis: ganti entri otomatis hari itu (OGS syncAutoOvertimeFromCheckout)
    await prisma.lemburKehadiran.deleteMany({ where: { userId: req.user.id, tanggalKerja: dt(tgl), sumber: 'OTOMATIS', penggajianId: null } })
    const l = H.lemburOtomatis({ tgl, pulang: e.dicatatPada, hariKhusus: hk, jadwal: j.jadwal })
    if (l) {
      const studioId = j.studioId ?? await unitLembur(req, web, b.studioId)
      const aturan = studioId ? await prisma.pengaturanLembur.findUnique({ where: { studioId } }) : null
      await prisma.lemburKehadiran.create({ data: { userId: req.user.id, studioId, status: statusAwal('OTOMATIS', aturan), tanggalKerja: dt(tgl), sumber: 'OTOMATIS', mulai: l.mulai, selesai: l.selesai, menit: l.menit, catatan: 'Otomatis — pulang lewat jam kerja' } })
    }
  }
  return res.status(201).json({ success: true, data: { id: e.id, waktu: H.jamTeks(e.dicatatPada) } })
})
// Unit tempat lembur dicatat (Payroll unit X hanya mengklaim lembur unit X): unit yang diminta klien bila orangnya bekerja di sana
// (dalam circle alamat ini), atau satu-satunya unitnya di sini; null bila tak bisa dipastikan (koordinator lalu menentukan saat meninjau).
async function unitLembur(req, web, diminta) {
  const kunci = whereLingkup(web.lingkup)
  const peran = await prisma.userRole.findMany({ where: { userId: req.user.id, roleType: { not: 'DIGNITY' }, studio: kunci }, select: { studioId: true } })
  const ids = [...new Set(peran.map(p => p.studioId).filter(Boolean))]
  if (diminta && ids.includes(diminta)) return diminta
  return ids.length === 1 ? ids[0] : null
}
export const catatLembur = wrap(async (req, res) => {
  const web = await sesi(req, res); if (!web) return
  const catatan = String(req.body?.catatan ?? '').trim(); if (!catatan) return gagal(res, 422, 'Catatan lembur wajib diisi')
  const studioId = await unitLembur(req, web, req.body?.studioId)
  const aturan = studioId ? await prisma.pengaturanLembur.findUnique({ where: { studioId } }) : null
  // KEPUTUSAN USER 10 Nov 2026: lembur Ekosistem = FEE tambahan untuk pekerjaan di luar jam kantor, BUKAN upah per jam. Jadi:
  // • boleh dicatat KAPAN SAJA (tanggal pekerjaan bebas, asal bukan tanggal yang akan datang) & tidak perlu presensi pulang dulu;
  // • jam mulai–selesai hanya wajib untuk mode lama berbasis jam (PER_JAM/BERTINGKAT/PER_HARI); untuk mode lain opsional (acuan saja).
  const hariIni = H.hariIniWIB()
  const tgl = req.body?.tanggal ? String(req.body.tanggal) : hariIni
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl) || isNaN(dt(tgl))) return gagal(res, 422, 'Tanggal lembur harus YYYY-MM-DD')
  if (tgl > hariIni) return gagal(res, 422, 'Tanggal lembur tidak boleh di masa depan')
  const jamWajib = MODE_JAM.includes(aturan?.mode) // unit tanpa aturan: lembur hanya dicatat (tanpa uang), jam opsional
  const adaJam = !!(req.body?.mulai && req.body?.selesai)
  if (jamWajib && !adaJam) return gagal(res, 422, 'Aturan lembur unit ini dihitung per jam — isi jam mulai & selesai')
  let v = { mulai: dt(tgl), selesai: dt(tgl), menit: 0 }
  if (adaJam) {
    v = H.validasiLemburManual({ tgl, mulai: req.body.mulai, selesai: req.body.selesai, pulang: null, libur: true }) // tanpa syarat "setelah pulang"
    if (v.galat) return gagal(res, 422, v.galat)
    if (v.menit > 16 * 60) return gagal(res, 422, 'Durasi lembur tidak masuk akal (maks 16 jam)')
  }
  // Lembur per project (9 Nov 2026): order yang dilemburkan WAJIB dipilih bila aturan unit PER_PROYEK (opsional untuk mode lain);
  // nilainya diisi koordinator saat menyetujui, jadi lembur PER_PROYEK selalu MENUNGGU.
  let orderId = null
  if (req.body?.orderId) {
    const o = await prisma.orderProduksi.findUnique({ where: { id: String(req.body.orderId) }, select: { studioId: true } })
    if (!o || o.studioId !== studioId) return gagal(res, 422, 'Order bukan milik unit ini')
    orderId = String(req.body.orderId)
  }
  if ((aturan?.mode === 'PER_PROYEK' || aturan?.mode === 'PER_LEVEL') && !orderId) return gagal(res, 422, 'Pilih order/project yang dilemburkan')
  // Mode PER_LEVEL (9 Nov 2026): level pekerjaan + progres awal–akhir wajib; fee level DIKUNCI sekarang (ubah daftar level nanti tak mengubah catatan ini)
  let lv = {}
  if (aturan?.mode === 'PER_LEVEL') {
    const level = req.body?.levelId ? await prisma.levelLembur.findUnique({ where: { id: String(req.body.levelId) } }) : null
    if (!level || level.studioId !== studioId || !level.aktif) return gagal(res, 422, 'Pilih level pekerjaan yang masih aktif di unit ini')
    const pr = validasiProgres(req.body?.progresAwal, req.body?.progresAkhir); if (pr.galat) return gagal(res, 422, pr.galat)
    lv = { levelId: level.id, levelNama: level.produk ? `${level.nama} — ${level.produk}` : level.nama, feeLevel: level.fee, progresAwal: pr.awal, progresAkhir: pr.akhir }
  }
  // Lembur manual diisi sendiri → MENUNGGU persetujuan koordinator unit (bawaan), kecuali aturan unit menyatakan tidak perlu
  const status = aturan?.mode === 'PER_PROYEK' || aturan?.mode === 'PER_LEVEL' ? 'MENUNGGU' : statusAwal('MANUAL', aturan)
  const l = await prisma.lemburKehadiran.create({ data: { userId: req.user.id, studioId, status, tanggalKerja: dt(tgl), sumber: 'MANUAL', mulai: v.mulai, selesai: v.selesai, menit: v.menit, catatan: catatan.slice(0, 300), orderId, ...lv } })
  return res.status(201).json({ success: true, data: { id: l.id, menit: v.menit, status }, message: status === 'MENUNGGU' ? 'Lembur dicatat — menunggu persetujuan koordinator' : 'Lembur dicatat' })
})
export const getRiwayat = wrap(async (req, res) => {
  const web = await sesi(req, res); if (!web) return
  const hari = Math.min(62, Math.max(1, Number(req.query.hari) || 30))
  const hariIni = H.hariIniWIB(), awal = new Date(dt(hariIni).getTime() - (hari - 1) * 86400000).toISOString().slice(0, 10)
  const [hk, m] = await Promise.all([hariKhususMap(awal, hariIni), muatHari(req.user.id, awal, hariIni)])
  const evPer = per(m.events, e => ISO(e.tanggalKerja)), lbPer = per(m.lembur, l => ISO(l.tanggalKerja))
  const jadwalCache = new Map(), jadwalDari = async (ev) => { const k = ev.find(e => e.jenis === 'MASUK')?.studioId ?? '-'; if (!jadwalCache.has(k)) jadwalCache.set(k, (await jadwalHari(req, web, ev, req.query.studioId)).jadwal); return jadwalCache.get(k) }
  const baris = []
  for (let i = 0; i < hari; i++) { const tgl = new Date(dt(hariIni).getTime() - i * 86400000).toISOString().slice(0, 10); const ev = evPer.get(tgl) ?? []; const r = ringkasHari({ tgl, hariIni, events: ev, cuti: m.cuti, lembur: lbPer.get(tgl) ?? [], hariKhusus: hk, jadwal: await jadwalDari(ev) }); baris.push({ tanggal: tgl, status: r.status, labelStatus: r.labelStatus, modeKerja: r.modeKerja, lokasiWfa: r.lokasiWfa, masuk: r.masuk, pulang: r.pulang, pulangOtomatis: r.pulangOtomatis, labelKerja: r.labelKerja, menitKerja: r.menitKerja, lupaPulang: r.lupaPulang, labelLembur: r.labelLembur, cuti: r.cutiDisetujui }) }
  return res.json({ success: true, data: baris })
})

// ── Cuti / izin ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const getCutiSaya = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const c = await prisma.cutiKehadiran.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 60 })
  return res.json({ success: true, data: { cuti: c.map(rapiCuti), pilihan: { jenis: H.JENIS_CUTI, durasi: H.DURASI_CUTI } } })
})
export const ajukanCuti = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const b = req.body ?? {}
  if (!Object.keys(H.JENIS_CUTI).includes(b.jenis)) return gagal(res, 422, `jenis harus salah satu: ${Object.keys(H.JENIS_CUTI).join(', ')}`)
  if (!Object.keys(H.DURASI_CUTI).includes(b.durasi ?? 'SEHARI')) return gagal(res, 422, 'durasi tidak dikenal')
  if (!tglOk(b.mulai) || !tglOk(b.selesai)) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (b.selesai < b.mulai) return gagal(res, 422, 'Tanggal selesai tidak boleh sebelum tanggal mulai.')
  if ((new Date(b.selesai) - new Date(b.mulai)) / 86400000 > 60) return gagal(res, 422, 'Rentang izin maksimal 60 hari')
  const alasan = String(b.alasan ?? '').trim(); if (!alasan || alasan.length > 500) return gagal(res, 422, 'Alasan wajib diisi (maks 500 huruf)')
  const ada = await prisma.cutiKehadiran.findMany({ where: { userId: req.user.id, status: { in: ['MENUNGGU', 'DISETUJUI'] }, mulai: { lte: dt(b.selesai) }, selesai: { gte: dt(b.mulai) } } })
  if (ada.length) return gagal(res, 422, 'Sudah ada pengajuan izin pada rentang tanggal ini.')
  const tgl = H.hariIniWIB()
  if (b.mulai <= tgl && b.selesai >= tgl && (b.durasi ?? 'SEHARI') === 'SEHARI') { const m = await muatHari(req.user.id, tgl, tgl); if (H.statusSesi(m.events).status !== 'belum_hadir') return gagal(res, 422, 'Kamu sudah presensi hari ini, tidak bisa mengajukan izin seharian.') }
  const c = await prisma.cutiKehadiran.create({ data: { userId: req.user.id, jenis: b.jenis, mulai: dt(b.mulai), selesai: dt(b.selesai), durasi: b.durasi ?? 'SEHARI', alasan } })
  return res.status(201).json({ success: true, data: rapiCuti(c) })
})
export const batalkanCuti = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const c = await prisma.cutiKehadiran.findUnique({ where: { id: req.params.id } })
  if (!c || c.userId !== req.user.id) return gagal(res, 404, 'Pengajuan tidak ditemukan')
  if (c.status !== 'MENUNGGU') return gagal(res, 409, 'Hanya pengajuan yang masih menunggu yang bisa dibatalkan')
  await prisma.cutiKehadiran.update({ where: { id: c.id }, data: { status: 'DIBATALKAN' } })
  return res.json({ success: true, message: 'Pengajuan dibatalkan' })
})

// ══ Koordinator unit ═════════════════════════════════════════════════════════════════════════════════════════════════════
async function manajerUnit(req, res, studioId) {
  if (!(await sesi(req, res))) return false
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return false }
  const p = await peranStudio(req, studioId)
  // Presensi tim, rekap, keterlambatan, check-in & kotak izin = urusan SDM → bukan untuk pemegang akses Admin Market (27 Okt 2026)
  if (!p.manajer || p.adminMarket) { gagal(res, 403, 'Hanya Koordinator ke atas'); return false }
  return true
}
// Penyetuju: orang yang mengelola (manajer) SALAH SATU unit tempat pemohon berperan; tidak boleh menyetujui dirinya sendiri
export async function bolehMeninjau(req, userIdPemohon) {
  if (userIdPemohon === req.user.id) return false
  const peran = await prisma.userRole.findMany({ where: { userId: userIdPemohon, studioId: { not: null }, roleType: { not: 'DIGNITY' } }, select: { studioId: true } })
  // pemilik (lihat saja) & Admin Market BUKAN peninjau: refleksi, profil SDM & izin orang lain adalah data pribadi
  for (const sid of new Set(peran.map(p => p.studioId))) { if (!(await studioBolehDilihat(req, sid))) continue; const p = await peranStudio(req, sid); if (p.pengelola) return true }
  return false
}
export const getKotakCuti = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await manajerUnit(req, res, studioId))) return
  if ((await peranStudio(req, studioId)).lihatSaja) return gagal(res, 403, 'Alasan izin bersifat pribadi — hanya untuk koordinator unit')
  const anggota = await anggotaStudio(studioId)
  const ids = [...anggota.keys()]
  const [menunggu, riwayat] = await Promise.all([
    prisma.cutiKehadiran.findMany({ where: { userId: { in: ids }, status: 'MENUNGGU' }, orderBy: { createdAt: 'asc' } }),
    prisma.cutiKehadiran.findMany({ where: { userId: { in: ids }, status: { in: ['DISETUJUI', 'DITOLAK'] } }, orderBy: { ditinjauPada: 'desc' }, take: 40 }),
  ])
  const peta = (c) => ({ ...rapiCuti(c), pemohon: anggota.get(c.userId) ?? '—', pemohonId: c.userId })
  return res.json({ success: true, data: { menunggu: menunggu.map(peta), riwayat: riwayat.map(peta) } })
})
const tinjau = (setuju) => wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const c = await prisma.cutiKehadiran.findUnique({ where: { id: req.params.id } })
  if (!c) return gagal(res, 404, 'Pengajuan tidak ditemukan')
  if (!(await bolehMeninjau(req, c.userId))) return gagal(res, 403, 'Kamu tidak berwenang meninjau pengajuan ini')
  if (c.status !== 'MENUNGGU') return gagal(res, 409, 'Pengajuan ini sudah diproses.')
  const catatan = String(req.body?.catatan ?? '').trim()
  if (!setuju && !catatan) return gagal(res, 422, 'Alasan penolakan wajib diisi')
  await prisma.cutiKehadiran.update({ where: { id: c.id }, data: { status: setuju ? 'DISETUJUI' : 'DITOLAK', ditinjauOlehId: req.user.id, ditinjauOleh: await namaPengguna(req), ditinjauPada: new Date(), catatanPeninjau: catatan ? catatan.slice(0, 500) : null } })
  return res.json({ success: true, message: setuju ? 'Izin disetujui' : 'Izin ditolak' })
})
export const setujuiCuti = tinjau(true)
export const tolakCuti = tinjau(false)

// ══ Aturan & persetujuan lembur per unit (21 Okt 2026) ═════════════════════════════════════════════════════════════════════
// Koordinator unit ke atas (bukan Admin Market) menentukan aturan lembur unitnya sendiri dan meninjau lembur anggota. Payroll Ekosistem
// menghitung uang lembur dari aturan ini dan hanya untuk lembur DISETUJUI milik unit tersebut.
async function pengelolaLembur(req, res, studioId) {
  if (!(await sesi(req, res))) return false
  if (!studioId || !(await studioBolehDilihat(req, studioId)) || !(await kelolaStudio(peranKerja(req), studioId))) { gagal(res, 403, 'Aturan & persetujuan lembur hanya untuk Koordinator ke atas unit ini'); return false }
  return true
}
const rapiAturan = (a) => ({ ...ATURAN_BAWAAN, ...(a ? { mode: a.mode, tarifPerJam: a.tarifPerJam, tingkat: a.tingkat, tarifPerHari: a.tarifPerHari, pengaliLibur: a.pengaliLibur, minimalMenit: a.minimalMenit, pembulatanMenit: a.pembulatanMenit, batasJamBulanan: a.batasJamBulanan, perluPersetujuan: a.perluPersetujuan, otomatisPerluSetuju: a.otomatisPerluSetuju, catatan: a.catatan } : {}), tersimpan: !!a, diubahOleh: a?.diubahOleh ?? null, diperbarui: a?.updatedAt ?? null })
export const getAturanLembur = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await pengelolaLembur(req, res, studioId))) return
  const a = await prisma.pengaturanLembur.findUnique({ where: { studioId } })
  return res.json({ success: true, data: { aturan: rapiAturan(a), pilihan: { mode: pilihanMode(a?.mode ?? null), pembulatan: PEMBULATAN } } })
})
export const simpanAturanLembur = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await pengelolaLembur(req, res, studioId))) return
  const v = validasiAturan(req.body ?? {}); if (v.galat) return gagal(res, 422, v.galat)
  const oleh = await namaPengguna(req)
  const data = { ...v.data, tingkat: v.data.tingkat ?? Prisma.DbNull, diubahOleh: oleh }
  const a = await prisma.pengaturanLembur.upsert({ where: { studioId }, update: data, create: { studioId, ...data } })
  return res.json({ success: true, data: { aturan: rapiAturan(a) }, message: 'Aturan lembur unit disimpan' })
})
// JAM KERJA UNIT (16 Nov 2026, masukan tim): dilihat & diatur Koordinator/Pendamping unit (pengelolaLembur — bukan Admin Market).
const rapiJam = (j) => ({ jadwal: jadwalKeTeks(j.jadwal), diatur: j.diatur, pulangOtomatis: j.pulangOtomatis, batasPulang: j.batasPulang, aktifSejak: j.aktifSejak, diubahOleh: j.diubahOleh, diubahPada: j.updatedAt, hari: NAMA_HARI })
export const getJamKerja = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await pengelolaLembur(req, res, studioId))) return
  return res.json({ success: true, data: rapiJam(await jamKerjaUnit(studioId)) })
})
export const simpanJamKerja = wrap(async (req, res) => {
  const { studioId, jadwal, pulangOtomatis, batasPulang } = req.body ?? {}
  if (!(await pengelolaLembur(req, res, studioId))) return
  if (req.user?.imp) return gagal(res, 403, 'Tidak bisa saat menyamar')
  const v = validasiJadwal(jadwal); if (v.galat) return gagal(res, 422, v.galat)
  const nyala = pulangOtomatis === true
  if (nyala) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(batasPulang ?? '')) return gagal(res, 422, 'Isi jam pulang otomatis (HH:MM)')
    const terakhir = Math.max(...Object.values(v.data).filter(Boolean).map(h => keMenit(h.kerja[1])))
    if (keMenit(batasPulang) < terakhir) return gagal(res, 422, 'Jam pulang otomatis tidak boleh lebih awal dari jam pulang resmi')
  }
  const lama = await prisma.jamKerjaUnit.findUnique({ where: { studioId } })
  const data = { jadwal: v.data, pulangOtomatis: nyala, batasPulang: nyala ? batasPulang : null, aktifSejak: nyala ? (lama?.pulangOtomatis && lama.aktifSejak ? lama.aktifSejak : new Date()) : null, diubahOleh: await namaPengguna(req) }
  await prisma.jamKerjaUnit.upsert({ where: { studioId }, update: data, create: { studioId, ...data } })
  return res.json({ success: true, data: rapiJam(await jamKerjaUnit(studioId)), message: 'Jam kerja unit disimpan' })
})

// Daftar level lembur unit (mode PER_LEVEL) — hanya pengelola unit
const rapiLevel = (l) => ({ id: l.id, nama: l.nama, produk: l.produk, keterangan: l.keterangan, fee: l.fee, aktif: l.aktif })
export const getLevelLembur = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await pengelolaLembur(req, res, studioId))) return
  const l = await prisma.levelLembur.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }, { nama: 'asc' }] })
  return res.json({ success: true, data: { level: l.map(rapiLevel) } })
})
// Simpan seluruh daftar: baris ber-id = ubah; tanpa id = tambah; level yang tak ada di daftar dinonaktifkan (bukan dihapus — catatan lama tetap utuh).
export const simpanLevelLembur = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await pengelolaLembur(req, res, studioId))) return
  const masuk = Array.isArray(req.body?.level) ? req.body.level : []
  if (masuk.length > 40) return gagal(res, 422, 'Maksimal 40 level')
  const rapi = [], nama = new Set()
  for (const [i, x] of masuk.entries()) {
    const n = String(x?.nama ?? '').trim().slice(0, 60), fee = Number(x?.fee)
    if (!n) return gagal(res, 422, `Level ${i + 1}: nama wajib diisi`)
    const produk = String(x?.produk ?? '').trim().slice(0, 40), kunci = `${n.toLowerCase()}|${produk.toLowerCase()}`
    if (nama.has(kunci)) return gagal(res, 422, `Level "${n}"${produk ? ` untuk produk ${produk}` : ''} dobel`)
    nama.add(kunci)
    if (!Number.isFinite(fee) || fee < 0 || fee > 100000000) return gagal(res, 422, `Level "${n}": fee harus angka 0–100.000.000`)
    rapi.push({ id: x?.id ? String(x.id) : null, nama: n, produk, keterangan: x?.keterangan ? String(x.keterangan).slice(0, 120) : null, fee: Math.round(fee), aktif: x?.aktif !== false, urutan: i })
  }
  const ada = await prisma.levelLembur.findMany({ where: { studioId } })
  const idAda = new Map(ada.map(a => [a.id, a]))
  for (const r of rapi) if (r.id && !idAda.has(r.id)) return gagal(res, 422, 'Ada level yang bukan milik unit ini')
  await prisma.$transaction(async (tx) => {
    // kosongkan nama dulu agar tukar-nama antar level tidak bentrok pada @@unique([studioId, nama])
    for (const a of ada) await tx.levelLembur.update({ where: { id: a.id }, data: { nama: `~${a.id}`, produk: '', aktif: false } })
    for (const r of rapi) {
      const data = { nama: r.nama, produk: r.produk, keterangan: r.keterangan, fee: r.fee, aktif: r.aktif, urutan: r.urutan }
      if (r.id) await tx.levelLembur.update({ where: { id: r.id }, data })
      else await tx.levelLembur.create({ data: { studioId, ...data } })
    }
    for (const a of ada) if (!rapi.some(r => r.id === a.id)) await tx.levelLembur.update({ where: { id: a.id }, data: { nama: `${a.nama} (nonaktif ${a.id.slice(-4)})`, produk: a.produk } })
  })
  const l = await prisma.levelLembur.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }, { nama: 'asc' }] })
  return res.json({ success: true, data: { level: l.map(rapiLevel) }, message: 'Daftar level lembur disimpan' })
})
// Tahap pekerjaan unit (pilihan cepat progres) — hanya pengelola unit; PUT mengganti seluruh daftar
export const getTahapLembur = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await pengelolaLembur(req, res, studioId))) return
  const t = await prisma.tahapLembur.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }, { persen: 'asc' }], select: { id: true, nama: true, persen: true } })
  return res.json({ success: true, data: { tahap: t } })
})
export const simpanTahapLembur = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await pengelolaLembur(req, res, studioId))) return
  const masuk = Array.isArray(req.body?.tahap) ? req.body.tahap : []
  if (masuk.length > 20) return gagal(res, 422, 'Maksimal 20 tahap')
  const nama = new Set(), rapi = []
  for (const [i, x] of masuk.entries()) {
    const n = String(x?.nama ?? '').trim().slice(0, 40), p = Number(x?.persen)
    if (!n) return gagal(res, 422, `Tahap ${i + 1}: nama wajib diisi`)
    if (nama.has(n.toLowerCase())) return gagal(res, 422, `Tahap "${n}" dobel`)
    nama.add(n.toLowerCase())
    if (!Number.isFinite(p) || p < 0 || p > 100) return gagal(res, 422, `Tahap "${n}": persen harus 0–100`)
    rapi.push({ studioId, nama: n, persen: Math.round(p), urutan: i })
  }
  await prisma.$transaction([prisma.tahapLembur.deleteMany({ where: { studioId } }), prisma.tahapLembur.createMany({ data: rapi })])
  const t = await prisma.tahapLembur.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }, { persen: 'asc' }], select: { id: true, nama: true, persen: true } })
  return res.json({ success: true, data: { tahap: t }, message: 'Daftar tahap disimpan' })
})
/** Lembur bulan ini milik unit: tercatat di unit ini, atau belum berunit tapi orangnya anggota unit ini. */
async function lemburUnit(studioId, bulan) {
  const anggota = await anggotaStudio(studioId), ids = [...anggota.keys()]
  const awal = dt(bulan + '-01'), akhir = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5)), 1))
  const baris = await prisma.lemburKehadiran.findMany({ where: { tanggalKerja: { gte: awal, lt: akhir }, OR: [{ studioId }, { studioId: null, userId: { in: ids } }] }, orderBy: [{ tanggalKerja: 'asc' }, { mulai: 'asc' }] })
  return { anggota, baris, awal, akhir }
}
export const getUsulanLembur = wrap(async (req, res) => {
  const { studioId } = req.query, bulan = req.query.bulan ?? H.hariIniWIB().slice(0, 7)
  if (!(await pengelolaLembur(req, res, studioId))) return
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const [{ anggota, baris }, aturan] = await Promise.all([lemburUnit(studioId, bulan), prisma.pengaturanLembur.findUnique({ where: { studioId } })])
  const akhirBulan = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5)), 0)).toISOString().slice(0, 10)
  const hk = await hariKhususMap(bulan + '-01', akhirBulan)
  const namaLain = new Map((await prisma.user.findMany({ where: { id: { in: baris.map(b => b.userId).filter(id => !anggota.has(id)) } }, select: { id: true, nama: true } })).map(u => [u.id, u.nama]))
  const nama = (id) => anggota.get(id) ?? namaLain.get(id) ?? '—'
  const perOrang = new Map(); for (const b of baris) { if (!perOrang.has(b.userId)) perOrang.set(b.userId, []); perOrang.get(b.userId).push(b) }
  const orang = [...perOrang].map(([userId, l]) => ({ userId, nama: nama(userId), ...hitungLembur(l, aturan, hk), menunggu: l.filter(x => x.status === 'MENUNGGU').length, rincian: undefined })).sort((a, b) => b.menunggu - a.menunggu || a.nama.localeCompare(b.nama, 'id'))
  const judulOrder = new Map((await prisma.orderProduksi.findMany({ where: { id: { in: baris.map(b => b.orderId).filter(Boolean) } }, select: { id: true, judul: true } })).map(o => [o.id, o.judul]))
  return res.json({ success: true, data: {
    bulan, aturan: rapiAturan(aturan), orang,
    baris: baris.map(b => ({ id: b.id, userId: b.userId, nama: nama(b.userId), tanggal: ISO(b.tanggalKerja), sumber: b.sumber, status: b.status, mulai: H.jamTeks(b.mulai), selesai: H.jamTeks(b.selesai), menit: b.menit, label: H.formatMenit(b.menit), catatan: b.catatan, ditinjauOleh: b.ditinjauOleh, catatanPeninjau: b.catatanPeninjau, terklaim: !!b.penggajianId, tanpaUnit: !b.studioId, milikSaya: b.userId === req.user.id, orderId: b.orderId, order: b.orderId ? (judulOrder.get(b.orderId) ?? '—') : null, nilaiProyek: b.nilaiProyek, levelNama: b.levelNama ?? null, progresAwal: b.progresAwal != null ? Math.round(b.progresAwal * 100) : null, progresAkhir: b.progresAkhir != null ? Math.round(b.progresAkhir * 100) : null, nilaiUsulan: b.feeLevel != null && b.progresAwal != null && b.progresAkhir != null ? nilaiLevel(b.feeLevel, b.progresAwal, b.progresAkhir) : null })),
    catatan: 'Uang di sini perkiraan dari aturan unit; angka final dihitung Payroll di Management Dashboard saat Generate (hanya lembur DISETUJUI, sekali klaim).',
  } })
})
const tinjauLembur = (setuju) => wrap(async (req, res) => {
  const l = await prisma.lemburKehadiran.findUnique({ where: { id: req.params.id } })
  if (!l) return gagal(res, 404, 'Lembur tidak ditemukan')
  const studioId = l.studioId ?? req.body?.studioId
  if (!(await pengelolaLembur(req, res, studioId))) return
  if (!l.studioId && !(await anggotaStudio(studioId)).has(l.userId)) return gagal(res, 422, 'Orang ini bukan anggota unit tersebut')
  if (l.userId === req.user.id) return gagal(res, 403, 'Tidak bisa meninjau lembur sendiri')
  if (l.penggajianId) return gagal(res, 409, 'Lembur ini sudah masuk slip gaji — ubah lewat Payroll di Management Dashboard')
  const catatan = String(req.body?.catatan ?? '').trim()
  if (!setuju && !catatan) return gagal(res, 422, 'Alasan penolakan wajib diisi')
  // PER_PROYEK: koordinator mengisi nilai lembur order ini saat menyetujui (9 Nov 2026)
  let nilaiProyek
  if (setuju) {
    const aturan = await prisma.pengaturanLembur.findUnique({ where: { studioId }, select: { mode: true } })
    if (aturan?.mode === 'PER_LEVEL' && l.feeLevel != null && l.progresAwal != null && l.progresAkhir != null && (req.body?.nilai == null || req.body?.nilai === '')) {
      nilaiProyek = nilaiLevel(l.feeLevel, l.progresAwal, l.progresAkhir) // otomatis: fee level × progres; koordinator boleh menimpa lewat `nilai`
    } else if (aturan?.mode === 'PER_PROYEK' || aturan?.mode === 'PER_LEVEL') {
      const n = Number(req.body?.nilai)
      if (req.body?.nilai == null || req.body?.nilai === '' || !Number.isFinite(n) || n < 0 || n > 100000000) return gagal(res, 422, 'Isi nilai lembur untuk order ini (Rp, 0 bila tidak dibayar)')
      nilaiProyek = Math.round(n)
    }
  }
  await prisma.lemburKehadiran.update({ where: { id: l.id }, data: { studioId, status: setuju ? 'DISETUJUI' : 'DITOLAK', ditinjauOlehId: req.user.id, ditinjauOleh: await namaPengguna(req), ditinjauPada: new Date(), catatanPeninjau: catatan ? catatan.slice(0, 300) : null, ...(nilaiProyek !== undefined ? { nilaiProyek } : {}) } })
  return res.json({ success: true, message: setuju ? 'Lembur disetujui' : 'Lembur ditolak' })
})
export const setujuiLembur = tinjauLembur(true)
export const tolakLembur = tinjauLembur(false)

export const getRoster = wrap(async (req, res) => {
  const { studioId } = req.query, tgl = req.query.tanggal ?? H.hariIniWIB()
  if (!(await manajerUnit(req, res, studioId))) return
  if (!tglOk(tgl)) return gagal(res, 422, 'tanggal harus YYYY-MM-DD')
  const anggota = await anggotaStudio(studioId), ids = [...anggota.keys()]
  const [hk, events, cuti] = await Promise.all([hariKhususMap(tgl, tgl), prisma.kehadiranEvent.findMany({ where: { userId: { in: ids }, tanggalKerja: dt(tgl), jenis: 'MASUK' }, orderBy: { dicatatPada: 'asc' } }), prisma.cutiKehadiran.findMany({ where: { userId: { in: ids }, status: 'DISETUJUI', mulai: { lte: dt(tgl) }, selesai: { gte: dt(tgl) } } })])
  const pertama = new Map(); for (const e of events) if (!pertama.has(e.userId)) pertama.set(e.userId, e)
  const jam = H.jamResmi(tgl, hk, await jadwalUnit(studioId)), jh = H.jenisHari(tgl, hk), hariIni = H.hariIniWIB() // jam kerja unit ini (16 Nov 2026)
  const hadir = [], terlambat = [], izin = [], bolos = []
  for (const [id, nama] of anggota) {
    const c = cuti.find(x => x.userId === id), e = pertama.get(id)
    if (c?.durasi === 'SEHARI' && !e) { izin.push({ userId: id, nama, jenis: H.JENIS_CUTI[c.jenis] }); continue }
    if (e) { const telat = jam && new Date(e.dicatatPada) > jam.mulai; const baris = { userId: id, nama, masuk: H.jamTeks(e.dicatatPada), modeKerja: e.modeKerja, terlambat: !!telat, menitTerlambat: telat ? Math.round((new Date(e.dicatatPada) - jam.mulai) / 60000) : 0 }; hadir.push(baris); if (telat) terlambat.push(baris); continue }
    if (['LIBUR', 'LIBUR_MINGGU', 'WFA'].includes(jh) || tgl > hariIni) continue
    bolos.push({ userId: id, nama })
  }
  return res.json({ success: true, data: { tanggal: tgl, jenisHari: jh, jamResmi: jam?.label ?? null, jumlah: { anggota: anggota.size, hadir: hadir.length, terlambat: terlambat.length, izin: izin.length, tidakHadir: bolos.length }, hadir, terlambat, izin, tidakHadir: bolos } })
})
async function dataBulan(studioId, bulan) {
  const awal = bulan + '-01', akhirBulan = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5)), 0)).toISOString().slice(0, 10), hariIni = H.hariIniWIB()
  const akhir = akhirBulan > hariIni ? hariIni : akhirBulan
  const anggota = await anggotaStudio(studioId), ids = [...anggota.keys()]
  const rentang = []; for (let t = awal; t <= akhir; t = new Date(dt(t).getTime() + 86400000).toISOString().slice(0, 10)) rentang.push(t)
  const [hk, events, cuti, lembur] = await Promise.all([hariKhususMap(awal, akhir), prisma.kehadiranEvent.findMany({ where: { userId: { in: ids }, jenis: 'MASUK', tanggalKerja: { gte: dt(awal), lte: dt(akhir) } }, orderBy: { dicatatPada: 'asc' } }), prisma.cutiKehadiran.findMany({ where: { userId: { in: ids }, status: 'DISETUJUI', mulai: { lte: dt(akhir) }, selesai: { gte: dt(awal) } } }), prisma.lemburKehadiran.findMany({ where: { userId: { in: ids }, tanggalKerja: { gte: dt(awal), lte: dt(akhir) } } })])
  const masukPertama = new Map(); for (const e of events) { const k = `${e.userId}|${ISO(e.tanggalKerja)}`; if (!masukPertama.has(k)) masukPertama.set(k, e.dicatatPada) }
  return { anggota, rentang, hk, masukPertama, cuti, lembur, events, jadwal: await jadwalUnit(studioId) }
}
export const getRekap = wrap(async (req, res) => {
  const { studioId } = req.query, bulan = req.query.bulan ?? H.hariIniWIB().slice(0, 7)
  if (!(await manajerUnit(req, res, studioId))) return
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const d = await dataBulan(studioId, bulan)
  const r = H.rekapBulan({ anggota: [...d.anggota.entries()].map(([id, nama]) => ({ id, nama })), rentangHari: d.rentang, hariKhusus: d.hk, masukPertama: d.masukPertama, cuti: d.cuti, lembur: d.lembur, jadwal: d.jadwal })
  return res.json({ success: true, data: { bulan, hariKerja: r.hariKerja, orang: r.orang.sort((a, b) => (b.hariTerlambat + b.hariTidakHadir) - (a.hariTerlambat + a.hariTidakHadir) || a.nama.localeCompare(b.nama, 'id')) } })
})
// Lupa pulang (11 Nov 2026): daftar sesi hari lampau (30 hari) yang punya MASUK tanpa PULANG, untuk dikoreksi koordinator unit
export const getLupaPulang = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await manajerUnit(req, res, studioId))) return
  const hariIni = H.hariIniWIB(), dari = new Date(dt(hariIni).getTime() - 30 * 86400000), anggota = await anggotaStudio(studioId)
  const ev = await prisma.kehadiranEvent.findMany({ where: { userId: { in: [...anggota.keys()] }, tanggalKerja: { gte: dari, lt: dt(hariIni) }, jenis: { in: ['MASUK', 'PULANG'] } }, orderBy: { dicatatPada: 'asc' } })
  const per = new Map(); for (const e of ev) { const k = `${e.userId}|${ISO(e.tanggalKerja)}`; const o = per.get(k) ?? {}; if (e.jenis === 'MASUK' && !o.masuk) o.masuk = e; if (e.jenis === 'PULANG') o.pulang = e; per.set(k, o) }
  const daftar = [...per.entries()].filter(([, o]) => o.masuk && !o.pulang).map(([k, o]) => ({ userId: k.split('|')[0], nama: anggota.get(k.split('|')[0]), tanggal: k.split('|')[1], masuk: H.jamTeks(o.masuk.dicatatPada) })).sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  return res.json({ success: true, data: { daftar } })
})
export const koreksiPulang = wrap(async (req, res) => {
  const { studioId, userId, tanggal, jam } = req.body ?? {}
  if (!(await manajerUnit(req, res, studioId))) return
  if (!(await anggotaStudio(studioId)).has(userId)) return gagal(res, 422, 'Orang itu bukan anggota unit ini')
  if (!tglOk(tanggal) || tanggal >= H.hariIniWIB()) return gagal(res, 422, 'Hanya untuk hari yang sudah lewat')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(jam ?? '')) return gagal(res, 422, 'Jam pulang harus HH:MM')
  const ev = await prisma.kehadiranEvent.findMany({ where: { userId, tanggalKerja: dt(tanggal), jenis: { in: ['MASUK', 'PULANG'] } }, orderBy: { dicatatPada: 'asc' } })
  const masuk = ev.find(e => e.jenis === 'MASUK')
  if (!masuk) return gagal(res, 422, 'Hari itu tidak ada presensi masuk')
  if (ev.some(e => e.jenis === 'PULANG')) return gagal(res, 409, 'Hari itu sudah punya jam pulang')
  const waktu = new Date(`${tanggal}T${jam}:00+07:00`)
  if (waktu <= masuk.dicatatPada) return gagal(res, 422, `Jam pulang harus setelah jam masuk (${H.jamTeks(masuk.dicatatPada)})`)
  await prisma.kehadiranEvent.create({ data: { userId, tanggalKerja: dt(tanggal), jenis: 'PULANG', dicatatPada: waktu, catatan: `Dikoreksi oleh ${await namaPengguna(req)} (lupa pulang)` } })
  return res.json({ success: true, message: 'Jam pulang dikoreksi' })
})
export const getTerlambat = wrap(async (req, res) => {
  const { studioId } = req.query, bulan = req.query.bulan ?? H.hariIniWIB().slice(0, 7)
  if (!(await manajerUnit(req, res, studioId))) return
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const d = await dataBulan(studioId, bulan)
  const masuk = [...d.masukPertama.entries()].map(([k, dicatatPada]) => ({ userId: k.split('|')[0], tgl: k.split('|')[1], dicatatPada }))
  const orang = H.terlambat({ masukPertama: masuk, hariKhusus: d.hk, jadwal: d.jadwal }).map(o => ({ ...o, nama: d.anggota.get(o.userId) ?? '—', labelTotal: H.formatMenit(o.totalMenit) }))
  return res.json({ success: true, data: { bulan, jumlahOrang: orang.length, kejadian: orang.reduce((s, o) => s + o.hariTerlambat, 0), orang } })
})

// ══ Check-in harian (pribadi) ════════════════════════════════════════════════════════════════════════════════════════════
export const getCheckInHariIni = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const tgl = H.hariIniWIB(), hk = await hariKhususMap(tgl, tgl)
  const [hariIni, riwayat] = await Promise.all([prisma.checkInHarian.findUnique({ where: { userId_tanggal: { userId: req.user.id, tanggal: dt(tgl) } } }), prisma.checkInHarian.findMany({ where: { userId: req.user.id, status: 'DIISI', tanggal: { gte: dt(new Date(dt(tgl).getTime() - 6 * 86400000).toISOString().slice(0, 10)), lte: dt(tgl) } }, orderBy: { tanggal: 'asc' } })])
  const rapi = (c) => ({ tanggal: ISO(c.tanggal), status: c.status, emosi: c.emosi, labelEmosi: c.emosi ? H.EMOSI[c.emosi] : null, intensitas: c.intensitas, kejernihan: c.kejernihan, fokusPikiran: c.fokusPikiran ? H.FOKUS_PIKIRAN[c.fokusPikiran] : null, kebutuhan: c.kebutuhan ? H.KEBUTUHAN[c.kebutuhan] : null })
  return res.json({ success: true, data: { tanggal: tgl, hariKerja: !H.hariLibur(tgl, hk), perluDiisi: !H.hariLibur(tgl, hk) && !hariIni, munculSetelah: H.jamPromptCheckIn(tgl), hariIni: hariIni ? rapi(hariIni) : null, riwayat: riwayat.map(rapi), pilihan: { emosi: H.EMOSI, fokusPikiran: H.FOKUS_PIKIRAN, kebutuhan: H.KEBUTUHAN } } })
})
export const kirimCheckIn = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const galat = H.validasiCheckIn(req.body ?? {}); if (galat) return gagal(res, 422, galat)
  const tanggal = dt(H.hariIniWIB())
  if (await prisma.checkInHarian.findUnique({ where: { userId_tanggal: { userId: req.user.id, tanggal } } })) return gagal(res, 409, 'Kamu sudah menyelesaikan check-in hari ini.')
  const b = req.body
  await prisma.checkInHarian.create({ data: { userId: req.user.id, tanggal, status: 'DIISI', emosi: b.emosi, intensitas: b.intensitas, kejernihan: b.kejernihan, fokusPikiran: b.fokusPikiran, kebutuhan: b.kebutuhan } })
  return res.status(201).json({ success: true, message: 'Check-in tersimpan' })
})
export const lewatiCheckIn = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const tanggal = dt(H.hariIniWIB())
  if (await prisma.checkInHarian.findUnique({ where: { userId_tanggal: { userId: req.user.id, tanggal } } })) return gagal(res, 409, 'Kamu sudah menyelesaikan check-in hari ini.')
  await prisma.checkInHarian.create({ data: { userId: req.user.id, tanggal, status: 'DILEWATI' } })
  return res.status(201).json({ success: true, message: 'Check-in dilewati' })
})
// Koordinator: partisipasi + agregat SAJA (tanpa emosi per orang)
const MIN_RINGKAS_CHECKIN = 3
export const getCheckInTim = wrap(async (req, res) => {
  const { studioId } = req.query, tgl = req.query.tanggal ?? H.hariIniWIB()
  if (!(await manajerUnit(req, res, studioId))) return
  if (!tglOk(tgl)) return gagal(res, 422, 'tanggal harus YYYY-MM-DD')
  const anggota = await anggotaStudio(studioId), ids = [...anggota.keys()]
  const baris = await prisma.checkInHarian.findMany({ where: { userId: { in: ids }, tanggal: dt(tgl) } })
  const belum = ids.filter(id => !baris.some(b => b.userId === id)).map(id => anggota.get(id))
  // Ringkasan isi (emosi/kebutuhan/fokus/rata-rata) hanya bila ≥ MIN_RINGKAS orang mengisi — dengan 1–2 pengisi, "ringkasan" = isian pribadinya
  const ag = H.agregatCheckIn({ anggotaIds: ids, baris })
  const cukup = ag.diisi >= MIN_RINGKAS_CHECKIN
  const isi = cukup ? ag : { ...ag, emosi: [], kebutuhan: [], fokusPikiran: [], rataIntensitas: null, rataKejernihan: null }
  return res.json({ success: true, data: { tanggal: tgl, ...isi, ringkasanDisembunyikan: !cukup, belumMengisi: belum, catatan: cukup ? 'Isian emosi bersifat pribadi: koordinator hanya melihat partisipasi dan ringkasan tim.' : `Ringkasan isi baru tampil bila minimal ${MIN_RINGKAS_CHECKIN} orang mengisi (menjaga isian pribadi tetap pribadi).` } })
})

// ══ Kalender ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
export const getKalenderBulan = wrap(async (req, res) => {
  const web = await sesi(req, res); if (!web) return
  const bulan = req.query.bulan ?? H.hariIniWIB().slice(0, 7)
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const awal = bulan + '-01', akhir = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5)), 0)).toISOString().slice(0, 10)
  const [hk, acara] = await Promise.all([prisma.hariLiburKerja.findMany({ where: { tanggal: { gte: dt(awal), lte: dt(akhir) } }, orderBy: { tanggal: 'asc' } }), prisma.acaraKalender.findMany({ where: { lingkupJenis: web.lingkup.jenis, lingkupId: web.lingkup.id, tanggal: { lte: dt(akhir) } } })])
  const hari = []
  for (let t = awal; t <= akhir; t = new Date(dt(t).getTime() + 86400000).toISOString().slice(0, 10)) {
    const k = hk.find(x => ISO(x.tanggal) === t)
    hari.push({ tanggal: t, jenis: H.jenisHari(t, new Map(hk.map(x => [ISO(x.tanggal), x.jenis]))), label: k?.nama ?? null, catatan: k?.catatan ?? null, acara: acara.filter(a => H.acaraPadaTanggal(a, t)).map(a => ({ id: a.id, judul: a.judul, seharian: a.seharian, mulai: a.mulai, selesai: a.selesai, lokasi: a.lokasi, berulang: a.berulang })) })
  }
  return res.json({ success: true, data: { bulan, hari, bisaKelola: atasanWeb(req, web), acara: acara.map(a => ({ id: a.id, judul: a.judul, tanggal: ISO(a.tanggal), seharian: a.seharian, mulai: a.mulai, selesai: a.selesai, lokasi: a.lokasi, deskripsi: a.deskripsi, berulang: a.berulang, berulangDihentikan: ISO(a.berulangDihentikan) })) } })
})
function bersihAcara(b, { baru }) {
  const out = {}
  if (baru || b.judul !== undefined) { const j = String(b.judul ?? '').trim(); if (!j || j.length > 160) return { galat: 'Judul wajib diisi (maks 160 huruf)' }; out.judul = j }
  if (baru || b.tanggal !== undefined) { if (!tglOk(b.tanggal)) return { galat: 'Tanggal harus YYYY-MM-DD' }; out.tanggal = dt(b.tanggal) }
  if (b.seharian !== undefined) out.seharian = !!b.seharian
  for (const f of ['mulai', 'selesai']) if (b[f] !== undefined) { if (b[f] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b[f])) return { galat: `${f} harus HH:MM` }; out[f] = b[f] || null }
  if (out.mulai && out.selesai && out.selesai <= out.mulai) return { galat: 'Jam selesai harus setelah jam mulai' }
  if (b.lokasi !== undefined) out.lokasi = b.lokasi ? String(b.lokasi).slice(0, 160) : null
  if (b.deskripsi !== undefined) out.deskripsi = b.deskripsi ? String(b.deskripsi).slice(0, 2000) : null
  if (b.berulang !== undefined) { if (b.berulang && !['MINGGUAN', 'BULANAN', 'TAHUNAN'].includes(b.berulang)) return { galat: 'berulang harus MINGGUAN, BULANAN, atau TAHUNAN' }; out.berulang = b.berulang || null }
  return { data: out }
}
export const buatAcara = wrap(async (req, res) => {
  const web = await sesi(req, res); if (!web) return
  if (!atasanWeb(req, web)) return gagal(res, 403, 'Acara kalender diatur Kepala Circle ke atas')
  const { galat, data } = bersihAcara(req.body ?? {}, { baru: true }); if (galat) return gagal(res, 422, galat)
  const a = await prisma.acaraKalender.create({ data: { lingkupJenis: web.lingkup.jenis, lingkupId: web.lingkup.id, dibuatOlehId: req.user.id, ...data } })
  return res.status(201).json({ success: true, data: { id: a.id } })
})
const lewatAcara = (isi) => wrap(async (req, res) => {
  const web = await sesi(req, res); if (!web) return
  if (!atasanWeb(req, web)) return gagal(res, 403, 'Acara kalender diatur Kepala Circle ke atas')
  const a = await prisma.acaraKalender.findUnique({ where: { id: req.params.id } })
  if (!a || a.lingkupJenis !== web.lingkup.jenis || a.lingkupId !== web.lingkup.id) return gagal(res, 404, 'Acara tidak ditemukan')
  return isi(req, res, a)
})
export const ubahAcara = lewatAcara(async (req, res, a) => { const { galat, data } = bersihAcara(req.body ?? {}, { baru: false }); if (galat) return gagal(res, 422, galat); await prisma.acaraKalender.update({ where: { id: a.id }, data }); return res.json({ success: true, message: 'Acara diperbarui' }) })
export const hapusAcara = lewatAcara(async (req, res, a) => { await prisma.acaraKalender.delete({ where: { id: a.id } }); return res.json({ success: true, message: 'Acara dihapus' }) })
export const hentikanAcara = lewatAcara(async (req, res, a) => { if (!a.berulang) return gagal(res, 422, 'Acara ini tidak berulang'); await prisma.acaraKalender.update({ where: { id: a.id }, data: { berulangDihentikan: dt(H.hariIniWIB()) } }); return res.json({ success: true, message: 'Pengulangan dihentikan' }) })
