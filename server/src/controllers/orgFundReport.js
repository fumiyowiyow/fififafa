import prisma from '../prisma.js'
import { canManageOrgUnit } from '../utils/roles.js'
import { getStartOfWeekWIB, getReportingPeriod } from '../utils/week.js'
import { lingkupKeuangan, samarkan } from '../utils/lingkup.js'

const TYPE_MODEL = {
  circle:     prisma.circle,
  rumahUsaha: prisma.rumahUsaha,
}

export const getStatus = async (req, res) => {
  try {
    const type = req.query.type
    if (!TYPE_MODEL[type]) {
      return res.status(422).json({ success: false, message: 'type wajib "circle" atau "rumahUsaha"' })
    }
    const fk = type === 'circle' ? 'circleId' : 'rumahUsahaId'

    const rawInput = req.query.weekStart ? new Date(req.query.weekStart) : getStartOfWeekWIB()
    const { periodeAwal: startOfWeek, periodeAkhir } = getReportingPeriod(rawInput)
    const endOfWeek = new Date(periodeAkhir.getTime() + 24 * 60 * 60 * 1000)

    // Circle tidak punya kolom statusAktif (beda dari RumahUsaha yang punya) -- semua circle
    // dianggap aktif, gak ada konsep nonaktifkan circle di app ini.
    // Dana circle / rumah usaha hanya terlihat oleh pengelolanya (Advisor/Kepala Ekosistem = semua).
    const lingkup = await lingkupKeuangan(req.userRoles)
    const idBoleh = type === 'circle' ? lingkup.circleIds : lingkup.rumahUsahaIds
    const entities = await TYPE_MODEL[type].findMany({
      where: type === 'rumahUsaha' ? { statusAktif: true } : {},
      select: {
        id: true, nama: true, colorHex: true,
        orgFundReports: {
          where: { periodeAwal: { gte: startOfWeek, lt: endOfWeek } },
          select: { id: true, dana: true, pengeluaran: true, catatan: true, periodeAwal: true, createdAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { nama: 'asc' },
    })

    const belumLaporIds = entities.filter(e => e.orgFundReports.length === 0).map(e => e.id)
    const prevReports = belumLaporIds.length > 0
      ? await prisma.orgFundReport.findMany({
          where: { [fk]: { in: belumLaporIds }, periodeAwal: { lt: startOfWeek } },
          select: { [fk]: true, dana: true, periodeAwal: true },
          distinct: [fk],
          orderBy: { periodeAwal: 'desc' },
        })
      : []
    const prevDanaMap = Object.fromEntries(prevReports.map(r => [r[fk], r.dana]))

    // Semua circle/rumah usaha tetap tampil dengan status lapornya; dana & pengeluaran milik orang lain disamarkan.
    const data = entities.map(e => {
      const milikku = lingkup.semua || idBoleh.has(e.id)
      const tutupi = (x) => (milikku ? x : samarkan(x, ['dana', 'pengeluaran']))
      return {
        ...e,
        orgFundReports: e.orgFundReports.map(tutupi),
        sudahLapor: e.orgFundReports.length > 0,
        laporanTerakhir: tutupi(e.orgFundReports[0] ?? null),
        danaSebelumnya: milikku && e.orgFundReports.length === 0 ? (prevDanaMap[e.id] ?? null) : null,
      }
    })

    return res.json({ success: true, data })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    const { circleId, rumahUsahaId, periodeAwal, periodeAkhir, dana, pengeluaran = 0, catatan } = req.body

    if ((!circleId && !rumahUsahaId) || (circleId && rumahUsahaId)) {
      return res.status(422).json({ success: false, message: 'Pilih salah satu: Circle atau Rumah Usaha' })
    }
    if (!periodeAwal || dana == null) {
      return res.status(422).json({ success: false, message: 'periodeAwal, dana wajib diisi' })
    }
    if (isNaN(new Date(periodeAwal).getTime())) {
      return res.status(422).json({ success: false, message: 'periodeAwal tidak valid' })
    }
    if ([dana, pengeluaran].some(v => isNaN(Number(v)) || Number(v) < 0)) {
      return res.status(422).json({ success: false, message: 'Dana dan pengeluaran tidak boleh negatif' })
    }
    if (!(await canManageOrgUnit(req.userRoles, { circleId, rumahUsahaId }))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke Circle/Rumah Usaha ini' })
    }

    // periodeAwal/periodeAkhir SELALU di-derive server-side (bukan percaya periodeAkhir kiriman
    // client) -- minggu dipotong di batas bulan buat laporan baru mulai Juli 2026.
    const { periodeAwal: periodeAwalReal, periodeAkhir: periodeAkhirReal } = getReportingPeriod(new Date(periodeAwal))

    const existing = await prisma.orgFundReport.findFirst({
      where: {
        periodeAwal: periodeAwalReal,
        ...(circleId ? { circleId } : { rumahUsahaId }),
      },
    })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Laporan minggu ini sudah ada. Gunakan tombol Update jika ingin mengubah.' })
    }

    const report = await prisma.orgFundReport.create({
      data: {
        circleId:     circleId     || null,
        rumahUsahaId: rumahUsahaId || null,
        periodeAwal:  periodeAwalReal,
        periodeAkhir: periodeAkhirReal,
        dana:         Number(dana),
        pengeluaran:  Number(pengeluaran),
        catatan:      catatan || null,
      },
    })
    return res.status(201).json({ success: true, data: report, message: 'Dana berhasil disimpan' })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Laporan minggu ini sudah ada. Gunakan tombol Update jika ingin mengubah.' })
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const { dana, pengeluaran, catatan, periodeAwal } = req.body

    const existing = await prisma.orgFundReport.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' })

    if (!(await canManageOrgUnit(req.userRoles, { circleId: existing.circleId, rumahUsahaId: existing.rumahUsahaId }))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke laporan ini' })
    }
    if ([dana, pengeluaran].some(v => v != null && (isNaN(Number(v)) || Number(v) < 0))) {
      return res.status(422).json({ success: false, message: 'Dana dan pengeluaran tidak boleh negatif' })
    }

    let periodeUpdate = {}
    if (periodeAwal != null) {
      const d = new Date(periodeAwal)
      if (isNaN(d.getTime())) {
        return res.status(422).json({ success: false, message: 'Periode tidak valid' })
      }
      periodeUpdate = getReportingPeriod(d)
    }

    const report = await prisma.orgFundReport.update({
      where: { id },
      data: {
        ...(dana        != null && { dana:        Number(dana) }),
        ...(pengeluaran != null && { pengeluaran: Number(pengeluaran) }),
        ...(catatan     !== undefined && { catatan }),
        ...periodeUpdate,
      },
    })
    return res.json({ success: true, data: report, message: 'Laporan berhasil diperbarui' })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Sudah ada laporan di minggu itu — pilih minggu lain' })
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
