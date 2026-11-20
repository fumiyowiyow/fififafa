import prisma from '../prisma.js'
import { lingkupKeuangan } from '../utils/lingkup.js'
import { SLUG_KORPORASI } from '../utils/web.js'
import { hariIniWIB } from '../utils/kehadiran.js'
import { bayanganOmsetStudio } from '../utils/omsetBayangan.js'
import { nadiStudio } from './circleAnalitik.js'
import { nilaiBulanIni } from './circle.js'
import { barisBelumDibayar } from './circleOps.js'
import { hitung as hitungBuku } from './circleBuku.js'
import { papanTarget } from './circlePenjualan.js'

// HALAMAN "WEB CIRCLE" DI Ekosistem DASHBOARD (14 Nov 2026, permintaan Founder): ringkasan semua circle & unit tanpa membuka web circle satu per
// satu. Management Dashboard = tempat data akhir terlihat (Aturan 4b); halaman ini HANYA MEMBACA data web circle dari database yang sama — tidak ada
// salinan/sinkron, tidak ada tulisan ke Laporan Omset/kas resmi (mode bayangan, Aturan 4).
// WILAYAH = aturan uang Ekosistem yang sama (`lingkupKeuangan`): Founder/Co-Founder (Super Admin) semua; Kepala Circle circle-nya; Kepala Rumah Usaha
// rumah usahanya; Koordinator/Pendamping unitnya; talent tidak (rute minimal Koordinator). Unit di luar wilayah TIDAK dikirim sama sekali.
// SEMUA ANGKA memakai rumus web circle yang sama (tidak ada definisi kedua): antrean & macet = Analitik › Kondisi hari ini (`nadiStudio`),
// nilai order bulan ini = kartu Produksi (`nilaiBulanIni`), belum dibayar klien = menu Belum dibayar klien (`barisBelumDibayar`),
// target = Manajemen (`papanTarget`), laba rugi & kas = Tutup bulan (`hitung`), omset resmi vs order = Cek omset (`bayanganOmsetStudio`).
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const r2 = (n) => Math.round((n ?? 0) * 100) / 100
const HARI = 86400000
const KERJA_TIM = ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG']

/** Kelompok & alamat web circle satu unit. */
function letak(s) {
  if (s.circle) return { jenis: 'circle', id: s.circle.id, nama: s.circle.nama, alamat: s.circle.slug ? `https://${s.circle.slug}.domain-anda.com` : null }
  if (s.rumahUsaha) return { jenis: 'rumah', id: s.rumahUsaha.id, nama: s.rumahUsaha.nama, alamat: s.rumahUsaha.slug ? `https://${s.rumahUsaha.slug}.domain-anda.com` : null }
  return { jenis: 'korporasi', id: s.induk.id, nama: s.induk.nama, alamat: `https://${SLUG_KORPORASI}.domain-anda.com` }
}

async function ringkasUnit(s, { bulanKunci, bulan, tahun, awalHari, tujuhHari }) {
  const id = s.id
  const [nadi, nilai, belum, buku, bayangan, lewat, baru, anggota] = await Promise.all([
    nadiStudio(id),
    nilaiBulanIni(id),
    barisBelumDibayar(id),
    hitungBuku(id, bulanKunci),
    bayanganOmsetStudio(id, bulan, tahun),
    prisma.orderProduksi.count({ where: { studioId: id, status: { in: ['MASUK', 'PROSES'] }, deadline: { lt: awalHari } } }),
    prisma.orderProduksi.count({ where: { studioId: id, status: { not: 'BATAL' }, tanggalMasuk: { gte: tujuhHari } } }),
    prisma.userRole.findMany({ where: { studioId: id, roleType: { in: KERJA_TIM }, user: { statusAktif: true } }, select: { userId: true } }),
  ])
  const ids = [...new Set(anggota.map(a => a.userId))]
  const hadir = ids.length ? (await prisma.kehadiranEvent.findMany({ where: { userId: { in: ids }, jenis: 'MASUK', tanggalKerja: { gte: tujuhHari } }, distinct: ['userId'], select: { userId: true } })).length : 0
  const alir = Object.fromEntries(nadi.alir.map(a => [a.kunci, a.jumlah]))
  const dlv = belum.filter(b => b.sudahDelivery)
  return {
    produksi: { aktif: nadi.alir.reduce((a, x) => a + x.jumlah, 0), alir: nadi.alir.map(a => ({ kunci: a.kunci, label: a.label, jumlah: a.jumlah })), macet: nadi.nadi.macet, lewatDeadline: lewat, selesaiHariIni: nadi.nadi.selesaiHariIni, inbox: alir.antrian ?? 0 },
    nilai: { jumlahMasuk: nilai.jumlahMasuk, total: r2(nilai.total), done: r2(nilai.done), delivery: r2(nilai.delivery), dikerjakan: r2(nilai.dikerjakan) },
    belumDibayar: { jumlah: dlv.length, sisa: r2(dlv.reduce((a, b) => a + b.sisa, 0)), belumDitagih: dlv.filter(b => !b.sudahDitagih).length, masihDikerjakan: r2(belum.filter(b => !b.sudahDelivery).reduce((a, b) => a + b.sisa, 0)) },
    buku: { masuk: r2(buku.masuk), keluar: r2(buku.keluar), hasil: r2(buku.hasil), kasAkhir: r2(buku.kasAkhir), ditutup: buku.ditutup },
    omset: { laporanUsd: bayangan.total.laporanUsd, orderBersihUsd: bayangan.total.orderBersihUsdBerlaporan, selisihUsd: bayangan.total.selisihBersih, periodeBerlaporan: bayangan.total.periodeBerlaporan, jumlahPeriode: bayangan.total.jumlahPeriode },
    pemakaian: { orderBaru7: baru, anggota: ids.length, presensi7: hadir },
  }
}

export const getRingkasan = async (req, res) => {
  try {
    const lingkup = await lingkupKeuangan(req.userRoles ?? [])
    const semua = await prisma.studio.findMany({
      where: { statusAktif: true, tipe: { not: 'KORPORASI' }, OR: [{ circleId: { not: null } }, { rumahUsahaId: { not: null } }, { indukId: { not: null } }], ...(lingkup.semua ? {} : { id: { in: [...lingkup.studioIds] } }) },
      select: { id: true, nama: true, tipe: true, hitungDiEkosistem: true, circle: { select: { id: true, nama: true, slug: true } }, rumahUsaha: { select: { id: true, nama: true, slug: true } }, induk: { select: { id: true, nama: true } } },
      orderBy: { nama: 'asc' },
    })
    const hari = hariIniWIB(), tahun = Number(hari.slice(0, 4)), bulan = Number(hari.slice(5, 7))
    const awalHari = new Date(hari + 'T00:00:00+07:00')
    const konteks = { bulanKunci: hari.slice(0, 7), bulan, tahun, awalHari, tujuhHari: new Date(awalHari.getTime() - 6 * HARI) }
    const { papan } = await papanTarget(semua, tahun, bulan)
    const target = new Map(papan.map(p => [p.studioId, p]))
    // Satu unit gagal dihitung tidak boleh menjatuhkan seluruh halaman; dihitung bertahap (5 unit sekaligus) agar database tidak terbebani
    const hasil = []
    for (let i = 0; i < semua.length; i += 5) {
      hasil.push(...await Promise.all(semua.slice(i, i + 5).map(async s => {
        const t = target.get(s.id)
        const dasar = { studioId: s.id, nama: s.nama, tipe: s.tipe, dihitung: s.hitungDiEkosistem, letak: letak(s), target: t ? { aktualUsd: t.aktualUsd, targetUsd: t.targetUsd, persen: t.persen, status: t.status } : null }
        try { return { ...dasar, ...(await ringkasUnit(s, konteks)) } } catch { return { ...dasar, galat: 'Data unit ini gagal dimuat' } }
      })))
    }
    const kelompok = new Map()
    for (const u of hasil) { const k = `${u.letak.jenis}:${u.letak.id}`; if (!kelompok.has(k)) kelompok.set(k, { ...u.letak, unit: [] }); kelompok.get(k).unit.push(u) }
    const urutJenis = { korporasi: 0, circle: 1, rumah: 2 }
    const ok = hasil.filter(u => !u.galat && u.dihitung)
    const jml = (f) => r2(ok.reduce((a, u) => a + f(u), 0))
    return res.json({
      success: true,
      data: {
        hari, bulan: konteks.bulanKunci, semuaWilayah: lingkup.semua,
        total: {
          unit: hasil.length, aktif: jml(u => u.produksi.aktif), lewatDeadline: jml(u => u.produksi.lewatDeadline), macet: jml(u => u.produksi.macet),
          nilai: jml(u => u.nilai.total), done: jml(u => u.nilai.done), delivery: jml(u => u.nilai.delivery), dikerjakan: jml(u => u.nilai.dikerjakan),
          belumDibayar: jml(u => u.belumDibayar.sisa), belumDibayarProject: jml(u => u.belumDibayar.jumlah), belumDitagih: jml(u => u.belumDibayar.belumDitagih), anggota: jml(u => u.pemakaian.anggota), presensi7: jml(u => u.pemakaian.presensi7), orderBaru7: jml(u => u.pemakaian.orderBaru7),
          masuk: jml(u => u.buku.masuk), keluar: jml(u => u.buku.keluar), hasil: jml(u => u.buku.hasil), kasAkhir: jml(u => u.buku.kasAkhir),
          laporanUsd: jml(u => u.omset.laporanUsd ?? 0), orderBersihUsd: jml(u => u.omset.orderBersihUsd ?? 0),
        },
        kelompok: [...kelompok.values()].sort((a, b) => (urutJenis[a.jenis] - urutJenis[b.jenis]) || a.nama.localeCompare(b.nama, 'id')),
        catatan: 'Angka bayangan dari web circle (dibaca langsung dari database yang sama, tidak disalin). Omset resmi tetap dari Laporan Omset. Total hanya unit yang dihitung di ekosistem.',
      },
    })
  } catch {
    return gagal(res, 500, 'Gagal memuat ringkasan web circle')
  }
}
