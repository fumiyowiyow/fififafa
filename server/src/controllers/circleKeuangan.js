import prisma from '../prisma.js'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { ROLE_KIRIM_LAPORAN, STAFF_PLUS, hasAnyRole } from '../utils/roles.js'
import { peranKerja, studioBolehDilihat, permintaanBaca } from './circle.js'
import * as Lap from './weeklyReport.js'
import * as Peng from './pengeluaran.js'
import * as Rek from './studioRekening.js'
import { upsertStudioCpm, getStudioCpm } from './monthlyData.js'
import { bayanganOmsetStudio } from '../utils/omsetBayangan.js'

// KEUANGAN di web circle (21 Okt 2026) — menampilkan & mengisi laporan omset mingguan, pengeluaran, saldo kas, dan
// dana di luar kas LANGSUNG ke data Ekosistem (satu data besar). Tidak ada logika keuangan baru di sini: semua hitungan
// (periode, kas, CPM, penyamaran angka di luar wilayah) tetap dikerjakan handler Ekosistem yang sama. Lapisan ini hanya
// (1) membatasi ke circle/rumah usaha pemilik alamat web, (2) menyaring peran DIGNITY, (3) merapikan hasil ke
// lingkup circle itu. Omset otomatis dari order produksi sengaja TIDAK ada (keputusan user: nanti).

const gagal = (res, status, message) => res.status(status).json({ success: false, message })

/** Jalankan handler Ekosistem dengan res tiruan; kembalikan { status, body } supaya hasilnya bisa disaring. */
async function tangkap(handler, req) {
  let status = 200, body
  const res = { status(s) { status = s; return this }, json(b) { body = b; return this } }
  await handler(req, res)
  return { status, body }
}

/** Semua studio aktif di circle/rumah usaha alamat ini (sebelum disaring peran). */
async function studioLingkup(req) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') return []
  const where = whereLingkup(web.lingkup)
  const ids = (await prisma.studio.findMany({ where: { ...where, statusAktif: true }, select: { id: true } })).map(s => s.id)
  const boleh = await Promise.all(ids.map(id => studioBolehDilihat(req, id)))
  return ids.filter((_, i) => boleh[i])
}

// Talent (Kader/Karyawan/Magang) TIDAK melihat omset/kas (Aturan Keras 2, ditegaskan user 21 Okt 2026): baca pun hanya Koordinator/Pendamping ke atas.
const bacaOk = (req) => hasAnyRole(peranKerja(req), STAFF_PLUS)
const tulisOk = (req) => hasAnyRole(peranKerja(req), ROLE_KIRIM_LAPORAN)

/** Pembungkus: isi req.userRoles HANYA dengan peran Koordinator ke atas (tanpa DIGNITY/talent) — handler Ekosistem lalu menghitung
 *  wilayah (lingkupKeuangan / canManageStudio) dari peran itu saja, jadi unit tempat dia cuma Kader tidak ikut. */
const jalur = (tulis, isi) => async (req, res) => {
  try {
    const web = await resolveWeb(req)
    if (web.aud !== 'circle') return gagal(res, 403, 'Hanya untuk web circle')
    if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) return gagal(res, 403, 'Token bukan untuk alamat ini')
    req.userRoles = peranKerja(req).filter(r => STAFF_PLUS.includes(r.roleType))
    if (permintaanBaca(req)) {
      // PEMILIK unit (penerima SHU) melihat keuangan unitnya, LIHAT SAJA: peran sementara setara Pendamping untuk unit tempat ia pemilik di
      // alamat ini, HANYA untuk permintaan baca ini (tidak disimpan; permintaan tulis tidak pernah mendapatkannya).
      const kunci = whereLingkup(web.lingkup)
      const milik = await prisma.studioPemilik.findMany({ where: { userId: req.user.id, studio: kunci }, select: { studioId: true } })
      for (const m of milik) if (!req.userRoles.some(r => r.studioId === m.studioId)) req.userRoles.push({ roleType: 'PENDAMPING', studioId: m.studioId, userId: req.user.id, sementaraPemilik: true })
    }
    if (!(tulis && !permintaanBaca(req) ? tulisOk(req) : bacaOk(req))) return gagal(res, 403, tulis ? 'Hanya Koordinator/Pendamping ke atas yang mengisi laporan' : 'Akses ditolak')
    return await isi(req, res)
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

const teruskan = async (handler, req, res, saring) => {
  const { status, body } = await tangkap(handler, req)
  if (!body?.success || !saring) return res.status(status).json(body)
  return res.status(status).json(saring(body))
}

// ── Baca ────────────────────────────────────────────────────────────────────────────────────────────
export const getStatus = jalur(false, async (req, res) => {
  const ids = new Set(await studioLingkup(req))
  return teruskan(Lap.getStatusThisWeek, req, res, (b) => ({ ...b, data: b.data.filter(s => ids.has(s.id)) }))
})

export const getBulanan = jalur(false, async (req, res) => {
  const ids = new Set(await studioLingkup(req))
  return teruskan(Lap.getMonthlyReport, req, res, (b) => {
    // Ekosistem mengurutkan peringkat se-ekosistem dari angka asli; di sini cukup disaring dan dinomori ulang (urutan sama).
    const studios = b.data.studios.filter(s => ids.has(s.id)).sort((a, c) => a.peringkat - c.peringkat)
      .map((s, i) => ({ ...s, peringkat: i + 1 }))
    const nyata = studios.filter(s => s.totalUsd != null)
    const grandTotalUsd = nyata.reduce((a, s) => a + s.totalUsd, 0)
    const grandTotalIdr = nyata.reduce((a, s) => a + s.totalUsd * (s.avgKurs ?? 0), 0)
    const sudahLapor = studios.filter(s => s.sudahLapor).length
    return { ...b, data: { ...b.data, studios, summary: {
      totalStudio: studios.length, sudahLapor, belumLapor: studios.length - sudahLapor, grandTotalUsd, grandTotalIdr,
      grandTotalPengeluaran: nyata.reduce((a, s) => a + (s.totalPengeluaran ?? 0), 0),
      grandTotalKas: nyata.reduce((a, s) => a + (s.kasAkhir ?? 0), 0),
    } } }
  })
})

export const getRiwayat = jalur(false, async (req, res) => {
  const ids = await studioLingkup(req)
  const diminta = String(req.query.studioId ?? '').split(',').filter(Boolean)
  // Express 5: req.query hanya getter → pakai salinan turunan dengan query terbatas pada unit circle ini
  const query = { ...req.query, studioId: (diminta.length ? diminta.filter(i => ids.includes(i)) : ids).join(',') || '-' }
  return teruskan(Lap.getAll, Object.create(req, { query: { value: query } }), res)
})

// ── Tulis laporan ───────────────────────────────────────────────────────────────────────────────────
export const buatLaporan = jalur(true, async (req, res) => {
  if (!(await studioBolehDilihat(req, req.body?.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  return teruskan(Lap.create, req, res)
})

const lewatLaporan = (handler) => jalur(true, async (req, res) => {
  const lap = await prisma.weeklyReport.findUnique({ where: { id: req.params.id }, select: { studioId: true } })
  if (!lap) return gagal(res, 404, 'Laporan tidak ditemukan')
  if (!(await studioBolehDilihat(req, lap.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  return teruskan(handler, req, res)
})
export const ubahLaporan = lewatLaporan(Lap.update)
export const hapusLaporan = lewatLaporan(Lap.remove)

// ── Pengeluaran per item ────────────────────────────────────────────────────────────────────────────
export const getPengeluaran = jalur(true, async (req, res) => {
  if (!(await studioBolehDilihat(req, req.query?.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  return teruskan(Peng.list, req, res)
})
export const buatPengeluaran = jalur(true, async (req, res) => {
  if (!(await studioBolehDilihat(req, req.body?.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  // api() web circle hanya membaca `data`, jadi peringatan (Beban orang vs Payroll) dipindah ke dalam data
  return teruskan(Peng.create, req, res, (b) => (b.peringatan ? { ...b, data: { ...b.data, peringatan: b.peringatan } } : b))
})
const lewatPengeluaran = (handler) => jalur(true, async (req, res) => {
  const p = await prisma.pengeluaran.findUnique({ where: { id: req.params.id }, select: { studioId: true } })
  if (!p) return gagal(res, 404, 'Pengeluaran tidak ditemukan')
  if (!(await studioBolehDilihat(req, p.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  return teruskan(handler, req, res)
})
export const ubahPengeluaran = lewatPengeluaran(Peng.update)
export const hapusPengeluaran = lewatPengeluaran(Peng.remove)

// ── Saldo kas (rekening): hanya saldo — nomor rekening & atas nama TIDAK pernah dikirim ke web circle ───
export const getSaldo = jalur(true, async (req, res) => {
  if (!(await studioBolehDilihat(req, req.params.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  return teruskan(Rek.getRekening, req, res, (b) => ({
    ...b, data: b.data.map(r => ({ id: r.id, namaBank: r.namaBank, saldo: r.saldo, updatedAt: r.updatedAt })),
  }))
})
export const ubahSaldo = jalur(true, async (req, res) => {
  if (!(await studioBolehDilihat(req, req.params.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  if (req.body?.saldo === undefined || isNaN(Number(req.body.saldo)) || Number(req.body.saldo) < 0) return gagal(res, 422, 'Saldo harus angka, tidak boleh negatif')
  req.body = { saldo: Number(req.body.saldo) } // hanya saldo yang boleh diubah dari web circle
  return teruskan(Rek.updateRekening, req, res, (b) => ({ ...b, data: { id: b.data.id, namaBank: b.data.namaBank, saldo: b.data.saldo } }))
})

// ── Omzet bayangan: order web circle vs Laporan Omset (BACA saja, mode bayangan — jembatan sebelum integrasi omzet) ──
export const getBayangan = jalur(false, async (req, res) => {
  const { studioId } = req.query
  const bulan = Number(req.query.bulan), tahun = Number(req.query.tahun)
  if (!(Number.isInteger(bulan) && bulan >= 1 && bulan <= 12 && Number.isInteger(tahun) && tahun >= 2024 && tahun <= 2100)) return gagal(res, 422, 'bulan/tahun tidak valid')
  if (!studioId || !(await studioLingkup(req)).includes(studioId)) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  return res.json({ success: true, data: await bayanganOmsetStudio(studioId, bulan, tahun) })
})

// ── Dana di luar kas (catatan bulanan) ──────────────────────────────────────────────────────────────
export const getDanaLuar = jalur(false, async (req, res) => {
  const ids = new Set(await studioLingkup(req))
  return teruskan(getStudioCpm, req, res, (b) => ({ ...b, data: b.data.filter(n => ids.has(n.studioId)) }))
})
export const simpanDanaLuar = jalur(true, async (req, res) => {
  if (!(await studioBolehDilihat(req, req.body?.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  return teruskan(upsertStudioCpm, req, res)
})
