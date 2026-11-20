import prisma from '../prisma.js'
import bcrypt from 'bcrypt'
import { computeTotalKompensasi } from '../utils/compensation.js'
import { buatKode, hashKode, MASA_BERLAKU_MS } from '../utils/telegramKode.js'


export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, nama: true, email: true,
        fotoUrl: true, telegramId: true, telegramKodeHash: true, telegramKodeKadaluarsa: true,
        telegramUsername: true, nomorWa: true, tanggalLahir: true,
        tanggalMasuk: true, statusAktif: true,
        jenisKelamin: true, posisi: true, alamat: true,
        namaBank: true, noRekening: true, atasNamaRekening: true,
        nik: true, nomorBpjs: true,
        roles: {
          include: {
            circle:     { select: { id: true, nama: true, colorHex: true } },
            rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
            studio:     { select: { id: true, nama: true, tipe: true } },
          },
        },
        studioPemilik: {
          select: { id: true, persenSaham: true, studio: { select: { id: true, nama: true, statusShu: true, totalShu: true } } },
        },
      },
    })
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' })
    // ID Telegram mentah tidak perlu sampai ke klien — cukup status tertaut atau belum.
    // telegramKodeAktif: ada kode tautan yang belum terpakai & belum kedaluwarsa (klien memantau ini
    // supaya tahu kapan kodenya dipakai di bot). Hash-nya sendiri tidak pernah dikirim ke klien.
    const { telegramId, telegramKodeHash, telegramKodeKadaluarsa, ...sisa } = user
    const telegramKodeAktif = !!telegramKodeHash && !!telegramKodeKadaluarsa && telegramKodeKadaluarsa > new Date()
    return res.json({ success: true, data: { ...sisa, telegramTertaut: !!telegramId, telegramKodeAktif, ...computeTotalKompensasi(user.roles, user.studioPemilik) } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ── Tautan Telegram aman (14 Okt 2026) ───────────────────────────────────────────────────────
// Dulu `/daftar email` di bot menautkan Telegram siapa pun ke akun mana pun hanya dari email (tanpa
// bukti kepemilikan). Sekarang pemilik akun yang SUDAH LOGIN membuat kode sekali pakai di sini,
// lalu mengirim `/daftar KODE` ke bot. Kode lama otomatis hangus saat dibuat yang baru.
export const buatKodeTelegram = async (req, res) => {
  try {
    const kode = buatKode()
    const kadaluarsa = new Date(Date.now() + MASA_BERLAKU_MS)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { telegramKodeHash: hashKode(kode), telegramKodeKadaluarsa: kadaluarsa },
    })
    res.set('Cache-Control', 'no-store')
    return res.json({ success: true, data: { kode, kadaluarsa } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal membuat kode, coba lagi' })
  }
}

export const putuskanTelegram = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { telegramId: null, telegramKodeHash: null, telegramKodeKadaluarsa: null },
    })
    return res.json({ success: true, message: 'Tautan Telegram diputus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memutus tautan, coba lagi' })
  }
}

export const updateProfile = async (req, res) => {
  try {
    const { nama, telegramUsername, nomorWa, tanggalLahir, fotoUrl,
            jenisKelamin, posisi, alamat, namaBank, noRekening, atasNamaRekening,
            nik, nomorBpjs } = req.body

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(nama             !== undefined && { nama }),
        ...(telegramUsername !== undefined && { telegramUsername: telegramUsername || null }),
        ...(nomorWa          !== undefined && { nomorWa: nomorWa || null }),
        ...(tanggalLahir     !== undefined && { tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : null }),
        ...(fotoUrl          !== undefined && { fotoUrl }),
        ...(jenisKelamin     !== undefined && { jenisKelamin: jenisKelamin || null }),
        ...(posisi           !== undefined && { posisi: posisi || null }),
        ...(alamat           !== undefined && { alamat: alamat || null }),
        ...(namaBank         !== undefined && { namaBank: namaBank || null }),
        ...(noRekening       !== undefined && { noRekening: noRekening || null }),
        ...(atasNamaRekening !== undefined && { atasNamaRekening: atasNamaRekening || null }),
        ...(nik              !== undefined && { nik: nik || null }),
        ...(nomorBpjs        !== undefined && { nomorBpjs: nomorBpjs || null }),
      },
      select: {
        id: true, nama: true, email: true, fotoUrl: true,
        telegramId: true, telegramUsername: true, nomorWa: true, tanggalLahir: true,
        jenisKelamin: true, posisi: true, alamat: true,
        namaBank: true, noRekening: true, atasNamaRekening: true,
        nik: true, nomorBpjs: true,
      },
    })
    return res.json({ success: true, data: user, message: 'Profil berhasil diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const changePassword = async (req, res) => {
  try {
    const { passwordLama, passwordBaru } = req.body
    if (!passwordLama || !passwordBaru) {
      return res.status(422).json({ success: false, message: 'Password lama dan baru wajib diisi' })
    }
    if (passwordBaru.length < 8) {
      return res.status(422).json({ success: false, message: 'Password baru minimal 8 karakter' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const match = await bcrypt.compare(passwordLama, user.passwordHash)
    if (!match) return res.status(401).json({ success: false, message: 'Password lama salah' })

    const hash = await bcrypt.hash(passwordBaru, 10)
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { passwordHash: hash },
    })

    return res.json({ success: true, message: 'Password berhasil diubah' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
