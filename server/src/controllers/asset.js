import prisma from '../prisma.js'
import { canManageStudio, hasAnyRole, ASSET_MANAGERS } from '../utils/roles.js'

// Nilai rupiah: kosong/null = belum diisi; selain itu harus angka >= 0.
function bacaNilai(v) {
  if (v === undefined) return { skip: true }
  if (v === null || v === '') return { nilai: null }
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return { galat: true }
  return { nilai: Math.round(n) }
}


// Nilai Saat Ini DIHITUNG, tidak diisi manual (keputusan user 15 Okt 2026):
//   umur < 1 tahun sejak tanggal beli → 70% dari nilai beli; umur >= 1 tahun → 50%.
// Tanpa nilai beli atau tanpa tanggal beli → null (belum bisa dihitung). Kolom nilaiTerkini di DB
// tidak dipakai lagi; nilainya selalu diturunkan di sini supaya turun otomatis saat lewat setahun.
export function hitungNilaiSaatIni(nilaiBeli, tanggalBeli, sekarang = new Date()) {
  if (nilaiBeli == null || !tanggalBeli) return { nilai: null, persen: null }
  const ulangTahun = new Date(tanggalBeli)
  ulangTahun.setUTCFullYear(ulangTahun.getUTCFullYear() + 1)
  const persen = sekarang < ulangTahun ? 70 : 50
  return { nilai: Math.round(nilaiBeli * persen / 100), persen }
}

// Tanggal beli: kosong = belum diisi; harus tanggal valid dan tidak di masa depan.
function bacaTanggalBeli(v) {
  if (v === undefined) return { skip: true }
  if (v === null || v === '') return { nilai: null }
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return { galat: 'Tanggal beli tidak valid' }
  if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { galat: 'Tanggal beli tidak boleh di masa depan' }
  return { nilai: d }
}

export const getAll = async (req, res) => {
  try {
    const { studioId, tipe } = req.query
    const where = {
      ...(studioId && { studioId }),
      ...(tipe     && { tipe }),
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: [{ studioId: 'asc' }, { tipe: 'asc' }, { nama: 'asc' }],
    })

    const studioIds = [...new Set(assets.map(a => a.studioId))]
    const studios   = await prisma.studio.findMany({
      where: { id: { in: studioIds } },
      select: { id: true, nama: true,
        circle:     { select: { nama: true, colorHex: true } },
        rumahUsaha: { select: { nama: true, colorHex: true } },
      },
    })
    const studioMap = Object.fromEntries(studios.map(s => [s.id, s]))

    // Nilai rupiah hanya untuk pengelola aset; peran lain tak menerima field-nya sama sekali.
    const lihatNilai = hasAnyRole(req.userRoles, ASSET_MANAGERS)
    return res.json({
      success: true,
      data: assets.map(({ nilaiBeli, nilaiTerkini: _manual, ...a }) => {
        const { nilai, persen } = hitungNilaiSaatIni(nilaiBeli, a.tanggalBeli)
        return {
          ...a, studio: studioMap[a.studioId] ?? null,
          ...(lihatNilai && { nilaiBeli, nilaiTerkini: nilai, persenNilai: persen }),
        }
      }),
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    const { studioId, nama, tipe, keterangan, pemegangId, masaAktif } = req.body
    const beli = bacaNilai(req.body.nilaiBeli)
    if (beli.galat) {
      return res.status(422).json({ success: false, message: 'Nilai aset harus berupa angka rupiah, tidak boleh negatif' })
    }
    const tgl = bacaTanggalBeli(req.body.tanggalBeli)
    if (tgl.galat) return res.status(422).json({ success: false, message: tgl.galat })
    if (!studioId || !nama || !tipe) {
      return res.status(422).json({ success: false, message: 'studioId, nama, tipe wajib' })
    }
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa tambah aset studio sendiri' })
    }
    const asset = await prisma.asset.create({
      data: {
        studioId, nama, tipe,
        keterangan: keterangan ?? null,
        pemegangId: pemegangId ?? null,
        masaAktif:  masaAktif  ? new Date(masaAktif) : null,
        nilaiBeli: beli.nilai ?? null,
        tanggalBeli: tgl.nilai ?? null,
        status: 'aktif',
      },
    })
    return res.status(201).json({ success: true, data: asset })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

async function checkAssetOwnership(assetId, userRoles) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { studioId: true } })
  if (!asset) return { error: 'Aset tidak ditemukan', status: 404 }
  if (!(await canManageStudio(userRoles, asset.studioId))) {
    return { error: 'Hanya bisa edit aset studio sendiri', status: 403 }
  }
  return { asset }
}

const STATUS_VALID = ['aktif', 'nonaktif', 'dipinjam']
const TIPE_BOLEH = ['PERALATAN', 'SOFTWARE']

export const update = async (req, res) => {
  try {
    const check = await checkAssetOwnership(req.params.id, req.userRoles)
    if (check.error) return res.status(check.status).json({ success: false, message: check.error })

    const { status, keterangan, pemegangId, masaAktif, nama, tipe, studioId } = req.body

    const beli = bacaNilai(req.body.nilaiBeli)
    if (beli.galat) {
      return res.status(422).json({ success: false, message: 'Nilai aset harus berupa angka rupiah, tidak boleh negatif' })
    }
    const tgl = bacaTanggalBeli(req.body.tanggalBeli)
    if (tgl.galat) return res.status(422).json({ success: false, message: tgl.galat })
    if (status !== undefined && !STATUS_VALID.includes(status)) {
      return res.status(422).json({ success: false, message: 'Status tidak dikenal' })
    }
    if (nama !== undefined && !String(nama).trim()) {
      return res.status(422).json({ success: false, message: 'Nama aset tidak boleh kosong' })
    }
    if (tipe !== undefined) {
      // Akun Marketplace sudah pindah ke Direktori Sosmed: tidak boleh DIPILIH lagi, tapi baris lama
      // yang masih bertipe itu boleh disimpan tanpa mengubah tipenya.
      const lama = await prisma.asset.findUnique({ where: { id: req.params.id }, select: { tipe: true } })
      const boleh = TIPE_BOLEH.includes(tipe) || tipe === lama?.tipe
      if (!boleh) return res.status(422).json({ success: false, message: 'Tipe aset tidak valid' })
    }
    // Pindah unit: pengelola harus berwenang atas unit TUJUAN juga (bukan cuma unit asal).
    if (studioId !== undefined) {
      const tujuan = await prisma.studio.findUnique({ where: { id: studioId }, select: { id: true } })
      if (!tujuan) return res.status(422).json({ success: false, message: 'Unit tujuan tidak ditemukan' })
      if (!(await canManageStudio(req.userRoles, studioId))) {
        return res.status(403).json({ success: false, message: 'Tidak berwenang atas unit tujuan' })
      }
    }

    const asset = await prisma.asset.update({
      where: { id: req.params.id },
      data: {
        ...(status     !== undefined && { status }),
        ...(keterangan !== undefined && { keterangan: keterangan ? String(keterangan).trim() : null }),
        ...(pemegangId !== undefined && { pemegangId }),
        ...(masaAktif  !== undefined && { masaAktif: masaAktif ? new Date(masaAktif) : null }),
        ...(nama       !== undefined && { nama: String(nama).trim() }),
        ...(tipe       !== undefined && { tipe }),
        ...(studioId   !== undefined && { studioId }),
        ...(!beli.skip    && { nilaiBeli: beli.nilai }),
        ...(!tgl.skip     && { tanggalBeli: tgl.nilai }),
      },
    })
    return res.json({ success: true, data: asset })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const remove = async (req, res) => {
  try {
    const check = await checkAssetOwnership(req.params.id, req.userRoles)
    if (check.error) return res.status(check.status).json({ success: false, message: check.error })

    await prisma.asset.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Aset dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
