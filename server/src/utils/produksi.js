// Kalkulasi finansial modul Produksi -- dipisah dari controller biar bisa diverifikasi langsung
// tanpa perlu mock Express req/res atau Prisma. Project ini belum punya framework test terpasang
// (cek 7 Agustus 2026: nol jest/vitest/mocha di package.json manapun, nol file *.test.js) --
// verifikasi kalkulasi ini sementara dijalankan ad-hoc (lihat laporan), BUKAN file test permanen,
// sampai ada keputusan framework mana yang mau dipakai project ini.

import prisma from '../prisma.js'
import { kelolaStudio } from './roles.js'

// nilaiBersih SELALU dihitung server-side dari nilaiKotor & fee akun -- controller TIDAK PERNAH
// percaya nilaiBersih yang dikirim dari frontend (lihat createOrder/updateOrder di
// controllers/produksi.js).
export function hitungNilaiBersih(nilaiKotor, feePersen) {
  return nilaiKotor * (1 - feePersen)
}

// Otorisasi buat operasi KELOLA ORDER (create/update/delete/assignment) -- KOORDINATOR ke atas
// ATAU ada baris ProduksiAdminMarket buat user+studio ini (akses khusus di luar hierarki role
// biasa, lihat komentar model-nya di schema.prisma). SENGAJA endpoint yang ngatur siapa dapat
// akses ini (routes/produksi.js: GET/POST/DELETE /admin-market) TETAP pakai canManageStudio
// doang (BUKAN fungsi ini) -- biar orang yang cuma dapat akses lewat ProduksiAdminMarket gak
// bisa kasih akses ke diri sendiri/orang lain.
//
// PENTING: canManageStudio SENDIRIAN gak cukup buat "KOORDINATOR ke atas" -- fallback
// terakhirnya (`roles.some(r => r.studioId === studioId)`) permisif buat SIAPA PUN yang punya
// role apa aja di studio itu, TERMASUK KADER polos (lihat roles.js). Selama ini itu gak masalah
// buat create/update/delete order karena route-level checkRole(PRODUKSI_MANAGERS) yang beneran
// nyaring KADER duluan sebelum sampai controller -- tapi route itu sekarang dilonggarkan jadi
// authenticate+populateRoles (biar Admin Market grantee non-KOORDINATOR bisa lolos), jadi kalau
// fungsi ini cuma manggil canManageStudio doang, SEMUA KADER-dengan-role-apa-aja-di-studio-itu
// bakal ikut kebobol lolos juga -- bukan cuma yang beneran dikasih ProduksiAdminMarket. Makanya
// di sini WAJIB dicek eksplisit role-nya beneran KOORDINATOR ke atas (STAFF_PLUS), baru gabung
// sama canManageStudio (buat nangkep KEPALA_CIRCLE/KEPALA_RUMAH_USAHA yang scope-nya circle/rumah
// usaha, bukan role langsung di studio itu) -- pola sama persis kayak isKoordinatorPlus di
// getOrders/getPenggajianList.
// 21 Okt 2026: peran Koordinator ke atas harus UNTUK studio ini (kelolaStudio), bukan di studio mana saja.
export async function canManageProduksiOrder(userRoles, userId, studioId) {
  if (await kelolaStudio(userRoles ?? [], studioId)) return true
  const admin = await prisma.produksiAdminMarket.findUnique({
    where: { userId_studioId: { userId, studioId } },
  })
  return !!admin
}

// Fase 1 (Fondasi Klien/Talent, 8 Agustus 2026) -- cari KlienProduksi existing (case-insensitive-
// trim, scoped per studio) atau bikin baru. Dipanggil dari createOrder/updateOrder/
// bulkImportOrders SETIAP kali field teks `klien` ditulis buat order tipeKlien=EKSTERNAL. `klien`
// (teks bebas) TETAP sumber tampilan/wajib diisi -- ini cuma link tambahan yang auto-terisi,
// TIDAK PERNAH divalidasi/direject dari sisi user. Nama beda kapitalisasi ("Budi" vs "budi")
// DIANGGAP SAMA klien (di-merge ke row yang sama) -- beda dari findOrCreateTalentEksternal di
// bawah yang SENGAJA gak dianggap identik lewat DB unique, lihat komentarnya.
export async function findOrCreateKlien(studioId, namaKlien) {
  const nama = namaKlien?.toString().trim()
  if (!nama) return null
  const existing = await prisma.klienProduksi.findFirst({
    where: { studioId, nama: { equals: nama, mode: 'insensitive' } },
  })
  if (existing) return existing.id
  try {
    const created = await prisma.klienProduksi.create({ data: { studioId, nama } })
    return created.id
  } catch (e) {
    if (e.code === 'P2002') {
      // Race condition -- 2 request bareng bikin klien sama persis, yang kalah re-fetch aja.
      const retry = await prisma.klienProduksi.findFirst({ where: { studioId, nama: { equals: nama, mode: 'insensitive' } } })
      return retry?.id ?? null
    }
    throw e
  }
}

// Cari TalentEksternal existing (case-insensitive-trim, EKOSISTEM-WIDE, bukan per-studio -- lihat
// komentar model) atau bikin baru. SENGAJA TIDAK ada @@unique DB di `nama` (beda dari
// KlienProduksi di atas) -- nama orang, terutama nama depan doang, jauh lebih rawan "teks sama
// TAPI orang beda beneran" dibanding nama klien/studio, jadi kolisi di sini gak boleh dipaksa
// P2002/merge otomatis lewat constraint database. Ini SATU-SATUNYA identitas talent lintas studio
// yang bakal dipakai Fase 4 (saldo aggregation) -- kalau nama sama-tapi-beda-orang pernah kejadian
// nyata mengacaukan angka, itu butuh tooling split manual terpisah, BUKAN scope Fase 1 ini.
export async function findOrCreateTalentEksternal(namaTalent) {
  const nama = namaTalent?.toString().trim()
  if (!nama) return null
  const existing = await prisma.talentEksternal.findFirst({
    where: { nama: { equals: nama, mode: 'insensitive' } },
  })
  if (existing) return existing.id
  const created = await prisma.talentEksternal.create({ data: { nama } })
  return created.id
}

// Fase 4b -- pembagian minggu 1-4 dalam sebulan, hari-ke-bulan TETAP (1-7/8-14/15-21/22-akhir),
// BUKAN minggu kalender Senin-Minggu (itu punya utils/week.js sendiri, tujuan beda). Minggu ke-4
// nampung sisa hari (8-10 hari buat bulan 29-31 hari) -- sengaja, biar selalu tepat 4 bucket sesuai
// sheet "Financial Forecasting" asli, bukan 5 bucket di bulan panjang.
export function mingguKeBulan(tanggal) {
  const hari = tanggal.getDate()
  if (hari <= 7) return 1
  if (hari <= 14) return 2
  if (hari <= 21) return 3
  return 4
}

/** Nama klien yang tampak seperti NOMINAL uang ("Rp 650.000", "650000") — biasanya salah baca saat "Tempel banyak" (laporan tim 10 Nov 2026). */
export const klienTampakNominal = (k) => { const t = String(k ?? '').trim(); return /^(rp\.?\s*)?\d[\d.,\s]*$/i.test(t) || /\brp\.?\s*\d/i.test(t) }
