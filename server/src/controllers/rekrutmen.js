import prisma from '../prisma.js'
import bcrypt from 'bcrypt'
import { ROLE_LEVEL, bestLevel, canAssignScope, scopeArgs } from '../utils/roles.js'


export const getAll = async (req, res) => {
  try {
    const { status, jalur } = req.query
    const where = {
      ...(status && { status }),
      ...(jalur  && { jalurMasuk: jalur }),
    }
    const items = await prisma.rekrutmen.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ success: true, data: items })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    const { namaCalon, jalurMasuk, referralDari, studioTujuan, catatan,
            email, nomorWa, telegramId, tanggalLahir, jenisKelamin, posisi } = req.body
    if (!namaCalon || !jalurMasuk) {
      return res.status(422).json({ success: false, message: 'namaCalon dan jalurMasuk wajib' })
    }
    const item = await prisma.rekrutmen.create({
      data: {
        namaCalon, jalurMasuk,
        referralDari:  referralDari  ?? null,
        studioTujuan:  studioTujuan  ?? null,
        catatan:       catatan       ?? null,
        email:         email         ?? null,
        nomorWa:       nomorWa       ?? null,
        telegramId:    telegramId    ?? null,
        tanggalLahir:  tanggalLahir  ? new Date(tanggalLahir) : null,
        jenisKelamin:  jenisKelamin  ?? null,
        posisi:        posisi        ?? null,
        status: 'PENDAFTARAN',
      },
    })
    return res.status(201).json({ success: true, data: item })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const jadikanAnggota = async (req, res) => {
  try {
    const { id } = req.params
    const { passwordAwal, roleType, circleId, studioId,
            nama, email, nomorWa, telegramId, tanggalLahir, jenisKelamin, posisi } = req.body

    const calon = await prisma.rekrutmen.findUnique({ where: { id } })
    if (!calon) return res.status(404).json({ success: false, message: 'Data rekrutmen tidak ditemukan' })
    if (calon.sudahJadiAnggota) return res.status(409).json({ success: false, message: 'Calon ini sudah menjadi anggota' })
    if (!email || !passwordAwal || !roleType) {
      return res.status(422).json({ success: false, message: 'email, passwordAwal, dan roleType wajib diisi' })
    }
    if (ROLE_LEVEL[roleType] === undefined) {
      return res.status(422).json({ success: false, message: 'roleType tidak valid' })
    }
    if (ROLE_LEVEL[roleType] < bestLevel(req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Tidak bisa membuat akun dengan role lebih senior dari role sendiri' })
    }
    // scopeArgs: kalau studioId ada, itu aja yang dicek -- circleId di sini cuma context (auto-
    // terisi dari circle studio yang dipilih di form), bukan syarat independen. Tanpa ini,
    // KOORDINATOR/PENDAMPING (wewenang sah atas studio sendiri, bukan KEPALA_CIRCLE) salah
    // ke-block pas jadikan calon jadi anggota studio mereka sendiri (bug sama kayak di members.js).
    if ((studioId || circleId) && !(await canAssignScope(req.userRoles ?? [], scopeArgs(studioId, circleId)))) {
      return res.status(403).json({ success: false, message: 'Tidak bisa membuat akun untuk studio/circle di luar wewenangmu' })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) return res.status(409).json({ success: false, message: 'Email sudah terdaftar' })

    const passwordHash = await bcrypt.hash(passwordAwal, 10)
    const resolvedTanggalLahir = tanggalLahir
      ? new Date(tanggalLahir)
      : (calon.tanggalLahir ?? null)

    // User baru + tandai calon sebagai sudah jadi anggota harus atomic -- kalau gak, server
    // yang gangguan di antara dua write bisa bikin User kebuat tapi Rekrutmen masih keliatan
    // "belum jadi anggota", buka celah tombol "Jadikan Anggota" diklik ulang jadi user dobel.
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          nama:         nama        || calon.namaCalon,
          email:        email.toLowerCase(),
          passwordHash,
          nomorWa:      nomorWa     || calon.nomorWa    || null,
          telegramId:   telegramId  || calon.telegramId  || null,
          tanggalLahir: resolvedTanggalLahir,
          jenisKelamin: jenisKelamin || calon.jenisKelamin || null,
          posisi:       posisi       || calon.posisi       || null,
          roles: {
            create: {
              roleType,
              circleId: circleId || null,
              studioId: studioId || null,
            },
          },
        },
      })

      await tx.rekrutmen.update({
        where: { id },
        data: { sudahJadiAnggota: true, status: 'DITERIMA' },
      })

      return newUser
    })

    return res.status(201).json({
      success: true,
      data: user,
      message: `${user.nama} berhasil dijadikan anggota`,
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getBadge = async (req, res) => {
  try {
    const count = await prisma.rekrutmen.count({ where: { status: 'PENDAFTARAN' } })
    return res.json({ success: true, data: { pendaftaran: count } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const remove = async (req, res) => {
  try {
    await prisma.rekrutmen.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Data rekrutmen dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateStatus = async (req, res) => {
  try {
    const { status, catatan } = req.body
    const VALID = ['PENDAFTARAN','SELEKSI','DITERIMA','DITOLAK']
    if (!VALID.includes(status)) {
      return res.status(422).json({ success: false, message: `Status harus: ${VALID.join(', ')}` })
    }
    const item = await prisma.rekrutmen.update({
      where: { id: req.params.id },
      data: { status, ...(catatan !== undefined && { catatan }) },
    })
    return res.json({ success: true, data: item })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
