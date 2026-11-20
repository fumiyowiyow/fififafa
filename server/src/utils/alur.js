// MESIN ALUR PRODUKSI (20 Okt 2026) — acuan: workflow detail OGS (stage utama + gerbang QC / Revisi Internal /
// Preview Klien / Revisi Klien, tahap opsional per order). Murni (tanpa database) supaya setiap jalur bisa diuji.
//
// Yang TETAP adalah JENIS langkah; NAMA langkah hanyalah data per studio (templat), jadi studio 3D / ilustrasi /
// animasi memakai mesin yang sama dengan diksi berbeda.
//
//   MASUK → KERJA → [QC → (gagal) REVISI_INTERNAL → QC] → KERJA berikut … → [PREVIEW_KLIEN ⇄ REVISI_KLIEN] → SELESAI
//   HOLD dapat dimasuki dari langkah mana pun (kecuali SELESAI) dan kembali ke langkah sebelumnya.
//
// Langkah dengan `opsional` dapat dinyalakan/dimatikan per order. Aturan ketergantungan (sama dengan OGS):
// gerbang yang punya induk hanya aktif bila induknya aktif; Revisi Klien hanya aktif bila Preview Klien aktif.

export const STATUS_DARI_JENIS = {
  MASUK: 'MASUK', KERJA: 'PROSES', QC: 'PROSES', REVISI_INTERNAL: 'PROSES', PREVIEW_KLIEN: 'PROSES',
  REVISI_KLIEN: 'PROSES', MENUNGGU_KLIEN: 'PROSES', FINALISASI: 'PROSES', DELIVERY: 'PROSES', HOLD: 'PROSES', SELESAI: 'SELESAI',
}

// FASE MAKRO papan (acuan OGS ProductionPhaseService::PHASES): Antrian, Produksi, QC, Revisi, Klien, Finalisasi, Delivery, Selesai.
// Hold berdiri sendiri. Langkah mikro (Sketch, QC: Sketch, …) tampil sebagai label di kartu.
export const FASE = [
  { kunci: 'antrian', label: 'Antrian', jenis: ['MASUK'] },
  { kunci: 'produksi', label: 'Produksi', jenis: ['KERJA'] },
  { kunci: 'qc', label: 'QC', jenis: ['QC'] },
  { kunci: 'revisi', label: 'Revisi', jenis: ['REVISI_INTERNAL', 'REVISI_KLIEN'] },
  { kunci: 'klien', label: 'Klien', jenis: ['PREVIEW_KLIEN', 'MENUNGGU_KLIEN'] },
  { kunci: 'finalisasi', label: 'Finalisasi', jenis: ['FINALISASI'] },
  { kunci: 'delivery', label: 'Delivery', jenis: ['DELIVERY'] },
  { kunci: 'hold', label: 'Hold', jenis: ['HOLD'] },
  { kunci: 'selesai', label: 'Selesai', jenis: ['SELESAI'] },
]

// PEMILIK fase (acuan OGS ProductionAssignmentQueueService::MARKETER_PHASE_KEYS = client, delivery, done):
// bagian yang berhadapan dengan KLIEN dipegang MARKETER; sisanya tim PRODUKSI (artist, PM/QC).
export const JENIS_MARKETER = ['PREVIEW_KLIEN', 'MENUNGGU_KLIEN', 'DELIVERY', 'SELESAI']
export const milikMarketer = (jenis) => JENIS_MARKETER.includes(jenisNormal(jenis))

/** Nilai legacy dari prototipe awal dibaca sebagai nilai baru. */
export function jenisNormal(j) { return j === 'PREVIEW' ? 'PREVIEW_KLIEN' : j === 'REVISI' ? 'REVISI_KLIEN' : j }

export const JENIS_REVISI = ['REVISI_INTERNAL', 'REVISI_KLIEN']
export const LABEL_JENIS = {
  MASUK: 'Inbox', KERJA: 'Pengerjaan', QC: 'QC', REVISI_INTERNAL: 'Revisi internal', PREVIEW_KLIEN: 'Preview klien',
  REVISI_KLIEN: 'Revisi klien', MENUNGGU_KLIEN: 'Menunggu client', FINALISASI: 'Finalisasi', DELIVERY: 'Delivery', HOLD: 'Hold', SELESAI: 'Selesai',
}

// ── Templat bawaan (nama bisa diubah koordinator; jenis & hubungan induk adalah mesinnya) ─────────────────
const gerbang = (nama) => [
  { kunci: `qc:${nama}`, nama: `QC: ${nama}`, jenis: 'QC', induk: `k:${nama}` },
  { kunci: `ri:${nama}`, nama: `Revisi: ${nama}`, jenis: 'REVISI_INTERNAL', induk: `k:${nama}` },
]
const tahapKerja = (nama, adaGerbang = true) => [{ kunci: `k:${nama}`, nama, jenis: 'KERJA' }, ...(adaGerbang ? gerbang(nama) : [])]
// finalisasiAktif / denganMenunggu: dipakai preset 3D (10 Nov 2026) — Finalisasi menyala bawaan; "menunggu klien" cukup lewat Hold
const ujung = (previewAktif, { finalisasiAktif = false, denganMenunggu = true } = {}) => [
  { kunci: 'pk', nama: 'Preview klien', jenis: 'PREVIEW_KLIEN', opsional: true, aktifBawaan: previewAktif },
  { kunci: 'rk', nama: 'Revisi klien', jenis: 'REVISI_KLIEN', opsional: true, aktifBawaan: previewAktif },
  ...(denganMenunggu ? [{ kunci: 'mk', nama: 'Menunggu client', jenis: 'MENUNGGU_KLIEN' }] : []),
  { kunci: 'fin', nama: 'Finalisasi', jenis: 'FINALISASI', opsional: true, aktifBawaan: finalisasiAktif },
  { kunci: 'dlv', nama: 'Delivery', jenis: 'DELIVERY', opsional: true, aktifBawaan: true },
  { kunci: 'hold', nama: 'Hold', jenis: 'HOLD' },
  { kunci: 'done', nama: 'Done', jenis: 'SELESAI' },
]

export const PRESET = {
  sederhana: {
    label: 'Sederhana — Inbox, Pengerjaan, Preview, Revisi, Done (acuan: Daily Update PiBi)',
    langkah: [
      { kunci: 'in', nama: 'Inbox', jenis: 'MASUK' },
      ...tahapKerja('Pengerjaan', false),
      { kunci: 'pk', nama: 'Preview', jenis: 'PREVIEW_KLIEN' },
      { kunci: 'rk', nama: 'Revisi', jenis: 'REVISI_KLIEN' },
      { kunci: 'hold', nama: 'Hold', jenis: 'HOLD' },
      { kunci: 'done', nama: 'Done', jenis: 'SELESAI' },
    ],
  },
  layanan: {
    label: 'Layanan — Queue, Menunggu Client, Progress, Preview, Revision, Done (acuan: Daily Chat Sekartaji)',
    langkah: [
      { kunci: 'in', nama: 'Queue', jenis: 'MASUK' },
      { kunci: 'mk', nama: 'Menunggu Client', jenis: 'MENUNGGU_KLIEN' },
      ...tahapKerja('Progress', false),
      { kunci: 'pk', nama: 'Preview', jenis: 'PREVIEW_KLIEN' },
      { kunci: 'rk', nama: 'Revision', jenis: 'REVISI_KLIEN' },
      { kunci: 'hold', nama: 'Hold', jenis: 'HOLD' },
      { kunci: 'done', nama: 'Done', jenis: 'SELESAI' },
    ],
  },
  ilustrasi: {
    label: 'Ilustrasi / GFS — Sketch, Line Art, Base Color, Finishing (acuan: OGS), tiap tahap dengan QC',
    langkah: [
      { kunci: 'in', nama: 'Inbox', jenis: 'MASUK' },
      ...['Sketch', 'Line Art', 'Base Color', 'Finishing'].flatMap(n => tahapKerja(n)),
      ...ujung(false),
    ],
  },
  '3d': {
    label: '3D — Modeling, Texture, Rigging (tiap tahap dengan QC), Preview klien, Finalisasi, Delivery, Hold, Done (nama tahap perlu dicocokkan dengan studio)',
    langkah: [
      { kunci: 'in', nama: 'Inbox', jenis: 'MASUK' },
      ...['Modeling', 'Texture', 'Rigging'].flatMap(n => tahapKerja(n)),
      ...ujung(true, { finalisasiAktif: true, denganMenunggu: false }),
    ],
  },
}

/** Buat templat dari preset untuk satu studio. `buat(baris)` menyimpan satu baris & mengembalikan id-nya. */
// ── Ganti templat saat sudah ada order (10 Nov 2026, masukan tim) ────────────────────────────────────────────────
// Setiap langkah LAMA dipetakan ke langkah BARU yang paling mirip menurut JENIS (urutan cadangan di bawah); nama yang sama diutamakan,
// lalu langkah pertama berjenis itu. Murni (tanpa database) supaya bisa diuji.
const CADANGAN_JENIS = {
  MASUK: ['MASUK'], KERJA: ['KERJA'], QC: ['QC', 'KERJA'], REVISI_INTERNAL: ['REVISI_INTERNAL', 'KERJA'],
  PREVIEW_KLIEN: ['PREVIEW_KLIEN', 'MENUNGGU_KLIEN', 'KERJA'], MENUNGGU_KLIEN: ['MENUNGGU_KLIEN', 'PREVIEW_KLIEN', 'KERJA'],
  REVISI_KLIEN: ['REVISI_KLIEN', 'REVISI_INTERNAL', 'KERJA'], FINALISASI: ['FINALISASI', 'KERJA'], DELIVERY: ['DELIVERY', 'FINALISASI', 'KERJA'],
  HOLD: ['HOLD', 'KERJA'], SELESAI: ['SELESAI'],
}
/** lama/baru: [{id, nama, jenis, urutan}] → Map idLama → langkah baru (atau undefined bila tak ada padanan sama sekali). */
export function petakanTahapLama(lama, baru) {
  const urut = [...baru].sort((a, b) => a.urutan - b.urutan), hasil = new Map()
  for (const l of lama) {
    const jenis = jenisNormal(l.jenis)
    const sama = urut.find(b => b.nama.trim().toLowerCase() === String(l.nama).trim().toLowerCase() && jenisNormal(b.jenis) === jenis)
    let tujuan = sama
    for (const j of CADANGAN_JENIS[jenis] ?? ['KERJA']) { if (tujuan) break; tujuan = urut.find(b => jenisNormal(b.jenis) === j) }
    hasil.set(l.id, tujuan)
  }
  return hasil
}

export async function bangunPreset(kunciPreset, buat) {
  const p = PRESET[kunciPreset]
  if (!p) throw new Error('Preset tidak dikenal')
  const idDari = {}
  let urutan = 0
  for (const l of p.langkah) {
    urutan += 1
    idDari[l.kunci] = await buat({
      urutan, nama: l.nama, jenis: l.jenis, indukId: l.induk ? idDari[l.induk] ?? null : null,
      opsional: !!l.opsional, aktifBawaan: l.aktifBawaan ?? true,
    })
  }
  return idDari
}

// ── Aktif / jalur ─────────────────────────────────────────────────────────────────────────────────────────
const urut = (t) => [...t].sort((a, b) => a.urutan - b.urutan)

/** Himpunan id tahap opsional yang menyala untuk order. tahapAktif kosong = ikut aktifBawaan templat. */
export function tahapOpsionalAktif(templat, tahapAktifOrder = []) {
  const opsional = templat.filter(t => t.opsional)
  const eksplisit = (tahapAktifOrder?.length ?? 0) > 0
  return new Set(opsional.filter(t => (eksplisit ? tahapAktifOrder.includes(t.id) : t.aktifBawaan)).map(t => t.id))
}

export function langkahAktif(templat, tahapAktifOrder = []) {
  const menyala = tahapOpsionalAktif(templat, tahapAktifOrder)
  const nyalaSendiri = (t) => !t.opsional || menyala.has(t.id)
  const peta = Object.fromEntries(templat.map(t => [t.id, t]))
  const adaPreview = templat.some(t => jenisNormal(t.jenis) === 'PREVIEW_KLIEN' && nyalaSendiri(t))
  return urut(templat).filter(t => {
    if (!nyalaSendiri(t)) return false
    const j = jenisNormal(t.jenis)
    if (t.indukId && peta[t.indukId] && !nyalaSendiri(peta[t.indukId])) return false // gerbang ikut induknya
    if (j === 'REVISI_KLIEN' && !adaPreview) return false                              // Revisi Klien butuh Preview Klien
    return true
  })
}

const JALUR_UTAMA = ['MASUK', 'KERJA', 'QC', 'PREVIEW_KLIEN', 'FINALISASI', 'DELIVERY', 'SELESAI']
const jalurUtama = (aktif) => aktif.filter(t => JALUR_UTAMA.includes(jenisNormal(t.jenis)))

// ── Aksi yang tersedia ────────────────────────────────────────────────────────────────────────────────────
/**
 * @param templat   semua baris TahapProduksi studio (id, urutan, nama, jenis, indukId, opsional, aktifBawaan)
 * @param order     { tahapAktif }
 * @param sekarang  baris tahap saat ini
 * @param riwayat   tahap-tahap yang pernah dilalui, TERBARU TERAKHIR ({ tahapId, jenis }), untuk kembali dari Hold / Menunggu client / membuka Done
 * @param peran     { manajer, ditugaskan, marketer }
 * templat.qcSemua (opsional, 12 Nov 2026): pengaturan unit "semua hasil talent dicek admin (QC) dulu" — ditempel pastikanTahap()
 *                  manajer    = Koordinator ke atas atau Admin Market (QC, persetujuan, koreksi)
 *                  ditugaskan = orang yang ditugaskan di order ini (artist)
 *                  marketer   = fungsi MARKETER di studio ini (memegang fase Klien, Delivery, Selesai — acuan OGS)
 * @returns [{ aksi, label, ke (id tahap), naikRevisi }]
 */
export function aksiTersedia({ templat, order, sekarang, riwayat = [], peran }) {
  if (!sekarang) return []
  const aktif = langkahAktif(templat, order.tahapAktif)
  const utama = jalurUtama(aktif)
  const j = jenisNormal(sekarang.jenis)
  const hasil = []
  const pegangKlien = !!(peran.manajer || peran.marketer)
  // talentBoleh: artist yang ditugaskan; klienBoleh: marketer (fase milik marketer); selain itu hanya manajer
  // wakil = marketer yang sekaligus "ditugaskan" (wakil freelance): boleh menggerakkan Inbox → kerja untuk order tanpa talent internal
  const boleh = ({ talent = false, klien = false, wakil = false } = {}) => peran.manajer || (talent && peran.ditugaskan) || (klien && peran.marketer) || (wakil && peran.ditugaskan && peran.marketer)
  const tambah = (aksi, label, ke, opsi = {}) => { if (ke && boleh(opsi)) hasil.push({ aksi, label, ke: ke.id, naikRevisi: !!opsi.naikRevisi }) }
  const sebelumnya = (lewati) => {
    for (let i = riwayat.length - 1; i >= 0; i--) {
      const t = aktif.find(a => a.id === riwayat[i].tahapId)
      if (t && !lewati.includes(jenisNormal(t.jenis))) return t
    }
    return utama.find(t => jenisNormal(t.jenis) === 'KERJA') ?? null
  }
  const berikut = () => utama[utama.findIndex(t => t.id === sekarang.id) + 1] ?? null
  const cari = (jenis) => aktif.find(t => jenisNormal(t.jenis) === jenis)
  const gerbangUntuk = (jenis) => aktif.find(t => jenisNormal(t.jenis) === jenis && (t.indukId ?? null) === (sekarang.indukId ?? null)) ?? cari(jenis)
  const menungguKlien = cari('MENUNGGU_KLIEN')
  // QC SEMUA (12 Nov 2026, masukan tim): bila unit menyalakannya (dan punya langkah QC), setiap "selesai" dari talent — Pengerjaan,
  // Revisi klien, Finalisasi — masuk QC dulu; "QC lolos" lalu melanjutkan ke langkah sesudah asal pekerjaan itu.
  const qcSemua = !!templat.qcSemua && aktif.some(t => jenisNormal(t.jenis) === 'QC')
  const qcTerdekat = () => {
    const milik = aktif.find(t => jenisNormal(t.jenis) === 'QC' && t.indukId === sekarang.id) // gerbang QC milik tahap kerja ini
    if (milik) return milik
    const i = utama.findIndex(t => t.id === sekarang.id) // -1 = di luar jalur utama (Revisi klien) → QC terakhir di alur
    for (let k = (i === -1 ? utama.length : i) - 1; k >= 0; k--) if (jenisNormal(utama[k].jenis) === 'QC') return utama[k]
    return cari('QC')
  }
  const sesudah = (t) => utama[utama.findIndex(x => x.id === t.id) + 1] ?? null

  if (j === 'MASUK') {
    const n = berikut()
    // Inbox BUKAN antrean talent (10 Nov 2026, permintaan tim): admin menugaskan talent lalu memindahkan kartu ke Produksi
    tambah('lanjut', 'Mulai kerjakan', n, { wakil: true })
    tambah('menunggu_klien', 'Menunggu client', menungguKlien, { klien: true })
  } else if (j === 'KERJA') {
    const n = berikut()
    if (n && qcSemua && !['QC', 'SELESAI'].includes(jenisNormal(n.jenis))) {
      tambah('lanjut', 'Siap QC', qcTerdekat(), { talent: true })
    } else if (n) {
      const jn = jenisNormal(n.jenis)
      const label = jn === 'QC' ? 'Siap QC' : jn === 'KERJA' ? `Lanjut ke ${n.nama}` : jn === 'PREVIEW_KLIEN' ? `Siap ${n.nama}` : jn === 'DELIVERY' ? `Siap ${n.nama}` : jn === 'FINALISASI' ? `Lanjut ke ${n.nama}` : 'Selesai'
      tambah('lanjut', label, n, { talent: jn !== 'SELESAI' })
    }
  } else if (j === 'QC') {
    let ke = berikut()
    if (qcSemua) { // lanjut ke langkah sesudah ASAL pekerjaan yang dicek (bukan sekadar langkah sesudah QC di urutan)
      const asal = sebelumnya(['QC', 'REVISI_INTERNAL', 'HOLD', 'MENUNGGU_KLIEN'])
      const ja = asal ? jenisNormal(asal.jenis) : null
      if (ja === 'REVISI_KLIEN') ke = cari('PREVIEW_KLIEN') ?? ke
      else if (ja === 'KERJA' || ja === 'FINALISASI') { const n2 = sesudah(asal); ke = n2 && n2.id === sekarang.id ? sesudah(sekarang) : (n2 ?? ke) }
    }
    tambah('lanjut', 'QC lolos', ke)
    tambah('gagal', 'QC gagal → revisi', aktif.find(t => jenisNormal(t.jenis) === 'REVISI_INTERNAL' && (t.indukId ?? null) === (sekarang.indukId ?? null)) ?? cari('REVISI_INTERNAL'), { naikRevisi: true })
  } else if (j === 'REVISI_INTERNAL') {
    tambah('lanjut', 'Revisi selesai → QC', gerbangUntuk('QC'), { talent: true })
  } else if (j === 'PREVIEW_KLIEN') {
    const n = berikut()
    tambah('lanjut', 'Klien setuju', n, { klien: true })
    tambah('revisi_klien', 'Klien minta revisi', cari('REVISI_KLIEN'), { klien: true, naikRevisi: true })
    tambah('menunggu_klien', 'Menunggu client', menungguKlien, { klien: true })
  } else if (j === 'REVISI_KLIEN') {
    if (qcSemua) tambah('lanjut', 'Revisi selesai → QC', qcTerdekat(), { talent: true, klien: true })
    else tambah('lanjut', 'Revisi selesai → Preview', gerbangUntuk('PREVIEW_KLIEN'), { talent: true, klien: true })
  } else if (j === 'FINALISASI') {
    const n = berikut()
    const keSelesai = !!n && jenisNormal(n.jenis) === 'SELESAI'
    // Finalisasi = pekerjaan produksi (artist); hanya bila langkah berikutnya sudah SELESAI, marketer boleh menutupnya
    if (qcSemua && n && !keSelesai) tambah('lanjut', 'Siap QC', qcTerdekat(), { talent: true })
    else tambah('lanjut', n && jenisNormal(n.jenis) === 'DELIVERY' ? `Siap ${n.nama}` : 'Selesai', n, { talent: !!n && !keSelesai, klien: keSelesai })
  } else if (j === 'DELIVERY') {
    tambah('lanjut', 'Terkirim ke klien', berikut(), { klien: true })
    tambah('menunggu_klien', 'Menunggu client', menungguKlien, { klien: true })
  } else if (j === 'MENUNGGU_KLIEN') {
    tambah('lanjut', 'Client merespons', sebelumnya(['MENUNGGU_KLIEN', 'HOLD']), { klien: true })
  } else if (j === 'HOLD') {
    tambah('lanjut', 'Lanjutkan', sebelumnya(['HOLD', 'MENUNGGU_KLIEN']))
  } else if (j === 'SELESAI') {
    tambah('buka', 'Buka kembali', sebelumnya(['SELESAI']))
  }
  if (!['SELESAI', 'HOLD', 'MENUNGGU_KLIEN'].includes(j)) tambah('hold', 'Tahan (Hold)', cari('HOLD'))
  void pegangKlien
  return hasil
}

/** Validasi templat sebelum disimpan. Mengembalikan daftar pesan galat (kosong = sah). */
export function validasiTemplat(langkah) {
  const galat = []
  const j = (t) => jenisNormal(t.jenis)
  const hitung = (x) => langkah.filter(t => j(t) === x).length
  if (hitung('MASUK') !== 1) galat.push('Harus ada tepat satu langkah Inbox (masuk).')
  if (hitung('SELESAI') !== 1) galat.push('Harus ada tepat satu langkah Selesai.')
  if (hitung('KERJA') < 1) galat.push('Minimal satu tahap pengerjaan.')
  if (hitung('HOLD') > 1) galat.push('Hold maksimal satu.')
  if (hitung('MENUNGGU_KLIEN') > 1) galat.push('"Menunggu client" maksimal satu.')
  if (hitung('FINALISASI') > 1) galat.push('Finalisasi maksimal satu.')
  if (hitung('DELIVERY') > 1) galat.push('Delivery maksimal satu.')
  const nama = new Set()
  for (const t of langkah) {
    if (!t.nama?.trim()) galat.push('Nama langkah tidak boleh kosong.')
    else if (nama.has(t.nama.trim().toLowerCase())) galat.push(`Nama langkah ganda: ${t.nama}`)
    nama.add(t.nama?.trim().toLowerCase())
  }
  const ids = new Set(langkah.map(t => t.id ?? t.kunci))
  for (const t of langkah) {
    if (['QC', 'REVISI_INTERNAL'].includes(j(t)) && t.indukId && !ids.has(t.indukId)) galat.push(`Gerbang "${t.nama}" menunjuk induk yang tidak ada.`)
    if (j(t) === 'REVISI_INTERNAL' && !langkah.some(q => j(q) === 'QC' && (q.indukId ?? null) === (t.indukId ?? null))) galat.push(`"${t.nama}" tidak punya QC yang dituju.`)
  }
  if (hitung('REVISI_KLIEN') > 0 && hitung('PREVIEW_KLIEN') === 0) galat.push('Revisi klien butuh langkah Preview klien.')
  const urutan = [...langkah].sort((a, b) => a.urutan - b.urutan).filter(t => ['MASUK', 'KERJA', 'QC', 'PREVIEW_KLIEN', 'FINALISASI', 'DELIVERY', 'SELESAI'].includes(j(t)))
  if (urutan[0] && j(urutan[0]) !== 'MASUK') galat.push('Inbox harus berada paling awal.')
  if (urutan.at(-1) && j(urutan.at(-1)) !== 'SELESAI') galat.push('Selesai harus berada paling akhir.')
  return galat
}
