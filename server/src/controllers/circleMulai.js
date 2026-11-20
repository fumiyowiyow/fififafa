import prisma from '../prisma.js'
import rateLimit from 'express-rate-limit'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { studioBolehDilihat, peranStudio, peranKerja } from './circle.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import { hariIniWIB } from '../utils/kehadiran.js'
import { SUPER_ADMIN, hasAnyRole, atasanLingkup } from '../utils/roles.js'
import { buatKode, hashKode, MASA_BERLAKU_MS } from '../utils/telegramKode.js'
import { gajiShuBio } from './circleBuku.js'

// "MULAI DI SINI" v2 (21 Okt 2026): daftar kesiapan yang DIHITUNG dari data (bukan sekadar 3 centang), terbagi tiga:
//   wajib      — 3 hal sebelum unit bisa bekerja (tim, akun jualan, alur kerja — alur kini tersimpan di server, bukan di peramban)
//   disarankan — hal-hal agar fitur baru benar-benar jalan (keahlian, target, marketer, buku besar, Telegram, posisi SDM)
//   lingkup    — pengaturan circle (Kepala Circle ke atas / Super Admin): kalender libur, pemetaan kategori biaya, target semua unit
// plus tabel kesiapan semua unit untuk Kepala Circle ke atas. Kompatibel: akun / timTerkonfirmasi / order tetap dikirim.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const AKUN_OTOMATIS = 'Order Internal'
const atasan = (req, web) => atasanLingkup(peranKerja(req), web.lingkup) // Kepala Circle/Rumah Usaha alamat INI ke atas (21 Okt 2026)
const superAdmin = (req) => hasAnyRole(peranKerja(req), SUPER_ADMIN)
const langkah = (kunci, judul, ket, tab, selesai, rinci = null, extra = {}) => ({ kunci, judul, ket, tab, selesai, rinci, ...extra })
async function sesi(req, res) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  return web
}
async function kesiapanUnit(studioId, hari) {
  const bulan = Number(hari.slice(5, 7)), tahun = Number(hari.slice(0, 4))
  const [akun, anggota, atur, ahli, aturanLembur] = await Promise.all([
    prisma.akunProduksi.findMany({ where: { studioId, namaAkun: { not: AKUN_OTOMATIS } }, select: { id: true } }),
    anggotaStudio(studioId),
    prisma.pengaturanPenugasan.findUnique({ where: { studioId } }),
    prisma.keahlianTahap.count({ where: { studioId } }),
    prisma.pengaturanLembur.findUnique({ where: { studioId }, select: { mode: true } }),
  ])
  const ids = [...anggota.keys()]
  // Konfirmasi Tim hanya untuk PERAN KERJA (12 Nov 2026, laporan Najuwa: halaman Tim "7 dari 7", Mulai di sini "7 dari 10") — Pendamping/
  // Penasihat/Kepala tidak perlu fungsi kerja (sama dengan Susunan tim & layar Tim). Telegram & posisi tetap menghitung semua anggota.
  const idsKerja = [...new Set((await prisma.userRole.findMany({ where: { studioId, userId: { in: ids }, roleType: { in: ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG'] } }, select: { userId: true } })).map(r => r.userId))]
  const [terkonfirmasi, tAkun, tUnit, marketer, penugasan, itemTetap, status, telegram, posisi, rekening, rutinBio, admin, bio] = await Promise.all([
    prisma.fungsiAnggota.findMany({ where: { studioId, terkonfirmasi: true, userId: { in: idsKerja } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.targetOmsetAkun.count({ where: { akunId: { in: akun.map(a => a.id) }, tahun, bulan } }),
    prisma.targetOmsetUnit.count({ where: { studioId, tahun, bulan } }),
    prisma.fungsiAnggota.findMany({ where: { studioId, fungsi: 'MARKETER', userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.penugasanAkunMarketer.findMany({ where: { akun: { studioId } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.itemTetap.count({ where: { aktif: true, OR: [{ studioId }, { studioId: null }] } }),
    prisma.statusBulan.findMany({ where: { studioId }, select: { bulan: true, status: true, kasAwalManual: true } }),
    prisma.user.count({ where: { id: { in: ids }, telegramId: { not: null } } }),
    // posisi terisi = ditetapkan manual ATAU Koordinator unit ini (posisi otomatis dari peran Ekosistem, 12 Nov 2026)
    Promise.all([prisma.profilSdm.findMany({ where: { userId: { in: ids }, posisiSekarang: { not: null } }, select: { userId: true } }), prisma.userRole.findMany({ where: { studioId, roleType: 'KOORDINATOR', userId: { in: ids } }, select: { userId: true } })]).then(([a, b]) => new Set([...a, ...b].map(x => x.userId)).size),
    // Bio studio = sumber (12 Nov 2026): rekening, pengeluaran rutin, THP (gaji & Dignity), SHU dibaca buku besar circle
    prisma.studioRekening.count({ where: { studioId } }),
    prisma.studioPengeluaranRutin.count({ where: { studioId, jumlah: { gt: 0 } } }),
    prisma.produksiAdminMarket.findMany({ where: { studioId }, select: { akunIds: true } }),
    gajiShuBio(studioId, hari.slice(0, 7)),
  ])
  const dipegang = new Set(penugasan.map(p => p.userId))
  const marketerTanpaAkun = marketer.filter(m => !dipegang.has(m.userId)).length
  const kasSiap = status.some(s => s.kasAwalManual != null || s.status === 'DITUTUP')
  const n = ids.length
  return { akun: akun.length, n, nKerja: idsKerja.length, timOk: terkonfirmasi.length, alur: !!atur?.alurDisetujui, ahli, lembur: aturanLembur?.mode ?? null, targetAda: tAkun + tUnit > 0, marketer: marketer.length, marketerTanpaAkun, itemTetap, kasSiap, telegram, posisi, rekening, rutinBio, thpBio: bio.gaji.filter(g => g.dari === 'Bio' || g.dari === 'slip').length, shuBio: bio.shu > 0, admin: admin.length, adminBerakun: admin.filter(a => a.akunIds.length).length }
}

// "Mulai di sini" pribadi (11 Nov 2026) — marketer & talent. `disarankan` = kebiasaan harian yang dicentang dari datanya SENDIRI;
// `panduan` = petunjuk menu (tanpa centang). Tidak ada angka uang & tidak ada data orang lain.
async function mulaiPribadi(req, studioId, p) {
  const uid = req.user.id, hari = hariIniWIB(), tgl = new Date(`${hari}T00:00:00Z`)
  const marketer = p.marketer
  const [masuk, tugasAktif, aturanLembur, slipFinal] = await Promise.all([
    prisma.kehadiranEvent.count({ where: { userId: uid, tanggalKerja: tgl, jenis: 'MASUK' } }),
    prisma.penugasanTahap.count({ where: { userId: uid, status: { not: 'SELESAI' }, order: { studioId } } }),
    prisma.pengaturanLembur.findUnique({ where: { studioId }, select: { mode: true } }),
    prisma.penggajian.count({ where: { userId: uid, studioId, status: { in: ['FINAL', 'DIBAYAR'] } } }),
  ])
  const disarankan = [langkah('presensi', 'Presensi hari ini', 'Catat masuk saat mulai bekerja (WFO/WFA) dan pulang saat selesai. Kehadiran → Presensi.', 'hadir', masuk > 0, masuk > 0 ? 'sudah presensi masuk' : 'belum presensi masuk hari ini')]
  if (marketer) {
    const [akun, aktivitas, prospek] = await Promise.all([
      prisma.penugasanAkunMarketer.count({ where: { userId: uid, akun: { studioId } } }),
      prisma.aktivitasMarketer.count({ where: { userId: uid, studioId, tanggal: tgl } }),
      prisma.marketingLead.count({ where: { marketerId: uid, studioId } }),
    ])
    disarankan.unshift(langkah('akunSaya', 'Akun jualan yang kamu pegang', 'Kamu hanya melihat & mengelola order dari akun yang ditugaskan padamu. Kalau masih kosong, minta Koordinator menugaskannya (Marketing → Rencana).', 'marketing', akun > 0, akun > 0 ? `${akun} akun` : 'belum ada akun — hubungi Koordinator', { tombol: 'Lihat' }))
    disarankan.push(
      langkah('aktivitas', 'Catat aktivitas hari ini', 'Unggah konten, interaksi, jejaring, optimasi — catat di Marketing → Aktivitas supaya terlihat di Ringkasan & Kinerja saya.', 'marketing', aktivitas > 0, aktivitas > 0 ? `${aktivitas} aktivitas hari ini` : 'belum ada aktivitas hari ini'),
      langkah('prospek', 'Prospek → order', 'Calon klien dicatat di Marketing → Prospek. Saat deal, klik "Jadikan order" supaya data klien & nilainya ikut terbawa ke Produksi.', 'marketing', prospek > 0, prospek > 0 ? `${prospek} prospek tercatat` : 'belum ada prospek'),
    )
  }
  if (process.env.OTOMASI_AKTIF === '1') {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { telegramId: true } })
    disarankan.push(langkah('telegram', 'Tautkan Telegram', 'Supaya pengingat terkirim ke HP-mu. Kehadiran → Profil SDM → Buat kode tautan, lalu kirim kodenya ke bot lewat chat pribadi.', 'hadir', !!u?.telegramId, u?.telegramId ? 'sudah tertaut' : 'belum tertaut'))
  }
  const lemburDibayar = aturanLembur?.mode && aturanLembur.mode !== 'TIDAK_DIBAYAR'
  const panduan = [
    ...(marketer ? [
      langkah('order', 'Order & Produksi', 'Tambah order dari Produksi (akun jualan wajib dipilih). Order milikmu boleh kamu ubah: data dasar, item & add-on, cicilan. Untuk order freelance (tanpa talent internal), kamu yang menggeser tahapnya atas nama freelancer; QC tetap Koordinator.', 'papan', null),
      langkah('updateklien', 'Update klien & pembayaran', 'Catat setiap kabar ke klien di Update klien. Uang yang sudah diterima dicatat sebagai cicilan di detail order (Pembayaran dari klien — ada tombol ✓ Lunas penuh); sisa tagihan terlihat di menu Belum dibayar klien.', 'updateklien', null),
      langkah('setoran', 'Setoran', 'Laporkan setoran kapan saja di menu Setoran.', 'setoran', null),
    ] : []),
    langkah('tugas', 'Tugas saya', 'Pekerjaan yang ditugaskan padamu muncul di sini. Mulai, perbarui progres, lalu tandai selesai/siap QC.', 'tugas', null, tugasAktif > 0 ? `${tugasAktif} tugas berjalan` : 'belum ada tugas berjalan'),
    langkah('lembur', 'Catat lembur', 'Lembur = fee untuk pekerjaan di luar jam kantor. Catat kapan saja di Kehadiran → Catat lembur (pilih tanggal pekerjaannya); Koordinator yang menyetujui dan menentukan nilainya.', 'hadir', null, lemburDibayar ? 'aturan lembur unit sudah ada' : 'unit belum mengatur lembur — tetap boleh dicatat'),
    langkah('slip', 'Slip saya', 'Slip gaji muncul setelah difinalkan Koordinator, dan bisa diunduh PDF.', 'slip', null, slipFinal > 0 ? `${slipFinal} slip tersedia` : 'belum ada slip'),
  ]
  const peran = marketer ? 'marketer' : 'talent'
  return { peran, wajib: [], wajibSelesai: true, disarankan, panduan, disarankanSelesai: disarankan.filter(l => l.selesai).length, disarankanTotal: disarankan.length }
}

export const getMulai = wrap(async (req, res) => {
  const { studioId } = req.query
  const web = await sesi(req, res); if (!web) return
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  // 11 Nov 2026: "Mulai di sini" untuk SEMUA peran. Koordinator (pengelola unit; pemilik ikut melihat) → daftar kesiapan unit.
  // Marketer & talent → panduan kerja pribadi (dicentang otomatis dari datanya sendiri). Admin Market memakai daftar marketer/talent.
  const p = await peranStudio(req, studioId)
  if (!(p.manajer && !p.adminMarket)) return res.json({ success: true, data: await mulaiPribadi(req, studioId, p) })
  const hari = hariIniWIB(), k = await kesiapanUnit(studioId, hari)
  const [slipBulanIni, penerbit] = await Promise.all([
    prisma.penggajian.count({ where: { studioId, bulan: Number(hari.slice(5, 7)), tahun: Number(hari.slice(0, 4)) } }),
    prisma.pengaturanInvoice.findUnique({ where: { studioId }, select: { rekening: true } }),
  ])
  const pengingatAktif = process.env.OTOMASI_AKTIF === '1'
  const order = await prisma.orderProduksi.count({ where: { studioId } })
  const wajib = [
    langkah('tim', 'Konfirmasi Tim', 'Tandai fungsi tiap anggota: artist, marketer, PM/QC, atau admin. Tebakan dari posisi sudah terisi — periksa lalu simpan (ada tombol "Terima semua tebakan").', 'tim', k.nKerja > 0 && k.timOk >= k.nKerja, `${k.timOk} dari ${k.nKerja} anggota kerja terkonfirmasi (pendamping/penasihat tidak perlu)`),
    langkah('akun', 'Isi akun jualan', 'Akun Fiverr, Etsy, VGen, dll. yang dipakai unit. Tiap akun: platform, nama akun, dan fee platform.', 'akun', k.akun > 0, k.akun > 0 ? `${k.akun} akun` : 'belum ada akun'),
    langkah('alur', 'Periksa alur kerja', 'Pilih alur yang paling mirip (sederhana, layanan, ilustrasi, 3D), sesuaikan tahapnya bila perlu, lalu tandai sudah sesuai.', 'alur', k.alur, k.alur ? 'sudah ditandai sesuai' : 'belum ditandai', { bisaTandai: true }),
  ]
  const disarankan = [
    langkah('lembur', 'Aturan lembur unit', 'Lembur = fee untuk pekerjaan di luar jam kantor, bukan per jam. Pilih cara hitungnya: per project (nilai per order saat menyetujui) atau per level & progres. Tanpa aturan, lembur hanya dicatat dan tidak menambah gaji. Di menu yang sama atur juga jam kerja unit (bila tidak 09.00–17.00) & pulang otomatis. Kehadiran → Jam kerja & lembur.', 'hadir', !!k.lembur, k.lembur ? { PER_PROYEK: 'per project', PER_LEVEL: 'per level & progres', PER_JAM: 'per jam (cara lama)', BERTINGKAT: 'bertingkat (cara lama)', PER_HARI: 'per hari (cara lama)', TIDAK_DIBAYAR: 'tidak dibayar' }[k.lembur] ?? k.lembur : 'belum diatur'),
    langkah('gaji', 'Penggajian bulan ini', 'Gaji di Tutup bulan otomatis diambil dari THP Bio; begitu slip disiapkan, angka slip (dengan bonus/lembur/potongan) yang dipakai. Sekali di awal: Atur rincian. Tiap bulan: Siapkan slip (jadwal gajian bawaan tgl 27) → isi bonus/komisi/potongan → Finalkan → Tandai dibayar (otomatis tercatat dibayar di Tutup bulan). Anggota melihat slipnya di "Slip saya" setelah final.', 'gaji', slipBulanIni > 0, slipBulanIni > 0 ? `${slipBulanIni} slip bulan ini` : 'slip bulan ini belum disiapkan'),
    langkah('penerbit', 'Penerbit invoice', 'Nama studio/PH dan rekening penerima yang tercetak di invoice klien (termasuk Invoice DP/Pelunasan dari detail order). Rekening bisa diambil dari Bio studio. Tagihan → Penerbit invoice.', 'tagihan', !!penerbit?.rekening, penerbit?.rekening ? 'rekening sudah diisi' : 'rekening belum diisi'),
    langkah('keahlian','Keahlian tim untuk penugasan otomatis', 'Tanpa keahlian, "Tugaskan otomatis" dan "Saran penugasan" tidak punya dasar. Isi manual, atau klik "Isi keahlian dari riwayat" setelah ada pekerjaan selesai.', 'penugasan', k.ahli > 0, k.ahli > 0 ? `${k.ahli} keahlian terisi` : 'belum ada'),
    langkah('target', 'Target omset bulan ini', 'Tanpa target, Penjualan, Evaluasi & Perbaikan, dan Peringkat tidak bisa menilai pencapaian. Diisi per akun oleh Koordinator unit (Penjualan → Atur target).', 'penjualan', k.targetAda, k.targetAda ? 'sudah ada' : 'belum ada target bulan ini'),
    ...(k.marketer > 0 ? [langkah('marketer', 'Tugaskan akun ke marketer', 'Marketer hanya melihat dan menagih akun yang ditugaskan padanya (Marketing → Rencana → Penugasan akun ke marketer).', 'marketing', k.marketerTanpaAkun === 0, k.marketerTanpaAkun === 0 ? `${k.marketer} marketer, semua punya akun` : `${k.marketerTanpaAkun} dari ${k.marketer} marketer belum punya akun`)] : []),
    // Bio studio = sumber (12 Nov 2026): diisi sekali di Management Dashboard, dibaca otomatis buku besar circle (tidak diketik ulang)
    langkah('bio', 'Lengkapi Bio studio (Management Dashboard)', 'Web circle membaca Bio studio: THP tiap anggota (jadi gaji & Dignity di Tutup bulan), rekening bank (Kas per rekening & invoice), pengeluaran rutin (langganan, iuran, kontribusi) dan SHU. Periksa sekali di Management Dashboard → Bio studio — tidak perlu diketik lagi di sini. Hasilnya terlihat di Tutup bulan → Biaya rutin.', 'buku', k.thpBio > 0 && k.rekening > 0, `${k.thpBio} orang ber-THP · ${k.rekening} rekening · ${k.rutinBio} pengeluaran rutin${k.shuBio ? ' · SHU terisi' : ''}`, { tombol: 'Lihat hasilnya' }),
    langkah('buku', 'Saldo awal kas per rekening', k.rekening > 0
      ? 'Sekali di bulan pertama: Tutup bulan → Kas per rekening → Atur saldo awal → "Isi dari saldo Bio Ekosistem", periksa, lalu Simpan. Bulan berikutnya otomatis dari tutup bulan. Biaya rutin yang TIDAK ada di Bio (mis. sewa) dicatat di Tutup bulan → Biaya rutin.'
      : 'Sekali di bulan pertama: isi kas awal di Tutup bulan → Ringkasan (rekening bank belum ada di Bio studio — tambahkan di Ekosistem supaya kas bisa dilihat per rekening). Biaya rutin yang TIDAK ada di Bio dicatat di Tutup bulan → Biaya rutin.',
      'buku', k.kasSiap, `${k.kasSiap ? 'saldo awal sudah diisi' : 'saldo awal belum diisi'}${k.itemTetap > 0 ? ` · ${k.itemTetap} biaya rutin circle` : ''}`),
    // Telegram baru berguna bila pengingat otomatis dinyalakan (OTOMASI_AKTIF) — selama belum, langkah ini tidak ditampilkan
    ...(pengingatAktif ? [langkah('telegram', 'Tautkan Telegram anggota', 'Pengingat (rencana harian, delivery, presensi) hanya terkirim ke yang sudah menautkan. Tiap orang: Kehadiran → Profil SDM → Buat kode tautan, lalu kirim kodenya ke bot lewat chat pribadi.', 'hadir', k.n > 0 && k.telegram >= Math.ceil(k.n * 0.8), `${k.telegram} dari ${k.n} anggota tertaut`)] : []),
    // Admin per akun jualan (12 Nov 2026): hanya disarankan bila unit punya ≥ 2 Admin Market (mis. Admin Etsy & Admin LTK)
    ...(k.admin >= 2 ? [langkah('adminAkun', 'Bagi akun jualan ke admin', 'Unit ini punya beberapa Admin Market. Supaya tiap admin hanya melihat order tanggung jawabnya, pilih akun yang dipegang tiap admin di Tim → Admin Market. Tanpa pilihan, admin melihat semua order.', 'tim', k.adminBerakun > 0, `${k.adminBerakun} dari ${k.admin} admin sudah memegang akun`)] : []),
    langkah('posisi', 'Posisi sekarang anggota', 'Dipakai di Susunan tim dan profil SDM. Koordinator menetapkannya (Tim → Susunan tim, klik kolom posisi); posisi Koordinator terisi otomatis.', 'tim', k.n > 0 && k.posisi >= Math.ceil(k.n * 0.8), `${k.posisi} dari ${k.n} terisi`),
  ]
  const data = { akun: k.akun, timTerkonfirmasi: k.timOk, order, alurDisetujui: k.alur, wajib, disarankan, wajibSelesai: wajib.every(l => l.selesai), disarankanSelesai: disarankan.filter(l => l.selesai).length, disarankanTotal: disarankan.length, atasan: atasan(req, web), superAdmin: superAdmin(req) }
  if (atasan(req, web)) {
    const kunci = whereLingkup(web.lingkup)
    const semua = await prisma.studio.findMany({ where: { ...kunci, statusAktif: true }, select: { id: true, nama: true, hitungDiEkosistem: true }, orderBy: { nama: 'asc' } })
    const unit = []; for (const s of semua) if (await studioBolehDilihat(req, s.id)) unit.push(s)
    const tahun = Number(hari.slice(0, 4)), bulan = Number(hari.slice(5, 7))
    const baris = []
    for (const s of unit) { const x = await kesiapanUnit(s.id, hari); baris.push({ studioId: s.id, nama: s.nama.trim(), akun: x.akun, anggota: x.nKerja, timOk: x.timOk, alur: x.alur, target: x.targetAda, siap: x.akun > 0 && x.n > 0 && x.timOk >= x.n && x.alur }) }
    const [libur, belumPeta, totalKategori] = await Promise.all([
      prisma.hariLiburKerja.count({ where: { jenis: 'LIBUR', tanggal: { gte: new Date(`${tahun}-01-01T00:00:00Z`), lt: new Date(`${tahun + 1}-01-01T00:00:00Z`) } } }),
      prisma.kategoriBiaya.count({ where: { aktif: true, kategoriLedgerId: null } }),
      prisma.kategoriBiaya.count({ where: { aktif: true } }),
    ])
    const tanpaTarget = baris.filter(b => !b.target).length
    data.lingkup = [
      langkah('libur', `Kalender kerja ${tahun}: hari libur`, 'Jam kerja bersih (Analitik, Rekap kerja, Kinerja) menganggap hari libur nasional sebagai hari kerja kalau belum diisi. Super Admin mengisinya di Analitik → Kalender kerja.', 'analitik', libur > 0, libur > 0 ? `${libur} hari libur terisi` : 'belum ada hari libur', { khusus: 'Super Admin' }),
      langkah('pemetaan', 'Pasangkan kategori biaya → laporan keuangan', 'Biaya yang disetujui tapi kategorinya belum dipasangkan TIDAK ikut Laba rugi / Tutup bulan. Super Admin: Tutup bulan → Atur kategori.', 'buku', totalKategori > 0 && belumPeta === 0, totalKategori ? `${belumPeta} dari ${totalKategori} kategori belum dipasangkan` : 'belum ada kategori biaya', { khusus: 'Super Admin' }),
      langkah('targetSemua', 'Target omset semua unit bulan ini', 'Target diisi Koordinator tiap unit (CEO unitnya) per akun di Penjualan → Atur target; di sini dipantau unit mana yang belum mengisi.', 'penjualan', baris.length > 0 && tanpaTarget === 0, baris.length ? `${baris.length - tanpaTarget} dari ${baris.length} unit punya target` : '—'),
    ]
    data.unitSiap = baris.sort((a, b) => Number(a.siap) - Number(b.siap) || a.nama.localeCompare(b.nama, 'id'))
    data.pengingatAktif = process.env.OTOMASI_AKTIF === '1'
  }
  return res.json({ success: true, data })
})

export const setAlurDisetujui = wrap(async (req, res) => {
  const { studioId, setuju } = req.body ?? {}
  if (!(await sesi(req, res))) return
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  if (!(await peranStudio(req, studioId)).manajer) return gagal(res, 403, 'Hanya Koordinator ke atas')
  const v = !!setuju
  await prisma.pengaturanPenugasan.upsert({ where: { studioId }, update: { alurDisetujui: v }, create: { studioId, alurDisetujui: v } })
  return res.json({ success: true, data: { alurDisetujui: v } })
})

// ── Telegram: tautkan dari web circle (pekerja circle tak punya halaman Profil Ekosistem). Mekanisme sama persis dengan Profil Ekosistem ──
export const kodeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyGenerator: (req) => `kode-telegram:${req.user.id}`, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Terlalu banyak permintaan kode, coba lagi dalam 15 menit' } })
export const getTelegram = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { telegramId: true, telegramKodeHash: true, telegramKodeKadaluarsa: true } })
  return res.json({ success: true, data: { tertaut: !!u?.telegramId, kodeAktif: !!u?.telegramKodeHash && !!u.telegramKodeKadaluarsa && u.telegramKodeKadaluarsa > new Date(), bot: process.env.TELEGRAM_BOT_USERNAME || 'nama_bot_anda' } })
})
export const buatKodeTelegram = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  if (req.user?.imp) return gagal(res, 403, 'Tidak bisa saat menyamar')
  const kode = buatKode(), kadaluarsa = new Date(Date.now() + MASA_BERLAKU_MS)
  await prisma.user.update({ where: { id: req.user.id }, data: { telegramKodeHash: hashKode(kode), telegramKodeKadaluarsa: kadaluarsa } })
  res.set('Cache-Control', 'no-store')
  return res.json({ success: true, data: { kode, kadaluarsa, bot: process.env.TELEGRAM_BOT_USERNAME || 'nama_bot_anda' } })
})
export const putuskanTelegram = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  if (req.user?.imp) return gagal(res, 403, 'Tidak bisa saat menyamar')
  await prisma.user.update({ where: { id: req.user.id }, data: { telegramId: null, telegramKodeHash: null, telegramKodeKadaluarsa: null } })
  return res.json({ success: true, message: 'Tautan Telegram diputus' })
})
