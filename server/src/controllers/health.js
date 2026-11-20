import prisma from '../prisma.js'
import { getMonthAttributionRange, getReportingPeriod, isReportInMonth } from '../utils/week.js'
import { bestLevel, ROLE_LEVEL } from '../utils/roles.js'
import { getKondisiTimMap } from '../utils/penilaianKader.js'
import { STUDIO_DIHITUNG } from '../utils/kolaborasi.js'
import { lingkupKeuangan, semuaDalamLingkup } from '../utils/lingkup.js'

// Deadline lapor studio = HARI TERAKHIR periode laporan yang lagi berjalan (periodeAkhir dari
// getReportingPeriod) -- bisa minggu penuh Senin-Minggu (deadline Sabtu, kayak sebelumnya) ATAU
// stub pendek di awal/akhir bulan (deadline di hari terakhir stub itu, apapun harinya). "Sebelum
// deadline" (masih lihat laporan periode SEBELUMNYA yang udah pasti lengkap, bukan periode
// berjalan yang belum cukup waktu buat wajar ditagih) niru proporsi pola lama: 3 hari TERAKHIR
// dari 7 hari (Jumat-Minggu) = zona deadline, 4 hari pertama (Senin-Kamis) = belum waktunya --
// diterapkan proporsional (~3/7) ke panjang periode aktual, bukan dipatok hari tetap, supaya
// tetap masuk akal buat periode yang cuma 1-6 hari.
function getStartOfReportingPeriodWIB() {
  const now = new Date()
  const { periodeAwal, periodeAkhir } = getReportingPeriod(now)

  const WIB_MS = 7 * 60 * 60 * 1000
  const nowWIB   = new Date(now.getTime() + WIB_MS)
  const todayWIB = new Date(Date.UTC(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth(), nowWIB.getUTCDate()))

  const DAY_MS = 24 * 60 * 60 * 1000
  const periodLengthDays = Math.round((periodeAkhir.getTime() - periodeAwal.getTime()) / DAY_MS) + 1
  const daysElapsed      = Math.round((todayWIB.getTime() - periodeAwal.getTime()) / DAY_MS)
  const deadlineZoneDays = Math.max(1, Math.ceil(periodLengthDays * 3 / 7))
  const beforeDeadline   = daysElapsed < (periodLengthDays - deadlineZoneDays)

  if (!beforeDeadline) return periodeAwal
  // Belum waktunya -- cek periode SEBELUMNYA (udah lewat deadline-nya sendiri, pasti lengkap).
  return getReportingPeriod(new Date(periodeAwal.getTime() - DAY_MS)).periodeAwal
}

export const getEcosystem = async (req, res) => {
  try {
    // Skor/status kesehatan tetap kelihatan semua role (transparansi wajar), tapi angka omset
    // rupiah/USD mentah cuma buat KADER ke atas -- KARYAWAN dkk gak perlu tahu nominal.
    // Skor/status kepatuhan tetap terbuka, TAPI nominal omset hanya untuk unit dalam wilayah perannya
    // (utils/lingkup.js): unit di luar wilayah → omset null.
    const lingkup = await lingkupKeuangan(req.userRoles)
    const bolehLihatOmset = bestLevel(req.userRoles) <= ROLE_LEVEL.KADER

    const weekStart  = getStartOfReportingPeriodWIB()
    // Minggu yang nyebrang bulan diatribusikan ke bulan dengan hari terbanyak (lihat
    // getMonthAttributionRange) -- konsisten sama Rekap Bulanan, bukan cuma tanggal 1 kalender.
    const now = new Date()
    const bulanIni = now.getMonth() + 1
    const tahunIni = now.getFullYear()
    const { rangeStart: monthStart } = getMonthAttributionRange(bulanIni, tahunIni)

    const [circles, rumahUsahaList, studios, weekReports, monthReports] = await Promise.all([
      prisma.circle.findMany({
        include: {
          studios: { where: { statusAktif: true, ...STUDIO_DIHITUNG }, select: { id: true, nama: true, tipe: true } },
        },
      }),
      prisma.rumahUsaha.findMany({
        where: { statusAktif: true },
        include: {
          studios: { where: { statusAktif: true, ...STUDIO_DIHITUNG }, select: { id: true, nama: true, tipe: true } },
        },
      }),
      // Unit bertipe Korporasi (PT) sengaja TIDAK dinilai di sini (keputusan user 9 Nov 2026): PT tidak
      // lapor mingguan. Unit DI BAWAH Korporasi (mis. Ekosistem Project) tetap dinilai, dikelompokkan per PT.
      prisma.studio.findMany({
        where: { statusAktif: true, tipe: { not: 'KORPORASI' } },
        select: { id: true, nama: true, circleId: true, rumahUsahaId: true, indukId: true, tipe: true, hitungDiEkosistem: true, mitraKolaborasi: true },
      }),
      prisma.weeklyReport.findMany({
        where: { periodeAwal: { gte: weekStart } },
        select: { studioId: true, totalUsd: true, kasSekarang: true, skorSemangat: true },
      }),
      prisma.weeklyReport.findMany({
        where: { periodeAwal: { gte: monthStart } },
        select: { studioId: true, totalUsd: true, periodeAwal: true, periodeAkhir: true },
      }),
    ])

    // Kondisi Tim (13 Okt 2026) -- dari Penilaian Kader yang sudah rutin diisi mentor, gak ada
    // isian baru. Cuma angka agregat per unit (bukan nama/skor orang), jadi aman buat semua role.
    // SENGAJA gak ikut skor kesehatan di bawah: skor itu ngukur kepatuhan lapor & omset.
    const kondisiTimMap = await getKondisiTimMap(studios.map(s => s.id))

    const dihitungIds = new Set(studios.filter(s => s.hitungDiEkosistem).map(s => s.id))
    const weekMap  = Object.fromEntries(weekReports.map(r  => [r.studioId, r]))
    const monthMap = {}
    for (const r of monthReports.filter(r => isReportInMonth(r, bulanIni, tahunIni))) {
      monthMap[r.studioId] = (monthMap[r.studioId] ?? 0) + r.totalUsd
    }

    const studioHealth = studios.map(s => {
      const week  = weekMap[s.studioId ?? s.id]
      const sudahLapor = !!weekMap[s.id]
      const omsetMinggu = weekMap[s.id]?.totalUsd ?? 0
      const omsetBulan  = monthMap[s.id] ?? 0
      const semangat    = weekMap[s.id]?.skorSemangat ?? null

      let score = 0
      if (sudahLapor)     score += 40
      if (omsetMinggu > 0) score += 30
      if (omsetBulan  > 0) score += 20
      if (semangat && semangat >= 4) score += 10

      const status = score >= 80 ? 'SEHAT' : score >= 50 ? 'PERLU_PERHATIAN' : 'KRITIS'
      return {
        ...s, sudahLapor, semangat, score, status,
        kondisiTim: kondisiTimMap[s.id],
        omsetMinggu: bolehLihatOmset && lingkup.boleh(s.id) ? omsetMinggu : null,
        omsetBulan:  bolehLihatOmset && lingkup.boleh(s.id) ? omsetBulan  : null,
      }
    })

    // Sama persis buat Circle maupun Rumah Usaha -- keduanya unit organisasi sejajar (bukan
    // circle "spesial", rumah usaha "biasa"). Sebelum 20 Juli, cuma circleHealth yang dihitung
    // dan overallScore cuma ngerata-ratain itu -- studio di bawah Rumah Usaha gak pernah
    // kehitung sama sekali di skor kesehatan ekosistem manapun.
    function computeGroupHealth(groups) {
      return groups.map(g => {
        const studioIds = g.studios.map(s => s.id)
        const gStudios  = studioHealth.filter(s => studioIds.includes(s.id))
        const avgScore  = gStudios.length
          ? Math.round(gStudios.reduce((a, s) => a + s.score, 0) / gStudios.length)
          : 0
        const sudahLapor = gStudios.filter(s => s.sudahLapor).length
        // Total omset grup hanya tampil bila SEMUA unit grup dalam wilayah peran (total sebagian menyesatkan).
        const totalOmset = bolehLihatOmset && semuaDalamLingkup(lingkup, gStudios.map(s => s.id))
          ? gStudios.reduce((a, s) => a + (monthMap[s.id] ?? 0), 0)
          : null
        const status = avgScore >= 80 ? 'SEHAT' : avgScore >= 50 ? 'PERLU_PERHATIAN' : 'KRITIS'
        const kondisiTim = gStudios.reduce((a, s) => {
          for (const k of Object.keys(a)) a[k] += s.kondisiTim?.[k] ?? 0
          return a
        }, { total: 0, baik: 0, perhatian: 0, kritis: 0, belum_dinilai: 0 })

        return {
          id: g.id, nama: g.nama, colorHex: g.colorHex, kondisiTim,
          totalStudio: gStudios.length,
          sudahLapor, avgScore, totalOmset, status,
          studios: gStudios,
        }
      })
    }

    // Studio kolaborasi: dinilai sendiri (laporan tetap dipantau), tapi TIDAK masuk rata-rata grup,
    // skor ekosistem, maupun hitungan studio/laporan -- grup di atas dibangun dari studio yang dihitung saja.
    const kolaborasi = studioHealth.filter(s => !s.hitungDiEkosistem)
    const korporasiList = await prisma.studio.findMany({
      where: { statusAktif: true, tipe: 'KORPORASI' },
      select: { id: true, nama: true },
      orderBy: { nama: 'asc' },
    })
    const korporasiHealth  = computeGroupHealth(korporasiList.map(k => ({
      ...k, colorHex: 'var(--amber)',
      studios: studios.filter(s => s.indukId === k.id && s.hitungDiEkosistem),
    })))
    const circleHealth     = computeGroupHealth(circles)
    const rumahUsahaHealth = computeGroupHealth(rumahUsahaList)
    // Cuma grup yang beneran punya studio yang dihitung ke rata-rata -- grup kosong (mis. Rumah
    // Usaha baru dibuat, belum ada studio) gak boleh narik overallScore turun ke 0 secara gak adil.
    const allGroupsWithStudio = [...korporasiHealth, ...circleHealth, ...rumahUsahaHealth].filter(g => g.totalStudio > 0)

    const overallScore = allGroupsWithStudio.length
      ? Math.round(allGroupsWithStudio.reduce((a, g) => a + g.avgScore, 0) / allGroupsWithStudio.length)
      : 0

    return res.json({
      success: true,
      data: {
        overallScore,
        status: overallScore >= 80 ? 'SEHAT' : overallScore >= 50 ? 'PERLU_PERHATIAN' : 'KRITIS',
        totalStudio: studios.filter(s => s.hitungDiEkosistem).length,
        sudahLaporMingguIni: weekReports.filter(r => dihitungIds.has(r.studioId)).length,
        kolaborasi,
        korporasi: korporasiHealth,
        circles: circleHealth,
        rumahUsaha: rumahUsahaHealth,
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
