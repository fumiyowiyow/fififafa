import prisma from '../prisma.js'
// Per unit (21 Okt 2026): Koordinator/Pendamping unit itu ke atas — bukan "pelapor di unit mana saja + peran apa pun di unit ini".
import { kelolaStudio as canManageStudio } from '../utils/roles.js'
import {
  KATEGORI_PENGELUARAN, KATEGORI_LAMA, KATEGORI_GAJI, KATEGORI_DATA_LAMA, parseTanggal,
  amankanDataLama, sinkronPengeluaranLaporan,
} from '../utils/pengeluaran.js'

// Pengeluaran aktual per item -- total mingguan di WeeklyReport ikut dihitung ulang tiap item
// berubah (lihat utils/pengeluaran.js). Akses = siapa pun yang boleh mengelola studio itu.

function validasi({ kategori, nama, jumlah }, { boleh_data_lama = false } = {}) {
  const kategoriOk = KATEGORI_PENGELUARAN.includes(kategori) || KATEGORI_LAMA.includes(kategori) || (boleh_data_lama && kategori === KATEGORI_DATA_LAMA)
  if (!kategoriOk) return `kategori wajib salah satu: ${KATEGORI_PENGELUARAN.join(', ')}`
  if (!nama || !String(nama).trim()) return 'Nama pengeluaran wajib diisi'
  const n = Number(jumlah)
  if (jumlah === '' || jumlah == null || isNaN(n) || n <= 0) return 'Jumlah wajib lebih dari 0'
  return null
}

export const list = async (req, res) => {
  try {
    const { studioId, dari, sampai } = req.query
    const tDari = parseTanggal(dari), tSampai = parseTanggal(sampai)
    if (!studioId || !tDari || !tSampai) {
      return res.status(422).json({ success: false, message: 'studioId, dari, sampai (YYYY-MM-DD) wajib diisi' })
    }
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
    }
    const items = await prisma.pengeluaran.findMany({
      where: { studioId, tanggal: { gte: tDari, lte: tSampai } },
      orderBy: [{ tanggal: 'asc' }, { createdAt: 'asc' }],
    })
    // Laporan yang punya total pengeluaran tapi BELUM satu pun item di periodenya (data lama / diketik
    // sebagai total): tampilkan sebagai satu baris baca-saja, supaya angka di sini sama dengan laporan
    // & PDF. Baris ini bukan data tersimpan (id null); begitu item pertama dicatat di minggu itu,
    // amankanDataLama() mengubahnya jadi item "data lama" sungguhan yang bisa dikoreksi.
    const laporan = await prisma.weeklyReport.findMany({
      where: { studioId, periodeAwal: { gte: tDari, lte: tSampai }, pengeluaran: { gt: 0 } },
      select: { periodeAwal: true, periodeAkhir: true, pengeluaran: true },
    })
    const tanpaRincian = laporan
      .filter(l => !items.some(i => i.tanggal >= l.periodeAwal && i.tanggal <= l.periodeAkhir))
      .map(l => ({
        id: null, studioId, tanggal: l.periodeAwal, kategori: KATEGORI_DATA_LAMA,
        nama: 'Total laporan (tanpa rincian)', jumlah: l.pengeluaran, tanpaRincian: true,
      }))
    const semua = [...items, ...tanpaRincian].sort((a, b) => a.tanggal - b.tanggal)
    return res.json({ success: true, data: semua })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil pengeluaran' })
  }
}

export const create = async (req, res) => {
  try {
    const { studioId, tanggal, kategori, nama, jumlah } = req.body
    const t = parseTanggal(tanggal)
    if (!studioId || !t) return res.status(422).json({ success: false, message: 'studioId dan tanggal (YYYY-MM-DD) wajib diisi' })
    const err = validasi({ kategori, nama, jumlah })
    if (err) return res.status(422).json({ success: false, message: err })
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
    }

    const item = await prisma.$transaction(async (tx) => {
      await amankanDataLama(studioId, t, req.user.id, tx)
      const baru = await tx.pengeluaran.create({
        data: { studioId, tanggal: t, kategori, nama: String(nama).trim(), jumlah: Number(jumlah), dicatatOleh: req.user.id },
      })
      await sinkronPengeluaranLaporan(studioId, t, tx)
      return baru
    })
    // "Beban orang" bisa menumpuk dengan THP di modul Payroll — hanya peringatan, tidak menolak (fee freelancer/upah lepas sah).
    let peringatan
    if (KATEGORI_GAJI.includes(kategori)) {
      const ada = await prisma.penggajian.count({ where: { studioId, bulan: t.getUTCMonth() + 1, tahun: t.getUTCFullYear() } })
      if (ada) peringatan = 'Bulan ini unit ini sudah punya data Payroll. Pastikan gaji yang sudah ada di Payroll tidak dicatat lagi di sini (fee/upah lepas tidak masalah).'
    }
    return res.status(201).json({ success: true, data: item, message: 'Pengeluaran dicatat', ...(peringatan && { peringatan }) })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mencatat pengeluaran' })
  }
}

export const update = async (req, res) => {
  try {
    const existing = await prisma.pengeluaran.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Pengeluaran tidak ditemukan' })
    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
    }
    const merged = {
      kategori: req.body.kategori ?? existing.kategori,
      nama:     req.body.nama     ?? existing.nama,
      jumlah:   req.body.jumlah   ?? existing.jumlah,
    }
    // Item DATA_LAMA boleh dikoreksi jumlah/namanya, tapi kategori lain gak boleh diubah JADI DATA_LAMA.
    const err = validasi(merged, { boleh_data_lama: existing.kategori === KATEGORI_DATA_LAMA })
    if (err) return res.status(422).json({ success: false, message: err })
    const t = req.body.tanggal != null ? parseTanggal(req.body.tanggal) : existing.tanggal
    if (!t) return res.status(422).json({ success: false, message: 'Tanggal tidak valid' })

    const item = await prisma.$transaction(async (tx) => {
      const pindahPeriode = t.getTime() !== existing.tanggal.getTime()
      if (pindahPeriode) await amankanDataLama(existing.studioId, t, req.user.id, tx)
      const hasil = await tx.pengeluaran.update({
        where: { id: existing.id },
        data: { tanggal: t, kategori: merged.kategori, nama: String(merged.nama).trim(), jumlah: Number(merged.jumlah) },
      })
      await sinkronPengeluaranLaporan(existing.studioId, existing.tanggal, tx)
      if (pindahPeriode) await sinkronPengeluaranLaporan(existing.studioId, t, tx)
      return hasil
    })
    return res.json({ success: true, data: item, message: 'Pengeluaran diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengeluaran' })
  }
}

export const remove = async (req, res) => {
  try {
    const existing = await prisma.pengeluaran.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Pengeluaran tidak ditemukan' })
    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
    }
    await prisma.$transaction(async (tx) => {
      await tx.pengeluaran.delete({ where: { id: existing.id } })
      await sinkronPengeluaranLaporan(existing.studioId, existing.tanggal, tx)
    })
    return res.json({ success: true, message: 'Pengeluaran dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengeluaran' })
  }
}

// Hapus TOTAL LAMA tanpa rincian di laporan satu minggu (baris "Total laporan (tanpa rincian)" di tab).
// Hanya boleh kalau minggu itu belum punya item sama sekali (kalau sudah ada item, total laporan
// sudah dihitung dari item dan dihapus/diubah lewat item itu). Efeknya: pengeluaran laporan jadi 0.
export const hapusTotalLama = async (req, res) => {
  try {
    const { studioId, periodeAwal } = req.query
    const t = parseTanggal(periodeAwal)
    if (!studioId || !t) return res.status(422).json({ success: false, message: 'studioId dan periodeAwal (YYYY-MM-DD) wajib diisi' })
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
    }
    const laporan = await prisma.weeklyReport.findFirst({ where: { studioId, periodeAwal: t } })
    if (!laporan) return res.status(404).json({ success: false, message: 'Laporan minggu itu tidak ditemukan' })
    if (!(laporan.pengeluaran > 0)) return res.status(409).json({ success: false, message: 'Tidak ada total lama untuk dihapus' })
    const adaItem = await prisma.pengeluaran.count({ where: { studioId, tanggal: { gte: laporan.periodeAwal, lte: laporan.periodeAkhir } } })
    if (adaItem > 0) return res.status(409).json({ success: false, message: 'Minggu ini sudah punya item; hapus lewat itemnya' })
    await prisma.weeklyReport.update({ where: { id: laporan.id }, data: { pengeluaran: 0 } })
    return res.json({ success: true, data: { dihapus: laporan.pengeluaran }, message: 'Total lama dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus total lama' })
  }
}
