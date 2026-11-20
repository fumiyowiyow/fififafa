import prisma from '../prisma.js'
import { parsePagination } from '../utils/roles.js'

const POOL_ID = 'dp-pool-main'

// ─── POOL ────────────────────────────────────────────────
// totalPoolUsd = angka UTAMA (diisi langsung, tidak diturunkan dari kurs — kurs historis sering
// tidak diketahui persis). totalPool (Rp) cuma catatan historis nominal asli. kurs = live, buat
// konversi tampilan Rupiah equity terkini saja.
export const getPool = async (req, res) => {
  try {
    const pool = await prisma.danaPengembanganPool.findUnique({ where: { id: POOL_ID } })
    // Sengaja TIDAK filter statusAktif — unit yang dinonaktifkan modalnya belum tentu sudah
    // ditarik balik ke pool (itu perlu WITHDRAW eksplisit), jadi tetap dihitung teralokasi
    // supaya "sisa belum dialokasikan" tidak keliru naik seolah ada dana menganggur.
    const units = await prisma.danaPengembanganUnit.findMany({
      select: { modalAwalUsd: true },
    })
    const kurs = pool?.kurs ?? 17000
    const totalPoolUsd = pool?.totalPoolUsd ?? 0
    const totalAlokasiUsd = units.reduce((a, u) => a + u.modalAwalUsd, 0)
    const sisaBelumDialokasikanUsd = totalPoolUsd - totalAlokasiUsd

    return res.json({
      success: true,
      data: {
        ...pool,
        kurs,
        totalPoolUsd,
        totalAlokasiUsd,
        sisaBelumDialokasikanUsd,
        totalAlokasi: totalAlokasiUsd * kurs,
        sisaBelumDialokasikan: sisaBelumDialokasikanUsd * kurs,
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updatePool = async (req, res) => {
  try {
    const { totalPool, totalPoolUsd, kurs, catatan } = req.body
    if (totalPool == null || isNaN(Number(totalPool)) || Number(totalPool) < 0) {
      return res.status(422).json({ success: false, message: 'totalPool wajib diisi angka, tidak boleh negatif' })
    }
    if (totalPoolUsd == null || isNaN(Number(totalPoolUsd)) || Number(totalPoolUsd) < 0) {
      return res.status(422).json({ success: false, message: 'totalPoolUsd wajib diisi angka, tidak boleh negatif' })
    }
    if (kurs == null || isNaN(Number(kurs)) || Number(kurs) <= 0) {
      return res.status(422).json({ success: false, message: 'kurs wajib diisi angka lebih dari 0' })
    }
    const pool = await prisma.danaPengembanganPool.upsert({
      where: { id: POOL_ID },
      create: { id: POOL_ID, totalPool: Number(totalPool), totalPoolUsd: Number(totalPoolUsd), kurs: Number(kurs), catatan: catatan ?? null, updatedBy: req.user.id },
      update: { totalPool: Number(totalPool), totalPoolUsd: Number(totalPoolUsd), kurs: Number(kurs), catatan: catatan ?? null, updatedBy: req.user.id },
    })
    return res.json({ success: true, data: pool, message: 'Dana awal berhasil diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ─── PENGELOLA (dropdown) ────────────────────────────────
export const getPengelolaList = async (req, res) => {
  try {
    const roles = await prisma.userRole.findMany({
      where: { roleType: 'PENGELOLA_DANA' },
      include: { user: { select: { id: true, nama: true } } },
    })
    const unique = Object.values(Object.fromEntries(roles.map((r) => [r.user.id, r.user])))
    return res.json({ success: true, data: unique })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ─── TIMELINE (gabungan total equity semua unit per tanggal, buat chart) ──
export const getTimeline = async (req, res) => {
  try {
    const units = await prisma.danaPengembanganUnit.findMany({
      select: { id: true, modalAwalUsd: true },
    })
    const laporan = await prisma.danaPengembanganLaporan.findMany({
      select: { unitId: true, periodeAwal: true, equityUsd: true },
      orderBy: { periodeAwal: 'asc' },
    })

    if (laporan.length === 0) {
      return res.json({ success: true, data: [] })
    }

    const dates = [...new Set(laporan.map((l) => l.periodeAwal.getTime()))].sort((a, b) => a - b)

    const timeline = dates.map((ts) => {
      let totalEquityUsd = 0
      for (const u of units) {
        const relevant = laporan
          .filter((l) => l.unitId === u.id && l.periodeAwal.getTime() <= ts)
          .sort((a, b) => b.periodeAwal.getTime() - a.periodeAwal.getTime())[0]
        totalEquityUsd += relevant ? relevant.equityUsd : u.modalAwalUsd
      }
      return { tanggal: new Date(ts).toISOString(), totalEquityUsd }
    })

    return res.json({ success: true, data: timeline })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ─── UNITS ───────────────────────────────────────────────
// totalDepositUsd/totalWithdrawUsd (lifetime) dikirim biar client bisa hitung P/L standar:
// P/L = (equity - modalAwal) + totalWithdraw - totalDeposit — supaya modal masuk/keluar
// tidak ketukar sama untung/rugi trading beneran.
export const getUnits = async (req, res) => {
  try {
    const units = await prisma.danaPengembanganUnit.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        pengelola: { select: { id: true, nama: true } },
        laporan: { orderBy: { periodeAwal: 'desc' }, take: 1 },
        transaksi: { select: { tipe: true, jumlahUsd: true } },
      },
    })
    return res.json({
      success: true,
      data: units.map(({ laporan, transaksi, ...u }) => ({
        ...u,
        laporanTerakhir: laporan[0] ?? null,
        totalDepositUsd: transaksi.filter((t) => t.tipe === 'DEPOSIT').reduce((a, t) => a + t.jumlahUsd, 0),
        totalWithdrawUsd: transaksi.filter((t) => t.tipe === 'WITHDRAW').reduce((a, t) => a + t.jumlahUsd, 0),
      })),
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createUnit = async (req, res) => {
  try {
    const { nama, tipe, pengelolaId, modalAwalUsd, keterangan } = req.body
    if (!nama || !tipe || !pengelolaId || modalAwalUsd == null) {
      return res.status(422).json({ success: false, message: 'nama, tipe, pengelolaId, modalAwalUsd wajib diisi' })
    }
    if (isNaN(Number(modalAwalUsd)) || Number(modalAwalUsd) < 0) {
      return res.status(422).json({ success: false, message: 'modalAwalUsd harus angka, tidak boleh negatif' })
    }
    const unit = await prisma.danaPengembanganUnit.create({
      data: { nama, tipe, pengelolaId, modalAwalUsd: Number(modalAwalUsd), keterangan: keterangan || null },
      include: { pengelola: { select: { id: true, nama: true } } },
    })
    return res.status(201).json({ success: true, data: unit, message: 'Unit berhasil ditambahkan' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateUnit = async (req, res) => {
  try {
    const { id } = req.params
    const { nama, tipe, pengelolaId, modalAwalUsd, statusAktif, keterangan } = req.body
    const existing = await prisma.danaPengembanganUnit.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Unit tidak ditemukan' })
    if (modalAwalUsd != null && (isNaN(Number(modalAwalUsd)) || Number(modalAwalUsd) < 0)) {
      return res.status(422).json({ success: false, message: 'modalAwalUsd harus angka, tidak boleh negatif' })
    }

    const unit = await prisma.danaPengembanganUnit.update({
      where: { id },
      data: {
        ...(nama !== undefined && { nama }),
        ...(tipe !== undefined && { tipe }),
        ...(pengelolaId !== undefined && { pengelolaId }),
        ...(modalAwalUsd != null && { modalAwalUsd: Number(modalAwalUsd) }),
        ...(statusAktif != null && { statusAktif: Boolean(statusAktif) }),
        ...(keterangan !== undefined && { keterangan }),
      },
      include: { pengelola: { select: { id: true, nama: true } } },
    })
    return res.json({ success: true, data: unit, message: 'Unit berhasil diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const removeUnit = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await prisma.danaPengembanganUnit.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Unit tidak ditemukan' })
    await prisma.danaPengembanganUnit.delete({ where: { id } }) // cascade hapus laporan
    return res.json({ success: true, message: 'Unit berhasil dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ─── LAPORAN ─────────────────────────────────────────────
export const getLaporan = async (req, res) => {
  try {
    const { unitId } = req.params
    const { page, limit, skip } = parsePagination(req.query, 52) // ~1 tahun mingguan
    const [laporan, total] = await Promise.all([
      prisma.danaPengembanganLaporan.findMany({ where: { unitId }, skip, take: limit, orderBy: { periodeAwal: 'desc' } }),
      prisma.danaPengembanganLaporan.count({ where: { unitId } }),
    ])
    return res.json({ success: true, data: laporan, pagination: { page, limit, total } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createLaporan = async (req, res) => {
  try {
    const { unitId } = req.params
    const { periodeAwal, periodeAkhir, equityUsd, prosesnya } = req.body

    if (!periodeAwal || !periodeAkhir || equityUsd == null || !prosesnya) {
      return res.status(422).json({ success: false, message: 'periodeAwal, periodeAkhir, equityUsd, prosesnya wajib diisi' })
    }
    if (new Date(periodeAkhir) < new Date(periodeAwal)) {
      return res.status(422).json({ success: false, message: 'periodeAkhir tidak boleh sebelum periodeAwal' })
    }

    const unit = await prisma.danaPengembanganUnit.findUnique({ where: { id: unitId } })
    if (!unit) return res.status(404).json({ success: false, message: 'Unit tidak ditemukan' })

    const existing = await prisma.danaPengembanganLaporan.findFirst({ where: { unitId, periodeAwal: new Date(periodeAwal) } })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Laporan untuk unit dan minggu ini sudah ada. Gunakan tombol Edit.' })
    }

    const laporan = await prisma.danaPengembanganLaporan.create({
      data: {
        unitId,
        periodeAwal: new Date(periodeAwal),
        periodeAkhir: new Date(periodeAkhir),
        equityUsd: Number(equityUsd),
        prosesnya,
        dilaporkanOleh: req.user.id,
      },
    })

    return res.status(201).json({ success: true, data: laporan, message: 'Laporan mingguan berhasil disimpan' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateLaporan = async (req, res) => {
  try {
    const { id } = req.params
    const { periodeAkhir, equityUsd, prosesnya } = req.body

    const existing = await prisma.danaPengembanganLaporan.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' })

    const laporan = await prisma.danaPengembanganLaporan.update({
      where: { id },
      data: {
        ...(periodeAkhir !== undefined && { periodeAkhir: new Date(periodeAkhir) }),
        ...(equityUsd != null && { equityUsd: Number(equityUsd) }),
        ...(prosesnya !== undefined && { prosesnya }),
      },
    })

    return res.json({ success: true, data: laporan, message: 'Laporan berhasil diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const removeLaporan = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await prisma.danaPengembanganLaporan.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' })

    await prisma.danaPengembanganLaporan.delete({ where: { id } })

    return res.json({ success: true, message: 'Laporan berhasil dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ─── TRANSAKSI (deposit / withdraw, masing-masing kurs sendiri) ──
export const getTransaksi = async (req, res) => {
  try {
    const { unitId } = req.params
    const transaksi = await prisma.danaPengembanganTransaksi.findMany({ where: { unitId }, orderBy: { tanggal: 'desc' } })
    return res.json({ success: true, data: transaksi })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createTransaksi = async (req, res) => {
  try {
    const { unitId } = req.params
    const { tipe, tanggal, jumlahUsd, kurs, keterangan } = req.body
    if (!tipe || !['DEPOSIT', 'WITHDRAW'].includes(tipe)) {
      return res.status(422).json({ success: false, message: 'tipe wajib DEPOSIT atau WITHDRAW' })
    }
    if (!tanggal || jumlahUsd == null || kurs == null) {
      return res.status(422).json({ success: false, message: 'tanggal, jumlahUsd, kurs wajib diisi' })
    }
    if (!(Number(jumlahUsd) > 0) || !(Number(kurs) > 0)) {
      return res.status(422).json({ success: false, message: 'jumlahUsd dan kurs harus lebih besar dari 0' })
    }
    const unit = await prisma.danaPengembanganUnit.findUnique({ where: { id: unitId } })
    if (!unit) return res.status(404).json({ success: false, message: 'Unit tidak ditemukan' })

    const transaksi = await prisma.danaPengembanganTransaksi.create({
      data: {
        unitId,
        tipe,
        tanggal: new Date(tanggal),
        jumlahUsd: Number(jumlahUsd),
        kurs: Number(kurs),
        keterangan: keterangan || null,
        dicatatOleh: req.user.id,
      },
    })
    return res.status(201).json({ success: true, data: transaksi, message: 'Transaksi berhasil dicatat' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const removeTransaksi = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await prisma.danaPengembanganTransaksi.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' })

    await prisma.danaPengembanganTransaksi.delete({ where: { id } })

    return res.json({ success: true, message: 'Transaksi berhasil dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
