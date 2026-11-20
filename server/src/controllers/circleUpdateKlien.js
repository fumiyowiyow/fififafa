import prisma from '../prisma.js'
import { studioBolehDilihat, peranStudio, pastikanTahap, tahapEfektif, saringAkun, orderDalamAkun, riwayatOrder, jejakUntuk } from './circle.js'
import { jenisNormal, aksiTersedia } from '../utils/alur.js'
import { JENIS_KERJA } from '../utils/penugasan.js'

// UPDATE KLIEN (10 Nov 2026, permintaan tim / Sekai Land): satu tabel semua klien aktif + KAPAN terakhir dikabari, supaya tak ada klien yang
// terlewat tanpa kabar. Kontak = PREVIEW | KATA (kabar singkat tanpa preview) | DELIVER; FEEDBACK_TALENT = masukan klien sudah diteruskan ke talent.
// Akses: koordinator ke atas / admin market melihat semua order unit; marketer hanya order yang ia pegang; pemilik (lihat saja) membaca.
// Tanpa angka uang. Status = tahap alur (otomatis) + posisi (talent / admin / klien / ditahan).
// 12 Nov 2026 malam (masukan tim): + nama panggilan klien (direktori Klien), kolom Preview/Kata/Deliver bisa diklik manual (centang = catat
// kontak tanpa catatan; lepas = hapus catatan MANUAL terakhir jenis itu — yang otomatis dari produksi tetap), dan pindah tahap langsung dari
// tabel: `aksi` (mesin, juga untuk marketer pemegang) + `tahap` (semua langkah alur, hanya pengelola → PATCH /orders/:id/tahap).
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const HARI = 86400000
const KONTAK = ['PREVIEW', 'KATA', 'DELIVER']
// CATATAN (13 Nov 2026, masukan tim): kolom catatan langsung di tabel — feedback/keterangan dari klien. BUKAN kontak (tidak mengubah
// "terakhir dikabari"; kabar ke klien tetap lewat centang Preview/Kata/Deliver), tetapi tampil di kolom Catatan & riwayat.
const CATATAN = 'CATATAN'
export const BATAS_HARI_BAWAAN = 2
// MASA TENGGANG peluncuran (10 Nov 2026): order lama belum punya catatan kabar sama sekali — sampai tanggal ini yang "belum pernah tercatat" TIDAK
// ditandai merah (kalau tidak, hari pertama semua order langsung merah dan tanda ini kehilangan arti). Setelah itu dihitung dari umur order.
const TENGGANG_SAMPAI = new Date(process.env.UPDATE_KLIEN_TENGGANG_SAMPAI || '2026-11-13T00:00:00+07:00').getTime()
const hariBeda = (dari, ke = Date.now()) => Math.floor((ke - new Date(dari).getTime()) / HARI)

async function akses(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (!p.manajer && !p.marketer) { gagal(res, 403, 'Update klien untuk koordinator, admin market, atau marketer'); return null }
  return { p, tulis: !p.lihatSaja }
}
const POSISI = (jenis) => (JENIS_KERJA.includes(jenis) ? 'Di talent' : jenis === 'MASUK' || jenis === 'QC' ? 'Di admin' : jenis === 'HOLD' ? 'Ditahan' : jenis === 'SELESAI' ? 'Selesai' : 'Di klien')
// siapa boleh menyentuh order ini: manajer (bukan sekadar pemilik) atau marketer pemegangnya
const bolehOrder = (a, order, userId) => a.tulis && ((a.p.manajer && orderDalamAkun(a.p, order)) || order.marketerId === userId) // admin per akun: hanya order akunnya

export const getUpdateKlien = wrap(async (req, res) => {
  const { studioId } = req.query
  const a = await akses(req, res, studioId); if (!a) return
  const batas = Math.min(14, Math.max(1, Number(req.query.batas) || BATAS_HARI_BAWAAN))
  const tahap = await pastikanTahap(studioId)
  const orders = await prisma.orderProduksi.findMany({
    where: { studioId, status: { in: ['MASUK', 'PROSES'] }, ...(a.p.manajer ? saringAkun(a.p) : { marketerId: req.user.id }) },
    select: { id: true, judul: true, klien: true, deadline: true, tanggalMasuk: true, tahapId: true, tahapAktif: true, status: true, revisiKe: true, subStatus: true, marketerId: true, akunId: true, klienId: true, klienRef: { select: { panggilan: true } }, akun: { select: { platform: true, namaAkun: true } }, assignments: { where: { berhentiPada: null }, select: { namaEksternal: true, user: { select: { nama: true } } } } },
  })
  const ids = orders.map(o => o.id)
  const [logs, riwayat, jejak] = await Promise.all([
    prisma.updateKlien.findMany({ where: { orderId: { in: ids } }, orderBy: { waktu: 'desc' } }),
    prisma.riwayatTahapOrder.findMany({ where: { orderId: { in: ids }, jenis: { in: ['PREVIEW_KLIEN', 'DELIVERY', 'REVISI_KLIEN'] } }, orderBy: { mulai: 'asc' }, select: { orderId: true, jenis: true, mulai: true, selesai: true } }),
    riwayatOrder(ids),
  ])
  const perLog = new Map(), perRw = new Map()
  for (const l of logs) (perLog.get(l.orderId) ?? perLog.set(l.orderId, []).get(l.orderId)).push(l)
  for (const r of riwayat) (perRw.get(r.orderId) ?? perRw.set(r.orderId, []).get(r.orderId)).push(r)
  const sekarang = Date.now()
  const baris = orders.map(o => {
    const t = tahap.find(x => x.id === tahapEfektif(o, tahap)), jenis = t ? jenisNormal(t.jenis) : null
    const lg = perLog.get(o.id) ?? [], rw = perRw.get(o.id) ?? []
    const kontak = lg.filter(l => KONTAK.includes(l.jenis))
    // pesanan lama (sebelum fitur ini): keluar dari Preview klien / Delivery dianggap kontak ke klien
    const lama = rw.filter(r => ['PREVIEW_KLIEN', 'DELIVERY'].includes(r.jenis) && r.selesai).map(r => new Date(r.selesai).getTime())
    const terakhirMs = Math.max(kontak[0] ? new Date(kontak[0].waktu).getTime() : 0, ...lama, 0)
    const dasar = terakhirMs || new Date(o.tanggalMasuk).getTime()
    const hariLalu = hariBeda(dasar, sekarang)
    const revisiMulai = jenis === 'REVISI_KLIEN' ? [...rw].reverse().find(r => r.jenis === 'REVISI_KLIEN')?.mulai : null
    const boleh = bolehOrder(a, o, req.user.id)
    const aksi = boleh ? aksiTersedia({ templat: tahap, order: o, sekarang: t, riwayat: jejakUntuk(jejak.filter(x => x.orderId === o.id), tahap), peran: { manajer: a.p.manajer && !a.p.lihatSaja && orderDalamAkun(a.p, o), ditugaskan: false, marketer: o.marketerId === req.user.id } }).filter(x => x.ke).map(x => ({ aksi: x.aksi, label: x.label, ke: x.ke })) : []
    const manual = (j) => lg.find(l => l.jenis === j && !l.otomatis)?.id ?? null // catatan manual terakhir (untuk lepas centang)
    const feedback = jenis === 'REVISI_KLIEN' ? lg.some(l => l.jenis === 'FEEDBACK_TALENT' && (!revisiMulai || new Date(l.waktu) >= new Date(revisiMulai))) : null
    return {
      id: o.id, judul: o.judul, klien: o.klien, klienId: o.klienId, panggilan: o.klienRef?.panggilan ?? null, tahapId: t?.id ?? null, aksi, manual: { PREVIEW: manual('PREVIEW'), KATA: manual('KATA'), DELIVER: manual('DELIVER') }, akun: o.akun ? `${o.akun.platform} · ${o.akun.namaAkun}` : null, deadline: o.deadline, tanggalMasuk: o.tanggalMasuk, umurHari: hariBeda(o.tanggalMasuk, sekarang),
      status: t?.nama ?? o.subStatus, jenis, posisi: jenis ? POSISI(jenis) : '—', talent: o.assignments.map(x => x.user?.nama ?? x.namaEksternal).filter(Boolean), adaTalentInternal: o.assignments.some(x => x.user),
      preview: kontak.some(l => l.jenis === 'PREVIEW') || rw.some(r => r.jenis === 'PREVIEW_KLIEN' && r.selesai) || false,
      kata: kontak.some(l => l.jenis === 'KATA'), deliver: kontak.some(l => l.jenis === 'DELIVER') || rw.some(r => r.jenis === 'DELIVERY' && r.selesai) || false,
      terakhir: terakhirMs ? new Date(terakhirMs).toISOString() : null, belumPernah: !terakhirMs, hariLalu, terlewat: hariLalu >= batas && !(!terakhirMs && sekarang < TENGGANG_SAMPAI), masaTenggang: !terakhirMs && sekarang < TENGGANG_SAMPAI,
      catatanTerakhir: lg.find(l => l.catatan && !l.otomatis && l.jenis !== 'FEEDBACK_TALENT')?.catatan ?? null, jumlahCatatan: lg.filter(l => l.catatan && !l.otomatis).length, jumlahUpdate: kontak.length, feedbackKeTalent: feedback, bisaUbah: boleh, bisaPindah: boleh && a.p.manajer && !a.p.lihatSaja && orderDalamAkun(a.p, o),
    }
  // Urutan bawaan (16 Nov 2026, masukan tim): order masuk paling lama di atas — baris tidak melompat setelah Preview/Kata/Pindah diklik.
  // Urutan "paling lama belum dikabari" tersedia sebagai pilihan di tampilan (tanda merah & saring terlewat tetap ada).
  }).sort((x, y) => (new Date(x.tanggalMasuk) - new Date(y.tanggalMasuk)) || x.klien.localeCompare(y.klien, 'id'))
  return res.json({ success: true, data: {
    batasHari: batas, bisaCatat: a.tulis, tahap: a.p.manajer && !a.p.lihatSaja ? tahap.map(t => ({ id: t.id, nama: t.nama, jenis: jenisNormal(t.jenis) })) : [],
    ringkasan: { aktif: baris.length, terlewat: baris.filter(b => b.terlewat).length, diTalent: baris.filter(b => b.posisi === 'Di talent').length, diKlien: baris.filter(b => b.posisi === 'Di klien').length, diAdmin: baris.filter(b => b.posisi === 'Di admin').length, ditahan: baris.filter(b => b.posisi === 'Ditahan').length },
    baris,
  } })
})

async function muatOrder(req, res, orderId) {
  const o = orderId ? await prisma.orderProduksi.findUnique({ where: { id: String(orderId) }, select: { id: true, studioId: true, marketerId: true, status: true, tahapId: true, subStatus: true, akunId: true } }) : null
  if (!o) { gagal(res, 404, 'Order tidak ditemukan'); return null }
  const a = await akses(req, res, o.studioId); if (!a) return null
  return { o, a }
}
export const catatUpdateKlien = wrap(async (req, res) => {
  const d = await muatOrder(req, res, req.body?.orderId); if (!d) return
  if (!bolehOrder(d.a, d.o, req.user.id)) return gagal(res, 403, 'Hanya koordinator/admin market atau marketer pemegang order ini yang bisa mencatat update klien')
  if (!['MASUK', 'PROSES'].includes(d.o.status)) return gagal(res, 409, 'Order ini sudah tidak aktif')
  const jenis = String(req.body?.jenis ?? '').toUpperCase()
  if (!KONTAK.includes(jenis) && jenis !== CATATAN) return gagal(res, 422, `jenis harus salah satu: ${[...KONTAK, CATATAN].join(', ')}`)
  const catatan = req.body?.catatan ? String(req.body.catatan).trim().slice(0, 500) || null : null
  if (jenis === CATATAN && !catatan) return gagal(res, 422, 'Catatan kosong')
  const nama = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null
  const l = await prisma.updateKlien.create({ data: { orderId: d.o.id, studioId: d.o.studioId, jenis, catatan, dicatatOlehId: req.user.id, dicatatOleh: nama } })
  // TERUSKAN KE TALENT (16 Nov 2026, masukan tim): catatan/feedback klien sekaligus ditulis di CATATAN PROYEK order (satu sumber yang
  // dibaca talent: detail order & kartu Antreanku). Saat order di Revisi klien dan ada talent berakun, centang "Feedback ke talent" ikut
  // terisi. Talent freelance (tanpa akun) tetap harus dikabari manual oleh admin → centangnya tetap manual.
  let diteruskan = false
  if (jenis === CATATAN && req.body?.keTalent === true) {
    await prisma.catatanOrder.create({ data: { orderId: d.o.id, userId: req.user.id, nama: nama ?? 'Pengguna', isi: `Feedback klien: ${catatan}` } })
    const tahap = await pastikanTahap(d.o.studioId), t = tahap.find(x => x.id === tahapEfektif(d.o, tahap))
    const adaTalentAkun = await prisma.assignmentProduksi.count({ where: { orderId: d.o.id, userId: { not: null }, berhentiPada: null } })
    if (t && jenisNormal(t.jenis) === 'REVISI_KLIEN' && adaTalentAkun) {
      const mulai = (await prisma.riwayatTahapOrder.findFirst({ where: { orderId: d.o.id, jenis: 'REVISI_KLIEN' }, orderBy: { mulai: 'desc' }, select: { mulai: true } }))?.mulai ?? new Date(0)
      if (!(await prisma.updateKlien.count({ where: { orderId: d.o.id, jenis: 'FEEDBACK_TALENT', waktu: { gte: mulai } } }))) await prisma.updateKlien.create({ data: { orderId: d.o.id, studioId: d.o.studioId, jenis: 'FEEDBACK_TALENT', dicatatOlehId: req.user.id, dicatatOleh: nama } })
    }
    diteruskan = true
  }
  return res.status(201).json({ success: true, data: { id: l.id, diteruskan }, message: diteruskan ? 'Catatan disimpan & diteruskan ke talent (catatan proyek)' : 'Update klien dicatat' })
})
// Centang "feedback sudah disampaikan ke talent": hanya saat order di Revisi klien; berlaku untuk revisi yang sedang berjalan
export const setFeedbackTalent = wrap(async (req, res) => {
  const d = await muatOrder(req, res, req.body?.orderId); if (!d) return
  if (!bolehOrder(d.a, d.o, req.user.id)) return gagal(res, 403, 'Hanya koordinator/admin market atau marketer pemegang order ini')
  const tahap = await pastikanTahap(d.o.studioId), t = tahap.find(x => x.id === tahapEfektif(d.o, tahap))
  if (!t || jenisNormal(t.jenis) !== 'REVISI_KLIEN') return gagal(res, 409, 'Centang feedback hanya berlaku saat order berada di Revisi klien')
  const mulai = (await prisma.riwayatTahapOrder.findFirst({ where: { orderId: d.o.id, jenis: 'REVISI_KLIEN' }, orderBy: { mulai: 'desc' }, select: { mulai: true } }))?.mulai ?? new Date(0)
  if (req.body?.selesai === false) { await prisma.updateKlien.deleteMany({ where: { orderId: d.o.id, jenis: 'FEEDBACK_TALENT', waktu: { gte: mulai } } }); return res.json({ success: true, message: 'Centang feedback dilepas' }) }
  const nama = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null
  await prisma.updateKlien.create({ data: { orderId: d.o.id, studioId: d.o.studioId, jenis: 'FEEDBACK_TALENT', dicatatOlehId: req.user.id, dicatatOleh: nama } })
  return res.json({ success: true, message: 'Feedback ke talent dicatat' })
})
export const getRiwayatUpdateKlien = wrap(async (req, res) => {
  const d = await muatOrder(req, res, req.params.orderId); if (!d) return
  if (!(d.a.p.manajer && orderDalamAkun(d.a.p, d.o)) && d.o.marketerId !== req.user.id) return gagal(res, 403, 'Bukan order yang kamu pegang')
  const l = await prisma.updateKlien.findMany({ where: { orderId: d.o.id }, orderBy: { waktu: 'desc' }, take: 40 })
  return res.json({ success: true, data: l.map(x => ({ id: x.id, jenis: x.jenis, catatan: x.catatan, otomatis: x.otomatis, oleh: x.dicatatOleh, waktu: x.waktu })) })
})
// Ubah / hapus catatan update klien (12 Nov 2026, masukan tim): catatan boleh diubah di entri mana pun; HAPUS hanya entri yang dicatat
// manual (bukan otomatis dari perpindahan tahap) supaya jejak "terakhir dikabari" tidak hilang. Hak = sama dengan mencatat (bolehOrder).
async function muatEntri(req, res) {
  const e = await prisma.updateKlien.findUnique({ where: { id: req.params.id } })
  if (!e) { gagal(res, 404, 'Catatan tidak ditemukan'); return null }
  const d = await muatOrder(req, res, e.orderId); if (!d) return null
  if (!bolehOrder(d.a, d.o, req.user.id)) { gagal(res, 403, 'Hanya koordinator/admin market atau marketer pemegang order ini'); return null }
  return e
}
export const ubahCatatanUpdateKlien = wrap(async (req, res) => {
  const e = await muatEntri(req, res); if (!e) return
  const catatan = req.body?.catatan ? String(req.body.catatan).trim().slice(0, 500) || null : null
  await prisma.updateKlien.update({ where: { id: e.id }, data: { catatan } })
  return res.json({ success: true, message: 'Catatan diperbarui' })
})
export const hapusUpdateKlien = wrap(async (req, res) => {
  const e = await muatEntri(req, res); if (!e) return
  if (e.otomatis) return gagal(res, 409, 'Catatan otomatis (dari perpindahan tahap) tidak bisa dihapus — catatannya saja yang bisa diubah')
  await prisma.updateKlien.delete({ where: { id: e.id } })
  return res.json({ success: true, message: 'Catatan dihapus' })
})
