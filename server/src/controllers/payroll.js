import prisma from '../prisma.js'
// Wewenang Payroll PER UNIT (21 Okt 2026, keputusan user): Koordinator/Pendamping unit itu, Kepala Circle/Rumah Usaha pemiliknya, atau
// Super Admin. `canManageStudio` biasa terlalu longgar di sini (Koordinator unit A yang hanya Kader di unit B ikut lolos untuk B).
import { kelolaStudio as canManageStudio, STAFF_PLUS } from '../utils/roles.js'
import { hitungThp } from '../utils/payroll.js'
import { hitungLembur } from '../utils/lembur.js'

/** Hari libur/WFA global dalam periode → Map 'YYYY-MM-DD' → jenis (untuk pengali lembur hari libur). */
export async function hariKhususPeriode(awal, akhir) {
  const b = await prisma.hariLiburKerja.findMany({ where: { tanggal: { gte: awal, lt: akhir } }, select: { tanggal: true, jenis: true } })
  return new Map(b.map(x => [x.tanggal.toISOString().slice(0, 10), x.jenis]))
}
/** Lembur presensi DISETUJUI milik unit ini: tercatat di unit ini, atau belum berunit (data lama) bila orangnya hanya bekerja di unit ini. */
export async function lemburPresensiUnit(userId, studioId, awal, akhir, extra = {}) {
  const unitLain = await prisma.userRole.count({ where: { userId, roleType: { not: 'DIGNITY' }, studioId: { not: null, notIn: [studioId] } } })
  return prisma.lemburKehadiran.findMany({ where: { userId, status: 'DISETUJUI', tanggalKerja: { gte: awal, lt: akhir }, ...extra, OR: [{ studioId }, ...(unitLain ? [] : [{ studioId: null }])] } })
}

/** Endpoint baca Payroll WAJIB satu unit yang dikelola pemanggil (sebelumnya tanpa studioId = semua studio se-ekosistem). */
async function unitPayroll(req, res) {
  const { studioId } = req.query
  if (!studioId) { res.status(422).json({ success: false, message: 'studioId wajib diisi' }); return null }
  if (!(await canManageStudio(req.userRoles, studioId))) { res.status(403).json({ success: false, message: 'Hanya Koordinator ke atas unit ini' }); return null }
  return studioId
}

// ── RateCardLembur ───────────────────────────────────────

export const getRateCard = async (req, res) => {
  try {
    const studioId = await unitPayroll(req, res); if (!studioId) return
    const rateCard = await prisma.rateCardLembur.findMany({
      where: { studioId },
      include: { studio: { select: { id: true, nama: true } } },
      orderBy: [{ studioId: 'asc' }, { level: 'asc' }],
    })
    return res.json({ success: true, data: rateCard })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createRateCard = async (req, res) => {
  try {
    const { studioId, level, keterangan, fee } = req.body
    if (!studioId || !level || fee == null) {
      return res.status(422).json({ success: false, message: 'studioId, level, dan fee wajib diisi' })
    }
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa kelola rate card studio sendiri' })
    }
    const feeNum = Number(fee)
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      return res.status(422).json({ success: false, message: 'fee wajib angka >= 0' })
    }
    const rateCard = await prisma.rateCardLembur.create({
      data: { studioId, level, keterangan: keterangan || null, fee: feeNum },
    })
    return res.status(201).json({ success: true, data: rateCard })
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Studio ini sudah punya rate card dengan level yang sama' })
    }
    return res.status(500).json({ success: false, message: 'Gagal menambah rate card' })
  }
}

// Edit rate card -- CUMA ubah baris RateCardLembur itu sendiri, TIDAK PERNAH nyentuh
// CatatanLembur yang udah ada. Entri lama udah punya feeSaatItu sendiri yang di-copy pas dibuat
// (lihat createLembur), jadi perubahan fee di sini otomatis gak ngaruh ke entri lama -- gak ada
// query UPDATE ke tabel CatatanLembur di fungsi ini sama sekali, itu yang bikin independensinya
// terjamin (bukan logic khusus buat "skip recompute").
export const updateRateCard = async (req, res) => {
  try {
    const existing = await prisma.rateCardLembur.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Rate card tidak ditemukan' })
    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa kelola rate card studio sendiri' })
    }

    const { level, keterangan, fee, aktif } = req.body
    const data = {}
    if (level !== undefined) {
      if (!level) return res.status(422).json({ success: false, message: 'level tidak boleh kosong' })
      data.level = level
    }
    if (keterangan !== undefined) data.keterangan = keterangan || null
    if (fee !== undefined) {
      const feeNum = Number(fee)
      if (!Number.isFinite(feeNum) || feeNum < 0) {
        return res.status(422).json({ success: false, message: 'fee wajib angka >= 0' })
      }
      data.fee = feeNum
    }
    if (aktif !== undefined) data.aktif = !!aktif

    const updated = await prisma.rateCardLembur.update({ where: { id: existing.id }, data })
    return res.json({ success: true, data: updated })
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Studio ini sudah punya rate card dengan level yang sama' })
    }
    return res.status(500).json({ success: false, message: 'Gagal memperbarui rate card' })
  }
}

// ── CatatanLembur ────────────────────────────────────────

export const getLembur = async (req, res) => {
  try {
    const { userId, bulan, tahun } = req.query
    const studioId = await unitPayroll(req, res); if (!studioId) return
    const where = {
      ...(userId && { userId }),
      rateCard: { studioId },
    }
    if (bulan && tahun) {
      const periodeAwal = new Date(Date.UTC(Number(tahun), Number(bulan) - 1, 1))
      const periodeAkhir = new Date(Date.UTC(Number(tahun), Number(bulan), 1))
      where.tanggal = { gte: periodeAwal, lt: periodeAkhir }
    }
    const lembur = await prisma.catatanLembur.findMany({
      where,
      include: {
        user: { select: { id: true, nama: true } },
        rateCard: { select: { id: true, level: true, studioId: true, fee: true } },
        order: { select: { id: true, judul: true } },
      },
      orderBy: { tanggal: 'desc' },
    })
    return res.json({ success: true, data: lembur })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createLembur = async (req, res) => {
  try {
    const { userId, rateCardId, orderId, klien, briefName, tanggal, progresAwal, progresAkhir, catatan } = req.body
    if (!userId || !rateCardId || !tanggal || progresAwal == null || progresAkhir == null) {
      return res.status(422).json({ success: false, message: 'userId, rateCardId, tanggal, progresAwal, dan progresAkhir wajib diisi' })
    }

    const rateCard = await prisma.rateCardLembur.findUnique({ where: { id: rateCardId } })
    if (!rateCard) {
      return res.status(422).json({ success: false, message: 'rateCardId tidak valid' })
    }
    // Rate card nonaktif gak boleh dipakai buat ENTRI BARU -- entri LAMA yang udah pakai rate
    // card ini sebelum dinonaktifkan tetap utuh (feeSaatItu-nya udah ke-kunci sendiri, gak
    // kesentuh sama sekali di sini).
    if (!rateCard.aktif) {
      return res.status(422).json({ success: false, message: 'Rate card ini sudah nonaktif, tidak bisa dipakai buat entri baru' })
    }
    // Scope studio DIAMBIL DARI rateCard (bukan dari body) -- rateCard sudah nempel ke satu
    // studio tertentu, jadi otorisasi ngikutin studio pemilik rate card itu, gak bisa dititipin
    // dari client.
    if (!(await canManageStudio(req.userRoles, rateCard.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa catat lembur pakai rate card studio sendiri' })
    }

    const awal = Number(progresAwal)
    const akhir = Number(progresAkhir)
    if (!Number.isFinite(awal) || awal < 0 || awal > 1) {
      return res.status(422).json({ success: false, message: 'progresAwal wajib angka 0-1' })
    }
    if (!Number.isFinite(akhir) || akhir < 0 || akhir > 1) {
      return res.status(422).json({ success: false, message: 'progresAkhir wajib angka 0-1' })
    }
    if (akhir <= awal) {
      return res.status(422).json({ success: false, message: 'progresAkhir harus lebih besar dari progresAwal' })
    }

    const tanggalDate = new Date(tanggal)
    if (isNaN(tanggalDate.getTime())) {
      return res.status(422).json({ success: false, message: 'tanggal tidak valid' })
    }

    if (orderId) {
      const order = await prisma.orderProduksi.findUnique({ where: { id: orderId } })
      if (!order || order.studioId !== rateCard.studioId) return res.status(422).json({ success: false, message: 'orderId tidak valid untuk studio ini' })
    }

    // feeSaatItu DISALIN dari rateCard.fee SEKARANG (bukan cuma nyimpan rateCardId lalu baca fee
    // live tiap kali) -- kalau rate card-nya diubah belakangan (koordinator naikin/turunin fee),
    // entri lembur yang UDAH ada harus tetap pakai fee yang berlaku pas lembur itu dicatat.
    // feeAkhir dihitung SEKALI di sini dari feeSaatItu, bukan dihitung ulang tiap dibaca.
    const feeSaatItu = rateCard.fee
    const feeAkhir = feeSaatItu * (akhir - awal)

    const catatanLembur = await prisma.catatanLembur.create({
      data: {
        userId, rateCardId, feeSaatItu,
        orderId: orderId || null,
        klien: klien || null,
        briefName: briefName || null,
        tanggal: tanggalDate,
        progresAwal: awal, progresAkhir: akhir, feeAkhir,
        catatan: catatan || null,
      },
      include: {
        user: { select: { id: true, nama: true } },
        rateCard: { select: { id: true, level: true, studioId: true } },
      },
    })
    return res.status(201).json({ success: true, data: catatanLembur })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mencatat lembur' })
  }
}

// ── TunjanganTemplate (per studio) ────────────────────────
// Pola sama persis RateCardLembur: per studio, aktif/nonaktif (bukan hard delete), dipakai
// buat auto-generate baris TunjanganPenggajian tiap kali Penggajian baru dibuat.

export const getTunjanganTemplate = async (req, res) => {
  try {
    const studioId = await unitPayroll(req, res); if (!studioId) return
    const template = await prisma.tunjanganTemplate.findMany({
      where: { studioId },
      orderBy: [{ studioId: 'asc' }, { nama: 'asc' }],
    })
    return res.json({ success: true, data: template })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createTunjanganTemplate = async (req, res) => {
  try {
    const { studioId, nama } = req.body
    if (!studioId || !nama) {
      return res.status(422).json({ success: false, message: 'studioId dan nama wajib diisi' })
    }
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa kelola tunjangan studio sendiri' })
    }
    const template = await prisma.tunjanganTemplate.create({ data: { studioId, nama } })
    return res.status(201).json({ success: true, data: template })
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Studio ini sudah punya jenis tunjangan dengan nama yang sama' })
    }
    return res.status(500).json({ success: false, message: 'Gagal menambah jenis tunjangan' })
  }
}

export const updateTunjanganTemplate = async (req, res) => {
  try {
    const existing = await prisma.tunjanganTemplate.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Jenis tunjangan tidak ditemukan' })
    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa kelola tunjangan studio sendiri' })
    }
    const { nama, aktif } = req.body
    const data = {}
    if (nama !== undefined) {
      if (!nama) return res.status(422).json({ success: false, message: 'nama tidak boleh kosong' })
      data.nama = nama
    }
    if (aktif !== undefined) data.aktif = !!aktif
    const updated = await prisma.tunjanganTemplate.update({ where: { id: existing.id }, data })
    return res.json({ success: true, data: updated })
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Studio ini sudah punya jenis tunjangan dengan nama yang sama' })
    }
    return res.status(500).json({ success: false, message: 'Gagal memperbarui jenis tunjangan' })
  }
}

// ── Penggajian (Fase 3 bagian 2/2) ────────────────────────

// Generate/refresh Penggajian DRAFT buat semua anggota studio di satu periode. Idempotent by
// design: baris yang statusnya udah FINAL/DIBAYAR di-skip total (gak boleh ke-utak-atik lagi),
// baris DRAFT yang sudah ada di-refresh (lembur ke-tambah dari CatatanLembur yang BARU belum
// ke-klaim, bukan diitung ulang dari nol -- entri lembur yang udah pernah ke-link ke baris ini
// gak boleh ke-double-count kalau generate dipanggil berkali-kali).
// gajiPokok baris BARU di-prefill dari UserRole.takeHomePay (Bio) -- CUMA sekali pas dibuat,
// BUKAN disinkronkan ulang tiap generate (baris existing gak pernah nimpa gajiPokok yang udah
// diedit manual koordinator). takeHomePay sendiri TETAP hidup terpisah buat CPM Studio.
// Satu generate per unit+periode pada satu waktu (proses tunggal pm2): dua klik bersamaan sebelumnya bisa mengklaim lembur yang sama dua kali.
const generateBerjalan = new Set()
export const generatePenggajian = async (req, res) => {
  const kunci = `${req.query.studioId}|${req.query.bulan}|${req.query.tahun}`
  if (generateBerjalan.has(kunci)) return res.status(409).json({ success: false, message: 'Generate untuk unit & periode ini sedang berjalan, tunggu sebentar' })
  generateBerjalan.add(kunci)
  try { return await generatePenggajianInti(req, res) } finally { generateBerjalan.delete(kunci) }
}
const generatePenggajianInti = async (req, res) => {
  try {
    const { studioId, bulan, tahun } = req.query
    if (!studioId || !bulan || !tahun) {
      return res.status(422).json({ success: false, message: 'studioId, bulan, dan tahun wajib diisi' })
    }
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa generate payroll studio sendiri' })
    }
    const bulanNum = Number(bulan)
    const tahunNum = Number(tahun)
    const periodeAwal = new Date(Date.UTC(tahunNum, bulanNum - 1, 1))
    const periodeAkhir = new Date(Date.UTC(tahunNum, bulanNum, 1))

    // takeHomePay dari Bio (UserRole, per user+studio) dipakai sebagai NILAI AWAL gajiPokok pas
    // baris Penggajian BARU dibuat -- bukan disinkronkan terus-menerus. Kalau user punya lebih
    // dari satu UserRole row di studio yang sama, ambil yang takeHomePay-nya keisi duluan.
    const userRoleRows = await prisma.userRole.findMany({
      where: { studioId }, select: { userId: true, takeHomePay: true },
      orderBy: { takeHomePay: { sort: 'desc', nulls: 'last' } },
    })
    const takeHomePayByUser = new Map()
    for (const r of userRoleRows) {
      if (!takeHomePayByUser.has(r.userId)) takeHomePayByUser.set(r.userId, r.takeHomePay ?? 0)
    }
    const userIds = [...takeHomePayByUser.keys()]

    // Template tunjangan aktif studio ini -- dipakai buat auto-generate baris TunjanganPenggajian
    // pas Penggajian BARU dibuat (nominal mulai dari 0, koordinator isi manual). Baris DRAFT yang
    // udah ada TIDAK di-refresh tunjangan-nya di sini -- tunjangan yang udah diisi manual gak
    // boleh ketimpa/ke-reset cuma karena generate dipanggil ulang.
    const tunjanganTemplateAktif = await prisma.tunjanganTemplate.findMany({ where: { studioId, aktif: true } })
    // Lembur PRESENSI web circle (21 Okt 2026): dihitung dengan ATURAN LEMBUR UNIT ini (diisi koordinator di web circle). Hanya lembur
    // DISETUJUI milik unit ini yang belum diklaim; tanpa tarif (atau mode Tidak dibayar) = acuan saja, tidak diklaim.
    const aturanLembur = await prisma.pengaturanLembur.findUnique({ where: { studioId } })
    const lemburBerbayar = hitungLembur([], aturanLembur).adaTarif
    const hkLembur = lemburBerbayar ? await hariKhususPeriode(periodeAwal, periodeAkhir) : new Map()

    let dibuat = 0
    let diupdate = 0
    const detailSkip = []

    for (const userId of userIds) {
      const existing = await prisma.penggajian.findUnique({
        where: { userId_studioId_bulan_tahun: { userId, studioId, bulan: bulanNum, tahun: tahunNum } },
      })

      if (existing && existing.status !== 'DRAFT') {
        detailSkip.push({ userId, alasan: `sudah berstatus ${existing.status}` })
        continue
      }

      // CatatanLembur yang BELUM ke-klaim payroll manapun (penggajianId null) di periode ini --
      // entri yang udah ke-link ke baris Penggajian ini dari generate SEBELUMNYA otomatis gak
      // kesertakan lagi di sini (penggajianId-nya udah keisi), jadi lembur-nya gak double-count.
      const unclaimed = await prisma.catatanLembur.findMany({
        where: { userId, tanggal: { gte: periodeAwal, lt: periodeAkhir }, penggajianId: null },
      })
      // Selisih uang (sudah diklaim slip ini + baru) − (sudah diklaim) → batas jam bulanan & pembulatan per hari tetap benar walau Generate diulang
      const presensi = lemburBerbayar ? await lemburPresensiUnit(userId, studioId, periodeAwal, periodeAkhir, { penggajianId: null }) : []
      const sudahDiklaim = presensi.length && existing ? await prisma.lemburKehadiran.findMany({ where: { penggajianId: existing.id } }) : []
      const uangPresensi = presensi.length ? hitungLembur([...sudahDiklaim, ...presensi], aturanLembur, hkLembur).uang - hitungLembur(sudahDiklaim, aturanLembur, hkLembur).uang : 0
      const tambahanLembur = unclaimed.reduce((s, c) => s + c.feeAkhir, 0) + uangPresensi

      let penggajian
      if (existing) {
        const lemburBaru = existing.lembur + tambahanLembur
        const tunjanganAgg = await prisma.tunjanganPenggajian.aggregate({
          where: { penggajianId: existing.id }, _sum: { jumlah: true },
        })
        const thpBaru = hitungThp({ ...existing, lembur: lemburBaru }, tunjanganAgg._sum.jumlah ?? 0)
        penggajian = await prisma.penggajian.update({
          where: { id: existing.id },
          data: { lembur: lemburBaru, thp: thpBaru },
        })
        diupdate++
      } else {
        const gajiPokok = takeHomePayByUser.get(userId) ?? 0
        const data = { userId, studioId, bulan: bulanNum, tahun: tahunNum, lembur: tambahanLembur, gajiPokok }
        // Tunjangan baris baru semua mulai dari 0, jadi totalTunjangan=0 gak ngaruh ke thp awal.
        penggajian = await prisma.penggajian.create({ data: { ...data, thp: hitungThp(data, 0) } })
        if (tunjanganTemplateAktif.length > 0) {
          await prisma.tunjanganPenggajian.createMany({
            data: tunjanganTemplateAktif.map(t => ({
              penggajianId: penggajian.id, templateId: t.id, nama: t.nama, jumlah: 0,
            })),
          })
        }
        dibuat++
      }

      if (presensi.length > 0) await prisma.lemburKehadiran.updateMany({ where: { id: { in: presensi.map(x => x.id) } }, data: { penggajianId: penggajian.id } })
      if (unclaimed.length > 0) {
        await prisma.catatanLembur.updateMany({
          where: { id: { in: unclaimed.map(c => c.id) } },
          data: { penggajianId: penggajian.id },
        })
      }
    }

    return res.json({ success: true, data: { dibuat, diupdate, diskip: detailSkip.length, detailSkip } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal generate payroll' })
  }
}

// tunjangan* SENGAJA gak ada di sini lagi -- itu baris dinamis (TunjanganPenggajian), diedit
// lewat endpoint terpisah (updateTunjanganJumlah/addTunjanganExtra/deleteTunjangan di bawah).
const EDITABLE_PENGGAJIAN_FIELDS = ['gajiPokok', 'bonus', 'komisi', 'shu', 'potongan']

async function totalTunjanganOf(penggajianId) {
  const agg = await prisma.tunjanganPenggajian.aggregate({ where: { penggajianId }, _sum: { jumlah: true } })
  return agg._sum.jumlah ?? 0
}

export const updatePenggajian = async (req, res) => {
  try {
    const existing = await prisma.penggajian.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Penggajian tidak ditemukan' })
    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa edit payroll studio sendiri' })
    }
    // Ngunci total begitu FINAL/DIBAYAR -- angka yang udah difinalisasi/dibayar gak boleh
    // berubah-ubah diam-diam, harus lewat alur resmi (kalau perlu revisi, itu keputusan produk
    // terpisah, belum ada endpoint "unfinalize" di sini secara sengaja).
    if (existing.status !== 'DRAFT') {
      return res.status(409).json({ success: false, message: 'Cuma payroll berstatus DRAFT yang bisa diedit' })
    }

    const data = {}
    for (const key of EDITABLE_PENGGAJIAN_FIELDS) {
      if (req.body[key] === undefined) continue
      const num = Number(req.body[key])
      if (!Number.isFinite(num) || num < 0) {
        return res.status(422).json({ success: false, message: `${key} wajib angka >= 0` })
      }
      data[key] = num
    }
    if (req.body.catatan !== undefined) data.catatan = req.body.catatan || null

    const totalTunjangan = await totalTunjanganOf(existing.id)
    data.thp = hitungThp({ ...existing, ...data }, totalTunjangan)

    const updated = await prisma.penggajian.update({ where: { id: existing.id }, data })
    return res.json({ success: true, data: updated })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui payroll' })
  }
}

// ── TunjanganPenggajian (baris dinamis per Penggajian) ────

async function findPenggajianForTunjangan(tunjanganId) {
  const tunjangan = await prisma.tunjanganPenggajian.findUnique({ where: { id: tunjanganId } })
  if (!tunjangan) return { error: 'Baris tunjangan tidak ditemukan', status: 404 }
  const penggajian = await prisma.penggajian.findUnique({ where: { id: tunjangan.penggajianId } })
  return { tunjangan, penggajian }
}

// Nambah baris tunjangan AD-HOC ke satu Penggajian -- templateId null (bukan dari template
// resmi studio), buat kasus one-off yang gak perlu dijadiin jenis tunjangan tetap.
export const addTunjanganExtra = async (req, res) => {
  try {
    const penggajian = await prisma.penggajian.findUnique({ where: { id: req.params.id } })
    if (!penggajian) return res.status(404).json({ success: false, message: 'Penggajian tidak ditemukan' })
    if (!(await canManageStudio(req.userRoles, penggajian.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa edit payroll studio sendiri' })
    }
    if (penggajian.status !== 'DRAFT') {
      return res.status(409).json({ success: false, message: 'Cuma payroll berstatus DRAFT yang bisa diedit' })
    }
    const { nama, jumlah } = req.body
    if (!nama) return res.status(422).json({ success: false, message: 'nama tunjangan wajib diisi' })
    const jumlahNum = jumlah != null ? Number(jumlah) : 0
    if (!Number.isFinite(jumlahNum) || jumlahNum < 0) {
      return res.status(422).json({ success: false, message: 'jumlah wajib angka >= 0' })
    }

    const baris = await prisma.tunjanganPenggajian.create({
      data: { penggajianId: penggajian.id, templateId: null, nama, jumlah: jumlahNum },
    })
    const totalTunjangan = await totalTunjanganOf(penggajian.id)
    await prisma.penggajian.update({
      where: { id: penggajian.id }, data: { thp: hitungThp(penggajian, totalTunjangan) },
    })
    return res.status(201).json({ success: true, data: baris })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menambah baris tunjangan' })
  }
}

export const updateTunjanganJumlah = async (req, res) => {
  try {
    const { tunjangan, penggajian, error, status: errStatus } = await findPenggajianForTunjangan(req.params.id)
    if (error) return res.status(errStatus).json({ success: false, message: error })
    if (!(await canManageStudio(req.userRoles, penggajian.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa edit payroll studio sendiri' })
    }
    if (penggajian.status !== 'DRAFT') {
      return res.status(409).json({ success: false, message: 'Cuma payroll berstatus DRAFT yang bisa diedit' })
    }
    const jumlahNum = Number(req.body.jumlah)
    if (!Number.isFinite(jumlahNum) || jumlahNum < 0) {
      return res.status(422).json({ success: false, message: 'jumlah wajib angka >= 0' })
    }
    const updated = await prisma.tunjanganPenggajian.update({ where: { id: tunjangan.id }, data: { jumlah: jumlahNum } })
    const totalTunjangan = await totalTunjanganOf(penggajian.id)
    await prisma.penggajian.update({
      where: { id: penggajian.id }, data: { thp: hitungThp(penggajian, totalTunjangan) },
    })
    return res.json({ success: true, data: updated })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui tunjangan' })
  }
}

export const deleteTunjangan = async (req, res) => {
  try {
    const { tunjangan, penggajian, error, status: errStatus } = await findPenggajianForTunjangan(req.params.id)
    if (error) return res.status(errStatus).json({ success: false, message: error })
    if (!(await canManageStudio(req.userRoles, penggajian.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa edit payroll studio sendiri' })
    }
    if (penggajian.status !== 'DRAFT') {
      return res.status(409).json({ success: false, message: 'Cuma payroll berstatus DRAFT yang bisa diedit' })
    }
    await prisma.tunjanganPenggajian.delete({ where: { id: tunjangan.id } })
    const totalTunjangan = await totalTunjanganOf(penggajian.id)
    await prisma.penggajian.update({
      where: { id: penggajian.id }, data: { thp: hitungThp(penggajian, totalTunjangan) },
    })
    return res.json({ success: true, message: 'Baris tunjangan dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus tunjangan' })
  }
}

export const finalizePenggajian = async (req, res) => {
  try {
    const existing = await prisma.penggajian.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Penggajian tidak ditemukan' })
    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa finalize payroll studio sendiri' })
    }
    if (existing.status !== 'DRAFT') {
      return res.status(409).json({ success: false, message: 'Cuma payroll berstatus DRAFT yang bisa di-finalize' })
    }
    const updated = await prisma.penggajian.update({ where: { id: existing.id }, data: { status: 'FINAL' } })
    return res.json({ success: true, data: updated })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal finalize payroll' })
  }
}

export const tandaiDibayarPenggajian = async (req, res) => {
  try {
    const existing = await prisma.penggajian.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Penggajian tidak ditemukan' })
    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa tandai dibayar payroll studio sendiri' })
    }
    if (existing.status !== 'FINAL') {
      return res.status(409).json({ success: false, message: 'Cuma payroll berstatus FINAL yang bisa ditandai dibayar' })
    }
    const { buktiBayar } = req.body
    const updated = await prisma.penggajian.update({
      where: { id: existing.id },
      data: { status: 'DIBAYAR', buktiBayar: buktiBayar || null },
    })
    return res.json({ success: true, data: updated })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menandai dibayar' })
  }
}

// KOORDINATOR ke atas (studio-nya sendiri) lihat SEMUA baris; role di bawah itu cuma lihat
// baris miliknya sendiri -- pola sama persis kayak getOrders di controllers/produksi.js
// (canManageStudio doang gak cukup, fallback terakhirnya kelewat permisif buat KARYAWAN/MAGANG).
export const getPenggajianList = async (req, res) => {
  try {
    const { studioId, bulan, tahun } = req.query
    if (!studioId) return res.status(422).json({ success: false, message: 'studioId wajib diisi' })

    const isManager = await canManageStudio(req.userRoles, studioId)
    const isKoordinatorPlus = req.userRoles?.some(r => STAFF_PLUS.includes(r.roleType))
    const onlyMine = !isManager || !isKoordinatorPlus

    const penggajian = await prisma.penggajian.findMany({
      where: {
        studioId,
        ...(bulan && { bulan: Number(bulan) }),
        ...(tahun && { tahun: Number(tahun) }),
        // Pemilik hanya melihat baris miliknya yang sudah FINAL/DIBAYAR — DRAFT masih angka kerja koordinator.
        ...(onlyMine ? { userId: req.user.id, status: { not: 'DRAFT' } } : {}),
      },
      include: { user: { select: { id: true, nama: true } }, tunjangan: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ user: { nama: 'asc' } }],
    })
    return res.json({ success: true, data: penggajian })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Slip gaji -- JSON dulu (siap dipakai render UI/PDF nanti), belum PDF di langkah ini. Bisa
// diakses manager studio ATAU pemilik baris itu sendiri (bukan cuma manager -- karyawan biasa
// harus bisa lihat slip gajinya sendiri).
export const getSlip = async (req, res) => {
  try {
    const penggajian = await prisma.penggajian.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, nama: true, posisi: true } },
        studio: { select: { id: true, nama: true } },
        catatanLembur: {
          include: {
            rateCard: { select: { level: true } },
            order: { select: { id: true, judul: true } },
          },
          orderBy: { tanggal: 'asc' },
        },
        tunjangan: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!penggajian) return res.status(404).json({ success: false, message: 'Penggajian tidak ditemukan' })

    // canManageStudio mengizinkan peran APA PUN di studio itu → harus juga Koordinator ke atas (STAFF_PLUS), sama seperti getPenggajianList.
    const isManager = (await canManageStudio(req.userRoles, penggajian.studioId)) && !!req.userRoles?.some(r => STAFF_PLUS.includes(r.roleType))
    const isOwner = penggajian.userId === req.user.id
    if (!isManager && !isOwner) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke slip ini' })
    }
    if (!isManager && penggajian.status === 'DRAFT') {
      return res.status(403).json({ success: false, message: 'Slip belum final, belum bisa dilihat' })
    }

    const presensiTerklaim = await prisma.lemburKehadiran.findMany({ where: { penggajianId: penggajian.id } })
    const aturanSlip = await prisma.pengaturanLembur.findUnique({ where: { studioId: penggajian.studioId } })
    const periodeSlip = [new Date(Date.UTC(penggajian.tahun, penggajian.bulan - 1, 1)), new Date(Date.UTC(penggajian.tahun, penggajian.bulan, 1))]
    const lemburSlip = hitungLembur(presensiTerklaim, aturanSlip, await hariKhususPeriode(...periodeSlip))
    const debet = {
      gajiPokok: penggajian.gajiPokok, bonus: penggajian.bonus, komisi: penggajian.komisi,
      lembur: penggajian.lembur, shu: penggajian.shu,
    }
    // Kredit (tunjangan) sekarang baris DINAMIS per studio (lihat TunjanganTemplate), bukan 5
    // kolom tetap lagi -- kirim apa adanya sebagai array {nama, jumlah}, client yang render list.
    const kredit = penggajian.tunjangan.map(t => ({ id: t.id, nama: t.nama, jumlah: t.jumlah }))
    const totalDebet = Object.values(debet).reduce((a, b) => a + b, 0)
    const totalKredit = kredit.reduce((a, t) => a + t.jumlah, 0)

    return res.json({
      success: true,
      data: {
        penggajian, debet, totalDebet, kredit, totalKredit, lemburPresensi: { menit: lemburSlip.menit, hari: lemburSlip.hari, jam: lemburSlip.jam, uang: lemburSlip.uang, mode: aturanSlip?.mode ?? null, tarifPerJam: aturanSlip?.tarifPerJam ?? null },
        potongan: penggajian.potongan, thp: penggajian.thp,
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Pilihan order untuk catatan lembur (pengganti GET /api/produksi/orders yang dihapus 21 Okt 2026): hanya id/judul/klien, tanpa nilai uang.
export const getOrderOpsi = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!studioId) return res.status(422).json({ success: false, message: 'studioId wajib diisi' })
    if (!(await canManageStudio(req.userRoles, studioId))) return res.status(403).json({ success: false, message: 'Hanya bisa lihat order studio sendiri' })
    const orders = await prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' } }, orderBy: { tanggalMasuk: 'desc' }, take: 300, select: { id: true, judul: true, klien: true } })
    return res.json({ success: true, data: orders })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Lembur dari presensi web circle per orang per bulan + tarif per jam unit (acuan untuk koordinator; masuk ke slip hanya lewat Generate bila tarif diisi).
export const getLemburPresensi = async (req, res) => {
  try {
    const { studioId, bulan, tahun } = req.query
    if (!studioId || !bulan || !tahun) return res.status(422).json({ success: false, message: 'studioId, bulan, dan tahun wajib diisi' })
    const isManager = (await canManageStudio(req.userRoles, studioId)) && !!req.userRoles?.some(r => STAFF_PLUS.includes(r.roleType))
    if (!isManager) return res.status(403).json({ success: false, message: 'Hanya Koordinator ke atas studio ini' })
    const awal = new Date(Date.UTC(Number(tahun), Number(bulan) - 1, 1)), akhir = new Date(Date.UTC(Number(tahun), Number(bulan), 1))
    const [pengaturan, peran, hk] = await Promise.all([prisma.pengaturanLembur.findUnique({ where: { studioId } }), prisma.userRole.findMany({ where: { studioId, roleType: { not: 'DIGNITY' } }, select: { userId: true } }), hariKhususPeriode(awal, akhir)])
    const ids = [...new Set(peran.map(p => p.userId))]
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } })
    const berbayar = hitungLembur([], pengaturan).adaTarif
    const orang = []
    for (const u of users) {
      const semua = await lemburPresensiUnit(u.id, studioId, awal, akhir)                       // DISETUJUI milik unit ini
      const menunggu = await prisma.lemburKehadiran.count({ where: { userId: u.id, status: 'MENUNGGU', tanggalKerja: { gte: awal, lt: akhir }, OR: [{ studioId }, { studioId: null }] } })
      const diklaim = semua.filter(x => x.penggajianId), belum = semua.filter(x => !x.penggajianId)
      const r = (b) => { const h = hitungLembur(b, pengaturan, hk); return { menit: h.menit, hari: h.hari, jam: h.jam, uang: h.uang } }
      if (semua.length || menunggu) orang.push({ userId: u.id, nama: u.nama, total: r(semua), sudahMasukSlip: r(diklaim), belumMasukSlip: r(belum), menungguPersetujuan: menunggu })
    }
    orang.sort((a, b) => b.total.menit - a.total.menit)
    return res.json({ success: true, data: { tarifPerJam: pengaturan?.tarifPerJam ?? null, mode: pengaturan?.mode ?? null, otomatis: berbayar, orang, catatan: berbayar ? 'Dihitung dengan aturan lembur unit (diatur koordinator di web circle). Hanya lembur DISETUJUI yang belum masuk slip ditambahkan ke komponen Lembur saat Generate, sekali saja.' : 'Aturan lembur unit belum punya tarif (atau "Tidak dibayar"): lembur presensi hanya acuan dan TIDAK menambah slip. Koordinator mengatur aturan di web circle → Kehadiran → Aturan lembur.' } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
export const setTarifLembur = async (req, res) => {
  try {
    const { studioId } = req.body ?? {}
    let tarif = req.body?.tarifPerJam
    if (!studioId) return res.status(422).json({ success: false, message: 'studioId wajib diisi' })
    const isManager = (await canManageStudio(req.userRoles, studioId)) && !!req.userRoles?.some(r => STAFF_PLUS.includes(r.roleType))
    if (!isManager) return res.status(403).json({ success: false, message: 'Hanya Koordinator ke atas studio ini' })
    if (tarif === '' || tarif == null || Number(tarif) === 0) tarif = null
    else { tarif = Number(tarif); if (!Number.isFinite(tarif) || tarif < 0 || tarif > 10000000) return res.status(422).json({ success: false, message: 'Tarif per jam harus angka 0–10.000.000 (kosongkan untuk mematikan)' }) }
    const nama = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null
    await prisma.pengaturanLembur.upsert({ where: { studioId }, update: { tarifPerJam: tarif, diubahOleh: nama }, create: { studioId, tarifPerJam: tarif, diubahOleh: nama } })
    return res.json({ success: true, message: tarif ? 'Tarif lembur disimpan' : 'Tarif dikosongkan: lembur presensi tidak ikut Generate' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
