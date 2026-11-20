import prisma from '../prisma.js'
import { SUPER_ADMIN, STAFF_PLUS, hasAnyRole, kelolaStudio, atasanLingkup } from '../utils/roles.js'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { matriksLabaRugi, proyeksi, rencanaKas } from '../utils/labaRugi.js'
import { peranKerja, studioBolehDilihat, pengelolaAtauPemilikBaca, permintaanBaca, pemilikDiManaPun } from './circle.js'
import { daftarRekening, rekeningSah, bacaRekeningId } from '../utils/rekeningKas.js'
import { snapshotKasMingguIni } from '../utils/kas.js'

// BUKU BESAR & TUTUP BULAN web circle (20 Okt 2026) — adaptasi OGS Finance V2/V4 (ClosingLedgerSyncService, TutupBulanService, RingkasanService,
// Rincian). MODE BAYANGAN: tidak menulis ke WeeklyReport / StudioMonthlyNote. Sumber ledger: transfer pendapatan (terkirim/dikonfirmasi),
// biaya DISETUJUI yang kategorinya dipetakan, entri manual, dan item tetap bulanan. Bulan terbuka dihitung langsung (tanpa menulis);
// saat TUTUP, baris sumber dicatat sebagai snapshot terkunci + kas akhir disimpan. Buka lagi = Super Admin.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch (e) { if (e?.code === 'P2002') return gagal(res, 409, 'Data duplikat'); return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
// Wewenang PER UNIT (21 Okt 2026): pelapor = Koordinator/Pendamping unit itu ke atas. Keputusan user: Koordinator = CEO unit, jadi item tetap,
// kas awal & TUTUP BULAN unitnya juga oleh Koordinator ke atas (`atasan` = kelolaStudio). Membuka kembali bulan tetap Super Admin.
const pelapor = (req) => hasAnyRole(peranKerja(req), STAFF_PLUS)
const pelaporAtauPemilikBaca = async (req) => pelapor(req) || (permintaanBaca(req) && (await pemilikDiManaPun(req))) // pemilik unit: lihat saja
const atasan = (req, studioId) => kelolaStudio(peranKerja(req), studioId)
const superAdmin = (req) => hasAnyRole(peranKerja(req), SUPER_ADMIN)
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const tgl = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(new Date(s)) ? new Date(s + 'T00:00:00.000Z') : null)
const bulanOk = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(b ?? '')
const angka = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN }
const bulanSebelum = (b) => { const d = new Date(b + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7) }
const rentang = (b) => { const awal = new Date(b + '-01T00:00:00Z'); const akhir = new Date(awal); akhir.setUTCMonth(akhir.getUTCMonth() + 1); return [awal, akhir] }
const r2 = (n) => Math.round(n * 100) / 100
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'

async function bolehUnit(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return false }
  if (!(await pengelolaAtauPemilikBaca(req, studioId))) { gagal(res, 403, 'Hanya Koordinator/Pendamping unit ini ke atas'); return false }
  return true
}
async function studioLingkup(req) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') return []
  const where = whereLingkup(web.lingkup)
  return prisma.studio.findMany({ where: { ...where, statusAktif: true }, select: { id: true, nama: true }, orderBy: { nama: 'asc' } })
}

// ── Kategori buku besar (bawaan OGS, dibuat saat pertama dipakai) ────────────────────────────────────────────────────────
const BAWAAN = [
  ['Pendapatan Usaha', 'INCOME', null], ['Pendapatan Lain-lain', 'INCOME', null], ['Pemasukan Lain-lain', 'INCOME', null],
  ['Biaya Gaji & Uang Makan', 'EXPENSE', 'TETAP'], ['SHU', 'EXPENSE', 'TETAP'], ['Dignity', 'EXPENSE', 'TETAP'], ['Biaya Rumah Tangga', 'EXPENSE', 'TETAP'], ['Biaya Adm Bank & Pajak Bunga', 'EXPENSE', 'TETAP'], ['Biaya Pulsa & Telepon', 'EXPENSE', 'TETAP'],
  ['Biaya Usaha', 'EXPENSE', 'VARIABEL'], ['Biaya Operasional', 'EXPENSE', 'VARIABEL'], ['Fee Freelance', 'EXPENSE', 'VARIABEL'], ['Biaya Perlengkapan & Peralatan', 'EXPENSE', 'VARIABEL'], ['Biaya Entertainment', 'EXPENSE', 'VARIABEL'], ['Pengeluaran Lain-lain', 'EXPENSE', 'VARIABEL'],
]
async function pastikanKategori() {
  // Kategori bawaan yang belum ada dibuat (bukan hanya saat tabel kosong) — mis. "Biaya Operasional" (12 Nov 2026, masukan tim)
  const ada = new Set((await prisma.kategoriLedger.findMany({ select: { nama: true } })).map(k => k.nama))
  const kurang = BAWAAN.map(([nama, arus, sifat], i) => ({ nama, arus, sifat, urutan: i + 1 })).filter(k => !ada.has(k.nama))
  if (kurang.length) await prisma.kategoriLedger.createMany({ data: kurang })
  return prisma.kategoriLedger.findMany({ where: { aktif: true }, orderBy: { urutan: 'asc' } })
}

export const getKategori = wrap(async (req, res) => {
  if (!(await pelaporAtauPemilikBaca(req))) return gagal(res, 403, 'Hanya Koordinator/Pendamping ke atas')
  const k = await pastikanKategori()
  return res.json({ success: true, data: { kategori: k.map(x => ({ id: x.id, nama: x.nama, arus: x.arus, sifat: x.sifat, urutan: x.urutan })), bisaUbah: superAdmin(req) } })
})
export const simpanKategori = wrap(async (req, res) => {
  if (!superAdmin(req)) return gagal(res, 403, 'Hanya Super Admin / Kepala Ekosistem')
  const { nama, arus, sifat, urutan } = req.body ?? {}
  if (!String(nama ?? '').trim() || String(nama).length > 80) return gagal(res, 422, 'Nama wajib diisi (maks 80 huruf)')
  if (!['INCOME', 'EXPENSE'].includes(arus)) return gagal(res, 422, 'arus harus INCOME atau EXPENSE')
  if (arus === 'EXPENSE' && !['TETAP', 'VARIABEL'].includes(sifat)) return gagal(res, 422, 'Pengeluaran wajib bersifat TETAP atau VARIABEL')
  await pastikanKategori()
  const k = await prisma.kategoriLedger.create({ data: { nama: String(nama).trim(), arus, sifat: arus === 'EXPENSE' ? sifat : null, urutan: Number.isInteger(urutan) ? urutan : 99 } })
  return res.status(201).json({ success: true, data: { id: k.id } })
})

// ── Biaya rutin dari Bio studio (12 Nov 2026) ────────────────────────────────────────────────────────────────────────────
// Langganan/iuran/kontribusi/coworking diisi SEKALI di Bio studio (StudioPengeluaranRutin — sumber CPM, Laporan Mingguan & Progress Report).
// Buku besar circle MEMBACANYA (baca-saja) supaya tidak diketik dua kali; gaji, SHU, Dignity & uang saku tetap item tetap circle.
const KATEGORI_BIO = { SUBSCRIPTION: 'Langganan & Tools', SUPPORT: 'Iuran & Kontribusi', LAINNYA: 'Biaya Rutin Lainnya' }
async function kategoriBio() {
  const peta = new Map()
  for (const [jenis, nama] of Object.entries(KATEGORI_BIO)) {
    let k = await prisma.kategoriLedger.findFirst({ where: { nama, arus: 'EXPENSE', sifat: 'TETAP' } })
    if (!k) k = await prisma.kategoriLedger.create({ data: { nama, arus: 'EXPENSE', sifat: 'TETAP', urutan: 20 } })
    peta.set(jenis, k)
  }
  return peta
}
export const normNama = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** Item tetap circle yang SAMA dengan item Bio (nama sama setelah dirapikan & jumlah sama) → baris Bio dilewati agar tidak dihitung dobel. */
export function dobelDenganBio(bioItem, itemTetap) { return itemTetap.some(i => normNama(i.nama) === normNama(bioItem.nama) && Math.round(i.bulanan?.[0]?.jumlah ?? i.jumlahBawaan) === Math.round(bioItem.jumlah)) }
// Gaji & SHU dari Bio (12 Nov 2026, keputusan user: "Bio sebagai sumber, tidak mengisi ulang"): aturan sama dengan CPM (utils/cpm.js) —
// THP orang aktif (DIGNITY tetap dihitung), satu angka per orang (THP terisi terbesar); bila slip Penggajian bulan itu sudah dibuat,
// angka slip (THP Bio + bonus/lembur − potongan) yang dipakai. SHU = Studio.totalShu bila statusShu. Item tetap circle kategori
// Gaji/SHU lalu tidak dihitung lagi (gajiCircleDiabaikan) — kecuali unit belum mengisi THP/SHU di Bio (cadangan).
export const KATEGORI_GAJI = 'Biaya Gaji & Uang Makan', KATEGORI_SHU = 'SHU', KATEGORI_DIGNITY = 'Dignity'
export async function gajiShuBio(studioId, bulan) {
  const [y, m] = bulan.split('-').map(Number)
  const [peran, slip, st] = await Promise.all([
    prisma.userRole.findMany({ where: { studioId, takeHomePay: { gt: 0 }, OR: [{ roleType: 'DIGNITY' }, { user: { statusAktif: true } }] }, select: { userId: true, takeHomePay: true, roleType: true, user: { select: { nama: true } } } }),
    prisma.penggajian.findMany({ where: { studioId, bulan: m, tahun: y }, select: { id: true, userId: true, thp: true, status: true, tanggalBayar: true, user: { select: { nama: true } } } }),
    prisma.studio.findUnique({ where: { id: studioId }, select: { statusShu: true, totalShu: true } }),
  ])
  const orang = new Map()
  for (const r of peran) { const o = orang.get(r.userId); if (!o || r.takeHomePay > o.jumlah) orang.set(r.userId, { userId: r.userId, nama: r.user.nama, jumlah: r.takeHomePay, dari: 'Bio' }) }
  // Dignity (12 Nov 2026, masukan Sinta): orang yang di unit ini HANYA berperan DIGNITY → kelompok & kategori buku besar "Dignity", bukan gaji
  const kerja = new Set(peran.filter(r => r.roleType !== 'DIGNITY').map(r => r.userId))
  const dignity = new Set(peran.filter(r => r.roleType === 'DIGNITY' && !kerja.has(r.userId)).map(r => r.userId))
  for (const sl of slip) orang.set(sl.userId, { userId: sl.userId, nama: sl.user.nama, jumlah: sl.thp, dari: 'slip', status: sl.status, dibayarPada: sl.status === 'DIBAYAR' && sl.tanggalBayar ? ISO(sl.tanggalBayar) : null })
  for (const o of orang.values()) o.dignity = dignity.has(o.userId)
  const gaji = [...orang.values()].filter(o => o.jumlah > 0).sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  const shu = st?.statusShu && st.totalShu > 0 ? st.totalShu : 0
  return { gaji, shu }
}

// ── Perhitungan bulan (langsung bila terbuka; snapshot bila ditutup) ─────────────────────────────────────────────────────
// Buku besar satu unit satu bulan (masuk, keluar, laba rugi, kas) — juga dibaca halaman Web Circle di Management Dashboard (14 Nov 2026)
export async function hitung(studioId, bulan) {
  const kategori = await pastikanKategori()
  const kat = new Map(kategori.map(k => [k.id, k]))
  const status = await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId, bulan } } })
  const ditutup = status?.status === 'DITUTUP'
  const [awal, akhir] = rentang(bulan)
  const baris = [], bioDobel = [], gajiCircleDiabaikan = []
  let menunggu = { jumlah: 0, jumlahItem: 0 }, takTerpetakan = { jumlah: 0, jumlahItem: 0 }

  if (ditutup) {
    const entri = await prisma.entriLedger.findMany({ where: { studioId, bulan }, include: { kategori: true }, orderBy: [{ tanggal: 'asc' }, { createdAt: 'asc' }] })
    for (const e of entri) baris.push({ id: e.id, sumber: e.sumberTipe, rekeningId: e.rekeningId, kategoriId: e.kategoriId, kategori: e.kategori.nama, arus: e.kategori.arus, sifat: e.kategori.sifat, tanggal: ISO(e.tanggal), deskripsi: e.deskripsi, jumlah: e.jumlah, terkunci: true })
  } else {
    const pemasukanId = kategori.find(k => k.arus === 'INCOME')?.id
    let [transfer, biaya, manual, item] = await Promise.all([
      // Pemasukan = PENARIKAN (WD) yang dicatat studio — Ekosistem tiap studio mandiri, tanpa transfer ke kas pusat (10 Nov 2026)
      prisma.penarikanPendapatan.findMany({ where: { studioId, bulan }, orderBy: { tanggal: 'asc' } }),
      prisma.biayaStudio.findMany({ where: { studioId, tanggal: { gte: awal, lt: akhir } }, orderBy: { tanggal: 'asc' } }),
      prisma.entriLedger.findMany({ where: { studioId, bulan, sumberTipe: 'MANUAL' }, include: { kategori: true }, orderBy: { tanggal: 'asc' } }),
      prisma.itemTetap.findMany({ where: { aktif: true, OR: [{ studioId }, { studioId: null }], kategori: { sifat: 'TETAP', aktif: true } }, include: { kategori: true, bulanan: { where: { bulan } } }, orderBy: [{ urutan: 'asc' }, { nama: 'asc' }] }),
    ])
    if (pemasukanId) for (const t of transfer) { const k = kat.get(pemasukanId); baris.push({ id: null, sumber: 'WD', sumberId: t.id, rekeningId: t.rekeningId, kategoriId: k.id, kategori: k.nama, arus: 'INCOME', sifat: null, tanggal: ISO(t.tanggal), deskripsi: `Penarikan ${t.nomor} · ${t.dariPlatform} → ${t.bankTujuan}${t.catatan ? ` · ${t.catatan}` : ''}`.slice(0, 255), jumlah: t.jumlah, terkunci: false }) }
    const master = await prisma.kategoriBiaya.findMany({ where: { nama: { in: [...new Set(biaya.map(b => b.kategori))] } } })
    for (const b of biaya) {
      if (b.persetujuan === 'MENUNGGU') { menunggu.jumlah += b.jumlah; menunggu.jumlahItem++; continue }
      if (b.persetujuan !== 'DISETUJUI') continue
      // Pemetaan kategori biaya → buku besar: master KategoriBiaya bila ada; bila tidak (12 Nov 2026: master masih kosong di production, biaya harian
      // tak terhitung), kategori buku besar PENGELUARAN dengan nama sama (huruf besar/kecil diabaikan), selain itu "Pengeluaran Lain-lain".
      const k = kat.get(master.find(m => m.nama === b.kategori)?.kategoriLedgerId ?? '') ?? kategori.find(x => x.arus === 'EXPENSE' && x.nama.toLowerCase() === String(b.kategori).trim().toLowerCase()) ?? kategori.find(x => x.nama === 'Pengeluaran Lain-lain')
      if (!k) { takTerpetakan.jumlah += b.jumlah; takTerpetakan.jumlahItem++; continue }
      baris.push({ id: null, sumber: 'BIAYA', sumberId: b.id, rekeningId: b.rekeningId, kategoriId: k.id, kategori: k.nama, arus: k.arus, sifat: k.sifat, tanggal: ISO(b.tanggal), deskripsi: (b.deskripsi || b.kategori).slice(0, 255), jumlah: b.jumlah, terkunci: false })
    }
    for (const e of manual) baris.push({ id: e.id, sumber: 'MANUAL', rekeningId: e.rekeningId, kategoriId: e.kategoriId, kategori: e.kategori.nama, arus: e.kategori.arus, sifat: e.kategori.sifat, tanggal: ISO(e.tanggal), deskripsi: e.deskripsi, jumlah: e.jumlah, terkunci: false })
    const gs = await gajiShuBio(studioId, bulan)
    if (gs.gaji.length || gs.shu) {
      const kGaji = await prisma.kategoriLedger.findFirst({ where: { nama: KATEGORI_GAJI } }), kShu = await prisma.kategoriLedger.findFirst({ where: { nama: KATEGORI_SHU } }), kDig = kategori.find(k => k.nama === KATEGORI_DIGNITY) ?? kGaji
      if (gs.gaji.length && kGaji) for (const o of gs.gaji) { const kk = o.dignity ? kDig : kGaji; baris.push({ id: null, sumber: 'BIO', sumberId: `gaji:${o.userId}`, rekeningId: null, kategoriId: kk.id, kategori: kk.nama, arus: 'EXPENSE', sifat: 'TETAP', tanggal: `${bulan}-26`, deskripsi: `${o.dignity ? 'Dignity' : 'Gaji'} ${o.nama}${o.dari === 'slip' ? ' (slip)' : ''}`, jumlah: o.jumlah, terkunci: false, dariBio: true, slipDibayarPada: o.dibayarPada ?? null }) }
      if (gs.shu && kShu) baris.push({ id: null, sumber: 'BIO', sumberId: 'shu', rekeningId: null, kategoriId: kShu.id, kategori: kShu.nama, arus: 'EXPENSE', sifat: 'TETAP', tanggal: `${bulan}-26`, deskripsi: 'SHU (Bio studio)', jumlah: gs.shu, terkunci: false, dariBio: true })
    }
    const abaikan = (i) => (gs.gaji.length && [KATEGORI_GAJI, KATEGORI_DIGNITY].includes(i.kategori.nama)) || (gs.shu && i.kategori.nama === KATEGORI_SHU)
    for (const i of item) if (abaikan(i)) gajiCircleDiabaikan.push(i.nama)
    item = item.filter(i => !abaikan(i))
    const bio = await prisma.studioPengeluaranRutin.findMany({ where: { studioId, jumlah: { gt: 0 } }, orderBy: [{ kategori: 'asc' }, { nama: 'asc' }] })
    if (bio.length) {
      const kb = await kategoriBio()
      for (const b of bio) {
        if (dobelDenganBio(b, item)) { bioDobel.push(b.nama); continue }
        const k = kb.get(b.kategori)
        baris.push({ id: null, sumber: 'BIO', sumberId: b.id, rekeningId: null, kategoriId: k.id, kategori: k.nama, arus: 'EXPENSE', sifat: 'TETAP', tanggal: `${bulan}-26`, deskripsi: b.nama, jumlah: b.jumlah, terkunci: false, dariBio: true })
      }
    }
    for (const i of item) baris.push({ id: null, sumber: 'ITEM_TETAP', sumberId: i.id, rekeningId: i.studioId ? i.rekeningId : null, kategoriId: i.kategoriId, kategori: i.kategori.nama, arus: 'EXPENSE', sifat: 'TETAP', tanggal: `${bulan}-26`, deskripsi: i.nama, jumlah: i.bulanan[0]?.jumlah ?? i.jumlahBawaan, terkunci: false, diubahBulanIni: !!i.bulanan[0] })
    // Status bayar biaya rutin (12 Nov 2026, masukan tim): yang sudah ditandai dibayar memakai TANGGAL BAYAR & REKENING sebenarnya (memotong
    // saldo rekening itu, ikut "Saldo hari ini"); yang belum tetap tgl 26 (perkiraan). Gaji dari slip yang sudah DIBAYAR otomatis dianggap dibayar.
    const bayar = new Map((await prisma.bayarRutin.findMany({ where: { studioId, bulan } })).map(x => [`${x.sumber}|${x.sumberId}`, x]))
    for (const b of baris) {
      if (b.sumber !== 'BIO' && b.sumber !== 'ITEM_TETAP') continue
      const x = bayar.get(`${b.sumber}|${b.sumberId}`)
      if (x) Object.assign(b, { tanggal: ISO(x.dibayarPada), rekeningId: x.rekeningId ?? b.rekeningId, dibayar: true, dibayarOleh: x.oleh, bisaBatal: true })
      else if (b.slipDibayarPada) Object.assign(b, { tanggal: b.slipDibayarPada, dibayar: true, bisaBatal: false })
      else b.dibayar = false
    }
  }
  const jml = (f) => r2(baris.filter(f).reduce((a, b) => a + b.jumlah, 0))
  const masuk = jml(b => b.arus === 'INCOME'), tetap = jml(b => b.arus === 'EXPENSE' && b.sifat === 'TETAP'), variabel = jml(b => b.arus === 'EXPENSE' && b.sifat !== 'TETAP')
  const sebelum = await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId, bulan: bulanSebelum(bulan) } } })
  const kasAwal = ditutup ? status.kasAwal : (sebelum?.status === 'DITUTUP' ? sebelum.kasAkhir : status?.kasAwalManual ?? 0)
  const kasAwalDari = ditutup ? 'snapshot' : sebelum?.status === 'DITUTUP' ? 'bulan sebelumnya (ditutup)' : status?.kasAwalManual != null ? 'diisi manual' : 'belum ada (0)'
  const tertahan = await prisma.pendapatanTertahan.aggregate({ where: { studioId, status: 'TERTAHAN' }, _sum: { jumlah: true }, _count: true })
  return { baris, bioDobel, gajiCircleDiabaikan, ditutup, status, masuk, tetap, variabel, keluar: r2(tetap + variabel), hasil: r2(masuk - tetap - variabel), kasAwal: kasAwal ?? 0, kasAwalDari, kasAkhir: ditutup ? status.kasAkhir : r2((kasAwal ?? 0) + masuk - tetap - variabel), menunggu, takTerpetakan, tertahan: { jumlah: tertahan._sum.jumlah ?? 0, jumlahItem: tertahan._count } }
}
// ── Kas per rekening (12 Nov 2026) ─────────────────────────────────────────────────────────────────────────────────────────
// Saldo awal per rekening: snapshot akhir bulan sebelumnya (bila ditutup) → isian koordinator bulan ini → 0. Uang tanpa rekening & sisa kas awal yang
// belum dibagi masuk "Belum dipilih", sehingga jumlah semua baris SELALU = kas akhir total. Pindah antar rekening tidak mengubah total.
async function perRekening(studioId, bulan, h) {
  const daftar = await daftarRekening(studioId), ids = new Set(daftar.map(r => r.id))
  const sebelum = await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId, bulan: bulanSebelum(bulan) } } })
  const snap = h.ditutup ? h.status?.saldoRekening : null
  const awalPer = snap?.awal ?? (sebelum?.status === 'DITUTUP' && sebelum.saldoRekening?.akhir ? sebelum.saldoRekening.akhir : (h.status?.saldoAwalRekening ?? {}))
  const pindah = await prisma.pindahRekening.findMany({ where: { studioId, bulan }, orderBy: [{ tanggal: 'asc' }, { createdAt: 'asc' }] })
  const baru = () => ({ awal: 0, masuk: 0, keluar: 0, pindahMasuk: 0, pindahKeluar: 0 })
  const per = new Map(daftar.map(r => [r.id, baru()])), lain = baru()
  const ke = (id) => (id && ids.has(id) ? per.get(id) : lain)
  for (const r of daftar) per.get(r.id).awal = r2(Number(awalPer[r.id] ?? 0))
  lain.awal = r2(h.kasAwal - daftar.reduce((a, r) => a + per.get(r.id).awal, 0))
  for (const b of h.baris) { const e = ke(b.rekeningId); if (b.arus === 'INCOME') e.masuk = r2(e.masuk + b.jumlah); else e.keluar = r2(e.keluar + b.jumlah) }
  for (const p of pindah) { ke(p.dariId).pindahKeluar = r2(ke(p.dariId).pindahKeluar + p.jumlah); ke(p.keId).pindahMasuk = r2(ke(p.keId).pindahMasuk + p.jumlah) }
  const akhir = (e) => r2(e.awal + e.masuk - e.keluar + e.pindahMasuk - e.pindahKeluar)
  // Saldo HARI INI (12 Nov 2026, masukan tim): hanya catatan bertanggal ≤ hari ini (WIB). Biaya rutin bertanggal tgl 26 (gaji, SHU, Bio) belum
  // memotong saldo sebelum tanggalnya — angka inilah yang disalin ke Bio Ekosistem oleh "Perbarui saldo Bio".
  const hariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  const kini = new Map(daftar.map(r => [r.id, per.get(r.id).awal])); let kiniLain = lain.awal
  const tambahKini = (id, j) => { if (id && ids.has(id)) kini.set(id, r2(kini.get(id) + j)); else kiniLain = r2(kiniLain + j) }
  for (const b of h.baris) if ((b.tanggal ?? '') <= hariIni) tambahKini(b.rekeningId, b.arus === 'INCOME' ? b.jumlah : -b.jumlah)
  for (const p of pindah) if (ISO(p.tanggal) <= hariIni) { tambahKini(p.dariId, -p.jumlah); tambahKini(p.keId, p.jumlah) }
  const nama = new Map(daftar.map(r => [r.id, r.nama]))
  return {
    daftar: daftar.map(r => { const e = per.get(r.id); return { id: r.id, nama: r.nama, ...e, akhir: akhir(e), kini: kini.get(r.id), saldoBio: r.saldoBio, adaAwal: Object.prototype.hasOwnProperty.call(awalPer, r.id) } }),
    belumDipilih: { ...lain, akhir: akhir(lain), kini: kiniLain }, hariIni,
    pindah: pindah.map(p => ({ id: p.id, tanggal: ISO(p.tanggal), dari: nama.get(p.dariId) ?? 'Rekening dihapus', ke: nama.get(p.keId) ?? 'Rekening dihapus', jumlah: p.jumlah, catatan: p.catatan, dibuatOleh: p.dibuatOleh })),
    awalDari: snap ? 'snapshot' : sebelum?.status === 'DITUTUP' && sebelum.saldoRekening?.akhir ? 'bulan sebelumnya (ditutup)' : h.status?.saldoAwalRekening ? 'diisi koordinator' : 'belum diisi',
    bisaIsiAwal: !h.ditutup && !(sebelum?.status === 'DITUTUP' && sebelum.saldoRekening?.akhir),
    bioDisamakan: h.status?.bioDisamakanPada ? { pada: h.status.bioDisamakanPada, oleh: h.status.bioDisamakanOleh } : null,
  }
}
const ringkasan = (h) => ({ status: h.ditutup ? 'DITUTUP' : 'BERJALAN', ditutupPada: h.status?.ditutupPada ?? null, ditutupOleh: h.status?.ditutupOleh ?? null, kasAwal: h.kasAwal, kasAwalDari: h.kasAwalDari, masuk: h.masuk, tetap: h.tetap, variabel: h.variabel, keluar: h.keluar, hasil: h.hasil, kasAkhir: h.kasAkhir, menungguPersetujuan: h.menunggu, takTerpetakan: h.takTerpetakan, tertahan: h.tertahan })

export const getRingkasan = wrap(async (req, res) => {
  const { studioId, bulan } = req.query
  if (!(await bolehUnit(req, res, studioId))) return
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const h = await hitung(studioId, bulan)
  const perKategori = new Map(); for (const b of h.baris) { const e = perKategori.get(b.kategoriId) ?? { kategori: b.kategori, arus: b.arus, sifat: b.sifat, jumlah: 0 }; e.jumlah = r2(e.jumlah + b.jumlah); perKategori.set(b.kategoriId, e) }
  return res.json({ success: true, data: { studioId, bulan, ...ringkasan(h), perKategori: [...perKategori.values()], rekening: await perRekening(studioId, bulan, h), bisaTutup: await atasan(req, studioId), bisaBukaLagi: superAdmin(req) } })
})
export const getRincian = wrap(async (req, res) => {
  const { studioId, bulan } = req.query
  if (!(await bolehUnit(req, res, studioId))) return
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const h = await hitung(studioId, bulan)
  const nama = new Map((await daftarRekening(studioId)).map(r => [r.id, r.nama]))
  for (const b of h.baris) b.rekening = b.rekeningId ? (nama.get(b.rekeningId) ?? 'Rekening dihapus') : null
  return res.json({ success: true, data: { ditutup: h.ditutup, baris: h.baris.sort((a, b) => (a.tanggal ?? '').localeCompare(b.tanggal ?? '')), masuk: h.masuk, tetap: h.tetap, variabel: h.variabel, bioDobel: h.bioDobel, gajiCircleDiabaikan: h.gajiCircleDiabaikan } })
})
// Ringkasan seluruh unit circle ini (hanya unit dalam wewenang pemanggil)
export const getRingkasanCircle = wrap(async (req, res) => {
  const { bulan } = req.query
  if (!(await pelaporAtauPemilikBaca(req))) return gagal(res, 403, 'Hanya Koordinator/Pendamping ke atas')
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const web = await resolveWeb(req)
  if (req.user?.aud === 'circle' && web.aud === 'circle' && req.user.cs !== web.lingkup.slug) return gagal(res, 403, 'Token bukan untuk alamat ini')
  const baris = []
  for (const s of await studioLingkup(req)) {
    if (!(await studioBolehDilihat(req, s.id)) || !(await pengelolaAtauPemilikBaca(req, s.id))) continue
    const h = await hitung(s.id, bulan)
    baris.push({ studioId: s.id, nama: s.nama, status: h.ditutup ? 'DITUTUP' : 'BERJALAN', masuk: h.masuk, keluar: h.keluar, hasil: h.hasil, kasAkhir: h.kasAkhir, menunggu: h.menunggu.jumlahItem, takTerpetakan: h.takTerpetakan.jumlahItem })
  }
  const jml = (f) => r2(baris.reduce((a, b) => a + b[f], 0)), tutup = baris.filter(b => b.status === 'DITUTUP').length
  return res.json({ success: true, data: { bulan, unit: baris, total: { masuk: jml('masuk'), keluar: jml('keluar'), hasil: jml('hasil'), kasAkhir: jml('kasAkhir') }, statusCircle: !baris.length ? 'BERJALAN' : tutup === baris.length ? 'DITUTUP' : tutup ? 'SEBAGIAN' : 'BERJALAN', unitDitutup: tutup, unitTotal: baris.length } })
})

// ── Entri manual ────────────────────────────────────────────────────────────────────────────────────────────────────────
async function bulanTertutup(studioId, bulan) { return (await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId, bulan } } }))?.status === 'DITUTUP' }
export const buatEntri = wrap(async (req, res) => {
  const { studioId, kategoriId } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  const t = tgl(req.body.tanggal), j = angka(req.body.jumlah)
  if (!t) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (!(j > 0)) return gagal(res, 422, 'Jumlah harus lebih dari 0')
  const deskripsi = String(req.body.deskripsi ?? '').trim(); if (!deskripsi || deskripsi.length > 255) return gagal(res, 422, 'Deskripsi wajib diisi (maks 255 huruf)')
  await pastikanKategori()
  if (!(await prisma.kategoriLedger.findFirst({ where: { id: kategoriId ?? '', aktif: true } }))) return gagal(res, 422, 'Kategori tidak valid')
  const bulan = t.toISOString().slice(0, 7)
  if (await bulanTertutup(studioId, bulan)) return gagal(res, 409, 'Bulan ini sudah ditutup')
  const rekeningId = bacaRekeningId(req.body.rekeningId) ?? null
  if (!(await rekeningSah(studioId, rekeningId))) return gagal(res, 422, 'Rekening bukan milik unit ini')
  const e = await prisma.entriLedger.create({ data: { studioId, kategoriId, tanggal: t, deskripsi, jumlah: j, sumberTipe: 'MANUAL', bulan, rekeningId, dibuatOleh: await namaPengguna(req) } })
  return res.status(201).json({ success: true, data: { id: e.id } })
})
export const hapusEntri = wrap(async (req, res) => {
  const e = await prisma.entriLedger.findUnique({ where: { id: req.params.id } })
  if (!e) return gagal(res, 404, 'Entri tidak ditemukan')
  if (!(await bolehUnit(req, res, e.studioId))) return
  if (e.sumberTipe !== 'MANUAL') return gagal(res, 409, 'Hanya entri manual yang bisa dihapus')
  if (e.terkunci || (await bulanTertutup(e.studioId, e.bulan))) return gagal(res, 409, 'Bulan ini sudah ditutup')
  await prisma.entriLedger.delete({ where: { id: e.id } })
  return res.json({ success: true, message: 'Entri dihapus' })
})

// ── Item tetap bulanan ──────────────────────────────────────────────────────────────────────────────────────────────────
export const getItemTetap = wrap(async (req, res) => {
  const { studioId, bulan } = req.query
  if (!(await bolehUnit(req, res, studioId))) return
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  await pastikanKategori()
  const item = await prisma.itemTetap.findMany({ where: { aktif: true, OR: [{ studioId }, { studioId: null }] }, include: { kategori: true, bulanan: { where: { bulan } } }, orderBy: [{ urutan: 'asc' }, { nama: 'asc' }] })
  // Dari Bio studio (baca-saja): ikut dihitung di buku besar; yang sudah ada juga sebagai item tetap circle ditandai dobel (dilewati)
  const bioRows = await prisma.studioPengeluaranRutin.findMany({ where: { studioId, jumlah: { gt: 0 } }, orderBy: [{ kategori: 'asc' }, { nama: 'asc' }] })
  const gs = await gajiShuBio(studioId, bulan)
  const diabaikan = (i) => (gs.gaji.length > 0 && [KATEGORI_GAJI, KATEGORI_DIGNITY].includes(i.kategori.nama)) || (gs.shu > 0 && i.kategori.nama === KATEGORI_SHU)
  const dariBio = bioRows.map(b => ({ id: b.id, nama: b.nama, jenis: KATEGORI_BIO[b.kategori] ?? b.kategori, jumlah: b.jumlah, dobel: dobelDenganBio(b, item.filter(i => !diabaikan(i))) }))
  const gajiBio = { orang: gs.gaji.map(o => ({ userId: o.userId, nama: o.nama, jumlah: o.jumlah, dari: o.dari, status: o.status ?? null, dignity: !!o.dignity })), shu: gs.shu }
  return res.json({ success: true, data: { dariBio, gajiBio, ditutup: await bulanTertutup(studioId, bulan), item: item.map(i => ({ id: i.id, nama: i.nama, rekeningId: i.studioId ? i.rekeningId : null, kategori: i.kategori.nama, kategoriId: i.kategoriId, global: i.studioId == null, jumlahBawaan: i.jumlahBawaan, jumlahBulanIni: i.bulanan[0]?.jumlah ?? i.jumlahBawaan, diubah: !!i.bulanan[0], catatan: i.bulanan[0]?.catatan ?? null, diabaikan: diabaikan(i) })), bisaBuat: await atasan(req, studioId), bisaBuatGlobal: superAdmin(req) } })
})
export const buatItemTetap = wrap(async (req, res) => {
  const { studioId, kategoriId } = req.body ?? {}
  const global = !studioId
  if (global ? !superAdmin(req) : false) return gagal(res, 403, 'Item untuk semua unit hanya oleh Super Admin')
  if (!global) { if (!(await bolehUnit(req, res, studioId))) return; if (!(await atasan(req, studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas yang menambah item tetap') }
  const nama = String(req.body.nama ?? '').trim(); if (!nama || nama.length > 100) return gagal(res, 422, 'Nama wajib diisi (maks 100 huruf)')
  const j = angka(req.body.jumlahBawaan ?? 0); if (!(j >= 0)) return gagal(res, 422, 'Jumlah tidak boleh negatif')
  await pastikanKategori()
  const k = await prisma.kategoriLedger.findFirst({ where: { id: kategoriId ?? '', aktif: true, arus: 'EXPENSE', sifat: 'TETAP' } }); if (!k) return gagal(res, 422, 'Kategori harus pengeluaran bersifat TETAP')
  if (!global && [KATEGORI_GAJI, KATEGORI_SHU, KATEGORI_DIGNITY].includes(k.nama)) { const gs = await gajiShuBio(studioId, new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)); if (k.nama === KATEGORI_SHU ? gs.shu : gs.gaji.length) return gagal(res, 422, `${k.nama === KATEGORI_SHU ? 'SHU diambil dari SHU' : 'Gaji & Dignity diambil dari THP'} di Bio studio (atau slip Penggajian) — tidak perlu diketik lagi. Ubah angkanya di Management Dashboard → Unit Usaha → Bio Studio.`) }
  if (Object.values(KATEGORI_BIO).includes(k.nama)) return gagal(res, 422, `"${k.nama}" diisi di Bio studio (Management Dashboard → Unit Usaha → Bio Studio → Pengeluaran Rutin) dan otomatis ikut dihitung di sini — tidak perlu diketik lagi`)
  const rekeningId = global ? null : (bacaRekeningId(req.body.rekeningId) ?? null)
  if (!global && !(await rekeningSah(studioId, rekeningId))) return gagal(res, 422, 'Rekening bukan milik unit ini')
  const i = await prisma.itemTetap.create({ data: { kategoriId: k.id, studioId: global ? null : studioId, nama, jumlahBawaan: j, rekeningId } })
  return res.status(201).json({ success: true, data: { id: i.id } })
})
const lewatItem = (isi) => wrap(async (req, res) => { const i = await prisma.itemTetap.findUnique({ where: { id: req.params.id } }); if (!i) return gagal(res, 404, 'Item tidak ditemukan'); return isi(req, res, i) })
export const ubahItemTetap = lewatItem(async (req, res, i) => {
  if (i.studioId ? !(await bolehUnit(req, res, i.studioId)) : !superAdmin(req)) { if (!i.studioId) gagal(res, 403, 'Item untuk semua unit hanya oleh Super Admin'); return }
  if (i.studioId && !(await atasan(req, i.studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  const data = {}
  if (req.body.nama !== undefined) { const n = String(req.body.nama).trim(); if (!n || n.length > 100) return gagal(res, 422, 'Nama wajib diisi (maks 100 huruf)'); data.nama = n }
  if (req.body.jumlahBawaan !== undefined) { const j = angka(req.body.jumlahBawaan); if (!(j >= 0)) return gagal(res, 422, 'Jumlah tidak boleh negatif'); data.jumlahBawaan = j }
  if (req.body.aktif !== undefined) data.aktif = !!req.body.aktif
  const rekeningId = bacaRekeningId(req.body.rekeningId)
  if (rekeningId !== undefined && i.studioId) { if (!(await rekeningSah(i.studioId, rekeningId))) return gagal(res, 422, 'Rekening bukan milik unit ini'); data.rekeningId = rekeningId }
  await prisma.itemTetap.update({ where: { id: i.id }, data })
  return res.json({ success: true, message: 'Item diperbarui' })
})
export const ubahItemTetapBulan = lewatItem(async (req, res, i) => {
  const { studioId, bulan } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (i.studioId && i.studioId !== studioId) return gagal(res, 403, 'Item ini milik unit lain')
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (await bulanTertutup(studioId, bulan)) return gagal(res, 409, 'Bulan ini sudah ditutup')
  const j = angka(req.body.jumlah); if (!(j >= 0)) return gagal(res, 422, 'Jumlah tidak boleh negatif')
  await prisma.itemTetapBulan.upsert({ where: { itemId_bulan: { itemId: i.id, bulan } }, update: { jumlah: j, catatan: req.body.catatan ? String(req.body.catatan).slice(0, 300) : null, diubahOleh: await namaPengguna(req) }, create: { itemId: i.id, bulan, jumlah: j, catatan: req.body.catatan ? String(req.body.catatan).slice(0, 300) : null, diubahOleh: await namaPengguna(req) } })
  return res.json({ success: true, message: 'Jumlah bulan ini disimpan' })
})

// ── Kas awal manual (bulan pertama sebelum ada bulan yang ditutup) ───────────────────────────────────────────────────────
export const simpanKasAwal = wrap(async (req, res) => {
  const { studioId, bulan } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (!(await atasan(req, studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (await bulanTertutup(studioId, bulan)) return gagal(res, 409, 'Bulan ini sudah ditutup')
  const j = angka(req.body.jumlah); if (!(j >= 0)) return gagal(res, 422, 'Jumlah tidak boleh negatif')
  await prisma.statusBulan.upsert({ where: { studioId_bulan: { studioId, bulan } }, update: { kasAwalManual: j }, create: { studioId, bulan, kasAwalManual: j } })
  return res.json({ success: true, message: 'Kas awal disimpan' })
})

// ── Rekening (dari Bio Ekosistem), saldo awal per rekening & pindah dana (12 Nov 2026) ─────────────────────────────────────────
export const getRekening = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await bolehUnit(req, res, studioId))) return
  return res.json({ success: true, data: (await daftarRekening(studioId)).map(r => ({ id: r.id, nama: r.nama })) })
})
export const simpanSaldoAwalRekening = wrap(async (req, res) => {
  const { studioId, bulan, saldo } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (!(await atasan(req, studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (await bulanTertutup(studioId, bulan)) return gagal(res, 409, 'Bulan ini sudah ditutup')
  const sebelum = await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId, bulan: bulanSebelum(bulan) } } })
  if (sebelum?.status === 'DITUTUP' && sebelum.saldoRekening?.akhir) return gagal(res, 409, 'Saldo awal bulan ini sudah otomatis dari bulan sebelumnya yang ditutup')
  if (!saldo || typeof saldo !== 'object' || Array.isArray(saldo)) return gagal(res, 422, 'saldo harus { rekeningId: jumlah }')
  const ids = new Set((await daftarRekening(studioId)).map(r => r.id)), bersih = {}
  for (const [id, v] of Object.entries(saldo)) { if (!ids.has(id)) return gagal(res, 422, 'Rekening bukan milik unit ini'); const j = angka(v); if (!(j >= 0)) return gagal(res, 422, 'Saldo tidak boleh negatif'); bersih[id] = r2(j) }
  // Bulan pertama (sebelumnya belum ditutup): kas awal = jumlah saldo awal semua rekening. Bila bulan sebelumnya ditutup tanpa rincian
  // rekening, kas awal tetap dari bulan itu — isian ini hanya membagi kas awal ke rekening (sisanya "Belum dipilih").
  const kasAwalManual = sebelum?.status === 'DITUTUP' ? undefined : r2(Object.values(bersih).reduce((a, b) => a + b, 0))
  await prisma.statusBulan.upsert({ where: { studioId_bulan: { studioId, bulan } }, update: { saldoAwalRekening: bersih, ...(kasAwalManual !== undefined ? { kasAwalManual } : {}) }, create: { studioId, bulan, saldoAwalRekening: bersih, ...(kasAwalManual !== undefined ? { kasAwalManual } : {}) } })
  return res.json({ success: true, message: 'Saldo awal per rekening disimpan', data: { kasAwalIkut: kasAwalManual !== undefined } })
})
export const buatPindah = wrap(async (req, res) => {
  const { studioId, dariId, keId } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (!(await atasan(req, studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  const t = tgl(req.body.tanggal), j = angka(req.body.jumlah)
  if (!t) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (!(j > 0)) return gagal(res, 422, 'Jumlah harus lebih dari 0')
  if (!dariId || !keId || dariId === keId) return gagal(res, 422, 'Pilih rekening asal dan tujuan yang berbeda')
  if (!(await rekeningSah(studioId, dariId)) || !(await rekeningSah(studioId, keId))) return gagal(res, 422, 'Rekening bukan milik unit ini')
  const bulan = t.toISOString().slice(0, 7)
  if (await bulanTertutup(studioId, bulan)) return gagal(res, 409, 'Bulan ini sudah ditutup')
  const p = await prisma.pindahRekening.create({ data: { studioId, tanggal: t, bulan, dariId, keId, jumlah: r2(j), catatan: req.body.catatan ? String(req.body.catatan).slice(0, 255) : null, dibuatOleh: await namaPengguna(req) } })
  return res.status(201).json({ success: true, data: { id: p.id } })
})
export const hapusPindah = wrap(async (req, res) => {
  const p = await prisma.pindahRekening.findUnique({ where: { id: req.params.id } })
  if (!p) return gagal(res, 404, 'Catatan pindah dana tidak ditemukan')
  if (!(await bolehUnit(req, res, p.studioId))) return
  if (!(await atasan(req, p.studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  if (await bulanTertutup(p.studioId, p.bulan)) return gagal(res, 409, 'Bulan ini sudah ditutup')
  await prisma.pindahRekening.delete({ where: { id: p.id } })
  return res.json({ success: true, message: 'Catatan pindah dana dihapus' })
})

// ── Perbarui saldo Bio Ekosistem dari circle (opsi 2, keputusan user 12 Nov 2026) ──────────────────────────────────────────────────
// JALUR TULIS PERTAMA ke Ekosistem, dipicu manual oleh koordinator (bukan otomatis): saldo akhir tiap rekening bulan BERJALAN disalin ke
// StudioRekening.saldo, lalu laporan mingguan minggu berjalan diselaraskan (sama seperti saat saldo diubah di Bio). Saldo lama disimpan
// di StatusBulan.bioSebelum + siapa & kapan. Baris "Belum dipilih" tidak punya rekening, jadi tidak ikut disalin.
export const samakanBio = wrap(async (req, res) => {
  const { studioId, bulan } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (!(await atasan(req, studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  if (req.user?.imp) return gagal(res, 403, 'Tidak bisa saat menyamar')
  const bulanIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
  if (bulan !== bulanIni) return gagal(res, 422, 'Saldo Bio hanya bisa disamakan dengan bulan berjalan')
  const h = await hitung(studioId, bulan), rk = await perRekening(studioId, bulan, h)
  if (!rk.daftar.length) return gagal(res, 409, 'Unit ini belum punya rekening di Bio studio Ekosistem')
  // Pengaman: rekening yang saldo awalnya BELUM diisi tidak disalin — kalau disalin, saldo Bio bisa ternolkan (akhir circle dihitung dari 0)
  const siap = rk.daftar.filter(r => r.adaAwal), tanpaAwal = rk.daftar.filter(r => !r.adaAwal)
  if (!siap.length) return gagal(res, 409, 'Isi saldo awal per rekening dulu (Atur saldo awal) supaya saldo Bio tidak tertimpa angka 0')
  const ubah = siap.filter(r => Math.round(r.kini * 100) !== Math.round((r.saldoBio ?? 0) * 100))
  if (!ubah.length) return res.json({ success: true, message: 'Saldo Bio sudah sama, tidak ada yang diubah', data: { diubah: 0, dilewati: tanpaAwal.map(r => r.nama) } })
  if (ubah.some(r => r.kini < 0)) return gagal(res, 422, 'Ada rekening dengan saldo minus — periksa dulu catatannya (mungkin salah pilih rekening)')
  const oleh = await namaPengguna(req), sebelumBio = Object.fromEntries(ubah.map(r => [r.id, r.saldoBio ?? 0]))
  await prisma.$transaction([
    ...ubah.map(r => prisma.studioRekening.update({ where: { id: r.id }, data: { saldo: r.kini } })),
    prisma.statusBulan.upsert({ where: { studioId_bulan: { studioId, bulan } }, update: { bioDisamakanPada: new Date(), bioDisamakanOleh: oleh, bioSebelum: sebelumBio }, create: { studioId, bulan, bioDisamakanPada: new Date(), bioDisamakanOleh: oleh, bioSebelum: sebelumBio } }),
  ])
  await snapshotKasMingguIni(studioId).catch(() => {}) // gagal sinkron laporan mingguan tidak menggagalkan penyalinan saldo
  return res.json({ success: true, message: `Saldo ${ubah.length} rekening di Bio Ekosistem diperbarui`, data: { diubah: ubah.length, rekening: ubah.map(r => ({ nama: r.nama, dari: r.saldoBio ?? 0, ke: r.kini })), dilewati: tanpaAwal.map(r => r.nama), belumDipilih: rk.belumDipilih.kini } })
})

// ── Tutup / buka lagi ───────────────────────────────────────────────────────────────────────────────────────────────────
export const tutupBulan = wrap(async (req, res) => {
  const { studioId, bulan } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (!(await atasan(req, studioId))) return gagal(res, 403, 'Penutupan bulan hanya untuk Koordinator unit ini ke atas')
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const h = await hitung(studioId, bulan)
  if (h.ditutup) return gagal(res, 409, 'Bulan ini sudah ditutup')
  const oleh = await namaPengguna(req)
  const rk = await perRekening(studioId, bulan, h)
  const saldoRekening = { awal: Object.fromEntries(rk.daftar.map(r => [r.id, r.awal])), akhir: Object.fromEntries(rk.daftar.map(r => [r.id, r.akhir])) }
  await prisma.$transaction(async (tx) => {
    await tx.entriLedger.deleteMany({ where: { studioId, bulan, sumberTipe: { in: ['TRANSFER', 'WD', 'BIAYA', 'ITEM_TETAP', 'BIO'] } } })
    const sumber = h.baris.filter(b => b.sumber !== 'MANUAL')
    if (sumber.length) await tx.entriLedger.createMany({ data: sumber.map(b => ({ studioId, kategoriId: b.kategoriId, tanggal: new Date(b.tanggal + 'T00:00:00Z'), deskripsi: b.deskripsi, jumlah: b.jumlah, sumberTipe: b.sumber, sumberId: b.sumberId ?? null, rekeningId: b.rekeningId ?? null, bulan, terkunci: true, dibuatOleh: oleh })) })
    await tx.entriLedger.updateMany({ where: { studioId, bulan }, data: { terkunci: true } })
    await tx.statusBulan.upsert({ where: { studioId_bulan: { studioId, bulan } }, update: { status: 'DITUTUP', saldoRekening, kasAwal: h.kasAwal, masuk: h.masuk, variabel: h.variabel, tetap: h.tetap, kasAkhir: h.kasAkhir, ditutupPada: new Date(), ditutupOleh: oleh, catatan: req.body.catatan ? String(req.body.catatan).slice(0, 300) : null }, create: { studioId, bulan, status: 'DITUTUP', saldoRekening, kasAwal: h.kasAwal, masuk: h.masuk, variabel: h.variabel, tetap: h.tetap, kasAkhir: h.kasAkhir, ditutupPada: new Date(), ditutupOleh: oleh, catatan: req.body.catatan ? String(req.body.catatan).slice(0, 300) : null } })
  })
  return res.json({ success: true, data: { kasAkhir: h.kasAkhir, masuk: h.masuk, keluar: h.keluar, hasil: h.hasil, menungguDilewati: h.menunggu.jumlahItem, takTerpetakan: h.takTerpetakan.jumlahItem } })
})
export const bukaLagi = wrap(async (req, res) => {
  const { studioId, bulan } = req.body ?? {}
  if (!superAdmin(req)) return gagal(res, 403, 'Membuka kembali bulan hanya untuk Super Admin / Kepala Ekosistem')
  if (!studioId || !bulanOk(bulan)) return gagal(res, 422, 'studioId dan bulan (YYYY-MM) wajib')
  if (!(await bulanTertutup(studioId, bulan))) return gagal(res, 409, 'Bulan ini belum ditutup')
  // bulan berikutnya yang sudah ditutup memakai kas akhir bulan ini → tolak agar rantai kas tidak rusak
  const [aw] = rentang(bulan); const next = new Date(aw); next.setUTCMonth(next.getUTCMonth() + 1)
  if (await bulanTertutup(studioId, next.toISOString().slice(0, 7))) return gagal(res, 409, 'Bulan berikutnya sudah ditutup. Buka bulan berikutnya dulu.')
  await prisma.$transaction([
    prisma.entriLedger.deleteMany({ where: { studioId, bulan, sumberTipe: { in: ['TRANSFER', 'WD', 'BIAYA', 'ITEM_TETAP', 'BIO'] } } }),
    prisma.entriLedger.updateMany({ where: { studioId, bulan }, data: { terkunci: false } }),
    prisma.statusBulan.update({ where: { studioId_bulan: { studioId, bulan } }, data: { status: 'BERJALAN', saldoRekening: null, kasAwal: null, masuk: null, variabel: null, tetap: null, kasAkhir: null, ditutupPada: null, ditutupOleh: null } }),
  ])
  return res.json({ success: true, message: 'Bulan dibuka kembali' })
})

// Laba rugi 12 bulan (matriks kategori × bulan) + proyeksi 3 bulan — adaptasi OGS KaizenFinanceStudioPlService
export const getLabaRugi = wrap(async (req, res) => {
  const { studioId } = req.query, tahun = Number(req.query.tahun)
  if (!(await bolehUnit(req, res, studioId))) return
  if (!Number.isInteger(tahun) || tahun < 2020 || tahun > 2100) return gagal(res, 422, 'tahun tidak valid')
  const bulanList = []
  for (let m = 1; m <= 12; m++) {
    const bulan = `${tahun}-${String(m).padStart(2, '0')}`
    const h = await hitung(studioId, bulan)
    const per = new Map(); for (const b of h.baris) { const k = `${b.arus}|${b.kategori}`; const e = per.get(k) ?? { kategori: b.kategori, arus: b.arus, sifat: b.sifat, jumlah: 0 }; e.jumlah = r2(e.jumlah + b.jumlah); per.set(k, e) }
    bulanList.push({ bulan, perKategori: [...per.values()], masuk: h.masuk, tetap: h.tetap, variabel: h.variabel, kasAwal: h.kasAwal, kasAkhir: h.kasAkhir, status: h.ditutup ? 'DITUTUP' : 'BERJALAN' })
  }
  const bulanIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
  // proyeksi hanya dari bulan yang sudah lewat/berjalan
  const sampai = bulanList.filter(b => b.bulan <= bulanIni)
  return res.json({ success: true, data: { studioId, tahun, ...matriksLabaRugi(bulanList), proyeksi: proyeksi(sampai) } })
})

// Laba rugi seluruh unit dalam rentang bulan (dashboard Manajemen, adaptasi OGS Management/Index P&L per rentang). Kepala Circle ke atas.
export const getRentang = wrap(async (req, res) => {
  const dari = req.query.dari, sampai = req.query.sampai
  const web = await resolveWeb(req)
  if (web.aud !== 'circle' || !atasanLingkup(peranKerja(req), web.lingkup)) return gagal(res, 403, 'Hanya Kepala Circle ke atas')
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) return gagal(res, 403, 'Token bukan untuk alamat ini')
  if (!bulanOk(dari) || !bulanOk(sampai) || sampai < dari) return gagal(res, 422, 'dari/sampai harus YYYY-MM dan sampai ≥ dari')
  const daftar = []; for (let b = dari; b <= sampai; b = (() => { const d = new Date(b + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7) })()) { daftar.push(b); if (daftar.length > 24) return gagal(res, 422, 'Rentang maksimal 24 bulan') }
  const unit = []
  for (const s of await studioLingkup(req)) {
    if (!(await studioBolehDilihat(req, s.id))) continue
    let masuk = 0, tetap = 0, variabel = 0, tutup = 0, kasAkhir = 0
    const bulan = []
    for (const b of daftar) { const h = await hitung(s.id, b); masuk += h.masuk; tetap += h.tetap; variabel += h.variabel; if (h.ditutup) tutup++; kasAkhir = h.kasAkhir; bulan.push({ bulan: b, masuk: h.masuk, keluar: h.keluar, hasil: h.hasil, ditutup: h.ditutup }) }
    unit.push({ studioId: s.id, nama: s.nama, masuk: r2(masuk), tetap: r2(tetap), variabel: r2(variabel), keluar: r2(tetap + variabel), hasil: r2(masuk - tetap - variabel), marginPersen: masuk > 0 ? Math.round(((masuk - tetap - variabel) / masuk) * 1000) / 10 : null, kasAkhir, bulanDitutup: tutup, jumlahBulan: daftar.length, bulan })
  }
  unit.sort((a, b) => b.hasil - a.hasil)
  const jml = (f) => r2(unit.reduce((a, b) => a + b[f], 0))
  return res.json({ success: true, data: { dari, sampai, jumlahBulan: daftar.length, unit, total: { masuk: jml('masuk'), keluar: jml('keluar'), hasil: jml('hasil'), kasAkhir: jml('kasAkhir') }, catatan: 'Bulan yang belum ditutup dihitung langsung (belum terkunci).' } })
})

// Rencana keuangan (adaptasi OGS FinanceV4 Rencana): struktur biaya tetap bulan ini + forecast kas 3 skenario. Asumsi bawaan dari data (rata-rata 3 bulan
// terakhir yang berisi data); bisa ditimpa lewat query (masuk, variabel, tetap) untuk simulasi — TIDAK ada yang disimpan.
export const getRencana = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await bolehUnit(req, res, studioId))) return
  const bulanIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
  const bulan = bulanOk(req.query.bulan) ? req.query.bulan : bulanIni
  const n = Math.min(12, Math.max(1, Number(req.query.n) || 6))
  const num = (v) => (v === undefined || v === '' ? null : (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : NaN))
  const ov = { masuk: num(req.query.masuk), variabel: num(req.query.variabel), tetap: num(req.query.tetap) }
  if (Object.values(ov).some(Number.isNaN)) return gagal(res, 422, 'masuk/variabel/tetap harus angka ≥ 0')
  // struktur biaya tetap bulan ini
  const item = await prisma.itemTetap.findMany({ where: { aktif: true, OR: [{ studioId }, { studioId: null }], kategori: { sifat: 'TETAP', aktif: true } }, include: { kategori: true, bulanan: { where: { bulan } } }, orderBy: [{ urutan: 'asc' }, { nama: 'asc' }] })
  const per = new Map()
  for (const i of item) { const jml = i.bulanan[0]?.jumlah ?? i.jumlahBawaan; const e = per.get(i.kategori.nama) ?? { kategori: i.kategori.nama, jumlah: 0, item: [] }; e.jumlah = r2(e.jumlah + jml); e.item.push({ nama: i.nama, jumlah: jml, global: !i.studioId }); per.set(i.kategori.nama, e) }
  const struktur = [...per.values()].sort((a, b) => b.jumlah - a.jumlah)
  const tetapItem = r2(struktur.reduce((a, b) => a + b.jumlah, 0))
  // riwayat 3 bulan sebelum `bulan`
  const hist = []
  for (let k = 3; k >= 1; k--) { const d = new Date(bulan + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - k); const b = d.toISOString().slice(0, 7); const h = await hitung(studioId, b); hist.push({ bulan: b, masuk: h.masuk, tetap: h.tetap, variabel: h.variabel, kasAkhir: h.kasAkhir }) }
  const isi = hist.filter(h => h.masuk !== 0 || h.tetap + h.variabel !== 0)
  const rata = (f) => (isi.length ? r2(isi.reduce((a, h) => a + h[f], 0) / isi.length) : 0)
  const awal = await hitung(studioId, bulan)
  const asumsi = { masuk: ov.masuk ?? rata('masuk'), variabel: ov.variabel ?? rata('variabel'), tetap: ov.tetap ?? (tetapItem > 0 ? tetapItem : rata('tetap')) }
  const kasAwal = awal.kasAwal
  const skenario = rencanaKas({ kasAwal, bulanMulai: bulan, n, ...asumsi })
  return res.json({ success: true, data: { studioId, bulan, n, kasAwal, asumsi, sumberAsumsi: { masuk: ov.masuk != null ? 'diisi manual' : 'rata-rata 3 bulan terakhir', variabel: ov.variabel != null ? 'diisi manual' : 'rata-rata 3 bulan terakhir', tetap: ov.tetap != null ? 'diisi manual' : tetapItem > 0 ? 'total item tetap bulan ini' : 'rata-rata 3 bulan terakhir' }, struktur, totalTetapItem: tetapItem, riwayat: hist, skenario } })
})

// ── Tandai biaya rutin dibayar (12 Nov 2026) ──────────────────────────────────────────────────────────────────────────────
export const bayarRutin = wrap(async (req, res) => {
  const { studioId, bulan, baris, tanggal } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (!(await atasan(req, studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (await bulanTertutup(studioId, bulan)) return gagal(res, 409, 'Bulan ini sudah ditutup')
  const t = tgl(tanggal); if (!t) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (ISO(t).slice(0, 7) !== bulan) return gagal(res, 422, `Tanggal bayar harus di bulan ${bulan}`)
  const rekeningId = bacaRekeningId(req.body?.rekeningId) ?? null
  if (!(await rekeningSah(studioId, rekeningId))) return gagal(res, 422, 'Rekening bukan milik unit ini')
  if (!Array.isArray(baris) || !baris.length || baris.length > 200) return gagal(res, 422, 'Pilih baris biaya rutin (1–200)')
  const h = await hitung(studioId, bulan)
  const sah = new Set(h.baris.filter(b => b.sumber === 'BIO' || b.sumber === 'ITEM_TETAP').map(b => `${b.sumber}|${b.sumberId}`))
  if (baris.some(x => !sah.has(`${x?.sumber}|${x?.sumberId}`))) return gagal(res, 422, 'Ada baris yang bukan biaya rutin bulan ini')
  const oleh = await namaPengguna(req)
  await prisma.$transaction(baris.map(x => prisma.bayarRutin.upsert({ where: { studioId_bulan_sumber_sumberId: { studioId, bulan, sumber: x.sumber, sumberId: x.sumberId } }, update: { dibayarPada: t, rekeningId, oleh }, create: { studioId, bulan, sumber: x.sumber, sumberId: x.sumberId, dibayarPada: t, rekeningId, oleh } })))
  return res.json({ success: true, message: `${baris.length} biaya rutin ditandai dibayar` })
})
export const batalBayarRutin = wrap(async (req, res) => {
  const { studioId, bulan, sumber, sumberId } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (!(await atasan(req, studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (await bulanTertutup(studioId, bulan)) return gagal(res, 409, 'Bulan ini sudah ditutup')
  const r = await prisma.bayarRutin.deleteMany({ where: { studioId, bulan, sumber: String(sumber), sumberId: String(sumberId) } })
  return res.json({ success: true, message: r.count ? 'Tanda dibayar dibatalkan' : 'Tidak ada yang dibatalkan' })
})
