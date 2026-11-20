import prisma from '../prisma.js'

// Satu sumber hitungan Penilaian Kader -- dipakai Ringkasan Performa (controllers/penilaianKader.js
// getSkorRingkasan) DAN Kondisi Tim per unit (getKondisiTimMap di bawah, 13 Okt 2026), biar angka
// & flag di dua tempat gak bisa beda. Skala 1-5 berjangkar: 1 Jauh di Bawah Harapan,
// 2 Di Bawah Harapan, 3 Sesuai Harapan, 4 Di Atas Harapan, 5 Istimewa.

export const SKOR_FIELDS = [
  'skorKehadiran', 'skorKetepatanWaktu',
  'skorAdab', 'skorKejujuran', 'skorMenerimaMasukan',
  'skorKualitasKerja', 'skorPenguasaanSkill',
  'skorInisiatif', 'skorKerjaSama',
]

// Posisi operasional yang dinilai (bukan Pendamping/Kepala/Advisor/Dignity) -- keputusan user,
// sama dengan filter Ringkasan Performa.
export const ROLE_DINILAI = ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG']

export function rataRataSkor(entry) {
  return SKOR_FIELDS.reduce((sum, k) => sum + entry[k], 0) / SKOR_FIELDS.length
}

const WIB_MS = 7 * 60 * 60 * 1000

// entries: SEMUA penilaian satu kader, urut tanggalPenilaian TERBARU dulu.
export function ringkasPenilaian(entries, now = new Date()) {
  const nowWIB = new Date(now.getTime() + WIB_MS)
  const bulanIni = nowWIB.getUTCMonth() + 1
  const tahunIni = nowWIB.getUTCFullYear()
  const bulanTahun = (d) => {
    const t = new Date(d.getTime() + WIB_MS)
    return { bulan: t.getUTCMonth() + 1, tahun: t.getUTCFullYear() }
  }

  const terbaru = entries[0] ?? null
  let sudahDinilaiBulanIni = false
  if (terbaru) {
    const { bulan, tahun } = bulanTahun(terbaru.tanggalPenilaian)
    sudahDinilaiBulanIni = bulan === bulanIni && tahun === tahunIni
  }

  // 3 bulan terakhir TERMASUK bulan berjalan, urut lama -> baru.
  const riwayat3Bulan = [2, 1, 0].map(mundur => {
    const d = new Date(Date.UTC(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth() - mundur, 1))
    const bulan = d.getUTCMonth() + 1, tahun = d.getUTCFullYear()
    const entri = entries.filter(p => {
      const bt = bulanTahun(p.tanggalPenilaian)
      return bt.bulan === bulan && bt.tahun === tahun
    })
    const rataRata = entri.length ? entri.reduce((s, p) => s + rataRataSkor(p), 0) / entri.length : null
    return { bulan, tahun, rataRata }
  })

  // Flag "perlu penanganan khusus" -- prioritas: menurun > rendah konsisten > belum dipantau.
  // Kader yang belum pernah dinilai sama sekali gak di-flag (ketangkep lewat rataRata null).
  const ada = riwayat3Bulan.filter(r => r.rataRata != null)
  let flagKhusus = null
  if (entries.length > 0) {
    if (ada.length >= 2 && ada.every((r, i) => i === 0 || r.rataRata < ada[i - 1].rataRata)) flagKhusus = 'menurun'
    else if (ada.length > 0 && ada.every(r => r.rataRata < 3)) flagKhusus = 'rendah_konsisten'
    else if (ada.length === 0) flagKhusus = 'belum_dipantau'
  }

  return {
    terbaru,
    rataRata: terbaru ? rataRataSkor(terbaru) : null,
    sudahDinilaiBulanIni,
    riwayat3Bulan,
    flagKhusus,
  }
}

// Kondisi satu kader untuk agregat tim:
//  - belum_dinilai : gak ada penilaian dalam 3 bulan terakhir
//  - kritis        : penilaian terbaru rata-rata < 2 (Jauh di Bawah Harapan)
//  - perhatian     : terbaru < 3 (belum Sesuai Harapan), ATAU skornya menurun / rendah terus
//  - baik          : selebihnya (terbaru >= 3 dan gak ada flag)
export function kondisiKader(ringkasan) {
  const { rataRata, flagKhusus, riwayat3Bulan } = ringkasan
  if (rataRata == null || riwayat3Bulan.every(r => r.rataRata == null)) return 'belum_dinilai'
  if (rataRata < 2) return 'kritis'
  if (rataRata < 3 || flagKhusus === 'menurun' || flagKhusus === 'rendah_konsisten') return 'perhatian'
  return 'baik'
}

// { [studioId]: { total, baik, perhatian, kritis, belum_dinilai } } -- angka agregat saja, tanpa
// nama/skor perorangan, jadi aman ditampilkan di halaman yang dibuka semua role.
// Kader yang ada di beberapa unit dihitung di tiap unitnya.
export async function getKondisiTimMap(studioIds, now = new Date()) {
  const kosong = () => ({ total: 0, baik: 0, perhatian: 0, kritis: 0, belum_dinilai: 0 })
  const hasil = Object.fromEntries(studioIds.map(id => [id, kosong()]))
  if (studioIds.length === 0) return hasil

  const roles = await prisma.userRole.findMany({
    where: { studioId: { in: studioIds }, roleType: { in: ROLE_DINILAI }, user: { statusAktif: true } },
    select: { studioId: true, userId: true },
  })
  const userIds = [...new Set(roles.map(r => r.userId))]
  const penilaian = await prisma.penilaianKader.findMany({
    where: { userId: { in: userIds } },
    orderBy: { tanggalPenilaian: 'desc' },
  })
  const perUser = {}
  for (const p of penilaian) (perUser[p.userId] ??= []).push(p)
  const kondisiUser = Object.fromEntries(userIds.map(id => [id, kondisiKader(ringkasPenilaian(perUser[id] ?? [], now))]))

  const sudah = new Set()
  for (const r of roles) {
    const kunci = `${r.studioId}:${r.userId}`
    if (sudah.has(kunci)) continue // satu orang bisa punya 2 role operasional di unit yang sama
    sudah.add(kunci)
    const k = hasil[r.studioId]
    k.total += 1
    k[kondisiUser[r.userId]] += 1
  }
  return hasil
}
