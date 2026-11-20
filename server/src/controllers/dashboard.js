import prisma from '../prisma.js'
import { getStartOfWeekWIB, getMonthAttributionRange, getReportingPeriod, isReportInMonth } from '../utils/week.js'
import { getKasMapForStudios } from '../utils/kas.js'
import { bestLevel, ROLE_LEVEL } from '../utils/roles.js'
import { lingkupKeuangan, filterStudioId, infoLingkup, semuaDalamLingkup } from '../utils/lingkup.js'
import { STUDIO_DIHITUNG, LAPORAN_DIHITUNG, PERAN_DIHITUNG, userDihitung, studioKolaborasi } from '../utils/kolaborasi.js'


export const overview = async (req, res) => {
  try {
    // Angka omset mentah cuma buat KADER ke atas -- daftar circle/rumah usaha/statistik anggota
    // di endpoint yang sama tetap kelihatan semua role (dipakai halaman Goals buat dropdown scope).
    const bolehLihatOmset = bestLevel(req.userRoles) <= ROLE_LEVEL.KADER
    // Jumlah/status tetap seluruhnya; ANGKA UANG hanya dari unit dalam wilayah peran (Advisor/Kepala Ekosistem = semua),
    // sisanya disamarkan -- utils/lingkup.js.
    const lingkup = await lingkupKeuangan(req.userRoles)
    const fS = filterStudioId(lingkup)

    const weekStart  = getStartOfWeekWIB()
    const now = new Date()
    const bulanIni = now.getMonth() + 1
    const tahunIni = now.getFullYear()
    // Minggu yang nyebrang bulan diatribusikan ke bulan dengan hari terbanyak (lihat
    // getMonthAttributionRange) -- konsisten sama Rekap Bulanan, bukan cuma tanggal 1 kalender.
    const { rangeStart: monthStart } = getMonthAttributionRange(bulanIni, tahunIni)
    const bulanLalu = bulanIni === 1 ? 12 : bulanIni - 1
    const tahunLalu = bulanIni === 1 ? tahunIni - 1 : tahunIni

    const [
      totalUsers, totalStudios, totalCircles,
      tierCounts, circles, rumahUsahaList, weeklyReportsThisWeek,
      omsetThisWeek, omsetThisMonthReports, reportsCircle,
    ] = await Promise.all([
      // "Total Anggota" cuma ngitung akun yang beneran di tim kerja -- punya minimal 1 posisi
      // yang BUKAN PENGELOLA_DANA/DIGNITY/PENDAMPING (tag/posisi administratif, bukan anggota
      // tim operasional harian -- keputusan eksplisit user). SENGAJA gak disyaratkan "harus
      // nempel studio/circle/rumah usaha" -- role global (ADVISOR/KEPALA_EKOSISTEM)
      // memang didesain gak nempel unit manapun (wewenangnya se-ekosistem), bukan berarti
      // bukan anggota tim. Sebelumnya count() polos ikut ngitung akun "shell" tanpa role sama
      // sekali (mis. pemilik saham murni dari alur Tambah Pemilik di Kepemilikan Saham) -- itu
      // akun buat pencatatan, bukan anggota beneran; roles:{some:{...}} otomatis nyisihin itu
      // juga (nol role = gak match apa pun).
      prisma.user.count({
        where: {
          statusAktif: true,
          // Studio kolaborasi (mis. Souldear/Auralist): anggota yang HANYA punya peran di sana tidak
          // terhitung; yang punya peran lain di Ekosistem (mis. koordinator Kiddoru) tetap terhitung.
          ...userDihitung(['PENGELOLA_DANA', 'DIGNITY', 'PENDAMPING']),
        },
      }),
      prisma.studio.count({ where: { statusAktif: true, ...STUDIO_DIHITUNG } }),
      prisma.circle.count(),
      prisma.userRole.groupBy({
        by: ['roleType'], _count: { userId: true },
        where: { roleType: { in: ['KOORDINATOR','KARYAWAN','MAGANG','DIGNITY'] }, ...PERAN_DIHITUNG },
      }),
      prisma.circle.findMany({
        include: {
          studios: { where: STUDIO_DIHITUNG, select: { id: true, nama: true, tipe: true, statusAktif: true } },
          _count:  { select: { userRoles: true } },
        },
      }),
      prisma.rumahUsaha.findMany({
        where: { statusAktif: true },
        include: {
          studios: { where: STUDIO_DIHITUNG, select: { id: true, nama: true, tipe: true, statusAktif: true } },
          _count:  { select: { userRoles: true } },
        },
      }),
      prisma.weeklyReport.count({ where: { periodeAwal: { gte: weekStart }, ...LAPORAN_DIHITUNG } }),
      prisma.weeklyReport.aggregate({
        where: { periodeAwal: { gte: weekStart }, ...LAPORAN_DIHITUNG, ...fS },
        _sum: { totalUsd: true },
      }),
      // findMany + filter (bukan aggregate langsung) -- rentang monthStart sekarang cuma batas
      // fetch AMAN (over-inclusive), butuh baris mentah buat difilter presisi lewat
      // isReportInMonth() sebelum dijumlah (lihat week.js).
      prisma.weeklyReport.findMany({
        where: { periodeAwal: { gte: monthStart }, ...LAPORAN_DIHITUNG, ...fS },
        select: { totalUsd: true, periodeAwal: true, periodeAkhir: true },
      }),
      // Buat performa gabungan per circle: bulan ini + bulan lalu (growth) + minggu ini
      // (kepatuhan lapor). Fetch lebar dari awal bulan lalu, difilter presisi di bawah.
      bolehLihatOmset
        ? prisma.weeklyReport.findMany({
            where: { periodeAwal: { gte: getMonthAttributionRange(bulanLalu, tahunLalu).rangeStart }, ...LAPORAN_DIHITUNG },
            select: { studioId: true, totalUsd: true, kurs: true, periodeAwal: true, periodeAkhir: true,
                      studio: { select: { circleId: true, rumahUsahaId: true } } },
          })
        : Promise.resolve([]),
    ])

    // Total Dana Usaha = Kas studio (live Rekening Bank) + Dana di Luar Kas -- definisi sama
    // kayak totalEkuitasUsaha di getMonthlySummary. Dana di Luar Kas: catatan bulan ini, kalau
    // belum ada pakai catatan TERAKHIR studio itu (pola sama).
    let kasMap = {}, ekuitasMap = {}
    if (bolehLihatOmset) {
      const idsAktif = [...circles, ...rumahUsahaList].flatMap(u => u.studios).filter(st => st.statusAktif).map(st => st.id)
      const notes = await prisma.studioMonthlyNote.findMany({
        where: { studioId: { in: idsAktif } },
        distinct: ['studioId'],
        orderBy: [{ studioId: 'asc' }, { tahun: 'desc' }, { bulan: 'desc' }],
      })
      kasMap = await getKasMapForStudios(idsAktif)
      ekuitasMap = Object.fromEntries(notes.map(n => [n.studioId, n.ekuitas ?? 0]))
    }

    const omsetThisMonthUsd = omsetThisMonthReports
      .filter(r => isReportInMonth(r, bulanIni, tahunIni))
      .reduce((a, r) => a + r.totalUsd, 0)

    // Performa gabungan per circle / rumah usaha (cuma buat yang boleh lihat omset). Studio aktif dihitung
    // sebagai pembagi kepatuhan lapor & rata-rata omset per studio.
    const performaUnit = (c, field) => {
      if (!bolehLihatOmset) return null
      const studioAktif = c.studios.filter(st => st.statusAktif)
      const rep = reportsCircle.filter(r => r.studio[field] === c.id)
      const sum = (arr) => arr.reduce((a, r) => a + r.totalUsd, 0)
      const repBulanIni    = rep.filter(r => isReportInMonth(r, bulanIni, tahunIni))
      const omsetBulanIni  = sum(repBulanIni)
      const omsetRp        = repBulanIni.reduce((a, r) => a + r.totalUsd * r.kurs, 0)
      const kas            = studioAktif.reduce((a, st) => a + (kasMap[st.id] ?? 0), 0)
      const danaDiLuarKas  = studioAktif.reduce((a, st) => a + (ekuitasMap[st.id] ?? 0), 0)
      const omsetBulanLalu = sum(rep.filter(r => isReportInMonth(r, bulanLalu, tahunLalu)))
      const sudahLapor = new Set(
        rep.filter(r => r.periodeAwal >= weekStart).map(r => r.studioId)
      ).size
      // Total circle/rumah usaha hanya terbuka bila SEMUA unitnya dalam wilayah peran (Kepala Circle di circle-nya,
      // Advisor/Kepala Ekosistem di mana saja); jika tidak, uangnya disamarkan -- total sebagian akan menyesatkan.
      const uangTerbuka = semuaDalamLingkup(lingkup, studioAktif.map(st => st.id))
      const u = (v) => (uangTerbuka ? v : null)
      return {
        _asli: omsetBulanIni,
        omsetBulanIni: u(omsetBulanIni), omsetRp: u(omsetRp), omsetBulanLalu: u(omsetBulanLalu),
        kas: u(kas), danaDiLuarKas: u(danaDiLuarKas), totalDanaUsaha: u(kas + danaDiLuarKas),
        // null kalau bulan lalu 0 -- persen dari nol gak bermakna
        growthPct: uangTerbuka && omsetBulanLalu > 0
          ? Math.round(((omsetBulanIni - omsetBulanLalu) / omsetBulanLalu) * 100)
          : null,
        omsetPerStudio: u(studioAktif.length ? omsetBulanIni / studioAktif.length : 0),
        studioAktif: studioAktif.length,
        sudahLapor,
        kepatuhanPct: studioAktif.length ? Math.round((sudahLapor / studioAktif.length) * 100) : 0,
      }
    }

    // Anggota Ekosistem = orang (bukan baris peran) yang punya peran di unit: Koordinator/Kader/Karyawan/Magang,
    // di luar studio kolaborasi. Pimpinan (Advisor, Kepala, Admin Fungsional), Pendamping, Penasihat,
    // Dignity, Pengelola Dana tidak dihitung terpisah. Satu orang masuk satu kelompok: Koordinator >
    // Karyawan/Kader > Magang saja (7 Nov 2026).
    const peranUnit = (roleTypes) => ({ roles: { some: { roleType: { in: roleTypes }, ...PERAN_DIHITUNG } } })
    const adaPengurus = peranUnit(['KOORDINATOR'])
    const adaStaf     = peranUnit(['KARYAWAN', 'KADER'])
    const [nPengurus, nStaf, nMagang] = await Promise.all([
      prisma.user.count({ where: { statusAktif: true, ...adaPengurus } }),
      prisma.user.count({ where: { statusAktif: true, ...adaStaf, NOT: adaPengurus } }),
      prisma.user.count({ where: { statusAktif: true, ...peranUnit(['MAGANG']), NOT: { OR: [adaPengurus, adaStaf] } } }),
    ])
    const totalAnggota = nPengurus + nStaf + nMagang

    // Studio kolaborasi (angkanya dihitung di circle mitra): tampil TERPISAH, tidak masuk total di atas.
    const kolaborasiStudios = await studioKolaborasi({ id: true, nama: true, mitraKolaborasi: true, circle: { select: { nama: true } } })
    let kolaborasi = []
    if (kolaborasiStudios.length) {
      const ids = kolaborasiStudios.map(st => st.id)
      // Periode lapor yang sama dengan widget "Laporan Minggu Ini" (status/week): dipotong di batas bulan.
      const { periodeAwal: awalPeriodeLapor } = getReportingPeriod(weekStart)
      const kasKol = bolehLihatOmset ? await getKasMapForStudios(ids.filter(id => lingkup.boleh(id))) : {}
      const repKol = await prisma.weeklyReport.findMany({
        where: { studioId: { in: ids }, periodeAwal: { gte: monthStart } },
        select: { studioId: true, totalUsd: true, periodeAwal: true, periodeAkhir: true },
      })
      kolaborasi = kolaborasiStudios.map(st => {
        const rep = repKol.filter(r => r.studioId === st.id)
        return {
          id: st.id, nama: st.nama, mitra: st.mitraKolaborasi, circle: st.circle?.nama ?? null,
          sudahLapor: rep.some(r => r.periodeAwal >= awalPeriodeLapor),
          omsetBulanIni: bolehLihatOmset && lingkup.boleh(st.id) ? rep.filter(r => isReportInMonth(r, bulanIni, tahunIni)).reduce((a, r) => a + r.totalUsd, 0) : null,
          kas: bolehLihatOmset && lingkup.boleh(st.id) ? (kasKol[st.id] ?? 0) : null,
        }
      })
    }

    // Peringkat circle/rumah usaha dari omset ASLI (bilangan urut, bukan uang), lalu buang angka mentahnya.
    const beriPeringkat = (daftar) => {
      const urut = daftar.filter(x => x.performa).sort((a, b) => b.performa._asli - a.performa._asli)
      urut.forEach((x, i) => { x.performa.peringkat = i + 1 })
      daftar.forEach(x => { if (x.performa) delete x.performa._asli })
      return daftar
    }
    const circlesOut = beriPeringkat(circles.map(c => ({
      id: c.id, nama: c.nama, colorHex: c.colorHex,
      totalStudio:  c.studios.length,
      totalAnggota: c._count.userRoles,
      performa: performaUnit(c, 'circleId'),
    })))
    const rumahUsahaOut = beriPeringkat(rumahUsahaList.map(ru => ({
      id: ru.id, nama: ru.nama, colorHex: ru.colorHex ?? '#0EA5E9',
      totalStudio:  ru.studios.length,
      totalAnggota: ru._count.userRoles,
      performa: performaUnit(ru, 'rumahUsahaId'),
    })))

    return res.json({
      success: true,
      data: {
        totalUsers: totalAnggota, totalStudios, totalCircles,
        tier: {
          tetap:    nPengurus,
          karyawan: nStaf,
          magang:   nMagang,
        },
        omset: bolehLihatOmset ? {
          mingguIni: omsetThisWeek._sum.totalUsd ?? 0,
          bulanIni:  omsetThisMonthUsd,
        } : { mingguIni: null, bulanIni: null },
        weeklyReportsThisWeek,
        lingkup: infoLingkup(lingkup),
        kolaborasi,
        circles: circlesOut,
        rumahUsaha: rumahUsahaOut,
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

