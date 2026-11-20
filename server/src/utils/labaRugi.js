// LABA RUGI MULTI-BULAN & PROYEKSI (adaptasi OGS KaizenFinanceStudioPlService: matriks bulan × kategori, laba rugi, kas bergulir).
// MURNI — tanpa database. Bagian "biaya produksi % omset" (FF2) OGS sengaja tidak dibawa: tak ada padanannya di Ekosistem.
const r2 = (n) => Math.round(n * 100) / 100

/** bulanList: [{bulan, perKategori:[{kategori, arus, sifat, jumlah}], masuk, tetap, variabel, kasAwal, kasAkhir, status}] berurutan. */
export function matriksLabaRugi(bulanList) {
  const bulan = bulanList.map(b => b.bulan)
  const baris = new Map()
  bulanList.forEach((b, i) => {
    for (const k of b.perKategori) {
      const kunci = `${k.arus}|${k.kategori}`
      if (!baris.has(kunci)) baris.set(kunci, { kategori: k.kategori, arus: k.arus, sifat: k.sifat ?? null, sel: bulan.map(() => 0) })
      baris.get(kunci).sel[i] = r2(baris.get(kunci).sel[i] + k.jumlah)
    }
  })
  const jumlah = (arr) => r2(arr.reduce((a, b) => a + b, 0))
  const urut = (a, b) => b.total - a.total || a.kategori.localeCompare(b.kategori, 'id')
  const dgnTotal = (arus) => [...baris.values()].filter(x => x.arus === arus).map(x => ({ ...x, total: jumlah(x.sel) })).sort(urut)
  const masuk = bulanList.map(b => b.masuk), keluar = bulanList.map(b => r2(b.tetap + b.variabel))
  const hasil = masuk.map((m, i) => r2(m - keluar[i]))
  return {
    bulan, status: bulanList.map(b => b.status),
    pendapatan: dgnTotal('INCOME'), pengeluaran: dgnTotal('EXPENSE'),
    totalMasuk: masuk, totalKeluar: keluar, labaRugi: hasil, kasAkhir: bulanList.map(b => b.kasAkhir),
    jumlah: { masuk: jumlah(masuk), keluar: jumlah(keluar), labaRugi: jumlah(hasil) },
    marginPersen: jumlah(masuk) > 0 ? Math.round((jumlah(hasil) / jumlah(masuk)) * 1000) / 10 : null,
  }
}

/**
 * Proyeksi sederhana (transparan, bukan ramalan): rata-rata `jendela` bulan terakhir yang BERISI data (masuk atau keluar ≠ 0), diteruskan n bulan.
 * Kas awal proyeksi = kas akhir bulan terakhir yang berisi data. Mengembalikan null bila belum ada data.
 */
export function proyeksi(bulanList, { ke = 3, jendela = 3 } = {}) {
  const isi = bulanList.filter(b => b.masuk !== 0 || b.tetap + b.variabel !== 0)
  if (!isi.length) return null
  const pakai = isi.slice(-jendela)
  const rata = (f) => r2(pakai.reduce((a, b) => a + f(b), 0) / pakai.length)
  const masuk = rata(b => b.masuk), tetap = rata(b => b.tetap), variabel = rata(b => b.variabel)
  let kas = isi.at(-1).kasAkhir
  const [t, m] = isi.at(-1).bulan.split('-').map(Number)
  const bulan = []
  for (let i = 1; i <= ke; i++) {
    const d = new Date(Date.UTC(t, m - 1 + i, 1)); kas = r2(kas + masuk - tetap - variabel)
    bulan.push({ bulan: d.toISOString().slice(0, 7), masuk, keluar: r2(tetap + variabel), labaRugi: r2(masuk - tetap - variabel), kasAkhir: kas })
  }
  return { dasar: pakai.map(b => b.bulan), rataMasuk: masuk, rataKeluar: r2(tetap + variabel), bulan, catatan: `Rata-rata ${pakai.length} bulan terakhir yang berisi data, diteruskan apa adanya (tanpa musiman/target).` }
}

/**
 * RENCANA KAS (adaptasi OGS FinanceV4 RencanaPanel: struktur biaya tetap + forecast kas). Tiga skenario dari satu asumsi dasar:
 * pesimis/dasar/optimis = pemasukan × faktor (variabel ikut proporsional, biaya tetap TIDAK). Kas bergulir; tandai bulan kas jatuh < 0.
 */
export const FAKTOR_SKENARIO = { pesimis: 0.8, dasar: 1, optimis: 1.2 }
export function rencanaKas({ kasAwal, masuk, tetap, variabel, bulanMulai, n = 6, faktor = FAKTOR_SKENARIO }) {
  const [t, m] = bulanMulai.split('-').map(Number)
  const hasil = {}
  for (const [nama, f] of Object.entries(faktor)) {
    let kas = kasAwal; const bulan = []
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.UTC(t, m - 1 + i, 1)), pemasukan = r2(masuk * f), biayaVar = r2(variabel * f)
      const hasilBulan = r2(pemasukan - tetap - biayaVar); kas = r2(kas + hasilBulan)
      bulan.push({ bulan: d.toISOString().slice(0, 7), masuk: pemasukan, tetap: r2(tetap), variabel: biayaVar, hasil: hasilBulan, kasAkhir: kas, minus: kas < 0 })
    }
    const pertamaMinus = bulan.find(b => b.minus)
    hasil[nama] = { faktor: f, bulan, kasAkhir: kas, bulanKasHabis: pertamaMinus?.bulan ?? null }
  }
  return hasil
}
