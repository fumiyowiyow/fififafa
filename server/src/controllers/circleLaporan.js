import prisma from '../prisma.js'
import { jadwalUnit } from '../utils/jamKerjaUnit.js'
import { resolveWeb } from '../utils/web.js'
import { studioBolehDilihat, peranStudio, antreanSaya, saringAkun, orderDalamAkun } from './circle.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import { kunciTanggalWIB } from '../utils/jamKerja.js'
import { hariIniWIB, jenisHari } from '../utils/kehadiran.js'
import * as X from '../utils/laporanOgs.js'

// Beranda per peran, urgent, task selesai, progres harian, kontribusi nilai per orang, beban kerja per orang (21 Okt 2026) — adaptasi OGS
// HomeComposer, ProduksiController::toggleUrgent, CompletedTasksController, MyTasksController::buildDailyProgress, ReportController.
// Kontribusi nilai = uang per orang → hanya Koordinator ke atas unit itu.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const dt = (s) => new Date(s + 'T00:00:00.000Z')
const tglOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(dt(s))
async function akses(req, res, studioId, { manajer = false } = {}) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (manajer && !p.manajer) { gagal(res, 403, 'Hanya Koordinator ke atas'); return null }
  req._saringAkun = saringAkun(p) // admin per akun jualan (12 Nov 2026): laporan & beranda hanya order akunnya
  return p
}
const rentang = (q, defDari, defSampai) => {
  const dari = q.dari ?? defDari, sampai = q.sampai ?? defSampai
  if (!tglOk(dari) || !tglOk(sampai)) return { galat: 'dari/sampai harus YYYY-MM-DD' }
  if (sampai < dari) return { galat: 'sampai tidak boleh sebelum dari' }
  if ((dt(sampai) - dt(dari)) / 86400000 > 92) return { galat: 'Rentang maksimal 92 hari' }
  return { dari, sampai }
}
const wibAwal = (s) => new Date(s + 'T00:00:00+07:00'), wibAkhir = (s) => new Date(new Date(s + 'T00:00:00+07:00').getTime() + 86400000)

// ══ 1. Beranda ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
export const getBeranda = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  const lihatSemua = p.manajer || p.marketer
  const hari = hariIniWIB(), sekarang = new Date(), jam = Number(new Date(sekarang.getTime() + 7 * 3600000).toISOString().slice(11, 13))
  const nama = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? ''
  const milik = lihatSemua ? {} : { OR: [{ penugasanTahap: { some: { userId: req.user.id } } }, { assignments: { some: { userId: req.user.id, berhentiPada: null } } }] }
  // Tugasku = definisi yang SAMA dengan menu Tugas saya (`antreanSaya`) — dulu dari PenugasanTahap saja sehingga bisa 0 padahal ada tugas
  const [antreanku, selesaiHariIni, aktif] = await Promise.all([
    antreanSaya(req, studioId),
    prisma.penugasanTahap.count({ where: { userId: req.user.id, status: 'SELESAI', selesaiPada: { gte: wibAwal(hari), lt: wibAkhir(hari) }, order: { studioId } } }),
    prisma.orderProduksi.findMany({ where: { studioId, status: { in: ['MASUK', 'PROSES'] }, ...milik, ...req._saringAkun }, select: { id: true, judul: true, klien: true, deadline: true, penugasanTahap: { where: { status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, select: { id: true } }, assignments: { where: { berhentiPada: null }, select: { id: true } } } }),
  ])
  const sisa = (o) => (o.deadline ? Math.round((dt(kunciTanggalWIB(o.deadline)) - dt(hari)) / 86400000) : null)
  const denganSisa = aktif.map(o => ({ ...o, sisa: sisa(o) }))
  const delivery = denganSisa.filter(o => o.sisa != null && o.sisa >= 1 && o.sisa <= 5).sort((a, b) => a.sisa - b.sisa)
  const terlambat = denganSisa.filter(o => o.sisa != null && o.sisa < 0).length
  const segera = denganSisa.filter(o => o.sisa != null && o.sisa >= 0 && o.sisa <= 3).length
  const tanpaPenanggung = denganSisa.filter(o => !o.penugasanTahap.length && !o.assignments.length).length
  const perhatian = []
  const tambah = (kunci, label, jumlah, tab) => { if (jumlah > 0) perhatian.push({ kunci, label, jumlah, tab }) }
  // pribadi
  const [presensi, checkin] = await Promise.all([
    prisma.kehadiranEvent.count({ where: { userId: req.user.id, tanggalKerja: dt(hari), jenis: 'MASUK' } }),
    prisma.checkInHarian.count({ where: { userId: req.user.id, tanggal: dt(hari) } }),
  ])
  const hariKerja = !['LIBUR', 'LIBUR_MINGGU'].includes(jenisHari(hari, new Map((await prisma.hariLiburKerja.findMany({ where: { tanggal: dt(hari) }, select: { tanggal: true, jenis: true } })).map(b => [hari, b.jenis]))))
  if (hariKerja && !presensi) tambah('presensi', 'Belum presensi datang hari ini', 1, 'hadir')
  if (hariKerja && !checkin && jam >= 16) tambah('checkin', 'Check-in harian belum diisi', 1, 'hadir')
  // Hanya bila pengingat otomatis dinyalakan (OTOMASI_AKTIF) — selama belum, mengingatkan Telegram cuma membingungkan (11 Nov 2026)
  if (process.env.OTOMASI_AKTIF === '1' && !(await prisma.user.findUnique({ where: { id: req.user.id }, select: { telegramId: true } }))?.telegramId) tambah('telegram', 'Telegram belum tertaut (untuk menerima pengingat)', 1, 'hadir')
  const tugasku = antreanku.antrean, tugasTelat = tugasku.filter(t => sisa(t) != null && sisa(t) < 0).length
  tambah('tugasTelat', 'Tugasmu lewat deadline', tugasTelat, 'tugas')
  const delivery1 = delivery.filter(o => o.sisa === 1).length
  tambah('delivery', 'Order deadline besok (H-1)', delivery1, lihatSemua ? 'analitik' : 'tugas')
  let manajerInfo = null, marketerInfo = null
  if (p.manajer) {
    const anggota = [...(await anggotaStudio(studioId)).keys()]
    const senin = (() => { const d = dt(hari), dow = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - dow * 86400000) })()
    // Izin & refleksi = data SDM anggota → hanya pengelola unit (Koordinator/Pendamping), BUKAN Admin Market / pemilik (aturan 8a & 10; 11 Nov 2026)
    const sdm = !!p.pengelola
    const [izin, dukungan, diskusi] = await Promise.all([
      sdm ? prisma.cutiKehadiran.count({ where: { userId: { in: anggota }, status: 'MENUNGGU' } }) : null,
      sdm ? prisma.refleksiMingguan.count({ where: { userId: { in: anggota }, mingguMulai: senin, perluDukungan: true } }) : null,
      prisma.pesanDiskusi.count({ where: { diskusi: { studioId, status: 'TERBUKA' }, createdAt: { gte: new Date(sekarang.getTime() - 86400000) } } }).catch(() => 0),
    ])
    manajerInfo = { terlambat, segera, tanpaPenanggung, izinMenunggu: izin, perluDukungan: dukungan, diskusiBaru24Jam: diskusi }
    tambah('terlambat', 'Order lewat deadline', terlambat, 'analitik'); tambah('tanpa', 'Order aktif tanpa penanggung', tanpaPenanggung, 'penugasan')
    if (sdm) { tambah('izin', 'Pengajuan izin menunggu persetujuan', izin, 'hadir'); tambah('dukungan', 'Anggota menandai perlu dukungan (refleksi minggu ini)', dukungan, 'hadir') }
  }
  if (p.marketer) {
    const [aktivitas, selesai, setoranBulan] = await Promise.all([
      prisma.aktivitasMarketer.count({ where: { userId: req.user.id, studioId, tanggal: dt(hari) } }),
      prisma.aktivitasMarketer.count({ where: { userId: req.user.id, studioId, tanggal: dt(hari), selesai: true } }),
      prisma.setoranMarketer.count({ where: { studioId, marketerId: req.user.id, tanggal: { gte: dt(hari.slice(0, 7) + '-01') } } }),
    ])
    marketerInfo = { aktivitasHariIni: aktivitas, selesai, setoranBulanIni: setoranBulan }
    if (aktivitas === 0 && hariKerja) tambah('aktivitas', 'Belum ada aktivitas pemasaran hari ini', 1, 'marketing')
  }
  // seri 8 minggu: order masuk vs selesai
  let seri = null
  if (lihatSemua) {
    const senin0 = (() => { const d = dt(hari), dow = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - dow * 86400000 - 7 * 7 * 86400000) })()
    const [masuk, selesai] = await Promise.all([
      prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, ...req._saringAkun, tanggalMasuk: { gte: new Date(senin0.toISOString().slice(0, 10) + 'T00:00:00+07:00') } }, select: { tanggalMasuk: true } }),
      prisma.orderProduksi.findMany({ where: { studioId, status: 'SELESAI', ...req._saringAkun, tanggalSelesai: { gte: new Date(senin0.toISOString().slice(0, 10) + 'T00:00:00+07:00') } }, select: { tanggalSelesai: true } }),
    ])
    seri = Array.from({ length: 8 }, (_, i) => { const a = new Date(senin0.getTime() + i * 7 * 86400000), z = new Date(a.getTime() + 7 * 86400000), A = a.toISOString().slice(0, 10), Z = z.toISOString().slice(0, 10); const dalam = (d) => { const k = kunciTanggalWIB(d); return k >= A && k < Z } ; return { minggu: A, masuk: masuk.filter(o => dalam(o.tanggalMasuk)).length, selesai: selesai.filter(o => dalam(o.tanggalSelesai)).length } })
  }
  return res.json({ success: true, data: {
    sapaan: jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam', nama, tanggal: hari, mode: p.mode,
    perhatian, tugasSaya: { aktif: tugasku.length, telat: tugasTelat, selesaiHariIni },
    delivery: { h1: delivery1, h2: delivery.filter(o => o.sisa === 2).length, h3: delivery.filter(o => o.sisa === 3).length, h4_5: delivery.filter(o => o.sisa >= 4).length, daftar: delivery.slice(0, 8).map(o => ({ orderId: o.id, judul: o.judul, klien: o.klien, sisaHari: o.sisa })) },
    manajer: manajerInfo, marketer: marketerInfo, seri,
  } })
})

// ══ 2. Urgent ════════════════════════════════════════════════════════════════════════════════════════════════════════════
export const toggleMendesak = wrap(async (req, res) => {
  const b = await prisma.penugasanTahap.findUnique({ where: { id: req.params.id }, include: { order: { select: { studioId: true, akunId: true } } } })
  if (!b) return gagal(res, 404, 'Penugasan tidak ditemukan')
  const p = await akses(req, res, b.order.studioId); if (!p) return
  if (!(p.manajer && orderDalamAkun(p, b.order)) && b.userId !== req.user.id) return gagal(res, 403, 'Hanya penugasan milikmu sendiri')
  if (b.status === 'SELESAI') return gagal(res, 409, 'Penugasan ini sudah selesai')
  const u = await prisma.penugasanTahap.update({ where: { id: b.id }, data: { mendesak: !b.mendesak } })
  return res.json({ success: true, data: { mendesak: u.mendesak } })
})

// ══ 3. Task selesai (+ batalkan selesai) ═════════════════════════════════════════════════════════════════════════════════
export const getTugasSelesai = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  const hari = hariIniWIB(), r = rentang(req.query, hari, hari); if (r.galat) return gagal(res, 422, r.galat)
  const [baris, aktivitas] = await Promise.all([
    prisma.penugasanTahap.findMany({ where: { status: 'SELESAI', selesaiPada: { gte: wibAwal(r.dari), lt: wibAkhir(r.sampai) }, order: { ...req._saringAkun, studioId }, ...(p.manajer ? {} : { userId: req.user.id }) }, include: { order: { select: { id: true, judul: true, klien: true, tahapId: true } } }, orderBy: { selesaiPada: 'desc' }, take: 500 }),
    p.manajer || p.marketer ? prisma.aktivitasMarketer.findMany({ where: { studioId, selesai: true, selesaiPada: { gte: wibAwal(r.dari), lt: wibAkhir(r.sampai) }, ...(p.manajer ? {} : { userId: req.user.id }) }, orderBy: { selesaiPada: 'desc' }, take: 500 }) : [],
  ])
  const ids = [...new Set([...baris.map(b => b.userId), ...aktivitas.map(a => a.userId)])]
  const nama = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } })).map(u => [u.id, u.nama]))
  return res.json({ success: true, data: { ...r, bisaBatal: p.manajer,
    tugas: baris.map(b => ({ id: b.id, orderId: b.order.id, judul: b.order.judul, klien: b.order.klien, tahap: b.namaTahap, pekerja: nama.get(b.userId) ?? '—', selesaiPada: b.selesaiPada, bisaDibatalkan: p.manajer && b.order.tahapId === b.tahapId })),
    marketer: aktivitas.map(a => ({ id: a.id, jenis: a.jenis, judul: a.judul, jumlah: a.jumlah, pekerja: nama.get(a.userId) ?? '—', selesaiPada: a.selesaiPada })) } })
})
export const batalSelesai = wrap(async (req, res) => {
  const b = await prisma.penugasanTahap.findUnique({ where: { id: req.params.id }, include: { order: { select: { studioId: true, tahapId: true, akunId: true } } } })
  if (!b) return gagal(res, 404, 'Penugasan tidak ditemukan')
  const pp = await akses(req, res, b.order.studioId, { manajer: true }); if (!pp) return
  if (!orderDalamAkun(pp, b.order)) return gagal(res, 403, 'Order ini di luar akun jualanmu')
  if (b.status !== 'SELESAI') return gagal(res, 409, 'Penugasan ini belum selesai')
  if (b.order.tahapId !== b.tahapId) return gagal(res, 409, 'Order sudah pindah tahap, selesai tidak bisa dibatalkan')
  await prisma.penugasanTahap.update({ where: { id: b.id }, data: { status: 'DIKERJAKAN', selesaiPada: null, progres: Math.min(b.progres, 90) } })
  return res.json({ success: true, message: 'Selesai dibatalkan, kembali ke antrean' })
})

// ══ 4. Progres harian ════════════════════════════════════════════════════════════════════════════════════════════════════
export const getProgresHarian = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await akses(req, res, studioId, { manajer: true }))) return
  const hari = hariIniWIB(), awalDefault = new Date(dt(hari).getTime() - 6 * 86400000).toISOString().slice(0, 10)
  const r = rentang(req.query, awalDefault, hari); if (r.galat) return gagal(res, 422, r.galat)
  const baris = await prisma.penugasanTahap.findMany({ where: { order: { studioId, ...req._saringAkun }, ditugaskanPada: { lt: wibAkhir(r.sampai) }, OR: [{ selesaiPada: null }, { selesaiPada: { gte: wibAwal(r.dari) } }] }, select: { userId: true, ditugaskanPada: true, selesaiPada: true } })
  const anggota = await anggotaStudio(studioId)
  const hasil = X.progresHarian(baris, r.dari, r.sampai).map(h => ({ ...h, perPekerja: h.perPekerja.map(w => ({ ...w, nama: anggota.get(w.userId) ?? '—' })).sort((a, b) => b.total - a.total) }))
  return res.json({ success: true, data: { ...r, hari: hasil } })
})

// ══ 5. Kontribusi nilai per orang ════════════════════════════════════════════════════════════════════════════════════════
async function dataKontribusi(studioId, tahun, saring = {}) {
  const selesai = await prisma.penugasanTahap.findMany({ where: { status: 'SELESAI', selesaiPada: { gte: wibAwal(`${tahun}-01-01`), lt: wibAwal(`${tahun + 1}-01-01`) }, order: { studioId, status: { not: 'BATAL' }, ...saring } }, select: { id: true, orderId: true, userId: true, namaTahap: true, selesaiPada: true } })
  const orderIds = [...new Set(selesai.map(s => s.orderId))]
  const [semuaBaris, orders] = await Promise.all([prisma.penugasanTahap.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true, namaTahap: true, userId: true } }), prisma.orderProduksi.findMany({ where: { id: { in: orderIds } }, select: { id: true, nilaiBersih: true, judul: true, klien: true } })])
  const semua = new Map(); for (const b of semuaBaris) { if (!semua.has(b.orderId)) semua.set(b.orderId, []); semua.get(b.orderId).push(b) }
  return { selesai: selesai.map(s => ({ ...s, bulan: Number(kunciTanggalWIB(s.selesaiPada).slice(5, 7)) })), semua, nilai: new Map(orders.map(o => [o.id, o.nilaiBersih])), info: new Map(orders.map(o => [o.id, o])) }
}
const parseTB = (q) => { const tahun = Number(q.tahun) || Number(hariIniWIB().slice(0, 4)); const bulan = Number(q.bulan) || 0; return { tahun, bulan: bulan >= 1 && bulan <= 12 ? bulan : 0 } }
export const getKontribusi = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await akses(req, res, studioId, { manajer: true }))) return
  const { tahun, bulan } = parseTB(req.query)
  if (tahun < 2020 || tahun > 2100) return gagal(res, 422, 'tahun tidak valid')
  const d = await dataKontribusi(studioId, tahun, req._saringAkun)
  const hasil = X.hitungKontribusi(d.selesai, d.semua, d.nilai, bulan)
  const anggota = await anggotaStudio(studioId)
  const ekstra = await prisma.user.findMany({ where: { id: { in: hasil.orang.map(o => o.userId).filter(id => !anggota.has(id)) } }, select: { id: true, nama: true } })
  const nama = new Map([...anggota, ...ekstra.map(u => [u.id, u.nama])])
  return res.json({ success: true, data: { tahun, bulan: bulan || null, orang: hasil.orang.map(o => ({ ...o, nama: nama.get(o.userId) ?? '—' })), total: hasil.total, catatan: 'Porsi tiap tahap selesai = nilai bersih order ÷ jumlah tahap berbeda ÷ jumlah pekerja di tahap itu.' } })
})
export const getKontribusiDetail = wrap(async (req, res) => {
  const { studioId, userId } = req.query
  if (!(await akses(req, res, studioId, { manajer: true }))) return
  if (!userId) return gagal(res, 422, 'userId wajib diisi')
  const { tahun, bulan } = parseTB(req.query), scope = req.query.scope === 'bulan' && bulan ? 'bulan' : 'kumulatif'
  const d = await dataKontribusi(studioId, tahun, req._saringAkun)
  const baris = d.selesai.filter(s => s.userId === userId && (scope === 'bulan' ? s.bulan === bulan : bulan === 0 || s.bulan <= bulan))
    .map(s => ({ id: s.id, orderId: s.orderId, judul: d.info.get(s.orderId)?.judul, klien: d.info.get(s.orderId)?.klien, tahap: s.namaTahap, selesaiPada: s.selesaiPada, porsi: X.r2(X.porsiTahap(s, d.semua, d.nilai)) })).sort((a, b) => new Date(b.selesaiPada) - new Date(a.selesaiPada))
  return res.json({ success: true, data: { tahun, bulan: bulan || null, scope, total: X.r2(baris.reduce((a, b) => a + b.porsi, 0)), baris } })
})

// ══ 6. Beban kerja per orang per bulan ═══════════════════════════════════════════════════════════════════════════════════
export const getBebanKerja = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await akses(req, res, studioId, { manajer: true }))) return
  const tahun = Number(req.query.tahun) || Number(hariIniWIB().slice(0, 4))
  if (tahun < 2020 || tahun > 2100) return gagal(res, 422, 'tahun tidak valid')
  const a = wibAwal(`${tahun}-01-01`), z = wibAwal(`${tahun + 1}-01-01`)
  const [pindah, selesai, catatan] = await Promise.all([
    prisma.riwayatTahapOrder.findMany({ where: { userId: { not: null }, mulai: { gte: a, lt: z }, order: { studioId, ...req._saringAkun } }, select: { userId: true, mulai: true } }),
    prisma.penugasanTahap.findMany({ where: { selesaiPada: { gte: a, lt: z }, order: { studioId, ...req._saringAkun } }, select: { userId: true, selesaiPada: true } }),
    prisma.catatanOrder.findMany({ where: { userId: { not: null }, createdAt: { gte: a, lt: z }, order: { studioId, ...req._saringAkun } }, select: { userId: true, createdAt: true } }),
  ])
  const bln = (d) => Number(kunciTanggalWIB(d).slice(5, 7))
  const sumber = { pindah: pindah.map(x => ({ userId: x.userId, bulan: bln(x.mulai) })), selesai: selesai.map(x => ({ userId: x.userId, bulan: bln(x.selesaiPada) })), catatan: catatan.map(x => ({ userId: x.userId, bulan: bln(x.createdAt) })) }
  const total = X.bebanKerja([...sumber.pindah, ...sumber.selesai, ...sumber.catatan])
  const per = Object.fromEntries(Object.entries(sumber).map(([k, v]) => [k, new Map(X.bebanKerja(v).map(e => [e.userId, e]))]))
  const anggota = await anggotaStudio(studioId)
  const ekstra = await prisma.user.findMany({ where: { id: { in: total.map(t => t.userId).filter(id => !anggota.has(id)) } }, select: { id: true, nama: true } })
  const nama = new Map([...anggota, ...ekstra.map(u => [u.id, u.nama])])
  return res.json({ success: true, data: { tahun, catatan: 'Aksi = memindahkan tahap order + menyelesaikan tahap + menulis catatan order.', orang: total.map(t => ({ userId: t.userId, nama: nama.get(t.userId) ?? '—', bulan: t.bulan, total: t.total, pindahTahap: per.pindah.get(t.userId)?.total ?? 0, tahapSelesai: per.selesai.get(t.userId)?.total ?? 0, catatan: per.catatan.get(t.userId)?.total ?? 0 })) } })
})

// ══ Peta alur & rekap kerja per orang per bulan (audit OGS: WorkflowMap + WorkerMonthWorkLog) ═════════════════════════════
import { rekapKerjaBulan } from '../utils/laporanOgs.js'
import { pastikanTahap, tahapEfektif } from './circle.js'
import { jenisNormal } from '../utils/alur.js'
const muatLiburSet = async (dari, sampai) => new Set((await prisma.hariLiburKerja.findMany({ where: { jenis: 'LIBUR', tanggal: { gte: new Date(dari.getTime() - 2 * 86400000), lte: new Date(sampai.getTime() + 2 * 86400000) } }, select: { tanggal: true } })).map(b => b.tanggal.toISOString().slice(0, 10)))

// Peta alur: tiap tahap templat → siapa memegang kartu apa sekarang (+ order di tahap itu yang belum dipegang siapa pun)
export const getPetaAlur = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await akses(req, res, studioId, { manajer: true }))) return
  const [tahap, orders, aktif, anggota] = await Promise.all([
    pastikanTahap(studioId),
    prisma.orderProduksi.findMany({ where: { studioId, status: { in: ['MASUK', 'PROSES'] }, ...req._saringAkun }, select: { id: true, judul: true, klien: true, deadline: true, tahapId: true, status: true, subStatus: true, tahapAktif: true } }),
    prisma.penugasanTahap.findMany({ where: { status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, order: { studioId, ...req._saringAkun, status: { in: ['MASUK', 'PROSES'] } } }, select: { id: true, orderId: true, tahapId: true, userId: true, status: true, progres: true, mendesak: true, mulaiPada: true, ditugaskanPada: true } }),
    anggotaStudio(studioId),
  ])
  const sekarang = new Date(), libur = await muatLiburSet(new Date(sekarang.getTime() - 30 * 86400000), sekarang), jadwal = await jadwalUnit(studioId)
  const info = new Map(orders.map(o => [o.id, o]))
  const kolom = tahap.map(t => {
    const ordersDiTahap = orders.filter(o => tahapEfektif(o, tahap) === t.id)
    const pegang = aktif.filter(a => a.tahapId === t.id && info.has(a.orderId))
    const orang = new Map()
    for (const a of pegang) { const e = orang.get(a.userId) ?? { userId: a.userId, nama: anggota.get(a.userId) ?? '—', kartu: [] }; const o = info.get(a.orderId); e.kartu.push({ penugasanId: a.id, orderId: o.id, judul: o.judul, klien: o.klien, status: a.status, progres: a.progres, mendesak: a.mendesak, deadline: o.deadline, jam: jamKerja(a.mulaiPada ?? a.ditugaskanPada, sekarang, libur, jadwal) }); orang.set(a.userId, e) }
    const dipegang = new Set(pegang.map(a => a.orderId))
    return { tahapId: t.id, nama: t.nama, jenis: jenisNormal(t.jenis), jumlahOrder: ordersDiTahap.length, orang: [...orang.values()].sort((x, y) => y.kartu.length - x.kartu.length), tanpaPemegang: ordersDiTahap.filter(o => !dipegang.has(o.id)).map(o => ({ orderId: o.id, judul: o.judul, klien: o.klien, deadline: o.deadline })) }
  })
  return res.json({ success: true, data: { kolom, jumlahOrderAktif: orders.length } })
})
import { jamKerja } from '../utils/jamKerja.js'

export const getRekapKerja = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  const userId = req.query.userId || req.user.id
  if (!p.manajer && userId !== req.user.id) return gagal(res, 403, 'Hanya Koordinator ke atas yang melihat rekap orang lain')
  const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.bulan ?? '') ? req.query.bulan : hariIniWIB().slice(0, 7)
  const awal = new Date(bulan + '-01T00:00:00+07:00'), akhir = new Date(awal); akhir.setUTCMonth(akhir.getUTCMonth() + 1)
  const anggota = await anggotaStudio(studioId)
  if (p.manajer && userId !== req.user.id && !anggota.has(userId)) return gagal(res, 403, 'Bukan anggota unit ini')
  const baris = await prisma.penugasanTahap.findMany({ where: { userId, order: { studioId, status: { not: 'BATAL' } }, status: { not: 'DITUTUP' }, ditugaskanPada: { lt: akhir }, OR: [{ selesaiPada: null }, { selesaiPada: { gte: awal } }] }, include: { order: { select: { judul: true, klien: true } } } })
  const libur = await muatLiburSet(awal, akhir)
  const hasil = rekapKerjaBulan(baris.map(b => ({ id: b.id, judul: b.order.judul, klien: b.order.klien, namaTahap: b.namaTahap, status: b.status, ditugaskanPada: b.ditugaskanPada, mulaiPada: b.mulaiPada, selesaiPada: b.selesaiPada })), awal, akhir, new Date(), libur, await jadwalUnit(studioId))
  const nama = anggota.get(userId) ?? (await prisma.user.findUnique({ where: { id: userId }, select: { nama: true } }))?.nama ?? '—'
  return res.json({ success: true, data: { bulan, userId, nama, anggota: p.manajer ? [...anggota].map(([id, n]) => ({ id, nama: n })) : [], ...hasil, catatan: 'Lama di tangan = jam kerja bersih (menurut jam kerja unit, tanpa istirahat & libur) selama kartu dipegang dalam bulan itu.' } })
})
