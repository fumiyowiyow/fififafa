import prisma from '../prisma.js'

// Pengeluaran per item (13 Okt 2026). WeeklyReport.pengeluaran tetap ada sebagai TOTAL TERSIMPAN
// (dibaca rekap bulanan, dashboard, PDF, AI, dst -- gak perlu diubah satu-satu), tapi sekarang
// diisi server dari jumlah item, bukan diketik. Satu sumber: tabel Pengeluaran.

// Kategori mengikuti Jurnal Keuangan unit (daftar kode posting di file laporan keuangan studio), 4 Nov 2026.
export const KATEGORI_PENGELUARAN = [
  'BIAYA_USAHA', 'BIAYA_ADM_BANK', 'BIAYA_RUMAH_TANGGA', 'BIAYA_PULSA', 'BIAYA_PERLENGKAPAN',
  'BIAYA_ENTERTAINMENT', 'BIAYA_OPERASIONAL', 'LAIN_LAIN', 'INFAQ',
]
// Kategori lama (sebelum 4 Nov 2026): item yang sudah tercatat (juga dari web circle) tetap sah dan bisa diedit,
// tapi tidak ditawarkan lagi di form Ekosistem (Gaji, SHU, THR dikeluarkan dari pilihan 4 Nov 2026: sudah masuk CPM/Payroll).
export const KATEGORI_LAMA = ['BIAYA_GAJI', 'SHU', 'THR', 'BEBAN_ORANG', 'OPERASIONAL', 'SUBSCRIPTION', 'SUPPORT', 'LAINNYA']
// Kategori yang bisa menumpuk dengan gaji di modul Payroll (peringatan saat dicatat).
export const KATEGORI_GAJI = ['BIAYA_GAJI', 'BEBAN_ORANG']
// Item hasil konversi angka total lama -- gak bisa dipilih manual dari form.
export const KATEGORI_DATA_LAMA = 'DATA_LAMA'

// 'YYYY-MM-DD' (tanggal kalender WIB) -> Date UTC tengah malam, format yang sama dengan
// WeeklyReport.periodeAwal/periodeAkhir. null kalau gak valid.
export function parseTanggal(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(str)) return null
  const d = new Date(str.slice(0, 10) + 'T00:00:00.000Z')
  return isNaN(d.getTime()) ? null : d
}

// periodeAkhir laporan dari web = tengah malam hari terakhir, dari bot = 23:59:59.999 hari yang
// sama -- `lte` aman untuk keduanya karena tanggal item selalu tengah malam.
export async function totalPengeluaranPeriode(studioId, periodeAwal, periodeAkhir, db = prisma) {
  const agg = await db.pengeluaran.aggregate({
    where: { studioId, tanggal: { gte: periodeAwal, lte: periodeAkhir } },
    _sum: { jumlah: true },
  })
  return agg._sum.jumlah ?? 0
}

function laporanPadaTanggal(studioId, tanggal, db = prisma) {
  return db.weeklyReport.findFirst({
    where: { studioId, periodeAwal: { lte: tanggal }, periodeAkhir: { gte: tanggal } },
  })
}

// Laporan lama punya angka total tanpa rincian. Sebelum item PERTAMA masuk ke periode laporan
// itu, angka lamanya diubah jadi satu item "Pengeluaran (data lama)" -- tanpa ini, menambah satu
// item kecil diam-diam menimpa total lama yang jauh lebih besar.
export async function amankanDataLama(studioId, tanggal, userId, db = prisma) {
  const laporan = await laporanPadaTanggal(studioId, tanggal, db)
  if (!laporan || !(laporan.pengeluaran > 0)) return
  const adaItem = await db.pengeluaran.count({
    where: { studioId, tanggal: { gte: laporan.periodeAwal, lte: laporan.periodeAkhir } },
  })
  if (adaItem > 0) return
  await db.pengeluaran.create({
    data: {
      studioId,
      tanggal:     laporan.periodeAwal,
      kategori:    KATEGORI_DATA_LAMA,
      nama:        'Pengeluaran (data lama)',
      jumlah:      laporan.pengeluaran,
      dicatatOleh: userId ?? null,
    },
  })
}

// Hitung ulang total pengeluaran laporan yang periodenya memuat `tanggal` (kalau laporannya ada).
export async function sinkronPengeluaranLaporan(studioId, tanggal, db = prisma) {
  const laporan = await laporanPadaTanggal(studioId, tanggal, db)
  if (!laporan) return
  const total = await totalPengeluaranPeriode(studioId, laporan.periodeAwal, laporan.periodeAkhir, db)
  await db.weeklyReport.update({ where: { id: laporan.id }, data: { pengeluaran: total } })
}
