import prisma from '../prisma.js'
import { getStartOfWeekWIB, getMonthAttributionRange, isReportInMonth } from '../utils/week.js'
import { getCpmMapForStudios } from '../utils/cpm.js'
import { LAPORAN_DIHITUNG } from '../utils/kolaborasi.js'
import { lingkupKeuangan, filterStudioId, samarkan } from '../utils/lingkup.js'


export const getStudioRanking = async (req, res) => {
  try {
    const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear()

    const { rangeStart, rangeEnd } = getMonthAttributionRange(bulan, tahun)
    // Hanya unit dalam wilayah peran (Advisor/Kepala Ekosistem = semua) -- lihat utils/lingkup.js.
    const lingkup = await lingkupKeuangan(req.userRoles)

    const reports = (await prisma.weeklyReport.findMany({
      where: { periodeAwal: { gte: rangeStart, lte: rangeEnd } },
      select: {
        studioId: true, totalUsd: true, kasSekarang: true, skorSemangat: true, kurs: true,
        periodeAwal: true, periodeAkhir: true,
        omsetFiverr: true, omsetEtsy: true, omsetUpwork: true, omsetVgen: true, omsetKomunitas: true, omsetLainnya: true,
        studio: {
          select: {
            id: true, nama: true, tipe: true, hitungDiEkosistem: true, mitraKolaborasi: true,
            circle:     { select: { nama: true, colorHex: true } },
            rumahUsaha: { select: { nama: true, colorHex: true } },
          },
        },
      },
      orderBy: { periodeAwal: 'asc' },
    })).filter(r => isReportInMonth(r, bulan, tahun))

    // Aggregate per studio
    const studioMap = {}
    for (const r of reports) {
      const sid = r.studioId
      if (!studioMap[sid]) {
        studioMap[sid] = {
          studio:        r.studio,
          totalUsd:      0,
          jumlahLaporan: 0,
          avgSemangat:   [],
          minggu:        [],
          kursList:       [],
          omsetFiverr:    0,
          omsetEtsy:      0,
          omsetUpwork:    0,
          omsetVgen:      0,
          omsetKomunitas: 0,
          omsetLainnya:   0,
        }
      }
      studioMap[sid].totalUsd       += r.totalUsd
      studioMap[sid].jumlahLaporan  += 1
      studioMap[sid].omsetFiverr    += r.omsetFiverr    ?? 0
      studioMap[sid].omsetEtsy      += r.omsetEtsy      ?? 0
      studioMap[sid].omsetUpwork    += r.omsetUpwork    ?? 0
      studioMap[sid].omsetVgen      += r.omsetVgen      ?? 0
      studioMap[sid].omsetKomunitas += r.omsetKomunitas ?? 0
      studioMap[sid].omsetLainnya   += r.omsetLainnya   ?? 0
      studioMap[sid].kursList.push(r.kurs)
      if (r.skorSemangat) studioMap[sid].avgSemangat.push(r.skorSemangat)
      studioMap[sid].minggu.push({
        periodeAwal: r.periodeAwal,
        totalUsd:    r.totalUsd,
        kasSekarang: r.kasSekarang,
      })
    }

    const cpmMap = await getCpmMapForStudios(Object.keys(studioMap))

    // Peringkat & status kesehatan dihitung dari angka ASLI semua unit (urutan tetap utuh); setelah itu
    // angka uang unit di luar wilayah disamarkan sebelum dikirim.
    const FIELD_UANG_RANK = ['totalUsd', 'omsetFiverr', 'omsetEtsy', 'omsetUpwork', 'omsetVgen', 'omsetKomunitas', 'omsetLainnya']
    const rankingPenuh = Object.values(studioMap)
      .map(s => ({
        ...s,
        avgSemangat: s.avgSemangat.length
          ? (s.avgSemangat.reduce((a, v) => a + v, 0) / s.avgSemangat.length).toFixed(1)
          : null,
        financialHealth: computeFinancialHealth(s, cpmMap[s.studio.id]?.totalCpm ?? 0),
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd)
    const ranking = rankingPenuh.map(r => (lingkup.boleh(r.studio.id) ? r : {
      ...samarkan(r, FIELD_UANG_RANK),
      minggu: [], kursList: [],
      financialHealth: { ...r.financialHealth, coverageRatio: null },
    }))

    // Studio kolaborasi (angkanya dihitung di circle mitra) tetap muncul di ranking & analisis marketnya
    // (terpantau), tapi TIDAK masuk ringkasan kesehatan ekosistem maupun tren total di bawah.
    const dihitung = ranking.filter(r => r.studio.hitungDiEkosistem !== false)
    const financialHealthSummary = {
      sehat:          dihitung.filter(r => r.financialHealth.status === 'SEHAT').length,
      perluPerhatian: dihitung.filter(r => r.financialHealth.status === 'PERLU_PERHATIAN').length,
      kritis:         dihitung.filter(r => r.financialHealth.status === 'KRITIS').length,
      total:          dihitung.length,
    }

    // Weekly trend for all studios — last 8 weeks
    const eightWeeksAgo = new Date()
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

    const trendReports = await prisma.weeklyReport.findMany({
      where: { periodeAwal: { gte: eightWeeksAgo }, ...LAPORAN_DIHITUNG, ...filterStudioId(lingkup) },
      select: { periodeAwal: true, totalUsd: true, studioId: true },
      orderBy: { periodeAwal: 'asc' },
    })

    // Group by week
    const weekMap = {}
    for (const r of trendReports) {
      const weekKey = getWeekKey(r.periodeAwal)
      weekMap[weekKey] = (weekMap[weekKey] ?? 0) + r.totalUsd
    }
    const trendData = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, totalUsd]) => ({ week, totalUsd }))

    return res.json({
      success: true,
      data: { ranking, trendData, bulan, tahun, financialHealth: financialHealthSummary, lingkup: { semua: lingkup.semua } },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Tren omset per bulan -- N bulan berakhir di bulan/tahun terpilih. Atribusi minggu->bulan
// pakai isReportInMonth (sama persis dengan ranking & rekap bulanan) biar angkanya konsisten.
export const getMonthlyTrend = async (req, res) => {
  try {
    const bulan  = parseInt(req.query.bulan) || new Date().getMonth() + 1
    const tahun  = parseInt(req.query.tahun) || new Date().getFullYear()
    const jumlah = Math.min(Math.max(parseInt(req.query.jumlah) || 3, 1), 12)

    const months = []
    for (let i = jumlah - 1; i >= 0; i--) {
      const d = new Date(tahun, bulan - 1 - i, 1)
      months.push({ bulan: d.getMonth() + 1, tahun: d.getFullYear(), totalUsd: 0, jumlahLaporan: 0, studioIds: new Set() })
    }

    const first = getMonthAttributionRange(months[0].bulan, months[0].tahun)
    const last  = getMonthAttributionRange(bulan, tahun)
    const lingkup = await lingkupKeuangan(req.userRoles)
    const reports = await prisma.weeklyReport.findMany({
      where: { periodeAwal: { gte: first.rangeStart, lte: last.rangeEnd }, ...LAPORAN_DIHITUNG, ...filterStudioId(lingkup) },
      select: { studioId: true, totalUsd: true, periodeAwal: true, periodeAkhir: true },
    })

    for (const r of reports) {
      const m = months.find(x => isReportInMonth(r, x.bulan, x.tahun))
      if (!m) continue
      m.totalUsd += r.totalUsd
      m.jumlahLaporan += 1
      m.studioIds.add(r.studioId)
    }

    const data = months.map((m, i) => {
      const prev = i > 0 ? months[i - 1].totalUsd : null
      return {
        bulan: m.bulan, tahun: m.tahun,
        totalUsd: m.totalUsd,
        jumlahLaporan: m.jumlahLaporan,
        studioAktif: m.studioIds.size,
        perubahanPct: prev > 0 ? ((m.totalUsd - prev) / prev) * 100 : null,
      }
    })

    return res.json({ success: true, data: { months: data } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Kesehatan finansial studio -- BUKAN skor kepatuhan lapor (itu punya Health/getEcosystem, sudah
// direname "Kepatuhan Laporan"). Ini berbasis performa omset asli: tren mingguan + cakupan biaya
// operasional (CPM hasil hitungan otomatis, lihat utils/cpm.js). Dua sinyal ditampilin TERPISAH
// (trend & coverage), bukan dilebur diam-diam jadi satu angka -- studio yang belum ada CPM ("⚪
// belum ada target") gak boleh kebaca sama kayak studio yang beneran boncos ("🔴"), makanya
// composite status di bawah eksplisit bedain ⚪ dari 🔴/🟡 (lihat tabel keputusan di bawah).
function computeFinancialHealth(s, cpmRp) {
  const minggu = [...s.minggu].sort((a, b) => new Date(a.periodeAwal) - new Date(b.periodeAwal))

  let trend = 'data_kurang'
  if (minggu.length >= 2) {
    const [prev, latest] = minggu.slice(-2)
    trend = latest.totalUsd > prev.totalUsd ? 'naik' : latest.totalUsd < prev.totalUsd ? 'turun' : 'stabil'
  }

  // CPM <=0 dianggap belum diisi beneran (studio belum isi pengeluaran rutin/THP sama sekali) --
  // bukan berarti gagal, cuma gak ada acuan. CPM sekarang Rupiah-native, omset (totalUsd) masih
  // USD -- dikonversi pakai rata-rata kurs laporan studio ini bulan ini biar bisa dibandingkan.
  const adaTarget = cpmRp > 0
  const avgKursStudio = s.kursList.length > 0
    ? s.kursList.reduce((a, v) => a + v, 0) / s.kursList.length
    : 17000
  const coverageRatio = adaTarget ? (s.totalUsd * avgKursStudio) / cpmRp : null
  const coverage = !adaTarget ? 'belum_ada_target'
    : coverageRatio >= 1   ? 'nutup_biaya'
    : coverageRatio >= 0.5 ? 'belum_nutup_penuh'
    : 'jauh_dari_nutup'

  // Tabel keputusan (coverage x trend -> status):
  // 🔴 jauh_dari_nutup           -> KRITIS apa pun trend-nya
  // 🟡 belum_nutup_penuh + turun -> KRITIS
  // 🟡 belum_nutup_penuh + lainnya -> PERLU_PERHATIAN
  // 🟢 nutup_biaya               -> SEHAT (trend gak pernah nurunin ini ke bawah SEHAT)
  // ⚪ belum_ada_target + naik/stabil -> SEHAT (trend jadi satu-satunya acuan)
  // ⚪ belum_ada_target + turun/data_kurang -> PERLU_PERHATIAN
  let status
  if (coverage === 'jauh_dari_nutup') status = 'KRITIS'
  else if (coverage === 'belum_nutup_penuh') status = trend === 'turun' ? 'KRITIS' : 'PERLU_PERHATIAN'
  else if (coverage === 'nutup_biaya') status = 'SEHAT'
  else status = (trend === 'naik' || trend === 'stabil') ? 'SEHAT' : 'PERLU_PERHATIAN'

  return { trend, coverage, coverageRatio, status }
}

// periodeAwal WeeklyReport sudah dinormalisasi ke Senin (WIB) — jadi harusnya nggak perlu
// digeser lagi. Tetap lewat getStartOfWeekWIB() (bukan cuma slice string) buat jaring pengaman
// kalau ada data lama yang periodeAwal-nya belum konsisten (mis. laporan lama dari bot Telegram
// sebelum bug minggu-nya diperbaiki).
function getWeekKey(date) {
  return getStartOfWeekWIB(new Date(date)).toISOString().split('T')[0]
}
