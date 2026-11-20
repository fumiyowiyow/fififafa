import { tautkanKlien } from './circleKlien.js'
import prisma from '../prisma.js'
import { canManageStudio, hasAnyRole, SUPER_ADMIN, bestLevel, ROLE_LEVEL, atasanLingkup, kelolaStudio } from '../utils/roles.js'
import { sinkronPenugasanTahap, talentUnit } from '../utils/penugasanDb.js'
import { pastikanFreelancer } from '../utils/freelancer.js'
import { kolomStudio, labelKhusus } from './circleKolomKhusus.js'
import { JENIS_KERJA } from '../utils/penugasan.js'
import { canManageProduksiOrder, hitungNilaiBersih, klienTampakNominal } from '../utils/produksi.js'
import { validasiUsd, rupiahDariUsd } from '../utils/uang.js'
import { catatAudit } from '../utils/auditOrder.js'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { tebakFungsi, validasiFungsi, masihDiUnit } from '../utils/fungsi.js'
import { PRESET, FASE, STATUS_DARI_JENIS, JENIS_REVISI, JENIS_MARKETER, bangunPreset, aksiTersedia, jenisNormal, tahapOpsionalAktif, langkahAktif, validasiTemplat, petakanTahapLama } from '../utils/alur.js'
import { kabarOrderBaru } from '../utils/notifGrup.js'
import { kanonKategori } from '../utils/kategori.js'
import { muatPosisiTagih } from '../utils/posisiTagihDb.js'
import { kunciTanggalWIB } from '../utils/jamKerja.js'

// API WEB CIRCLE — alur proses produksi per studio. Data tetap milik Ekosistem (satu database); web circle hanya
// klien API ini. Isolasi antar circle dijaga di SERVER: studio yang boleh dilihat SELALU diturunkan dari peran
// pengguna (canManageStudio) dan dari circle di alamat web yang dipakai, bukan dari klien.
// Mesin aturan alur ada di utils/alur.js (murni, diuji terpisah).

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const PENANDA_EKSPLISIT = '-' // pada Order.tahapAktif: pengaturan opsional sudah ditetapkan (walau semuanya mati)

// ── Templat ─────────────────────────────────────────────────────────────────────────────────────────────
const bacaTemplat = (studioId) => prisma.tahapProduksi.findMany({ where: { studioId }, orderBy: { urutan: 'asc' } })

// Templat dibuat saat pertama kali dibutuhkan (bawaan: "sederhana" — alur Daily Update PiBi); aman dipanggil paralel.
export async function pastikanTahap(studioId) {
  let daftar = await bacaTemplat(studioId)
  if (daftar.length === 0) {
    try {
      await bangunPreset('sederhana', (b) => prisma.tahapProduksi.create({ data: { studioId, ...b } }).then(x => x.id))
    } catch { /* balapan dengan permintaan lain: unik (studioId, nama) menolak duplikat — abaikan */ }
    daftar = await bacaTemplat(studioId)
  }
  // Pengaturan unit "semua hasil talent dicek admin (QC) dulu" (12 Nov 2026) ditempel ke daftar → dibaca aksiTersedia (utils/alur.js)
  daftar.qcSemua = !!(await prisma.pengaturanPenugasan.findUnique({ where: { studioId }, select: { qcSemua: true } }))?.qcSemua
  return daftar
}

// Order lama (sebelum ada alur) belum punya tahapId — dipetakan dari status/subStatus saat dibaca, TANPA menulis
// apa pun ke database sampai order itu dipindahkan.
export function tahapEfektif(order, tahap) {
  if (order.tahapId && tahap.some(t => t.id === order.tahapId)) return order.tahapId
  // Pilih HANYA dari langkah yang aktif untuk order ini — langkah opsional yang mati tidak punya jalan keluar.
  const aktif = langkahAktif(tahap, order.tahapAktif)
  const cari = (j) => aktif.find(t => jenisNormal(t.jenis) === j)?.id ?? null
  if (order.status === 'MASUK') return cari('MASUK')
  if (order.status === 'SELESAI') return cari('SELESAI')
  const sub = (order.subStatus ?? '').toLowerCase()
  if (/hold|tunda|tahan/.test(sub)) return cari('HOLD') ?? cari('KERJA')
  if (/revis/.test(sub)) return cari('REVISI_KLIEN') ?? cari('REVISI_INTERNAL') ?? cari('KERJA')
  if (/preview|check|cek|review/.test(sub)) return cari('PREVIEW_KLIEN') ?? cari('QC') ?? cari('KERJA')
  return cari('KERJA')
}

// ── Akses ───────────────────────────────────────────────────────────────────────────────────────────────
// DIGNITY (orang yang menerima uang, lihat memori project-dignity-menerima-uang), bukan keanggotaan kerja — tidak boleh membuka akses ke papan
// studio. (canManageStudio sendiri mengizinkan peran apa pun di studio itu, termasuk DIGNITY.)
export const peranKerja = (req) => (req.userRoles ?? []).filter(r => r.roleType !== 'DIGNITY')

// Token dari web circle terikat ke SATU circle/rumah usaha (klaim `cs`): studio di luar itu tidak terlihat walau
// orangnya punya peran di sana. Token dari Management Dashboard tidak dibatasi (peran saja).
const studioDiLingkup = async (req, studioId) => {
  if (req.user?.aud !== 'circle') return true
  const web = await resolveWeb(req)
  if (web.aud !== 'circle' || web.lingkup.slug !== req.user.cs) return false
  return !!(await prisma.studio.findFirst({ where: { id: studioId, AND: [whereLingkup(web.lingkup)] }, select: { id: true } })) // termasuk unit di bawah Korporasi (9 Nov 2026)
}

// ── PEMILIK unit (penerima SHU, tabel StudioPemilik) — MODE LIHAT SAJA (keputusan user 21 Okt 2026) ─────────────────────
// Pemilik boleh MELIHAT proses & uang unitnya (seperti koordinator) tetapi TIDAK mengisi/mengubah apa pun: akses lewat status pemilik
// hanya berlaku untuk permintaan baca (GET/HEAD). Permintaan tulis tetap memakai peran kerjanya sendiri (bila ada). Data pribadi orang
// lain (gaji/lembur per orang, refleksi, alasan izin, profil SDM, riwayat login) tetap tertutup — lihat `lihatSaja` di pemakainya.
export const permintaanBaca = (req) => ['GET', 'HEAD'].includes(req.method)
export async function pemilikStudio(req, studioId) {
  if (!studioId || !req.user?.id) return false
  req._pemilik ??= new Map()
  if (!req._pemilik.has(studioId)) req._pemilik.set(studioId, !!(await prisma.studioPemilik.findFirst({ where: { userId: req.user.id, studioId }, select: { id: true } })))
  return req._pemilik.get(studioId)
}

/** Modul uang per unit (Kas, Buku besar, Kaizen, Keuangan): pengelola unit (kelolaStudio), atau pemilik unit untuk permintaan BACA. */
export async function pengelolaAtauPemilikBaca(req, studioId) {
  if (await kelolaStudio(peranKerja(req), studioId)) return true
  return permintaanBaca(req) && (await pemilikStudio(req, studioId))
}
/** Pemilik di unit mana pun (untuk gerbang modul yang tidak per unit, mis. daftar kategori). */
export const pemilikDiManaPun = async (req) => !!req.user?.id && !!(await prisma.studioPemilik.findFirst({ where: { userId: req.user.id }, select: { id: true } }))

export async function studioBolehDilihat(req, studioId) {
  if (!studioId) return false
  if (!(await studioDiLingkup(req, studioId))) return false
  if (await canManageStudio(peranKerja(req), studioId)) return true
  return permintaanBaca(req) && (await pemilikStudio(req, studioId))
}

// Mode per studio: 'kelola' (Koordinator ke atas / Admin Market: papan penuh + nilai uang + QC), 'marketing' (fungsi
// MARKETER yang sudah dikonfirmasi: memegang fase Klien/Delivery/Selesai, aktivitas pemasaran), atau 'tugas'
// (artist/anggota lain: HANYA tugasnya sendiri, tanpa nilai uang) — keputusan user 19–21 Okt 2026.
// QC & Preview Klien: Koordinator ATAU Admin (= mode 'kelola'); marketer memegang fase milik klien (acuan OGS).
const adalahManajer = (req, studioId) => canManageProduksiOrder(peranKerja(req), req.user.id, studioId)
const adalahMarketer = async (userId, studioId) => !!(await prisma.fungsiAnggota.findFirst({ where: { userId, studioId, fungsi: 'MARKETER', user: masihDiUnit(studioId) }, select: { id: true } }))
// WAKIL FREELANCE (keputusan user 9 Nov 2026): freelance tidak punya akun di web circle, jadi tahap kerjanya digerakkan oleh MARKETER yang
// memegang order itu (marketerId) — hanya aksi "talent" (mulai, lanjut tahap, siap QC, revisi selesai); QC tetap Koordinator/Admin.
// Berlaku bila order TIDAK punya talent internal (tak ada penugasan ber-akun) — baik freelancer sudah dicatat (namaEksternal) maupun belum
// (diperluas 9 Nov 2026: banyak order freelance tidak mencatat nama freelancer). Begitu talent internal ditugaskan, talent itulah yang menggerakkan.
// Freelance sendiri tetap tanpa akses apa pun.
export const wakilFreelance = (order, userId) => !!userId && order.marketerId === userId && !(order.assignments ?? []).some(a => a.userId ?? a.user?.id)
export async function peranStudio(req, studioId) {
  // `pengelola` = Koordinator/Pendamping unit ini ke atas (kelolaStudio). `adminMarket` = hanya pemegang akses Admin Market (ProduksiAdminMarket):
  // mengelola ORDER/proses unit, tetapi BUKAN pengelola SDM — presensi tim, izin, refleksi & profil SDM anggota tetap tertutup (27 Okt 2026).
  const pengelola = await kelolaStudio(peranKerja(req), studioId)
  const adminMarket = !pengelola && (await adalahManajer(req, studioId))
  const manajerAsli = pengelola || adminMarket
  const marketer = await adalahMarketer(req.user.id, studioId)
  // Pemilik: saat MEMBACA diperlakukan seperti manajer (lihat seluruh proses & uang unit); `lihatSaja` menandai bahwa wewenang itu
  // hanya dari status pemilik — dipakai untuk menutup data pribadi orang lain & menyembunyikan tombol ubah di tampilan.
  const lihatSaja = !manajerAsli && permintaanBaca(req) && (await pemilikStudio(req, studioId))
  const manajer = manajerAsli || lihatSaja
  // ADMIN PER AKUN JUALAN (12 Nov 2026, masukan tim): Koordinator bisa menugaskan akun jualan ke tiap Admin Market (mis. Admin Etsy, Admin LTK).
  // `akunAdmin` = daftar akun admin itu → ia hanya melihat & mengelola order dari akun tersebut. null = tidak dibatasi (belum ditugaskan,
  // atau bukan Admin Market). Pengelola unit & pemilik tidak pernah dibatasi.
  const akunAdmin = adminMarket ? ((await prisma.produksiAdminMarket.findUnique({ where: { userId_studioId: { userId: req.user.id, studioId } }, select: { akunIds: true } }))?.akunIds ?? []) : []
  return { manajer, marketer, lihatSaja, pengelola, adminMarket, akunAdmin: akunAdmin.length ? akunAdmin : null, mode: manajer ? 'kelola' : marketer ? 'marketing' : 'tugas' }
}
// Saringan prisma untuk DAFTAR order: Admin Market yang dibatasi hanya mendapat order dari akunnya.
export const saringAkun = (p) => (p?.akunAdmin ? { akunId: { in: p.akunAdmin } } : {})
export const orderDalamAkun = (p, order) => !p?.akunAdmin || p.akunAdmin.includes(order?.akunId)
// Peran untuk SATU order: di luar akunnya, Admin Market diperlakukan bukan pengelola order (jatuh ke peran marketer/talent bila ada).
export async function peranOrder(req, order) {
  const p = await peranStudio(req, order.studioId)
  if (orderDalamAkun(p, order)) return p
  return { ...p, manajer: false, adminMarket: false, diluarAkun: true, mode: p.marketer ? 'marketing' : 'tugas' }
}
async function modeStudio(req, studioId) { return (await peranStudio(req, studioId)).mode }

// ── Penerapan perpindahan tahap (dipakai aksi mesin & pemindahan manual) ──────────────────────────────────
export async function terapkanPindah({ order, tahapAsal, tujuan, userId, extra = {}, tunda = false, manual = false }) {
  const pengguna = await prisma.user.findUnique({ where: { id: userId }, select: { nama: true } })
  const sekarang = new Date()
  const jt = jenisNormal(tujuan.jenis)
  const masukRevisi = JENIS_REVISI.includes(jt) && !JENIS_REVISI.includes(jenisNormal(tahapAsal?.jenis))
  await prisma.$transaction([
    prisma.riwayatTahapOrder.updateMany({ where: { orderId: order.id, selesai: null }, data: { selesai: sekarang } }),
    prisma.riwayatTahapOrder.create({ data: { orderId: order.id, namaTahap: tujuan.nama, jenis: jt, userId, namaPengguna: pengguna?.nama ?? null, mulai: sekarang } }),
    prisma.orderProduksi.update({
      where: { id: order.id },
      data: {
        tahapId: tujuan.id, subStatus: tujuan.nama, status: STATUS_DARI_JENIS[jt],
        ...(masukRevisi ? { revisiKe: { increment: 1 } } : {}),
        tanggalSelesai: jt === 'SELESAI' ? (order.tanggalSelesai ?? sekarang) : null,
        ...(jt !== 'SELESAI' ? { cancelKlien: false, cancelPada: null, alasanCancel: null } : {}), // dibuka kembali dari Selesai/Cancel → tanda Cancel dilepas
        ...extra,
      },
    }),
  ])
  // Update klien otomatis (10 Nov 2026): keluar dari Preview klien (klien merespons: setuju/revisi/menunggu) atau Delivery (terkirim) = kontak ke klien
  try {
    const aj = jenisNormal(tahapAsal?.jenis)
    if (aj === 'PREVIEW_KLIEN' || aj === 'DELIVERY') await prisma.updateKlien.create({ data: { orderId: order.id, studioId: order.studioId, jenis: aj === 'PREVIEW_KLIEN' ? 'PREVIEW' : 'DELIVER', otomatis: true, dicatatOlehId: userId, dicatatOleh: pengguna?.nama ?? null, catatan: `Otomatis: ${tahapAsal.nama} → ${tujuan.nama}` } })
  } catch { /* abaikan */ }
  // penugasan per tahap (adaptasi OGS): tutup baris tahap lama, buka baris untuk tahap kerja baru. Gagal di sini tidak boleh menggagalkan perpindahan.
  try { await sinkronPenugasanTahap({ order, tujuan, pengguna: pengguna?.nama, tunda, manual }) } catch { /* abaikan: analitik jatuh kembali ke atribusi per order */ }
}

export const riwayatOrder = async (ids) => {
  const baris = await prisma.riwayatTahapOrder.findMany({ where: { orderId: { in: ids } }, orderBy: { mulai: 'asc' }, select: { orderId: true, namaTahap: true, jenis: true } })
  return baris
}
// Riwayat dicocokkan ke tahap lewat NAMA (riwayat menyimpan nama, bukan FK, supaya tetap utuh walau templat diubah)
export const jejakUntuk = (baris, templat) => baris.map(r => ({ tahapId: templat.find(t => t.nama === r.namaTahap)?.id ?? null, jenis: r.jenis })).filter(x => x.tahapId)

// ── Endpoint ────────────────────────────────────────────────────────────────────────────────────────────
export const getSaya = async (req, res) => {
  try {
    const studios = await prisma.studio.findMany({
      where: { statusAktif: true },
      select: { id: true, nama: true, tipe: true, circle: { select: { id: true, nama: true } }, rumahUsaha: { select: { id: true, nama: true } }, induk: { select: { id: true, nama: true } } }, // induk = Korporasi (pengelompokan di menu)
      orderBy: { nama: 'asc' },
    })
    const hasil = []
    for (const s of studios) {
      if (!(await studioBolehDilihat(req, s.id))) continue
      const { manajer, marketer, mode, lihatSaja, adminMarket } = await peranStudio(req, s.id)
      const fungsi = (await prisma.fungsiAnggota.findMany({ where: { userId: req.user.id, studioId: s.id }, select: { fungsi: true } })).map(f => f.fungsi)
      hasil.push({ ...s, mode, bisaUbah: manajer && !lihatSaja, lihatSaja, adminMarket, marketer, fungsi })
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, nama: true } })
    const web = await resolveWeb(req)
    const atasan = web.aud === 'circle' ? atasanLingkup(peranKerja(req), web.lingkup) : hasAnyRole(peranKerja(req), SUPER_ADMIN) || bestLevel(peranKerja(req)) <= ROLE_LEVEL.KEPALA_CIRCLE
    return res.json({ success: true, data: { user, studios: hasil, superAdmin: hasAnyRole(peranKerja(req), SUPER_ADMIN), atasan } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

export const getPapan = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
    const peranP = await peranStudio(req, studioId), mode = peranP.mode
    // Pemilik unit (lihatSaja) melihat papan penuh, tetapi TOMBOL hanya yang memang boleh ia jalankan (sebagai marketer / talent / wakil
    // freelance) — dulu tombol koordinator ikut tampil lalu ditolak server saat diklik (laporan Nadia, 9 Nov 2026).
    const lihatSaja = !!peranP.lihatSaja
    // "Pantau produksi" (permintaan user 27 Okt 2026): marketer melihat papan LIHAT SAJA — tanpa aksi, tanpa daftar anggota, dan nilai uang
    // hanya untuk order yang ia pegang (aturan keras 2). Talent tetap ditolak (hanya Tugas Saya).
    const pantau = mode === 'marketing'
    if (mode !== 'kelola' && !pantau) return gagal(res, 403, 'Papan penuh hanya untuk Koordinator ke atas — buka Tugas Saya')
    const tahap = await pastikanTahap(studioId)

    const sekarang = new Date()
    const awalBulan = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), 1))
    const akhirBulan = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() + 1, 1))

    const orders = await prisma.orderProduksi.findMany({
      where: {
        studioId, status: { not: 'BATAL' }, ...saringAkun(peranP), // Admin per akun: hanya order akunnya
        OR: [
          { status: { in: ['MASUK', 'PROSES'] } },
          { status: 'SELESAI', OR: [{ tanggalSelesai: { gte: awalBulan, lt: akhirBulan } }, { tanggalSelesai: null, updatedAt: { gte: awalBulan, lt: akhirBulan } }] },
        ],
      },
      include: { assignments: { where: { berhentiPada: null }, select: { id: true, namaEksternal: true, user: { select: { id: true, nama: true } } } } }, // talent aktif saja (berhenti = tidak di papan, 14 Nov 2026)
      orderBy: [{ deadline: 'asc' }, { tanggalMasuk: 'desc' }],
    })
    const jejak = await riwayatOrder(orders.map(o => o.id))
    const perOrder = new Map()
    for (const r of jejak) (perOrder.get(r.orderId) ?? perOrder.set(r.orderId, []).get(r.orderId)).push(r)

    // Ringkasan bulan berjalan (seperti Total / Total Done / Belum Selesai di sheet Daily Update)
    const kolomKhusus = await kolomStudio(studioId) // label kolom khusus di kartu (12 Nov 2026)
    const { jumlahMasukBulanIni, selesaiBulanIni, total, done, delivery } = await ringkasanBulan(studioId, peranP)

    const unik = new Map([...(await talentUnit(studioId))].map(([id, nama]) => [id, { id, nama }])) // pilihan talent Buat order: hanya Artist bila Fungsi sudah diatur

    if (pantau) {
      return res.json({
        success: true,
        data: {
          studioId, bisaUbah: false, pantau: true,
          tahap: tahap.map(t => ({ id: t.id, nama: t.nama, jenis: jenisNormal(t.jenis), indukId: t.indukId, opsional: t.opsional, aktifBawaan: t.aktifBawaan, urutan: t.urutan })),
          fase: FASE.map(f => ({ kunci: f.kunci, label: f.label, jenis: f.jenis, langkah: tahap.filter(t => f.jenis.includes(jenisNormal(t.jenis))).map(t => t.id) })).filter(f => f.langkah.length > 0),
          orders: orders.map(o => {
            const milik = o.marketerId === req.user.id
            // Aksi di papan pantau = yang memang boleh untuk marketer menurut mesin alur: fase klien (seperti Antrean klien) +
            // tahap kerja bila ia ditugaskan langsung ATAU menjadi wakil freelance order yang ia pegang. QC tetap Koordinator/Admin.
            const wakil = wakilFreelance(o, req.user.id)
            const ditugaskan = wakil || o.assignments.some(a => a.user?.id === req.user.id)
            const sekarangT = tahap.find(t => t.id === tahapEfektif(o, tahap))
            const aksi = aksiTersedia({ templat: tahap, order: o, sekarang: sekarangT, riwayat: jejakUntuk(perOrder.get(o.id) ?? [], tahap), peran: { manajer: false, ditugaskan, marketer: true } })
            return {
              id: o.id, judul: o.judul, klien: o.klien, tipeKlien: o.tipeKlien, milikSaya: milik, wakilFreelance: wakil, cancelKlien: o.cancelKlien,
              nilaiDisepakati: milik ? o.nilaiDisepakati : null, nilaiBersih: milik ? o.nilaiBersih : null, statusBayar: milik ? o.statusBayar : null,
              deadline: o.deadline, tanggalMasuk: o.tanggalMasuk, revisiKe: o.revisiKe,
              tahapId: tahapEfektif(o, tahap), tahapAktif: [...tahapOpsionalAktif(tahap, o.tahapAktif)], aksi: aksi.map(a => ({ aksi: a.aksi, label: a.label, ke: a.ke })),
              talent: o.assignments.map(a => a.user?.nama ?? a.namaEksternal).filter(Boolean), khusus: labelKhusus(kolomKhusus, o.isianKhusus), adaTalentInternal: o.assignments.some(a => a.user),
            }
          }),
          ringkasan: { jumlahMasukBulanIni, jumlahSelesai: selesaiBulanIni, total: null, done: null, delivery: null, belumSelesai: null, dikerjakan: null },
          anggota: [],
        },
      })
    }

    return res.json({
      success: true,
      data: {
        studioId,
        bisaUbah: !lihatSaja,
        // terbatas = pemilik (lihat saja): tanpa menu ⋯ / pindah manual; tombol hanya aksi miliknya. Tambah order tetap boleh bila ia marketer.
        terbatas: lihatSaja, bisaTambah: !lihatSaja || !!peranP.marketer,
        tahap: tahap.map(t => ({ id: t.id, nama: t.nama, jenis: jenisNormal(t.jenis), indukId: t.indukId, opsional: t.opsional, aktifBawaan: t.aktifBawaan, urutan: t.urutan })),
        fase: FASE.map(f => ({ kunci: f.kunci, label: f.label, jenis: f.jenis, langkah: tahap.filter(t => f.jenis.includes(jenisNormal(t.jenis))).map(t => t.id) })).filter(f => f.langkah.length > 0),
        orders: orders.map(o => {
          const tid = tahapEfektif(o, tahap)
          const sekarangT = tahap.find(t => t.id === tid)
          const ditugaskanAsli = o.assignments.some(a => a.user?.id === req.user.id)
          const peranAksi = lihatSaja
            ? { manajer: false, ditugaskan: ditugaskanAsli || wakilFreelance(o, req.user.id), marketer: !!peranP.marketer }
            : { manajer: true, ditugaskan: ditugaskanAsli, marketer: true }
          const aksi = aksiTersedia({ templat: tahap, order: o, sekarang: sekarangT, riwayat: jejakUntuk(perOrder.get(o.id) ?? [], tahap), peran: peranAksi })
          return {
            ...(lihatSaja ? { wakilFreelance: wakilFreelance(o, req.user.id) } : {}),
            id: o.id, judul: o.judul, klien: o.klien, tipeKlien: o.tipeKlien, cancelKlien: o.cancelKlien,
            nilaiDisepakati: o.nilaiDisepakati, nilaiBersih: o.nilaiBersih,
            deadline: o.deadline, tanggalMasuk: o.tanggalMasuk, revisiKe: o.revisiKe, statusBayar: o.statusBayar,
            tahapId: tid, tahapAktif: [...tahapOpsionalAktif(tahap, o.tahapAktif)],
            aksi: aksi.map(a => ({ aksi: a.aksi, label: a.label, ke: a.ke })),
            talent: o.assignments.map(a => a.user?.nama ?? a.namaEksternal).filter(Boolean), khusus: labelKhusus(kolomKhusus, o.isianKhusus), adaTalentInternal: o.assignments.some(a => a.user),
          }
        }),
        ringkasan: { jumlahMasukBulanIni, jumlahSelesai: selesaiBulanIni, total, done, delivery, belumSelesai: total - done, dikerjakan: total - done - delivery },
        anggota: [...unik.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
      },
    })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

export async function akunInternal(studioId) {
  const ada = await prisma.akunProduksi.findUnique({ where: { studioId_namaAkun: { studioId, namaAkun: 'Order Internal' } } })
  return ada ?? prisma.akunProduksi.create({ data: { studioId, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
}

// Akun jualan WAJIB dipilih untuk order baru (keputusan user 21 Okt 2026): fee platform menentukan nilai bersih, dan Penjualan/Laporan Mingguan
// membaca platform akun. Nilai khusus 'INTERNAL' = order internal tanpa platform (akun sistem "Order Internal", fee 0).
export async function akunUntukOrder(studioId, akunId) {
  if (!akunId) return { galat: 'Pilih akun jualan order ini (atau "Order internal" bila tanpa platform)' }
  if (akunId === 'INTERNAL') return { akun: await akunInternal(studioId) }
  const akun = await prisma.akunProduksi.findFirst({ where: { id: String(akunId), studioId } })
  return akun ? { akun } : { galat: 'Akun jualan bukan milik unit ini' }
}
export const tanggalSah = (s) => (s == null || s === '' ? null : /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z')) ? new Date(s + 'T00:00:00.000Z') : undefined) // undefined = tidak sah

export const buatOrder = async (req, res) => {
  try {
    const { studioId, judul, klien, tipeKlien, nilaiDisepakati, deadline, talentUserId } = req.body
    if (!studioId || !judul?.trim() || !klien?.trim()) return gagal(res, 422, 'studioId, judul, dan klien wajib diisi')
    if (klienTampakNominal(klien)) return gagal(res, 422, `Nama klien "${String(klien).trim().slice(0, 30)}" tampak seperti nominal uang. Isi nama klien yang benar (nilai diisi di kolom Nilai).`)
    const tglDeadline = tanggalSah(deadline); if (tglDeadline === undefined) return gagal(res, 422, 'Deadline harus YYYY-MM-DD')
    const peranBuat = await peranStudio(req, studioId)
    if (!(await studioBolehDilihat(req, studioId)) || !(peranBuat.manajer || peranBuat.marketer)) {
      return gagal(res, 403, 'Hanya Koordinator ke atas atau Marketer studio ini yang bisa menambah order')
    }
    const { mataUang, nilaiUsd, kurs } = req.body
    const galatUsd = validasiUsd({ mataUang, nilaiUsd, kurs }); if (galatUsd) return gagal(res, 422, galatUsd)
    const usd = mataUang === 'USD'
    const nilai = usd ? rupiahDariUsd(nilaiUsd, kurs) : (nilaiDisepakati == null || nilaiDisepakati === '' ? 0 : Number(nilaiDisepakati))
    if (!Number.isFinite(nilai) || nilai < 0) return gagal(res, 422, 'Nilai harus angka >= 0')
    const tipe = ['INTERNAL_EKOSISTEM', 'INTERNAL_JRU_LAIN', 'EKSTERNAL'].includes(tipeKlien) ? tipeKlien : 'INTERNAL_JRU_LAIN'
    if (talentUserId) {
      const peran = await prisma.userRole.findFirst({ where: { userId: talentUserId, studioId } })
      if (!peran) return gagal(res, 422, 'Talent bukan anggota studio ini')
    }
    // Talent freelance (9 Nov 2026, permintaan tim): cukup NAMA (freelance tidak punya akun) → masuk tim order sebagai pihak luar,
    // ditautkan ke data freelancer Ekosistem bila namanya cocok. Satu order: talent internal ATAU freelance.
    const namaFreelance = String(req.body.namaFreelance ?? '').trim()
    if (namaFreelance.length > 200) return gagal(res, 422, 'Nama freelance maksimal 200 huruf')
    if (namaFreelance && talentUserId) return gagal(res, 422, 'Pilih salah satu: talent internal atau freelance')
    // Tambah order sekalian lengkap (13 Nov 2026, masukan tim): kategori & fee talent bisa diisi saat membuat order.
    // Fee = uang per orang → hanya pengelola (sama dengan "ubah fee" di detail order); marketer tidak.
    let kategori = null
    if (String(req.body.kategori ?? '').trim()) { const kk = await kanonKategori(studioId, String(req.body.kategori).trim().slice(0, 250)); if (kk?.galat) return gagal(res, 422, kk.galat); kategori = kk }
    let feeTalent = null
    if (req.body.feeTalent != null && req.body.feeTalent !== '') {
      if (!peranBuat.manajer || peranBuat.lihatSaja) return gagal(res, 403, 'Fee talent hanya diisi Koordinator / admin')
      if (!talentUserId && !namaFreelance) return gagal(res, 422, 'Pilih talent dulu sebelum mengisi fee')
      const f = Number(req.body.feeTalent); if (!Number.isFinite(f) || f < 0 || f > 1000000000) return gagal(res, 422, 'Fee harus angka 0–1.000.000.000 (Rp)'); feeTalent = Math.round(f)
    }
    const talentEks = namaFreelance ? { id: await pastikanFreelancer(studioId, namaFreelance) } : null // otomatis masuk menu Freelancer (lingkup circle ini)
    const pilihAkun = await akunUntukOrder(studioId, req.body.akunId); if (pilihAkun.galat) return gagal(res, 422, pilihAkun.galat)
    const akun = pilihAkun.akun
    if (!peranBuat.marketer && !orderDalamAkun(peranBuat, { akunId: akun.id })) return gagal(res, 403, 'Akun jualan ini bukan tanggung jawabmu — pilih akun yang ditugaskan kepadamu')
    const [tahap, pengguna] = await Promise.all([
      pastikanTahap(studioId),
      prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }),
    ])
    const klienDir = await tautkanKlien(studioId, klien, akun.platform) // direktori klien: ejaan disamakan, klien baru otomatis tercatat
    const inbox = tahap.find(t => jenisNormal(t.jenis) === 'MASUK')
    // Pengaturan tahap opsional DIBEKUKAN saat order dibuat (perubahan bawaan templat nanti tidak menggeser order berjalan).
    const aktifAwal = [PENANDA_EKSPLISIT, ...tahap.filter(t => t.opsional && t.aktifBawaan).map(t => t.id)]
    const order = await prisma.orderProduksi.create({
      data: {
        studioId, akunId: akun.id, tipeKlien: tipe, klien: klienDir?.nama ?? klien.trim(), klienId: klienDir?.id ?? null, judul: judul.trim(),
        nilaiDisepakati: nilai, nilaiKotor: nilai, nilaiBersih: hitungNilaiBersih(nilai, akun.feePersen),
        status: 'MASUK', subStatus: inbox.nama, tahapId: inbox.id, tahapAktif: aktifAwal,
        marketerId: peranBuat.marketer ? req.user.id : null,
        deadline: tglDeadline, kategori,
        ...(usd ? { mataUang: 'USD', kurs: Number(kurs), nilaiUsd: Number(nilaiUsd) } : {}),
        ...(talentUserId ? { assignments: { create: { userId: talentUserId, feeTalent } } } : namaFreelance ? { assignments: { create: { namaEksternal: namaFreelance, tipeEksternal: 'FREELANCER_PERORANGAN', talentEksternalId: talentEks?.id ?? null, feeTalent } } } : {}),
        riwayatTahap: { create: { namaTahap: inbox.nama, jenis: jenisNormal(inbox.jenis), userId: req.user.id, namaPengguna: pengguna?.nama ?? null } },
      },
    })
    await catatAudit(order.id, req.user.id, 'BUAT', [{ field: 'order', dari: null, ke: `${order.judul} · ${order.klien} · ${akun.namaAkun} · Rp ${Math.round(nilai)}${usd ? ` (USD ${nilaiUsd} × ${kurs})` : ''}` }])
    kabarOrderBaru(order.id) // grup Telegram koordinator (12 Nov 2026); tidak ditunggu
    return res.status(201).json({ success: true, data: { id: order.id } })
  } catch {
    return gagal(res, 500, 'Gagal menambah order')
  }
}

// Aksi mesin alur pada satu order — SATU pintu untuk koordinator/admin (semua aksi) dan talent (hanya aksi yang
// diizinkan mesin untuk tugasnya sendiri). Tujuan ditentukan SERVER dari tahap sekarang; klien hanya mengirim nama aksi.
const buatAksiOrder = (soloDitugaskan) => async (req, res) => {
  try {
    const { aksi } = req.body
    const order = await prisma.orderProduksi.findUnique({ where: { id: req.params.id }, include: { assignments: { where: { berhentiPada: null }, select: { userId: true, namaEksternal: true } } } }) // talent yang berhenti tidak bisa menggerakkan tahap
    if (!order) return gagal(res, 404, 'Order tidak ditemukan')
    const ditugaskan = order.assignments.some(a => a.userId === req.user.id) || (!soloDitugaskan && wakilFreelance(order, req.user.id))
    const { manajer, marketer } = await peranOrder(req, order) // Admin per akun: order di luar akunnya → bukan pengelola
    if ((soloDitugaskan && !ditugaskan) || (!manajer && !ditugaskan && !marketer)) return gagal(res, 404, 'Tugas tidak ditemukan')
    if (!(await studioBolehDilihat(req, order.studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
    if (order.status === 'BATAL') return gagal(res, 409, 'Order ini dibatalkan')

    const tahap = await pastikanTahap(order.studioId)
    const sekarang = tahap.find(t => t.id === tahapEfektif(order, tahap))
    const jejak = jejakUntuk(await riwayatOrder([order.id]), tahap)
    const pilihan = aksiTersedia({ templat: tahap, order, sekarang, riwayat: jejak, peran: { manajer, ditugaskan, marketer } })
    const a = pilihan.find(x => x.aksi === aksi)
    if (!a) return gagal(res, 409, 'Aksi ini tidak tersedia untuk tahap sekarang — mungkin sudah diubah orang lain. Muat ulang.')
    const tujuan = tahap.find(t => t.id === a.ke)
    // antrean:false (12 Nov 2026, masukan tim) = pengelola memindah kartu tapi pekerjaan belum untuk hari ini → tugas talent dibuat DITUNDA
    await terapkanPindah({ order, tahapAsal: sekarang, tujuan, userId: req.user.id, tunda: manajer && req.body?.antrean === false })
    return res.json({ success: true, data: { id: order.id, tahap: tujuan.nama } })
  } catch {
    return gagal(res, 500, 'Gagal memperbarui order')
  }
}

export const aksiOrder = buatAksiOrder(false)   // koordinator/admin (semua order studio) atau talent (tugasnya)
export const aksiTugas = buatAksiOrder(true)    // jalur talent: hanya order yang ditugaskan kepadanya

// Pemindahan MANUAL oleh manajer (menimpa mesin: koreksi data / order lama). Aksi biasa lewat aksiOrder.
export const pindahTahap = async (req, res) => {
  try {
    const { tahapId, nilaiRiil } = req.body
    const order = await prisma.orderProduksi.findUnique({ where: { id: req.params.id }, include: { akun: true } })
    if (!order) return gagal(res, 404, 'Order tidak ditemukan')
    if (!(await studioBolehDilihat(req, order.studioId)) || !(await peranOrder(req, order)).manajer || !(await adalahManajer(req, order.studioId))) {
      return gagal(res, 403, 'Hanya Koordinator ke atas yang bisa memindahkan tahap')
    }
    const tahap = await pastikanTahap(order.studioId)
    const tujuan = tahap.find(t => t.id === (tahapId ?? ''))
    if (!tujuan) return gagal(res, 422, 'Tahap tidak valid untuk studio ini')
    const asal = tahap.find(t => t.id === tahapEfektif(order, tahap))
    if (asal?.id === tujuan.id) return res.json({ success: true, data: { id: order.id, tidakBerubah: true } })

    const extra = {}
    // Kembali dari QC ke langkah kerja sebelumnya (revisi hasil kurasi, 12 Nov 2026 masukan tim) = satu putaran revisi, seperti "QC gagal"
    if (jenisNormal(asal?.jenis) === 'QC' && jenisNormal(tujuan.jenis) === 'KERJA' && tujuan.urutan < asal.urutan) extra.revisiKe = { increment: 1 }
    if (nilaiRiil != null && nilaiRiil !== '') {
      const v = Number(nilaiRiil)
      if (!Number.isFinite(v) || v < 0) return gagal(res, 422, 'Nilai riil harus angka >= 0')
      extra.nilaiKotor = v
      extra.nilaiBersih = hitungNilaiBersih(v, order.akun.feePersen)
    }
    await terapkanPindah({ order, tahapAsal: asal, tujuan, userId: req.user.id, extra, tunda: req.body?.antrean === false, manual: true })
    return res.json({ success: true, data: { id: order.id } })
  } catch {
    return gagal(res, 500, 'Gagal memindahkan tahap')
  }
}

// Nyalakan/matikan tahap OPSIONAL untuk satu order (manajer). Tahap tempat order berada tidak boleh dimatikan.
export const aturOpsional = async (req, res) => {
  try {
    const { tahapAktif } = req.body
    if (!Array.isArray(tahapAktif)) return gagal(res, 422, 'tahapAktif harus berupa daftar id tahap')
    const order = await prisma.orderProduksi.findUnique({ where: { id: req.params.id } })
    if (!order) return gagal(res, 404, 'Order tidak ditemukan')
    if (!(await studioBolehDilihat(req, order.studioId)) || !(await peranOrder(req, order)).manajer || !(await adalahManajer(req, order.studioId))) return gagal(res, 403, 'Hanya Koordinator ke atas')
    const tahap = await pastikanTahap(order.studioId)
    const opsional = new Set(tahap.filter(t => t.opsional).map(t => t.id))
    if (!tahapAktif.every(id => opsional.has(id))) return gagal(res, 422, 'Hanya tahap opsional yang bisa diatur')
    const sekarang = tahapEfektif(order, tahap)
    if (opsional.has(sekarang) && !tahapAktif.includes(sekarang)) return gagal(res, 409, 'Order sedang berada di tahap ini — pindahkan dulu sebelum mematikannya')
    await prisma.orderProduksi.update({ where: { id: order.id }, data: { tahapAktif: [PENANDA_EKSPLISIT, ...tahapAktif] } })
    return res.json({ success: true, data: { id: order.id } })
  } catch {
    return gagal(res, 500, 'Gagal mengatur tahap opsional')
  }
}

// ── Templat per studio ──────────────────────────────────────────────────────────────────────────────────
export const getTemplat = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
    if (!(await adalahManajer(req, studioId))) return gagal(res, 403, 'Pengaturan alur hanya untuk Koordinator ke atas')
    const tahap = await pastikanTahap(studioId)
    const terpakai = await prisma.orderProduksi.groupBy({ by: ['tahapId'], where: { studioId, tahapId: { in: tahap.map(t => t.id) } }, _count: true })
    const hitung = Object.fromEntries(terpakai.map(x => [x.tahapId, x._count]))
    return res.json({
      success: true,
      data: {
        langkah: tahap.map(t => ({ id: t.id, urutan: t.urutan, nama: t.nama, jenis: jenisNormal(t.jenis), indukId: t.indukId, opsional: t.opsional, aktifBawaan: t.aktifBawaan, order: hitung[t.id] ?? 0 })),
        preset: Object.entries(PRESET).map(([kunci, p]) => ({ kunci, label: p.label })),
        qcSemua: !!tahap.qcSemua,
      },
    })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

// QC SEMUA (12 Nov 2026, masukan tim): nyalakan/matikan "semua hasil talent dicek admin (QC) dulu" untuk unit ini. Butuh langkah QC di alur.
export const simpanQcSemua = async (req, res) => {
  try {
    const { studioId, aktif } = req.body ?? {}
    if (!(await studioBolehDilihat(req, studioId)) || !(await adalahManajer(req, studioId))) return gagal(res, 403, 'Pengaturan alur hanya untuk Koordinator ke atas')
    const v = !!aktif
    if (v && !(await pastikanTahap(studioId)).some(t => jenisNormal(t.jenis) === 'QC')) return gagal(res, 422, 'Alur unit ini belum punya langkah QC — tambahkan gerbang QC di Alur dulu')
    await prisma.pengaturanPenugasan.upsert({ where: { studioId }, update: { qcSemua: v }, create: { studioId, qcSemua: v } })
    return res.json({ success: true, data: { qcSemua: v }, message: v ? 'Semua hasil talent kini masuk QC dulu' : 'Hasil talent kembali mengikuti urutan alur' })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

// Simpan templat: { preset } (ganti seluruhnya, hanya bila belum ada order yang memakai langkah lama) ATAU
// { langkah: [{ id?, kunci?, nama, jenis, indukId?, urutan, opsional, aktifBawaan }] } (sunting: ubah nama/urutan/opsional;
// jenis & induk hanya untuk langkah yang belum dipakai order; hapus hanya langkah yang belum dipakai order).
export const simpanTemplat = async (req, res) => {
  try {
    const { studioId } = req.query
    const { preset, langkah } = req.body
    if (!(await studioBolehDilihat(req, studioId)) || !(await adalahManajer(req, studioId))) return gagal(res, 403, 'Pengaturan alur hanya untuk Koordinator ke atas')
    const lama = await bacaTemplat(studioId)
    const dipakai = new Set((await prisma.orderProduksi.findMany({ where: { studioId, tahapId: { in: lama.map(t => t.id) } }, select: { tahapId: true }, distinct: ['tahapId'] })).map(x => x.tahapId))

    if (preset) {
      if (!PRESET[preset]) return gagal(res, 422, 'Preset tidak dikenal')
      if (dipakai.size > 0 && req.body.pindahkanOrder !== true) return gagal(res, 409, 'Sudah ada order yang memakai alur sekarang. Setujui pemindahan otomatis order ke langkah yang paling mirip, atau ubah nama/urutan lewat penyuntingan.')
      if (dipakai.size === 0) {
        await prisma.$transaction(async (tx) => {
          await tx.tahapProduksi.deleteMany({ where: { studioId } })
          await bangunPreset(preset, (b) => tx.tahapProduksi.create({ data: { studioId, ...b } }).then(x => x.id))
        })
        return res.json({ success: true, data: { diterapkan: preset } })
      }
      // Ada order: langkah lama diganti, order DIPINDAH otomatis ke langkah baru yang paling mirip (menurut jenis). Riwayat tahap tercatat.
      const pengguna = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } })
      const hasil = await prisma.$transaction(async (tx) => {
        for (const t of lama) await tx.tahapProduksi.update({ where: { id: t.id }, data: { nama: `__lama_${t.id}` } }) // bebaskan nama untuk templat baru
        const idPreset = await bangunPreset(preset, (b) => tx.tahapProduksi.create({ data: { studioId, ...b } }).then(x => x.id))
        const baru = await tx.tahapProduksi.findMany({ where: { id: { in: Object.values(idPreset) } } })
        const peta = petakanTahapLama(lama, baru)
        const aktifAwal = ['-', ...baru.filter(t => t.opsional && t.aktifBawaan).map(t => t.id)]
        const sekarang = new Date(); let dipindah = 0; const aktifSync = []
        for (const t of lama) {
          const tujuan = peta.get(t.id); if (!tujuan) continue
          const jt = jenisNormal(tujuan.jenis)
          const orders = await tx.orderProduksi.findMany({ where: { studioId, tahapId: t.id }, select: { id: true, status: true } })
          if (!orders.length) continue
          const ids = orders.map(o => o.id), bukanBatal = orders.filter(o => o.status !== 'BATAL').map(o => o.id)
          await tx.orderProduksi.updateMany({ where: { id: { in: ids } }, data: { tahapId: tujuan.id, subStatus: tujuan.nama, tahapAktif: aktifAwal } })
          if (bukanBatal.length) await tx.orderProduksi.updateMany({ where: { id: { in: bukanBatal } }, data: { status: STATUS_DARI_JENIS[jt] } })
          await tx.riwayatTahapOrder.updateMany({ where: { orderId: { in: bukanBatal }, selesai: null }, data: { selesai: sekarang } })
          await tx.riwayatTahapOrder.createMany({ data: bukanBatal.map(orderId => ({ orderId, namaTahap: tujuan.nama, jenis: jt, userId: req.user.id, namaPengguna: pengguna?.nama ?? null, mulai: sekarang })) })
          dipindah += ids.length
          for (const o of orders) if (['MASUK', 'PROSES'].includes(STATUS_DARI_JENIS[jt]) && o.status !== 'BATAL') aktifSync.push({ id: o.id, tujuan })
        }
        await tx.tahapProduksi.deleteMany({ where: { studioId, id: { in: lama.map(t => t.id) } } })
        return { dipindah, aktifSync }
      }, { timeout: 60000, maxWait: 15000 })
      // penugasan per tahap mengikuti langkah baru (gagal di sini tidak membatalkan penggantian templat)
      for (const x of hasil.aktifSync) { try { const o = await prisma.orderProduksi.findUnique({ where: { id: x.id } }); if (o) await sinkronPenugasanTahap({ order: o, tujuan: x.tujuan, pengguna: pengguna?.nama }) } catch { /* abaikan */ } }
      return res.json({ success: true, data: { diterapkan: preset, orderDipindah: hasil.dipindah } })
    }

    if (!Array.isArray(langkah) || langkah.length === 0) return gagal(res, 422, 'Kirim preset atau daftar langkah')
    const galat = validasiTemplat(langkah.map(l => ({ ...l, id: l.id ?? l.kunci })))
    if (galat.length) return gagal(res, 422, galat.join(' '))
    const idLama = new Set(lama.map(t => t.id))
    if (langkah.some(l => l.id && !idLama.has(l.id))) return gagal(res, 422, 'Ada langkah yang bukan milik studio ini')
    const dihapus = lama.filter(t => !langkah.some(l => l.id === t.id))
    const terkunci = dihapus.filter(t => dipakai.has(t.id)).map(t => t.nama)
    if (terkunci.length) return gagal(res, 409, `Langkah masih dipakai order, tidak bisa dihapus: ${terkunci.join(', ')}`)
    for (const l of langkah.filter(x => x.id && dipakai.has(x.id))) {
      const asli = lama.find(t => t.id === l.id)
      // 9 Nov 2026: jenis boleh diubah walau dipakai order bila lama & baru sama-sama jenis "tengah" (status order tetap PROSES, mis.
      // langkah "Preview" yang terlanjur berjenis Pengerjaan). Inbox/Selesai/QC/Revisi internal (gerbang) & induk tetap terkunci.
      const TENGAH = ['KERJA', 'PREVIEW_KLIEN', 'REVISI_KLIEN', 'MENUNGGU_KLIEN', 'FINALISASI', 'DELIVERY', 'HOLD']
      const jenisBerubah = jenisNormal(asli.jenis) !== l.jenis
      const bolehGanti = TENGAH.includes(jenisNormal(asli.jenis)) && TENGAH.includes(l.jenis)
      if ((jenisBerubah && !bolehGanti) || (asli.indukId ?? null) !== (l.indukId ?? null)) return gagal(res, 409, `Jenis/induk "${asli.nama}" tidak bisa diubah karena sudah dipakai order`)
    }
    await prisma.$transaction(async (tx) => {
      await tx.tahapProduksi.updateMany({ where: { studioId }, data: { urutan: { increment: 1000 } } }) // hindari tabrakan unik saat tukar nama
      const idDari = {}
      for (const l of langkah.filter(x => x.id)) idDari[l.id] = l.id
      for (const l of langkah.filter(x => !x.id)) {
        const baru = await tx.tahapProduksi.create({ data: { studioId, urutan: l.urutan, nama: `__baru_${Math.random().toString(36).slice(2)}`, jenis: l.jenis, opsional: !!l.opsional, aktifBawaan: l.aktifBawaan ?? true } })
        idDari[l.kunci ?? l.nama] = baru.id; l._id = baru.id
      }
      // nama sementara dulu agar pertukaran nama tidak melanggar keunikan (studioId, nama)
      for (const l of langkah) await tx.tahapProduksi.update({ where: { id: l.id ?? l._id }, data: { nama: `__tmp_${l.id ?? l._id}` } })
      for (const l of langkah) {
        await tx.tahapProduksi.update({
          where: { id: l.id ?? l._id },
          data: {
            nama: l.nama.trim(), urutan: l.urutan, jenis: l.jenis, opsional: !!l.opsional, aktifBawaan: l.aktifBawaan ?? true,
            indukId: l.indukId ? (idDari[l.indukId] ?? l.indukId) : null,
          },
        })
      }
      if (dihapus.length) await tx.tahapProduksi.deleteMany({ where: { id: { in: dihapus.map(t => t.id) } } })
    })
    return res.json({ success: true, data: { tersimpan: langkah.length } })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan alur')
  }
}

// Tugas milik pengguna sendiri di satu studio — TANPA nilai uang, TANPA data orang lain.
export const getTugasSaya = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
    const { antrean, selesai, lain } = await antreanSaya(req, studioId)
    return res.json({ success: true, data: { tugas: [...antrean, ...selesai], lain, ringkas: { aktif: antrean.length, selesaiBulanIni: selesai.length, dipantau: lain.length } } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

// TUGAS ADMIN (12 Nov 2026, masukan tim): Tugas saya pengelola order (Koordinator/Pendamping & Admin Market; pemilik lihat-saja TIDAK) berisi
// (1) kartu di tahap QC yang menunggu dikurasi — terbaru masuk di atas, ditandai yang masuk hari ini — dengan tombol QC lolos/gagal, dan
// (2) order yang PERLU DIBUATKAN INVOICE (keputusan user, ikut tim): project sudah DONE (Selesai ≤ 30 hari), belum lunas, dan harga belum
// seluruhnya ditagih (sama dengan "belum ditagih" di detail order). Admin per akun: hanya order akunnya.
// Baris QC ditulis "tahap – order – talent" (mis. Colouring – Dopa – Zaid); setelah dikurasi admin memilih tahap tujuan dari alur (dropdown):
// lanjut (mesin, aksi 'lanjut') atau tahap lain mis. kembali ke Colouring untuk revisi (PATCH /orders/:id/tahap).
export const getTugasAdmin = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
    const p = await peranStudio(req, studioId)
    if (!p.manajer || p.lihatSaja) return gagal(res, 403, 'Tugas admin hanya untuk pengelola order unit ini')
    const tahap = await pastikanTahap(studioId)
    const batasSelesai = new Date(Date.now() - 30 * 86400000)
    const orders = await prisma.orderProduksi.findMany({
      where: { studioId, ...saringAkun(p), OR: [{ status: { in: ['MASUK', 'PROSES'] } }, { status: 'SELESAI', OR: [{ tanggalSelesai: { gte: batasSelesai } }, { tanggalSelesai: null, updatedAt: { gte: batasSelesai } }] }] },
      select: { id: true, judul: true, klien: true, deadline: true, revisiKe: true, status: true, subStatus: true, tahapId: true, tahapAktif: true, akunId: true, statusBayar: true, nilaiKotor: true, nilaiDisepakati: true, tautan: true, isianKhusus: true, tanggalSelesai: true, assignments: { where: { berhentiPada: null }, select: { user: { select: { nama: true } }, namaEksternal: true } } },
    })
    const jenisOf = (o) => { const t = tahap.find(x => x.id === tahapEfektif(o, tahap)); return { t, jenis: t ? jenisNormal(t.jenis) : (o.status === 'SELESAI' ? 'SELESAI' : null) } }
    const kolomKhusus = await kolomStudio(studioId)
    const tim = (o) => o.assignments.map(a => a.user?.nama ?? a.namaEksternal).filter(Boolean)
    // (1) QC
    const diQc = orders.filter(o => jenisOf(o).jenis === 'QC')
    const jejak = await riwayatOrder(diQc.map(o => o.id))
    const baris = await prisma.riwayatTahapOrder.findMany({ where: { orderId: { in: diQc.map(o => o.id) } }, select: { orderId: true, namaTahap: true, jenis: true, mulai: true, selesai: true, namaPengguna: true }, orderBy: { mulai: 'asc' } })
    const masukQc = new Map(baris.filter(r => !r.selesai).map(r => [r.orderId, r]))
    // asal = langkah kerja terakhir sebelum QC (mis. "Colouring"); cadangan: nama QC tanpa awalan "QC: "
    const asalKerja = (o, t) => [...baris].reverse().find(r => r.orderId === o.id && r.selesai && !['QC', 'MASUK', 'HOLD'].includes(r.jenis))?.namaTahap ?? (t?.nama ?? '').replace(/^QC:\s*/i, '')
    const pilihanTahap = tahap.filter(t => t.aktif !== false).map(t => ({ id: t.id, nama: t.nama, jenis: jenisNormal(t.jenis) }))
    const hariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
    const qc = diQc.map(o => {
      const { t } = jenisOf(o), r = masukQc.get(o.id)
      const aksi = aksiTersedia({ templat: tahap, order: o, sekarang: t, riwayat: jejakUntuk(jejak.filter(x => x.orderId === o.id), tahap), peran: { manajer: true, ditugaskan: false, marketer: false } })
      return { id: o.id, judul: o.judul, klien: o.klien, deadline: o.deadline, revisiKe: o.revisiKe, tahap: t?.nama ?? o.subStatus, tahapId: t?.id ?? null, asal: asalKerja(o, t), tim: tim(o), adaTalentInternal: o.assignments.some(a => a.user), folder: o.tautan?.[0] ?? null, khusus: labelKhusus(kolomKhusus, o.isianKhusus), masuk: r?.mulai ?? null, oleh: r?.namaPengguna ?? null, hariIni: !!r?.mulai && new Date(r.mulai.getTime() + 7 * 3600000).toISOString().slice(0, 10) === hariIni, aksi: aksi.map(a => ({ aksi: a.aksi, label: a.label, ke: a.ke ?? null })) }
    }).sort((a, b) => (b.masuk ?? 0) - (a.masuk ?? 0))
    // (2) Perlu invoice
    const calon = orders.filter(o => o.statusBayar !== 'LUNAS' && o.status === 'SELESAI' && (o.nilaiDisepakati ?? o.nilaiKotor ?? 0) > 0)
    const posisi = await muatPosisiTagih(calon.map(o => o.id)) // rumus bersama (14 Nov 2026): DP yang diterima tanpa invoice ikut mengurangi
    const invoice = calon.map(o => {
      const p = posisi.get(o.id)
      return { id: o.id, judul: o.judul, klien: o.klien, tahap: 'Selesai', tanggalSelesai: o.tanggalSelesai, statusBayar: o.statusBayar, harga: p.harga, sudahDitagih: p.dalamTagihan, dibayarTanpaInvoice: p.dibayarLangsung, belumDitagih: p.belumDitagih }
    }).filter(x => x.belumDitagih > 0.5).sort((a, b) => b.belumDitagih - a.belumDitagih)
    return res.json({ success: true, data: { qc, invoice, tahap: pilihanTahap, ringkas: { qc: qc.length, qcHariIni: qc.filter(x => x.hariIni).length, invoice: invoice.length } } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

// NILAI ORDER BULAN INI satu unit (bulan kalender berjalan, order yang MASUK bulan ini, tanpa batal) — SATU rumus untuk kartu papan Produksi
// & halaman Web Circle di Management Dashboard (14 Nov 2026). "Selesai" TETAP = Done (keputusan 9 Nov; Laporan Harian Market juga membedakan
// Deliver & Complete); "sudah Delivery" (masukan tim 14 Nov) = hasil dikirim ke klien tetapi belum Done.
/**
 * Kartu ringkasan Produksi untuk satu bulan (bawaan bulan berjalan; 16 Nov 2026, masukan tim: bisa memilih bulan lain lewat
 * GET /papan/ringkasan?bulan=YYYY-MM). Nilai = `nilaiBulanIni` (order MASUK bulan itu, satu rumus dengan Web Circle Ekosistem);
 * "Selesai" = order yang selesai di bulan itu (= isi kolom Done untuk bulan berjalan, termasuk order yang masuk bulan sebelumnya).
 */
export async function ringkasanBulan(studioId, peranP, bulan = null) {
  const acuan = bulan ? new Date(`${bulan}-15T00:00:00Z`) : new Date()
  const awal = new Date(Date.UTC(acuan.getUTCFullYear(), acuan.getUTCMonth(), 1)), akhir = new Date(Date.UTC(acuan.getUTCFullYear(), acuan.getUTCMonth() + 1, 1))
  const n = await nilaiBulanIni(studioId, saringAkun(peranP), acuan)
  const selesaiBulanIni = await prisma.orderProduksi.count({ where: { studioId, status: 'SELESAI', ...saringAkun(peranP), OR: [{ tanggalSelesai: { gte: awal, lt: akhir } }, { tanggalSelesai: null, updatedAt: { gte: awal, lt: akhir } }] } })
  return { jumlahMasukBulanIni: n.jumlahMasuk, selesaiBulanIni, total: n.total, done: n.done, delivery: n.delivery }
}
export const getRingkasanPapan = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
    const p = await peranStudio(req, studioId)
    if (p.mode !== 'kelola' && p.mode !== 'marketing') return gagal(res, 403, 'Papan penuh hanya untuk Koordinator ke atas — buka Tugas Saya')
    const sekarang = kunciTanggalWIB(new Date()).slice(0, 7)
    const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.bulan ?? '') && req.query.bulan <= sekarang ? req.query.bulan : sekarang
    const r = await ringkasanBulan(studioId, p, bulan)
    const pantau = p.mode === 'marketing' // marketer: nilai uang unit tidak dikirim (Aturan 2), sama dengan papan pantau
    return res.json({ success: true, data: { bulan, ringkasan: { jumlahMasukBulanIni: r.jumlahMasukBulanIni, jumlahSelesai: r.selesaiBulanIni, total: pantau ? null : r.total, done: pantau ? null : r.done, delivery: pantau ? null : r.delivery, belumSelesai: pantau ? null : r.total - r.done, dikerjakan: pantau ? null : r.total - r.done - r.delivery } } })
  } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') }
}

export async function nilaiBulanIni(studioId, saring = {}, sekarang = new Date()) {
  const awalBulan = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), 1))
  const akhirBulan = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() + 1, 1))
  const bulanIni = await prisma.orderProduksi.findMany({
    where: { studioId, status: { not: 'BATAL' }, tanggalMasuk: { gte: awalBulan, lt: akhirBulan }, ...saring },
    select: { status: true, nilaiBersih: true, tahap: { select: { jenis: true } } },
  })
  const jml = (xs) => xs.reduce((a, o) => a + o.nilaiBersih, 0)
  const total = jml(bulanIni), done = jml(bulanIni.filter(o => o.status === 'SELESAI'))
  const delivery = jml(bulanIni.filter(o => o.status !== 'SELESAI' && jenisNormal(o.tahap?.jenis) === 'DELIVERY'))
  return { jumlahMasuk: bulanIni.length, total, done, delivery, dikerjakan: total - done - delivery }
}

// Satu sumber "antrean tugasku" — dipakai Tugas saya DAN Beranda (11 Nov 2026: Beranda dulu menghitung dari PenugasanTahap saja, sehingga
// order yang ditugaskan lewat Tim order tanpa baris per-tahap terbaca 0 di Beranda padahal ada di Tugas saya). Pemanggil wajib cek akses studio.
export async function antreanSaya(req, studioId) {
  const tahap = await pastikanTahap(studioId)
  const p = await peranStudio(req, studioId)
  const manajer = p.manajer && !p.lihatSaja, marketer = p.marketer // pemilik (lihat saja) tidak mendapat tombol koordinator
  const sekarang = new Date()
  const awalBulan = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), 1))
  const orders = await prisma.orderProduksi.findMany({
    where: {
      studioId, status: { not: 'BATAL' }, assignments: { some: { userId: req.user.id, berhentiPada: null } }, // berhenti = bukan antreanku lagi
      OR: [{ status: { in: ['MASUK', 'PROSES'] } }, { status: 'SELESAI', OR: [{ tanggalSelesai: { gte: awalBulan } }, { tanggalSelesai: null, updatedAt: { gte: awalBulan } }] }],
    },
    select: { id: true, judul: true, klien: true, deadline: true, revisiKe: true, status: true, subStatus: true, tahapId: true, tahapAktif: true, akunId: true, tautan: true, isianKhusus: true },
    orderBy: [{ deadline: 'asc' }, { tanggalMasuk: 'desc' }],
  })
  const jejak = await riwayatOrder(orders.map(o => o.id))
  // tugas yang DITUNDA admin (12 Nov 2026): order tetap giliran talent, tetapi tidak di Antreanku — ditandai untuk keterangan di Tugasku
  const kolomKhusus = await kolomStudio(studioId)
  const ditunda = new Set((await prisma.penugasanTahap.findMany({ where: { userId: req.user.id, tunda: true, status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, orderId: { in: orders.map(o => o.id) } }, select: { orderId: true } })).map(x => x.orderId))
  const data = orders.map(o => {
    const t = tahap.find(x => x.id === tahapEfektif(o, tahap))
    const riwayat = jejakUntuk(jejak.filter(r => r.orderId === o.id), tahap)
    const aksi = aksiTersedia({ templat: tahap, order: o, sekarang: t, riwayat, peran: { manajer: manajer && orderDalamAkun(p, o), ditugaskan: true, marketer } })
    return { id: o.id, folder: o.tautan?.[0] ?? null, khusus: labelKhusus(kolomKhusus, o.isianKhusus), ditunda: ditunda.has(o.id), judul: o.judul, klien: o.klien, deadline: o.deadline, revisiKe: o.revisiKe, tahap: t?.nama ?? o.subStatus, jenis: t ? jenisNormal(t.jenis) : null, aksi: aksi.map(a => ({ aksi: a.aksi, label: a.label })) }
  })
  // ANTREAN TALENT = satu definisi (10 Nov 2026, permintaan tim 3D): hanya Produksi, Revisi & Finalisasi (`JENIS_KERJA`); marketer juga memegang
  // fase klien miliknya. Order di tahap lain (Inbox, QC, Klien, Delivery, Hold) TIDAK dihitung & tanpa tombol — ditampilkan terpisah sebagai info.
  const PEMEGANG = { MASUK: 'Admin — menunggu ditugaskan & dimulai', QC: 'Admin — sedang dikurasi (QC)', PREVIEW_KLIEN: 'Admin/marketer — preview ke klien', MENUNGGU_KLIEN: 'Admin/marketer — menunggu klien', DELIVERY: 'Admin/marketer — kirim ke klien', HOLD: 'Ditahan (menunggu kejelasan)' }
  const giliranku = (d) => JENIS_KERJA.includes(d.jenis) || (marketer && JENIS_MARKETER.includes(d.jenis) && d.jenis !== 'SELESAI')
  const antrean = data.filter(giliranku), selesai = data.filter(d => d.jenis === 'SELESAI')
  const lain = data.filter(d => !giliranku(d) && d.jenis !== 'SELESAI').map(d => ({ id: d.id, judul: d.judul, klien: d.klien, deadline: d.deadline, tahap: d.tahap, jenis: d.jenis, pemegang: PEMEGANG[d.jenis] ?? 'Admin' }))
  return { antrean, selesai, lain }
}

// Publik (tanpa login): nama + warna alamat web ini, untuk tampilan halaman masuk. Tidak ada data sensitif.
export const getIdentitas = async (req, res) => {
  const web = await resolveWeb(req)
  if (web.galat) return gagal(res, 404, web.galat)
  if (web.aud === 'app') return res.json({ success: true, data: { aud: 'app' } })
  const { nama, slug, colorHex, jenis } = web.lingkup
  return res.json({ success: true, data: { aud: 'circle', nama, slug, jenis, warna: colorHex ?? null } })
}

// ── Tim: fungsi kerja anggota (artist / marketer / PM-QC / admin) ──────────────────────────────────────────
// Diisi dari TEBAKAN atas posisi, lalu dikonfirmasi koordinator. Hanya untuk Koordinator ke atas, hanya anggota studio ini.
const URUT_JENJANG = { KOORDINATOR: 0, KADER: 1, KARYAWAN: 2, MAGANG: 3 }
const JENJANG_PRODUKSI = ['KADER', 'KARYAWAN', 'MAGANG'] // "tim produksi ke bawah": yang fungsi kerjanya boleh diatur Admin Market
const FUNGSI_KOORDINATOR = ['MARKETER', 'ADMIN'] // fungsi yang hanya diberi/dicabut koordinator
// 16 Nov 2026 (masukan tim): Admin Market hanya mengatur fungsi TIM PRODUKSI — baris dirinya sendiri dan anggota tim admin/marketing
// (fungsi Admin/Marketer tersimpan, atau posisinya admin/marketing) hanya bisa dilihat; itu keputusan Koordinator.
const timNonProduksi = ({ userId, posisi, fungsi }, sayaId) => userId === sayaId || fungsi.some(f => FUNGSI_KOORDINATOR.includes(f)) || /admin|market/i.test(posisi ?? '')
async function anggotaStudio(studioId) {
  const peran = await prisma.userRole.findMany({
    where: { studioId, roleType: { in: Object.keys(URUT_JENJANG) }, user: { statusAktif: true } },
    select: { roleType: true, user: { select: { id: true, nama: true, posisi: true } } },
  })
  const peta = new Map()
  for (const p of peran) {
    const ada = peta.get(p.user.id)
    if (!ada || URUT_JENJANG[p.roleType] < URUT_JENJANG[ada.jenjang]) peta.set(p.user.id, { ...p.user, jenjang: p.roleType })
  }
  return [...peta.values()].sort((a, b) => (URUT_JENJANG[a.jenjang] - URUT_JENJANG[b.jenjang]) || a.nama.localeCompare(b.nama, 'id'))
}

export const getTim = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!(await studioBolehDilihat(req, studioId)) || !(await adalahManajer(req, studioId))) return gagal(res, 403, 'Layar Tim hanya untuk Koordinator ke atas')
    const [anggota, baris] = await Promise.all([anggotaStudio(studioId), prisma.fungsiAnggota.findMany({ where: { studioId } })])
    const tersimpan = new Map()
    for (const b of baris) (tersimpan.get(b.userId) ?? tersimpan.set(b.userId, []).get(b.userId)).push(b)
    const data = anggota.map(a => {
      const fungsi = (tersimpan.get(a.id) ?? []).map(f => ({ fungsi: f.fungsi, bidang: f.bidang, terkonfirmasi: f.terkonfirmasi }))
      return { userId: a.id, nama: a.nama, posisi: a.posisi, jenjang: a.jenjang, fungsi, terkonfirmasi: fungsi.some(f => f.terkonfirmasi), saran: tebakFungsi(a.posisi, a.jenjang) }
    })
    // Ubah fungsi kerja → pengelola unit (Koordinator/Pendamping, kelolaStudio) untuk semua anggota (13 Nov 2026, laporan tim).
    // Admin Market (13 Nov sore, masukan tim): boleh untuk tim produksi (Kader/Karyawan/Magang) saja, dan TIDAK menambah/mencabut fungsi
    // Marketer/Admin (membuka akses uang order) — itu tetap keputusan koordinator.
    const bisaUbah = await kelolaStudio(peranKerja(req), studioId)
    const p = bisaUbah ? null : await peranStudio(req, studioId)
    const adminProduksi = !bisaUbah && p.manajer && !p.lihatSaja
    for (const a of data) { a.bisaUbah = bisaUbah || (adminProduksi && JENJANG_PRODUKSI.includes(a.jenjang) && !timNonProduksi({ userId: a.userId, posisi: a.posisi, fungsi: a.fungsi.map(f => f.fungsi) }, req.user.id)); a.kunciFungsi = bisaUbah ? [] : FUNGSI_KOORDINATOR }
    return res.json({ success: true, data: { bisaUbah, anggota: data, ringkas: { total: data.length, terkonfirmasi: data.filter(d => d.terkonfirmasi).length, adaSaran: data.filter(d => !d.terkonfirmasi && d.saran.length > 0).length, tanpaDasar: data.filter(d => !d.terkonfirmasi && d.saran.length === 0).length } } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

async function simpanFungsiAnggota(tx, { userId, studioId, daftar, oleh }) {
  await tx.fungsiAnggota.deleteMany({ where: { userId, studioId } })
  if (daftar.length) await tx.fungsiAnggota.createMany({ data: daftar.map(f => ({ userId, studioId, fungsi: f.fungsi, bidang: f.bidang, terkonfirmasi: true, dikonfirmasiOleh: oleh, dikonfirmasiPada: new Date() })) })
}

export const simpanFungsi = async (req, res) => {
  try {
    const { studioId } = req.query
    const { userId } = req.params
    if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Fungsi kerja anggota hanya diatur Koordinator unit')
    const pengelola = await kelolaStudio(peranKerja(req), studioId)
    const p = pengelola ? null : await peranStudio(req, studioId)
    if (!pengelola && !(p.manajer && !p.lihatSaja)) return gagal(res, 403, 'Fungsi kerja anggota hanya diatur Koordinator unit')
    const anggota = await anggotaStudio(studioId)
    const target = anggota.find(a => a.id === userId)
    if (!target) return gagal(res, 404, 'Anggota tidak ditemukan di studio ini')
    const v = validasiFungsi(req.body?.fungsi)
    if (v.galat) return gagal(res, 422, v.galat)
    if (!pengelola) { // Admin Market: tim produksi saja, fungsi Marketer/Admin tidak boleh berubah
      if (!JENJANG_PRODUKSI.includes(target.jenjang)) return gagal(res, 403, 'Admin hanya bisa mengatur fungsi tim produksi (Kader/Karyawan/Magang)')
      const semuaLama = (await prisma.fungsiAnggota.findMany({ where: { userId, studioId }, select: { fungsi: true } })).map(f => f.fungsi)
      if (timNonProduksi({ userId, posisi: target.posisi, fungsi: semuaLama }, req.user.id)) return gagal(res, 403, 'Fungsi diri sendiri dan tim admin/marketing hanya diatur Koordinator unit')
      const lama = new Set(semuaLama.filter(f => FUNGSI_KOORDINATOR.includes(f)))
      const baru = new Set(v.daftar.map(f => f.fungsi).filter(f => FUNGSI_KOORDINATOR.includes(f)))
      if (lama.size !== baru.size || [...lama].some(f => !baru.has(f))) return gagal(res, 403, 'Fungsi Marketer dan Admin hanya diatur Koordinator unit')
    }
    await prisma.$transaction((tx) => simpanFungsiAnggota(tx, { userId, studioId, daftar: v.daftar, oleh: req.user.id }))
    return res.json({ success: true, data: { userId, fungsi: v.daftar } })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan fungsi')
  }
}

// "Terima semua saran": hanya anggota yang BELUM terkonfirmasi dan punya tebakan; yang tanpa dasar tetap harus diisi manual.
export const terimaSaran = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!(await studioBolehDilihat(req, studioId)) || !(await kelolaStudio(peranKerja(req), studioId))) return gagal(res, 403, 'Fungsi kerja anggota hanya diatur Koordinator unit')
    const [anggota, baris] = await Promise.all([anggotaStudio(studioId), prisma.fungsiAnggota.findMany({ where: { studioId, terkonfirmasi: true }, select: { userId: true } })])
    const sudah = new Set(baris.map(b => b.userId))
    const sasaran = anggota.filter(a => !sudah.has(a.id)).map(a => ({ a, saran: tebakFungsi(a.posisi, a.jenjang) })).filter(x => x.saran.length > 0)
    await prisma.$transaction(async (tx) => { for (const { a, saran } of sasaran) await simpanFungsiAnggota(tx, { userId: a.id, studioId, daftar: saran, oleh: req.user.id }) })
    return res.json({ success: true, data: { diterima: sasaran.length } })
  } catch {
    return gagal(res, 500, 'Gagal menerima saran')
  }
}
