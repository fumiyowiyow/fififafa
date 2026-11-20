import prisma from '../prisma.js'
import { getReportingPeriod } from './week.js'

// Kas "saat ini" studio -- BUKAN lagi angka WeeklyReport.kasSekarang terakhir (yang manual,
// bisa basi/gak sinkron sama saldo bank asli). Sekarang live SUM(StudioRekening.saldo) --
// satu sumber kebenaran yang sama dengan "Total Saldo" di Bio Studio § Rekening Bank.
// WeeklyReport.kasSekarang TETAP ADA & tetap tersimpan per-minggu (dipakai buat riwayat/trend
// historis di Rekap Bulanan & Riwayat Laporan -- StudioRekening.saldo gak punya riwayat, cuma
// angka terkini yang ke-timpa tiap diedit, jadi gak bisa gantiin data historis). Diputuskan
// 31 Juli 2026.
export async function getKasMapForStudios(studioIds) {
  if (studioIds.length === 0) return {}

  const rows = await prisma.studioRekening.groupBy({
    by: ['studioId'],
    where: { studioId: { in: studioIds } },
    _sum: { saldo: true },
  })
  const map = Object.fromEntries(rows.map(r => [r.studioId, r._sum.saldo ?? 0]))

  const result = {}
  for (const id of studioIds) result[id] = map[id] ?? 0
  return result
}

export async function getStudioKas(studioId) {
  const map = await getKasMapForStudios([studioId])
  return map[studioId] ?? 0
}

// WeeklyReport.kasSekarang = SNAPSHOT otomatis SUM(saldo) Rekening Bank, gak lagi diketik manual
// (13 Okt 2026 -- sebelumnya koordinator ngetik "Kas Sekarang" di form/bot, padahal angka resmi
// udah dari Rekening Bank sejak 31 Juli, jadi ada dua angka kas yang bisa beda). Dipanggil tiap
// saldo rekening berubah: laporan minggu BERJALAN ikut ke-update, laporan minggu lalu dibiarkan
// (itu riwayat). Gagal di sini gak boleh ngegagalin simpan rekening-nya -- caller wajib catch.
export async function snapshotKasMingguIni(studioId) {
  const { periodeAwal } = getReportingPeriod(new Date())
  const kas = await getStudioKas(studioId)
  await prisma.weeklyReport.updateMany({
    where: { studioId, periodeAwal },
    data: { kasSekarang: kas },
  })
}
