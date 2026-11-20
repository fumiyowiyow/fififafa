import prisma from '../prisma.js'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { studioBolehDilihat, peranStudio, peranOrder, saringAkun, pastikanTahap } from './circle.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import { bersihTautan } from '../utils/ltk.js'
import { catatAudit } from '../utils/auditOrder.js'
import { hariIniWIB } from '../utils/kehadiran.js'
import { kunciTanggalWIB } from '../utils/jamKerja.js'
import { jenisNormal } from '../utils/alur.js'
import { muatPosisiTagih } from '../utils/posisiTagihDb.js'
import { JENIS_PENGINGAT } from '../utils/pengingat.js'
import { kumpulkan } from '../utils/pengingatDb.js'
import { SUPER_ADMIN, hasAnyRole, kelolaStudio, atasanLingkup } from '../utils/roles.js'
import { peranKerja } from './circle.js'

// Audit OGS nomor 8–12 (21 Okt 2026): halaman Pembayaran order, aksi item order (selesaikan semua tahap, tautan), pipeline, riwayat login,
// pratinjau pengingat Telegram. Pengingat tidak dikirim dari sini (hanya pratinjau); pengiriman = cron md-bot dengan OTOMASI_AKTIF=1.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const r2 = (n) => Math.round(n * 100) / 100
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
async function akses(req, res, studioId, { manajer = false, marketer = false } = {}) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (manajer && !(p.manajer || (marketer && p.marketer))) { gagal(res, 403, manajer && marketer ? 'Hanya Koordinator ke atas atau Marketer unit ini' : 'Hanya Koordinator ke atas'); return null }
  return p
}

// ── 8. Pembayaran (order-level; marketer hanya ordernya sendiri) ──────────────────────────────────────────────────────
// BELUM DIBAYAR KLIEN satu unit — SATU rumus untuk menu Belum dibayar klien (web circle) & halaman Web Circle di Management Dashboard (14 Nov 2026).
// Semua order belum lunas dengan sisa > 0, ditandai `sudahDelivery` (tahap Delivery/Done) & `sudahDitagih` (posisiTagih); pemanggil yang menyaring.
export async function barisBelumDibayar(studioId, saring = {}) {
  const hari = hariIniWIB()
  const orders = await prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, statusBayar: { not: 'LUNAS' }, nilaiBersih: { gt: 0 }, ...saring }, include: { terminBayar: { orderBy: { urutan: 'asc' } }, marketer: { select: { nama: true } }, tahap: { select: { jenis: true, nama: true } } }, orderBy: { deadline: 'asc' }, take: 300 })
  const posisi = await muatPosisiTagih(orders.map(o => o.id)) // rumus bersama dengan panel invoice & "Perlu dibuatkan invoice"
  const baris = orders.map(o => {
    const dibayar = o.terminBayar.length ? o.terminBayar.filter(t => t.dibayarPada).reduce((a, t) => a + t.jumlah, 0) : (o.statusBayar === 'DP' ? (o.dpAmount ?? 0) : 0)
    const umur = Math.round((new Date(hari + 'T00:00:00Z') - new Date(kunciTanggalWIB(o.tanggalMasuk) + 'T00:00:00Z')) / 86400000)
    const sudahDelivery = o.status === 'SELESAI' || ['DELIVERY', 'SELESAI'].includes(jenisNormal(o.tahap?.jenis))
    return { id: o.id, judul: o.judul, klien: o.klien, marketer: o.marketer?.nama ?? null, status: o.status, statusBayar: o.statusBayar, tahap: o.tahap?.nama ?? null, sudahDelivery, sudahDitagih: (posisi.get(o.id)?.terbit ?? 0) > 0, ditagih: posisi.get(o.id)?.terbit ?? 0, deadline: ISO(o.deadline), nilaiBersih: o.nilaiBersih, dibayar: r2(dibayar), sisa: r2(Math.max(0, o.nilaiBersih - dibayar)), umurHari: umur, kelompok: umur <= 30 ? '0–30' : umur <= 60 ? '31–60' : umur <= 90 ? '61–90' : '>90', termin: o.terminBayar.map(t => ({ label: t.label, jumlah: t.jumlah, jatuhTempo: ISO(t.jatuhTempo), dibayarPada: ISO(t.dibayarPada) })) }
  }).filter(b => b.sisa > 0)
  return baris
}

export const getPembayaran = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await akses(req, res, studioId, { manajer: true, marketer: true }); if (!p) return
  // Masukan tim (13 Nov 2026): yang ditagih = project yang SUDAH DELIVERY (tahap Delivery atau Done); status = sudah/belum dibuat tagihan.
  const semua = req.query.semua === '1'
  const baris = await barisBelumDibayar(studioId, p.manajer ? saringAkun(p) : { marketerId: req.user.id })
  const masihDikerjakan = baris.filter(b => !b.sudahDelivery).length
  if (!semua) baris.splice(0, baris.length, ...baris.filter(b => b.sudahDelivery))
  const per = {}; for (const b of baris) { per[b.kelompok] ??= { jumlah: 0, total: 0 }; per[b.kelompok].jumlah++; per[b.kelompok].total = r2(per[b.kelompok].total + b.sisa) }
  return res.json({ success: true, data: { bisaLihatSemua: p.manajer, semua, masihDikerjakan, totalSisa: r2(baris.reduce((a, b) => a + b.sisa, 0)), kelompok: per, baris, catatan: semua ? 'Semua order yang belum lunas, termasuk yang masih dikerjakan. Sisa = nilai bersih order − cicilan yang sudah diterima (atau DP).' : 'Project yang sudah Delivery atau Done tetapi belum lunas. Sisa = nilai bersih order − cicilan yang sudah diterima (atau DP).' } })
})

// ── 9. Aksi item order ────────────────────────────────────────────────────────────────────────────────────────────────
export const ubahTautan = wrap(async (req, res) => {
  const o = await prisma.orderProduksi.findUnique({ where: { id: req.params.id }, include: { penugasanTahap: { select: { userId: true } }, assignments: { where: { berhentiPada: null }, select: { userId: true } } } })
  if (!o) return gagal(res, 404, 'Order tidak ditemukan')
  if (!(await akses(req, res, o.studioId))) return
  const p = await peranOrder(req, o) // admin per akun: di luar akunnya bukan pengelola
  const terlibat = o.penugasanTahap.some(x => x.userId === req.user.id) || o.assignments.some(x => x.userId === req.user.id) || o.marketerId === req.user.id
  if (!p.manajer && !p.marketer && !terlibat) return gagal(res, 403, 'Hanya Koordinator, Marketer, atau yang mengerjakan order ini')
  const arr = req.body?.tautan
  if (Array.isArray(arr) && arr.length > 10) return gagal(res, 422, 'Tautan maksimal 10.')
  const t = bersihTautan(arr ?? []); if (t.galat) return gagal(res, 422, t.galat)
  await prisma.orderProduksi.update({ where: { id: o.id }, data: { tautan: t.data } })
  await catatAudit(o.id, req.user.id, 'TAUTAN', [{ field: 'tautan', dari: `${(o.tautan ?? []).length} tautan`, ke: `${t.data.length} tautan` }])
  return res.json({ success: true, message: 'Tautan disimpan' })
})
// Selesaikan SEMUA penugasan tahap aktif order (OGS completeAll). Tidak memindahkan order — pindah tahap tetap lewat alur.
export const selesaikanSemua = wrap(async (req, res) => {
  const o = await prisma.orderProduksi.findUnique({ where: { id: req.params.id } })
  if (!o) return gagal(res, 404, 'Order tidak ditemukan')
  if (!(await akses(req, res, o.studioId, { manajer: true }))) return
  if (!(await peranOrder(req, o)).manajer) return gagal(res, 403, 'Order ini di luar akun jualanmu')
  const r = await prisma.penugasanTahap.updateMany({ where: { orderId: o.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, data: { status: 'SELESAI', progres: 100, selesaiPada: new Date() } })
  if (!r.count) return gagal(res, 409, 'Tidak ada penugasan aktif pada order ini')
  return res.json({ success: true, message: `${r.count} penugasan ditandai selesai`, data: { jumlah: r.count } })
})

// ── 11. Pipeline (order aktif per tahap; uang hanya untuk Koordinator ke atas) ────────────────────────────────────────
export const getPipeline = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await akses(req, res, studioId, { manajer: true }); if (!p) return
  const [tahap, orders] = await Promise.all([pastikanTahap(studioId), prisma.orderProduksi.findMany({ where: { studioId, status: { in: ['MASUK', 'PROSES'] }, ...saringAkun(p) }, select: { tahapId: true, subStatus: true, nilaiKotor: true, nilaiBersih: true } })])
  const baris = tahap.map(t => { const l = orders.filter(o => o.tahapId === t.id); return { tahapId: t.id, nama: t.nama, jenis: jenisNormal(t.jenis), jumlah: l.length, nilaiKotor: r2(l.reduce((a, b) => a + b.nilaiKotor, 0)), nilaiBersih: r2(l.reduce((a, b) => a + b.nilaiBersih, 0)) } })
  const lain = orders.filter(o => !tahap.some(t => t.id === o.tahapId))
  if (lain.length) baris.push({ tahapId: null, nama: 'Tanpa tahap', jenis: 'LAIN', jumlah: lain.length, nilaiKotor: r2(lain.reduce((a, b) => a + b.nilaiKotor, 0)), nilaiBersih: r2(lain.reduce((a, b) => a + b.nilaiBersih, 0)) })
  return res.json({ success: true, data: { total: { jumlah: orders.length, nilaiKotor: r2(orders.reduce((a, b) => a + b.nilaiKotor, 0)), nilaiBersih: r2(orders.reduce((a, b) => a + b.nilaiBersih, 0)) }, tahap: baris.filter(b => b.jumlah > 0 || b.jenis !== 'LAIN') } })
})

// ── 12. Riwayat login ─────────────────────────────────────────────────────────────────────────────────────────────────
export const getRiwayatLogin = wrap(async (req, res) => {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') return gagal(res, 403, 'Hanya untuk web circle')
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) return gagal(res, 403, 'Token bukan untuk alamat ini')
  const roles = peranKerja(req)
  if (!atasanLingkup(roles, web.lingkup)) return gagal(res, 403, 'Hanya Kepala Circle ke atas') // Kepala Circle alamat INI (bukan circle lain)
  const kunci = whereLingkup(web.lingkup)
  const peran = await prisma.userRole.findMany({ where: { studio: kunci, roleType: { not: 'DIGNITY' } }, select: { userId: true } })
  const ids = [...new Set(peran.map(x => x.userId))]
  const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.bulan ?? '') ? req.query.bulan : hariIniWIB().slice(0, 7)
  const a = new Date(bulan + '-01T00:00:00+07:00'), z = new Date(a); z.setUTCMonth(z.getUTCMonth() + 1)
  const where = { userId: req.query.userId ? (ids.includes(req.query.userId) ? req.query.userId : '-') : { in: ids }, waktu: { gte: a, lt: z } }
  const [baris, ringkas, users] = await Promise.all([
    prisma.logLogin.findMany({ where, orderBy: { waktu: 'desc' }, take: 200 }),
    prisma.logLogin.groupBy({ by: ['userId'], where, _count: true, _max: { waktu: true } }),
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } }),
  ])
  const nama = new Map(users.map(u => [u.id, u.nama]))
  return res.json({ success: true, data: { bulan, orang: users.map(u => ({ userId: u.id, nama: u.nama, jumlah: ringkas.find(r => r.userId === u.id)?._count ?? 0, terakhir: ringkas.find(r => r.userId === u.id)?._max.waktu ?? null })).sort((x, y) => y.jumlah - x.jumlah || x.nama.localeCompare(y.nama, 'id')), baris: baris.map(b => ({ id: b.id, userId: b.userId, nama: nama.get(b.userId) ?? '—', web: b.web, ip: b.ip, perangkat: b.perangkat, waktu: b.waktu })) } })
})

// ── 10. Pratinjau pengingat (tidak mengirim) ──────────────────────────────────────────────────────────────────────────
export const getPratinjauPengingat = wrap(async (req, res) => {
  const { studioId, jenis } = req.query
  if (!(await akses(req, res, studioId, { manajer: true }))) return
  if (!jenis) return res.json({ success: true, data: { jenis: JENIS_PENGINGAT, aktif: process.env.OTOMASI_AKTIF === '1' } })
  if (!JENIS_PENGINGAT[jenis]) return gagal(res, 422, 'jenis pengingat tidak dikenal')
  // Pengingat berskala unit: hanya penerima yang berada di unit ini
  const anggota = await anggotaStudio(studioId)
  const semua = await kumpulkan(jenis, { studioId })
  const penerima = semua.filter(x => anggota.has(x.userId) || jenis === 'delivery' || jenis === 'biaya' || jenis === 'laporanMarketer')
  return res.json({ success: true, data: { jenis, label: JENIS_PENGINGAT[jenis], aktif: process.env.OTOMASI_AKTIF === '1', penerima: penerima.map(x => ({ userId: x.userId, nama: x.nama, punyaTelegram: x.punyaTelegram, teks: x.teks })) } })
})

// ── Admin Market (dipindahkan dari halaman Produksi Ekosistem yang dihapus, 21 Okt 2026) ─────────────────────────────────────
// Akses kelola order untuk orang yang BUKAN Koordinator (mis. admin marketing). Hanya Koordinator ke atas unit itu yang boleh mengatur —
// pemegang akses ini tidak bisa memberi akses ke diri sendiri / orang lain.
async function pengatur(req, res, studioId) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return false }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return false }
  const roles = peranKerja(req)
  if (!studioId || !(await studioBolehDilihat(req, studioId)) || !(await kelolaStudio(roles, studioId))) { gagal(res, 403, 'Hanya Koordinator ke atas unit ini'); return false }
  return true
}
export const getAdminMarket = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await pengatur(req, res, studioId))) return
  const [daftar, anggota, akun] = await Promise.all([prisma.produksiAdminMarket.findMany({ where: { studioId }, include: { user: { select: { id: true, nama: true } } }, orderBy: { createdAt: 'asc' } }), anggotaStudio(studioId), prisma.akunProduksi.findMany({ where: { studioId }, select: { id: true, namaAkun: true, platform: true }, orderBy: [{ platform: 'asc' }, { namaAkun: 'asc' }] })])
  return res.json({ success: true, data: { admin: daftar.map(a => ({ id: a.id, userId: a.userId, nama: a.user.nama, akunIds: a.akunIds })), anggota: [...anggota].map(([id, nama]) => ({ id, nama })), akun: akun.map(a => ({ id: a.id, nama: a.namaAkun, platform: a.platform })) } })
})
export const tambahAdminMarket = wrap(async (req, res) => {
  const { studioId, userId } = req.body ?? {}
  if (!(await pengatur(req, res, studioId))) return
  if (!userId || !(await anggotaStudio(studioId)).has(userId)) return gagal(res, 422, 'Pilih anggota unit ini')
  try { const a = await prisma.produksiAdminMarket.create({ data: { userId, studioId } }); return res.status(201).json({ success: true, data: { id: a.id } }) }
  catch (e) { if (e?.code === 'P2002') return gagal(res, 409, 'Orang ini sudah menjadi admin market unit ini'); throw e }
})
// Akun jualan yang dipegang admin (12 Nov 2026, masukan tim): kosong = semua order unit. Hanya pengelola unit (Koordinator ke atas).
export const ubahAkunAdminMarket = wrap(async (req, res) => {
  const a = await prisma.produksiAdminMarket.findUnique({ where: { id: req.params.id } })
  if (!a) return gagal(res, 404, 'Admin market tidak ditemukan')
  if (!(await pengatur(req, res, a.studioId))) return
  const ids = req.body?.akunIds
  if (!Array.isArray(ids) || ids.length > 50) return gagal(res, 422, 'akunIds harus berupa daftar')
  const unik = [...new Set(ids.map(String))]
  if (unik.length && (await prisma.akunProduksi.count({ where: { id: { in: unik }, studioId: a.studioId } })) !== unik.length) return gagal(res, 422, 'Ada akun yang bukan milik unit ini')
  await prisma.produksiAdminMarket.update({ where: { id: a.id }, data: { akunIds: unik } })
  return res.json({ success: true, message: unik.length ? `Admin ini sekarang memegang ${unik.length} akun` : 'Admin ini melihat semua order unit' })
})
export const hapusAdminMarket = wrap(async (req, res) => {
  const a = await prisma.produksiAdminMarket.findUnique({ where: { id: req.params.id } })
  if (!a) return gagal(res, 404, 'Admin market tidak ditemukan')
  if (!(await pengatur(req, res, a.studioId))) return
  await prisma.produksiAdminMarket.delete({ where: { id: a.id } })
  return res.json({ success: true, message: 'Akses admin market dicabut' })
})

// ── Slip gaji saya (audit OGS: halaman Payslip pribadi) ───────────────────────────────────────────────────────────────
// Hanya milik SENDIRI, hanya yang sudah final (bukan DRAFT), hanya unit di circle/rumah usaha alamat ini. Angka sama persis dengan Payroll Ekosistem.
export const getSlipSaya = wrap(async (req, res) => {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') return gagal(res, 403, 'Hanya untuk web circle')
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) return gagal(res, 403, 'Token bukan untuk alamat ini')
  const kunci = whereLingkup(web.lingkup)
  const tahun = Number(req.query.tahun) || Number(hariIniWIB().slice(0, 4))
  const daftar = await prisma.penggajian.findMany({
    where: { userId: req.user.id, tahun, status: { not: 'DRAFT' }, studio: kunci },
    include: { lemburPresensi: true, studio: { select: { nama: true } }, tunjangan: { orderBy: { createdAt: 'asc' } }, catatanLembur: { include: { rateCard: { select: { level: true } }, order: { select: { judul: true } } }, orderBy: { tanggal: 'asc' } } },
    orderBy: [{ bulan: 'desc' }, { createdAt: 'desc' }],
  })
  const slip = daftar.map(p => {
    const kredit = p.tunjangan.map(t => ({ nama: t.nama, jumlah: t.jumlah }))
    const debet = [['Gaji pokok', p.gajiPokok], ['Bonus', p.bonus], ['Komisi', p.komisi], ['Lembur', p.lembur], ['SHU', p.shu]].filter(([, n]) => n)
    const lp = p.lemburPresensi.reduce((a, l) => a + l.menit, 0)
    return { id: p.id, bulan: p.bulan, tahun: p.tahun, unit: p.studio.nama, lemburPresensi: lp ? { jam: Math.round((lp / 60) * 100) / 100, hari: new Set(p.lemburPresensi.map(l => l.tanggalKerja.toISOString().slice(0, 10))).size } : null, status: p.status, penghasilan: debet.map(([nama, jumlah]) => ({ nama, jumlah })), tunjangan: kredit, potongan: p.potongan, thp: p.thp, catatan: p.catatan,
      lembur: p.catatanLembur.map(l => ({ tanggal: ISO(l.tanggal), order: l.order?.judul ?? l.briefName ?? l.klien ?? null, level: l.rateCard?.level ?? null, progres: `${Math.round(l.progresAwal * 100)}–${Math.round(l.progresAkhir * 100)}%`, fee: l.feeAkhir })) }
  })
  return res.json({ success: true, data: { tahun, slip, catatan: 'Slip hanya tampil setelah dinyatakan final oleh koordinator. Rincian lengkap dan perubahan ada di Payroll Ekosistem.' } })
})

// ── Impersonasi: Super Admin "masuk sebagai" pengguna (bantuan/uji), audit OGS users/*/impersonate ───────────────────────────
// Aturan keras: hanya Super Admin; tidak bisa meniru Super Admin lain atau diri sendiri; target harus berperan di circle ini; token pendek (30 menit)
// bertanda `imp` (id admin) dan TIDAK bisa dipakai meniru lagi; setiap sesi tercatat di LogImpersonasi. Catatan: aksi saat menyamar tercatat atas nama target.
import jwt from 'jsonwebtoken'
import { izinLingkup } from '../utils/web.js'
async function adminSah(req, res) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  if (req.user?.imp) { gagal(res, 403, 'Sedang dalam mode menyamar — berhenti dulu'); return null }
  if (!hasAnyRole(peranKerja(req), SUPER_ADMIN)) { gagal(res, 403, 'Hanya Super Admin'); return null }
  return web
}
export const getKandidatImpersonasi = wrap(async (req, res) => {
  const web = await adminSah(req, res); if (!web) return
  const kunci = whereLingkup(web.lingkup)
  const peran = await prisma.userRole.findMany({ where: { studio: kunci, roleType: { not: 'DIGNITY' }, user: { statusAktif: true } }, select: { roleType: true, studio: { select: { nama: true } }, user: { select: { id: true, nama: true } } } })
  const m = new Map()
  for (const p of peran) { const e = m.get(p.user.id) ?? { userId: p.user.id, nama: p.user.nama, peran: [] }; e.peran.push(`${p.roleType} · ${p.studio.nama.trim()}`); m.set(p.user.id, e) }
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const daftar = [...m.values()].filter(u => u.userId !== req.user.id && (!q || u.nama.toLowerCase().includes(q))).sort((a, b) => a.nama.localeCompare(b.nama, 'id')).slice(0, 100)
  return res.json({ success: true, data: daftar })
})
export const mulaiImpersonasi = wrap(async (req, res) => {
  const web = await adminSah(req, res); if (!web) return
  const { userId } = req.body ?? {}
  const alasan = String(req.body?.alasan ?? '').trim().slice(0, 200)
  if (!userId || userId === req.user.id) return gagal(res, 422, 'Pilih pengguna lain')
  if (!alasan) return gagal(res, 422, 'Alasan wajib diisi (tercatat di log)')
  const target = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { circle: true, rumahUsaha: true, studio: { include: { circle: true, rumahUsaha: true } } } } } })
  if (!target || !target.statusAktif) return gagal(res, 404, 'Pengguna tidak ditemukan atau tidak aktif')
  if (hasAnyRole(target.roles, SUPER_ADMIN)) return gagal(res, 403, 'Super Admin tidak bisa ditiru')
  if (!izinLingkup(target.roles, web.lingkup)) return gagal(res, 403, 'Pengguna ini tidak berperan di alamat ini')
  await prisma.logImpersonasi.create({ data: { adminId: req.user.id, targetId: target.id, web: web.lingkup.slug, alasan } })
  const accessToken = jwt.sign({ id: target.id, email: target.email, aud: 'circle', cs: web.lingkup.slug, imp: req.user.id }, process.env.JWT_SECRET, { expiresIn: '30m' })
  return res.json({ success: true, data: { accessToken, user: { id: target.id, nama: target.nama }, berlakuMenit: 30 } })
})
export const getLogImpersonasi = wrap(async (req, res) => {
  const web = await adminSah(req, res); if (!web) return
  const baris = await prisma.logImpersonasi.findMany({ where: { web: web.lingkup.slug }, orderBy: { waktu: 'desc' }, take: 50 })
  const ids = [...new Set(baris.flatMap(b => [b.adminId, b.targetId]))]
  const nama = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } })).map(u => [u.id, u.nama]))
  return res.json({ success: true, data: baris.map(b => ({ id: b.id, admin: nama.get(b.adminId) ?? '—', target: nama.get(b.targetId) ?? '—', alasan: b.alasan, waktu: b.waktu })) })
})

// ── Profil SDM & Manpower (audit OGS: SdmProfile current/next position, Data/Manpower) ─────────────────────────────────
import { bolehMeninjau } from './circleKehadiran.js'
const rapiProfil = (p) => ({ posisiSekarang: p?.posisiSekarang ?? null, posisiBerikut: p?.posisiBerikut ?? null, catatan: p?.catatan ?? null, diperbarui: p?.updatedAt ?? null })
export const getProfilSdm = wrap(async (req, res) => {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') return gagal(res, 403, 'Hanya untuk web circle')
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) return gagal(res, 403, 'Token bukan untuk alamat ini')
  const userId = req.query.userId || req.user.id
  if (userId !== req.user.id && !(await bolehMeninjau(req, userId))) return gagal(res, 403, 'Kamu tidak berwenang melihat profil ini')
  const [p, u, koord] = await Promise.all([prisma.profilSdm.findUnique({ where: { userId } }), prisma.user.findUnique({ where: { id: userId }, select: { nama: true } }), prisma.userRole.count({ where: { userId, roleType: 'KOORDINATOR' } })])
  const prof = rapiProfil(p); if (koord) prof.posisiSekarang = 'Koordinator' // otomatis dari peran Ekosistem (12 Nov 2026)
  return res.json({ success: true, data: { userId, nama: u?.nama ?? '—', ...prof, posisiOtomatis: !!koord, bisaUbahPosisiSekarang: userId !== req.user.id && (await bolehMeninjau(req, userId)), bolehUbahAspirasi: userId === req.user.id } })
})
export const simpanProfilSdm = wrap(async (req, res) => {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') return gagal(res, 403, 'Hanya untuk web circle')
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) return gagal(res, 403, 'Token bukan untuk alamat ini')
  const b = req.body ?? {}, userId = b.userId || req.user.id, diri = userId === req.user.id
  const pengelola = !diri && (await bolehMeninjau(req, userId))
  if (!diri && !pengelola) return gagal(res, 403, 'Kamu tidak berwenang mengubah profil ini')
  const data = {}
  const teks = (v, maks) => { const t = String(v ?? '').trim().slice(0, maks); return t || null }
  if (b.posisiBerikut !== undefined) { if (!diri) return gagal(res, 403, 'Posisi berikutnya diisi orangnya sendiri'); data.posisiBerikut = teks(b.posisiBerikut, 120) }
  if (b.catatan !== undefined) { if (!diri) return gagal(res, 403, 'Catatan diisi orangnya sendiri'); data.catatan = teks(b.catatan, 1000) }
  if (b.posisiSekarang !== undefined) { if (!pengelola) return gagal(res, 403, 'Posisi sekarang ditetapkan Koordinator ke atas'); data.posisiSekarang = teks(b.posisiSekarang, 120) }
  if (!Object.keys(data).length) return gagal(res, 422, 'Tidak ada yang diubah')
  await prisma.profilSdm.upsert({ where: { userId }, update: { ...data, diubahOlehId: req.user.id }, create: { userId, ...data, diubahOlehId: req.user.id } })
  return res.json({ success: true, message: 'Profil disimpan' })
})
export const getManpower = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await akses(req, res, studioId, { manajer: true }))) return
  const [peran, fungsi] = await Promise.all([
    prisma.userRole.findMany({ where: { studioId, roleType: { not: 'DIGNITY' }, user: { statusAktif: true } }, select: { roleType: true, user: { select: { id: true, nama: true } } } }),
    prisma.fungsiAnggota.findMany({ where: { studioId }, select: { userId: true, fungsi: true, bidang: true, terkonfirmasi: true } }),
  ])
  const ids = [...new Set(peran.map(p => p.user.id))]
  const profil = new Map((await prisma.profilSdm.findMany({ where: { userId: { in: ids } } })).map(p => [p.userId, p]))
  const orang = ids.map(id => { const p = peran.filter(x => x.user.id === id); return { userId: id, nama: p[0].user.nama, peran: [...new Set(p.map(x => x.roleType))], fungsi: fungsi.filter(f => f.userId === id).map(f => ({ fungsi: f.fungsi, bidang: f.bidang, terkonfirmasi: f.terkonfirmasi })), ...rapiProfil(profil.get(id)) } }).sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  // Pendamping/Penasihat/Admin fungsional/Kepala (12 Nov 2026, masukan tim): bukan pelaksana kerja harian → tidak perlu fungsi kerja;
  // ditandai `pendamping` (tampil "Pendamping · tidak perlu fungsi") supaya tidak tampak belum dikonfirmasi. Konfirmasi Tim sendiri hanya peran kerja.
  const KERJA = ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG']
  for (const o of orang) o.pendamping = !o.peran.some(r => KERJA.includes(r))
  // Koordinator unit (peran Management Dashboard) = posisi "Koordinator" OTOMATIS (12 Nov 2026, keputusan user) — tidak perlu ditetapkan manual,
  // tidak bisa diubah dari sini (mengikuti peran di Ekosistem). Dulu koordinator tak bisa mengisi posisinya sendiri sehingga kosong.
  for (const o of orang) if (o.peran.includes('KOORDINATOR')) { o.posisiSekarang = 'Koordinator'; o.posisiOtomatis = true }
  const per = {}; for (const f of fungsi) if (orang.some(o => o.userId === f.userId && !o.pendamping)) per[f.fungsi] = (per[f.fungsi] ?? 0) + 1
  const nPend = orang.filter(o => o.pendamping).length; if (nPend) per.PENDAMPING = nPend
  return res.json({ success: true, data: { jumlah: orang.length, perFungsi: per, orang } })
})
