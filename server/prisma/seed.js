import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

// Seed awal untuk ekosistem baru: HANYA membuat satu akun Super Admin (role ADVISOR) pertama.
// Tidak menghapus apa pun dan tidak berisi data orang sungguhan, jadi aman dijalankan berulang
// (kalau email sudah ada, seed berhenti tanpa mengubah apa-apa).
//
// Jalankan sekali setelah `npx prisma migrate deploy`:
//   ADMIN_EMAIL=admin@domain-anda.com ADMIN_NAMA="Nama Admin" ADMIN_PASSWORD='minimal-12-karakter' npm run db:seed
// Setelah login, ganti password dari halaman profil, lalu buat circle, studio, dan akun lain dari dalam aplikasi.

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  const nama = (process.env.ADMIN_NAMA ?? '').trim()
  const password = process.env.ADMIN_PASSWORD ?? ''

  if (!email || !nama || !password) {
    throw new Error('Isi ADMIN_EMAIL, ADMIN_NAMA, dan ADMIN_PASSWORD (lihat komentar di atas file ini)')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL tidak valid')
  if (password.length < 12) throw new Error('ADMIN_PASSWORD minimal 12 karakter')

  const ada = await prisma.user.findUnique({ where: { email } })
  if (ada) {
    console.log(`ℹ️  ${email} sudah ada — seed tidak mengubah apa-apa`)
    return
  }

  const user = await prisma.user.create({
    data: {
      nama,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      roles: { create: [{ roleType: 'ADVISOR' }] },
    },
  })
  console.log(`✅ Super Admin pertama dibuat: ${user.nama} <${user.email}>`)
}

main()
  .catch((e) => { console.error(`❌ ${e.message}`); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
