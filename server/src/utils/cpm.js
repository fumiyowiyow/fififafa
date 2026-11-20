import prisma from '../prisma.js'

// CPM ("Cost Per Month") studio -- BUKAN lagi satu angka manual (Studio.cpmTarget, dihapus
// 26 Juli 2026). Sekarang dihitung otomatis, dalam Rupiah:
//   CPM = SUM(UserRole.takeHomePay anggota studio yang MASIH AKTIF; yang nonaktif/resign tidak dihitung, KECUALI peran DIGNITY yang tetap dihitung; 4 Nov 2026)
//       + SUM(StudioPengeluaranRutin.jumlah studio)
//       + Studio.totalShu (kalau statusShu true -- angka PENUH, bukan dikali persentase saham
//         terisi; sesuai contoh breakdown manual koordinator yang tetap masukin "SHU Saham
//         Kosong" ke total, bukan cuma porsi yang sudah ada pemiliknya)
// Bulk (bukan N+1 per studio) supaya aman dipakai di Dashboard/Laporan Bulanan yang nampilin
// banyak studio sekaligus.
export async function getCpmMapForStudios(studioIds) {
  if (studioIds.length === 0) return {}

  const [thpRows, pengeluaranRows, studios] = await Promise.all([
    prisma.userRole.groupBy({
      by: ['studioId'],
      where: { studioId: { in: studioIds }, takeHomePay: { not: null }, OR: [{ roleType: 'DIGNITY' }, { user: { statusAktif: true } }] },
      _sum: { takeHomePay: true },
      _count: { _all: true },
    }),
    prisma.studioPengeluaranRutin.groupBy({
      by: ['studioId'],
      where: { studioId: { in: studioIds } },
      _sum: { jumlah: true },
    }),
    prisma.studio.findMany({
      where: { id: { in: studioIds } },
      select: { id: true, statusShu: true, totalShu: true },
    }),
  ])

  const jumlahOrangMap = Object.fromEntries(thpRows.map(r => [r.studioId, r._count?._all ?? 0]))
  const thpMap         = Object.fromEntries(thpRows.map(r => [r.studioId, r._sum.takeHomePay ?? 0]))
  const pengeluaranMap = Object.fromEntries(pengeluaranRows.map(r => [r.studioId, r._sum.jumlah ?? 0]))
  const studioMap      = Object.fromEntries(studios.map(s => [s.id, s]))

  const result = {}
  for (const id of studioIds) {
    const s = studioMap[id]
    const totalThp             = thpMap[id] ?? 0
    const totalPengeluaranRutin = pengeluaranMap[id] ?? 0
    const totalShu              = s?.statusShu ? (s.totalShu ?? 0) : 0
    result[id] = {
      totalThp,
      jumlahOrang: jumlahOrangMap[id] ?? 0,
      totalPengeluaranRutin,
      totalShu,
      totalCpm: totalThp + totalPengeluaranRutin + totalShu,
    }
  }
  return result
}

export async function getStudioCpmBreakdown(studioId) {
  const map = await getCpmMapForStudios([studioId])
  return map[studioId] ?? { totalThp: 0, totalPengeluaranRutin: 0, totalShu: 0, totalCpm: 0 }
}

// Template item default -- di-seed manual lewat tombol "Isi Template Default" di UI (bukan
// otomatis pas GET, biar gak ada side-effect nulis data dari endpoint read). Nominal Dana
// Forum/Gerakan/JRUHub konsisten persis sama di 3 contoh breakdown manual koordinator berbeda
// (Abstractlab, Kiddoru, Sekai Land) -- kelihatannya emang iuran tetap se-ekosistem, bukan
// kebetulan. "Infaq {studio}" nama studionya di-substitusi dinamis, nominal dikosongin (beda-beda
// tiap studio). "Freelance" SENGAJA tidak di-template -- nominalnya gak pernah sama.
export function getDefaultPengeluaranRutinTemplate(namaStudio) {
  return [
    { kategori: 'SUPPORT',  nama: 'Dana Forum',              jumlah: 250000 },
    { kategori: 'SUPPORT',  nama: 'Dana Gerakan',            jumlah: 1000000 },
    { kategori: 'SUPPORT',  nama: 'Iuran JRUHub',            jumlah: 200000 },
    { kategori: 'SUPPORT',  nama: `Infaq ${namaStudio}`,     jumlah: 0 },
    { kategori: 'LAINNYA',  nama: 'Tabungan THR Koperasi',   jumlah: 3000000 },
  ]
}

// ── CPM per bulan (foto akhir bulan) ─────────────────────
// Bulan berjalan / mendatang = hitung langsung. Bulan yang sudah lewat = pakai foto di
// StudioCpmBulanan kalau ada; studio tanpa foto (bulan lama yang belum pernah difoto) tetap dihitung
// langsung seperti sebelumnya. Hasil memuat `tersimpan: true` kalau dari foto.
const WIB_MS = 7 * 60 * 60 * 1000
export function bulanIniWIB() {
  const d = new Date(Date.now() + WIB_MS)
  return { bulan: d.getUTCMonth() + 1, tahun: d.getUTCFullYear() }
}

export async function getCpmMapForStudiosBulan(studioIds, bulan, tahun) {
  const live = await getCpmMapForStudios(studioIds)
  const kini = bulanIniWIB()
  if (studioIds.length === 0 || tahun * 12 + bulan >= kini.tahun * 12 + kini.bulan) return live
  const fotos = await prisma.studioCpmBulanan.findMany({ where: { studioId: { in: studioIds }, bulan, tahun } })
  for (const f of fotos) {
    live[f.studioId] = {
      totalThp: f.totalThp, jumlahOrang: f.jumlahOrang, totalPengeluaranRutin: f.totalPengeluaranRutin,
      totalShu: f.totalShu, totalCpm: f.totalCpm, tersimpan: true,
    }
  }
  return live
}

/** Foto CPM semua studio aktif untuk satu bulan. Studio yang sudah punya foto dilewati kecuali timpa=true. */
export async function simpanFotoCpm(bulan, tahun, { timpa = false } = {}) {
  const studios = await prisma.studio.findMany({ where: { statusAktif: true }, select: { id: true } })
  const ids = studios.map(s => s.id)
  const ada = new Set((await prisma.studioCpmBulanan.findMany({ where: { studioId: { in: ids }, bulan, tahun }, select: { studioId: true } })).map(f => f.studioId))
  const map = await getCpmMapForStudios(ids)
  let dibuat = 0
  for (const id of ids) {
    if (ada.has(id) && !timpa) continue
    const c = map[id]
    const data = { totalThp: c.totalThp, jumlahOrang: c.jumlahOrang, totalPengeluaranRutin: c.totalPengeluaranRutin, totalShu: c.totalShu, totalCpm: c.totalCpm }
    await prisma.studioCpmBulanan.upsert({ where: { studioId_bulan_tahun: { studioId: id, bulan, tahun } }, create: { studioId: id, bulan, tahun, ...data }, update: data })
    dibuat++
  }
  return { bulan, tahun, studio: ids.length, dibuat }
}
