import prisma from '../prisma.js'

// KATEGORI order/LTK per unit (10 Nov 2026, masukan tim): dipilih dari daftar, bukan diketik bebas (hindari typo "Visual"/"visual "),
// dan sebuah order boleh punya BEBERAPA kategori (bundling, mis. "3D Modeling + Animation"). Disimpan sebagai satu teks dipisah " + " di
// OrderProduksi.kategori / KasusLtk.kategori (pembaca lama tetap jalan); nama kategori tidak boleh mengandung "+".
// Daftar unit = tabel KategoriOrder; kategori lama yang sudah dipakai di order/LTK otomatis dimasukkan ke tabel (sinkronKategori).
export const PEMISAH = ' + '
export const MAKS_NAMA = 40, MAKS_JUMLAH = 6, MAKS_TEKS = 250
const norm = (t) => String(t ?? '').trim().replace(/\s+/g, ' ')
const kunci = (t) => norm(t).toLowerCase()
export const pisahKategori = (teks) => String(teks ?? '').split('+').map(norm).filter(Boolean)
export const namaKategoriSah = (n) => { const v = norm(n); return v && v.length <= MAKS_NAMA && !v.includes('+') ? v : null }

/** Masukkan kategori yang sudah dipakai order/LTK ke tabel (sekali jalan per pemanggilan, murah). Mengembalikan baris tabel terurut. */
export async function sinkronKategori(studioId) {
  const [simpan, order, ltk] = await Promise.all([
    prisma.kategoriOrder.findMany({ where: { studioId } }),
    prisma.orderProduksi.findMany({ where: { studioId, kategori: { not: null } }, distinct: ['kategori'], select: { kategori: true } }),
    prisma.kasusLtk.findMany({ where: { studioId, kategori: { not: null } }, distinct: ['kategori'], select: { kategori: true } }),
  ])
  const ada = new Set(simpan.map(x => kunci(x.nama)))
  const baru = new Map()
  for (const t of [...order, ...ltk]) for (const p of pisahKategori(t.kategori)) { const v = namaKategoriSah(p); if (v && !ada.has(kunci(v)) && !baru.has(kunci(v))) baru.set(kunci(v), v) }
  if (baru.size) await prisma.kategoriOrder.createMany({ data: [...baru.values()].map(nama => ({ studioId, nama })), skipDuplicates: true })
  const semua = baru.size ? await prisma.kategoriOrder.findMany({ where: { studioId } }) : simpan
  return semua.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}
export const daftarKategori = async (studioId) => (await sinkronKategori(studioId)).map(x => x.nama)

/** Samakan ejaan tiap kategori dengan daftar unit; yang baru otomatis disimpan. Hasil: "A + B" (tanpa dobel). Kosong → null. { galat } bila tidak sah. */
export async function kanonKategori(studioId, teks) {
  const bagian = pisahKategori(teks)
  if (!bagian.length) return null
  if (bagian.length > MAKS_JUMLAH) return { galat: `Maksimal ${MAKS_JUMLAH} kategori per order` }
  const daftar = await daftarKategori(studioId), hasil = []
  for (const b of bagian) {
    const v = namaKategoriSah(b); if (!v) return { galat: `Nama kategori "${b.slice(0, 20)}…" tidak sah (maks ${MAKS_NAMA} huruf)` }
    let nama = daftar.find(x => kunci(x) === kunci(v))
    if (!nama) { await prisma.kategoriOrder.upsert({ where: { studioId_nama: { studioId, nama: v } }, update: {}, create: { studioId, nama: v } }); daftar.push(v); nama = v }
    if (!hasil.some(h => kunci(h) === kunci(nama))) hasil.push(nama)
  }
  return hasil.join(PEMISAH)
}
/** Jumlah order & LTK yang memakai tiap kategori (untuk layar atur kategori). */
export async function pemakaianKategori(studioId) {
  const [order, ltk] = await Promise.all([
    prisma.orderProduksi.findMany({ where: { studioId, kategori: { not: null } }, select: { kategori: true } }),
    prisma.kasusLtk.findMany({ where: { studioId, kategori: { not: null } }, select: { kategori: true } }),
  ])
  const hit = new Map()
  for (const r of [...order, ...ltk]) for (const p of new Set(pisahKategori(r.kategori).map(kunci))) hit.set(p, (hit.get(p) ?? 0) + 1)
  return hit
}
export const gantiNamaDiTeks = (teks, lama, baru) => pisahKategori(teks).map(p => (kunci(p) === kunci(lama) ? baru : p)).filter((p, i, a) => a.findIndex(q => kunci(q) === kunci(p)) === i).join(PEMISAH)
