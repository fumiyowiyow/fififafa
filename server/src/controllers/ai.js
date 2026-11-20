import { GoogleGenAI } from '@google/genai'
import prisma from '../prisma.js'
import { STUDIO_DIHITUNG, LAPORAN_DIHITUNG, USER_BUKAN_KOLABORASI_SAJA } from '../utils/kolaborasi.js'
import { getStartOfWeekWIB, getMonthAttributionRange, isReportInMonth } from '../utils/week.js'
import { ECOSYSTEM_NAME } from '../config/ecosystem.js'
import { getKasMapForStudios } from '../utils/kas.js'


function getClient() {
  if (!process.env.GEMINI_API_KEY) return null
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
}

async function gatherEcosystemData() {
  // Minggu yang nyebrang bulan diatribusikan ke bulan dengan hari terbanyak (lihat
  // getMonthAttributionRange) -- konsisten sama Rekap Bulanan, bukan cuma tanggal 1 kalender.
  const now = new Date()
  const bulanIni = now.getMonth() + 1
  const tahunIni = now.getFullYear()
  const { rangeStart: monthStart } = getMonthAttributionRange(bulanIni, tahunIni)
  const weekStart  = getStartOfWeekWIB()

  const [circles, studios, weekReports, monthReports, members] = await Promise.all([
    // Studio kolaborasi (angkanya dihitung di circle mitra) tidak ikut bahan insight AI ekosistem.
    prisma.circle.findMany({ include: { studios: { where: { statusAktif: true, ...STUDIO_DIHITUNG }, select: { id: true, nama: true } } } }),
    prisma.studio.findMany({
      where: { statusAktif: true, ...STUDIO_DIHITUNG },
      select: { id: true, nama: true, tipe: true, circleId: true },
    }),
    prisma.weeklyReport.findMany({
      where: { periodeAwal: { gte: weekStart }, ...LAPORAN_DIHITUNG },
      select: { studioId: true, totalUsd: true, pengeluaran: true, skorSemangat: true, kendala: true },
    }),
    prisma.weeklyReport.findMany({
      where: { periodeAwal: { gte: monthStart }, ...LAPORAN_DIHITUNG },
      select: { studioId: true, totalUsd: true, periodeAwal: true, periodeAkhir: true },
    }),
    prisma.user.count({ where: { statusAktif: true, ...USER_BUKAN_KOLABORASI_SAJA } }),
  ])

  const weekMap = {}
  for (const r of weekReports) {
    if (!weekMap[r.studioId]) weekMap[r.studioId] = { totalUsd: 0, semangat: [], kendala: [] }
    weekMap[r.studioId].totalUsd    += r.totalUsd
    if (r.skorSemangat) weekMap[r.studioId].semangat.push(r.skorSemangat)
    if (r.kendala)      weekMap[r.studioId].kendala.push(r.kendala)
  }

  const monthMap = {}
  for (const r of monthReports.filter(r => isReportInMonth(r, bulanIni, tahunIni))) {
    monthMap[r.studioId] = (monthMap[r.studioId] ?? 0) + r.totalUsd
  }

  const circleMap = Object.fromEntries(circles.map(c => [c.id, c]))
  // Kas sekarang live dari SUM(saldo) Rekening Bank (Bio Studio) -- diputuskan 31 Juli 2026.
  const kasMap = await getKasMapForStudios(studios.map(s => s.id))

  const studioData = studios.map(s => ({
    nama:        s.nama,
    circle:      circleMap[s.circleId]?.nama ?? '—',
    tipe:        s.tipe,
    sudahLapor:  !!weekMap[s.id],
    omsetMinggu: weekMap[s.id]?.totalUsd ?? 0,
    omsetBulan:  monthMap[s.id] ?? 0,
    kasSekarang: kasMap[s.id] ?? 0,
    avgSemangat: weekMap[s.id]?.semangat?.length
      ? (weekMap[s.id].semangat.reduce((a,v) => a+v, 0) / weekMap[s.id].semangat.length).toFixed(1)
      : null,
    kendala: weekMap[s.id]?.kendala ?? [],
  }))

  return {
    tanggal:          new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    totalAnggota:     members,
    totalStudio:      studios.length,
    sudahLapor:       new Set(weekReports.map(r => r.studioId)).size,
    totalOmsetMinggu: weekReports.reduce((a, r) => a + r.totalUsd, 0),
    totalOmsetBulan:  monthReports.reduce((a, r) => a + r.totalUsd, 0),
    studios:          studioData,
  }
}

export const getInsights = async (req, res) => {
  const genAI = getClient()
  if (!genAI) {
    return res.status(503).json({ success: false, code: 'NO_API_KEY', message: 'GEMINI_API_KEY belum diset' })
  }

  try {
    const data = await gatherEcosystemData()
    const belumLapor = data.studios.filter(s => !s.sudahLapor).map(s => s.nama)
    const topStudio  = data.studios.filter(s => s.omsetMinggu > 0).sort((a,b) => b.omsetMinggu - a.omsetMinggu).slice(0,3)
    const kendalaAll = data.studios.flatMap(s => s.kendala).filter(Boolean)

    const prompt = `Kamu adalah AI analyst untuk ekosistem bisnis kreatif ${ECOSYSTEM_NAME} di Indonesia.

DATA EKOSISTEM MINGGU INI (${data.tanggal}):
- Total anggota aktif: ${data.totalAnggota}
- Total studio/project: ${data.totalStudio}
- Studio sudah lapor: ${data.sudahLapor}/${data.totalStudio}
- Studio BELUM lapor: ${belumLapor.join(', ') || 'semua sudah lapor'}
- Total omset minggu ini: $${data.totalOmsetMinggu.toFixed(2)} USD
- Total omset bulan ini: $${data.totalOmsetBulan.toFixed(2)} USD

TOP PERFORMER MINGGU INI:
${topStudio.map((s,i) => `${i+1}. ${s.nama} (${s.circle}) — $${s.omsetMinggu.toFixed(2)} | semangat: ${s.avgSemangat ?? '-'}/5`).join('\n') || 'Belum ada data omset'}

KENDALA YANG DILAPORKAN:
${kendalaAll.length ? kendalaAll.map(k => `- ${k}`).join('\n') : 'Tidak ada kendala dilaporkan'}

SEMUA STUDIO:
${data.studios.map(s =>
  `${s.nama} (${s.circle}, ${s.tipe}): ${s.sudahLapor ? `✓ lapor, $${s.omsetMinggu.toFixed(2)}/minggu, $${s.omsetBulan.toFixed(2)}/bulan` : '✗ belum lapor'}`
).join('\n')}

Berikan analisis HANYA dalam format JSON berikut (tidak ada teks lain di luar JSON):
{
  "ringkasan": "2-3 kalimat ringkasan kondisi ekosistem minggu ini",
  "skorKesehatan": 75,
  "status": "BAIK",
  "highlights": [
    {"tipe": "positif", "pesan": "..."}
  ],
  "rekomendasi": [
    {"prioritas": "tinggi", "aksi": "...", "target": "ALL"}
  ],
  "prediksi": "1 kalimat prediksi omset bulan ini"
}`

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    })
    const json = JSON.parse(result.text)

    return res.json({
      success: true,
      data: {
        ...json,
        generatedAt: new Date().toISOString(),
        ekosistem: {
          totalOmsetMinggu: data.totalOmsetMinggu,
          totalOmsetBulan:  data.totalOmsetBulan,
          sudahLapor:       data.sudahLapor,
          totalStudio:      data.totalStudio,
        },
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const chatWithAI = async (req, res) => {
  const genAI = getClient()
  if (!genAI) return res.status(503).json({ success: false, code: 'NO_API_KEY', message: 'GEMINI_API_KEY belum diset' })

  try {
    const { pertanyaan } = req.body
    if (!pertanyaan) return res.status(422).json({ success: false, message: 'pertanyaan wajib diisi' })

    const data = await gatherEcosystemData()

    const systemContext = `Kamu adalah asisten AI untuk ekosistem bisnis kreatif ${ECOSYSTEM_NAME}.
Data terkini: ${data.totalAnggota} anggota, ${data.totalStudio} studio, omset minggu ini $${data.totalOmsetMinggu.toFixed(2)}, bulan ini $${data.totalOmsetBulan.toFixed(2)}.
Jawab singkat, dalam Bahasa Indonesia, dan fokus pada konteks ekosistem ${ECOSYSTEM_NAME}.`

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `${systemContext}\n\nPertanyaan: ${pertanyaan}`,
    })

    return res.json({ success: true, data: { jawaban: result.text } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
