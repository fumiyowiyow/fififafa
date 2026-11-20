// TAGIHAN KOMUNITAS (adaptasi OGS CommunityInvoiceService). MURNI — tanpa database.
export const STATUS = { DRAFT: 'Draft', DITAGIH: 'Ditagih', LUNAS: 'Lunas', BATAL: 'Batal' }
const BOLEH = { DRAFT: ['DITAGIH', 'BATAL'], DITAGIH: ['LUNAS', 'DRAFT'], LUNAS: [], BATAL: ['DRAFT'] }
export const bolehPindah = (dari, ke) => (BOLEH[dari] ?? []).includes(ke)
export const bisaDiubah = (t) => t.status === 'DRAFT'
export const nomorBerikut = (tahun, terakhir) => { const m = /-(\d+)$/.exec(terakhir ?? ''); return `INV-${tahun}-${String((m ? Number(m[1]) : 0) + 1).padStart(4, '0')}` }
/** Order yang boleh ditagih: klien sama, belum BATAL, belum LUNAS, belum ada di tagihan aktif, nilai > 0. */
export function layak(order, klien, sudahDitagih) {
  return order.klien.trim().toLowerCase() === klien.trim().toLowerCase() && order.status !== 'BATAL' && order.statusBayar !== 'LUNAS' && !sudahDitagih.has(order.id) && order.nilaiKotor > 0
}
export const hitungTotal = (items) => Math.round(items.reduce((a, b) => a + b.jumlah, 0) * 100) / 100

// POSISI TAGIH satu order (14 Nov 2026, masukan tim: Pelunasan invoice tidak memperhitungkan DP yang dicatat tanpa invoice). SATU rumus untuk
// panel invoice order, "Perlu dibuatkan invoice" (Tugas saya admin), dan status di Belum dibayar klien — dulu tiap tempat menghitung sendiri.
//   harga        = harga ke klien (nilai disepakati, atau nilai kotor)
//   dalamTagihan = invoice/tagihan yang belum dibatalkan (termasuk Draft) — dasar "jangan menagih dua kali"
//   terbit       = invoice yang sudah dikirim ke klien (Ditagih/Lunas) — dasar status "Sudah ditagihkan"
//   dibayarLangsung = cicilan yang DITERIMA tanpa invoice (TerminBayarOrder dibayar, tagihanId kosong). Cicilan dicatat sebagai uang masuk studio
//     (setelah potongan platform), jadi disetarakan ke harga klien dengan rasio kotor/bersih — kebalikan rasio yang dipakai saat invoice Lunas.
//   belumDitagih = harga − dalamTagihan − dibayarLangsung
export function posisiTagih(o, item, termin) {
  const r = (x) => Math.round(x * 100) / 100
  const harga = o.nilaiDisepakati ?? o.nilaiKotor ?? 0
  const aktif = item.filter(i => i.status !== 'BATAL')
  const dalamTagihan = r(aktif.reduce((a, i) => a + i.jumlah, 0))
  const terbit = r(aktif.filter(i => i.status === 'DITAGIH' || i.status === 'LUNAS').reduce((a, i) => a + i.jumlah, 0))
  const bersihLangsung = termin.filter(t => t.dibayarPada && !t.tagihanId).reduce((a, t) => a + t.jumlah, 0)
  const rasio = o.nilaiBersih > 0 && o.nilaiKotor > 0 ? o.nilaiKotor / o.nilaiBersih : 1
  const dibayarLangsung = r(bersihLangsung * rasio)
  return { harga, dalamTagihan, terbit, dibayarLangsung, belumDitagih: r(Math.max(0, harga - dalamTagihan - dibayarLangsung)) }
}
