import prisma from '../prisma.js'
import { kelolaStudio } from '../utils/roles.js'
import { getCpmMapForStudios, bulanIniWIB } from '../utils/cpm.js'

// CPM satu unit pada satu bulan + koreksi manual foto bulan yang sudah lewat (4 Nov 2026).
// Akses = pengelola unit itu (Koordinator/Pendamping unit, Kepala Circle/Rumah Usaha pemiliknya, Super Admin).
// Bulan berjalan/mendatang tidak bisa dikoreksi: selalu dihitung langsung dari Bio Studio (utils/cpm.js).

function baca(q) {
  const bulan = parseInt(q.bulan), tahun = parseInt(q.tahun)
  if (!q.studioId || !(bulan >= 1 && bulan <= 12) || !(tahun >= 2020 && tahun <= 2100)) return null
  return { studioId: String(q.studioId), bulan, tahun }
}
const sudahLewat = (bulan, tahun) => { const k = bulanIniWIB(); return tahun * 12 + bulan < k.tahun * 12 + k.bulan }
const angka = (v) => Math.round(Number(v) || 0)

async function bentuk({ studioId, bulan, tahun }) {
  const foto = sudahLewat(bulan, tahun)
    ? await prisma.studioCpmBulanan.findUnique({ where: { studioId_bulan_tahun: { studioId, bulan, tahun } } })
    : null
  const c = foto ?? (await getCpmMapForStudios([studioId]))[studioId]
  return {
    studioId, bulan, tahun,
    sumber: foto ? (foto.diubahPada ? 'dikoreksi' : 'foto') : 'langsung',
    bisaDikoreksi: sudahLewat(bulan, tahun),
    totalThp: c.totalThp, jumlahOrang: c.jumlahOrang ?? 0, totalPengeluaranRutin: c.totalPengeluaranRutin,
    totalShu: c.totalShu, totalCpm: c.totalCpm,
    diubahOleh: foto?.diubahOleh ?? null, diubahPada: foto?.diubahPada ?? null,
  }
}

export const getCpmBulanan = async (req, res) => {
  try {
    const k = baca(req.query)
    if (!k) return res.status(422).json({ success: false, message: 'studioId, bulan, dan tahun wajib diisi' })
    if (!(await kelolaStudio(req.userRoles, k.studioId))) return res.status(403).json({ success: false, message: 'Tidak punya akses ke unit ini' })
    return res.json({ success: true, data: await bentuk(k) })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memuat CPM bulanan' })
  }
}

export const simpanCpmBulanan = async (req, res) => {
  try {
    const k = baca(req.body)
    if (!k) return res.status(422).json({ success: false, message: 'studioId, bulan, dan tahun wajib diisi' })
    if (!(await kelolaStudio(req.userRoles, k.studioId))) return res.status(403).json({ success: false, message: 'Tidak punya akses ke unit ini' })
    if (!sudahLewat(k.bulan, k.tahun)) return res.status(409).json({ success: false, message: 'CPM bulan berjalan dihitung otomatis dari Bio Studio; hanya bulan yang sudah lewat yang bisa dikoreksi' })
    const nilai = ['totalThp', 'totalPengeluaranRutin', 'totalShu'].map(f => req.body[f])
    if (nilai.some(v => !Number.isFinite(Number(v)) || Number(v) < 0)) return res.status(422).json({ success: false, message: 'Angka harus 0 atau lebih' })
    const [totalThp, totalPengeluaranRutin, totalShu] = nilai.map(angka)
    const sebelum = await bentuk(k)
    const pengubah = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } })
    const data = {
      totalThp, totalPengeluaranRutin, totalShu, totalCpm: totalThp + totalPengeluaranRutin + totalShu,
      jumlahOrang: sebelum.jumlahOrang, diubahOleh: pengubah?.nama ?? req.user.id, diubahPada: new Date(),
    }
    await prisma.studioCpmBulanan.upsert({
      where: { studioId_bulan_tahun: { studioId: k.studioId, bulan: k.bulan, tahun: k.tahun } },
      create: { ...k, ...data }, update: data,
    })
    console.log(`[cpm] koreksi ${k.studioId} ${k.bulan}/${k.tahun} oleh ${data.diubahOleh}: ${sebelum.totalCpm} -> ${data.totalCpm}`)
    return res.json({ success: true, data: await bentuk(k), message: 'CPM bulan itu diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan CPM bulanan' })
  }
}

// Buang foto/koreksi -> bulan itu kembali dihitung langsung dari kondisi sekarang.
export const resetCpmBulanan = async (req, res) => {
  try {
    const k = baca(req.query)
    if (!k) return res.status(422).json({ success: false, message: 'studioId, bulan, dan tahun wajib diisi' })
    if (!(await kelolaStudio(req.userRoles, k.studioId))) return res.status(403).json({ success: false, message: 'Tidak punya akses ke unit ini' })
    await prisma.studioCpmBulanan.deleteMany({ where: k })
    return res.json({ success: true, data: await bentuk(k), message: 'Kembali dihitung langsung' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengembalikan CPM bulanan' })
  }
}
