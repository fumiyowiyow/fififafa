// PRATINJAU LANGSUNG — PDF ASLI di kolom kanan pembuat laporan (arahan Owner 11 Okt 2026:
// "semua preview di sisi kanan, benar-benar real-time, bisa dicek di beberapa slide lain,
// tidak harus klik Pratinjau"). Setiap kali pilihan berubah (`kunci`), dokumen disusun ulang
// dari data yang SUDAH dimuat pemanggil (tanpa ambil ulang ke server) setelah jeda singkat,
// lalu halamannya digambar dengan pdf.js — yang terlihat = berkas yang diunduh.
// Blob terakhir dibagikan ke pemanggil (`onBlob`) supaya tombol Unduh tidak menyusun dua kali.
import { useCallback, useEffect, useRef, useState } from 'react'
import PdfPopout from '../../components/PdfPopout'

const JEDA_MS = 650
const LEBAR_THUMB = 132

// pdf.js dimuat sekali, hanya saat pratinjau pertama dibutuhkan (pustakanya besar). Build
// "legacy" dipakai supaya peramban HP yang lebih tua tetap bisa menggambar halaman.
let pdfjsJanji = null
export function muatPdfjs() {
  if (!pdfjsJanji) {
    pdfjsJanji = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    }).catch((e) => { pdfjsJanji = null; throw e })
  }
  return pdfjsJanji
}

// Satu kanvas = satu render berjalan: render lama di kanvas yang sama dibatalkan dulu (dokumen
// baru tiba saat gambar kecil dokumen lama masih digambar → pdf.js menolak kanvas yang sibuk).
const tugasKanvas = new WeakMap()
export async function gambarHalaman(doc, nomor, kanvas, lebarCss) {
  const hal = await doc.getPage(nomor)
  const dasar = hal.getViewport({ scale: 1 })
  const rasio = Math.min(2, window.devicePixelRatio || 1)
  const vp = hal.getViewport({ scale: (lebarCss / dasar.width) * rasio })
  const lama = tugasKanvas.get(kanvas)
  // cancel() melepas kanvas seketika; janji tugas dokumen yang sudah dihancurkan bisa tak pernah
  // selesai, jadi TIDAK ditunggu.
  if (lama) lama.cancel()
  kanvas.width = Math.round(vp.width)
  kanvas.height = Math.round(vp.height)
  kanvas.style.aspectRatio = `${dasar.width} / ${dasar.height}`
  const tugas = hal.render({ canvasContext: kanvas.getContext('2d'), viewport: vp })
  tugasKanvas.set(kanvas, tugas)
  try {
    await tugas.promise
  } catch (e) {
    if (e?.name !== 'RenderingCancelledException') throw e
  } finally {
    if (tugasKanvas.get(kanvas) === tugas) tugasKanvas.delete(kanvas)
  }
}

/**
 * @param kunci    string yang berubah setiap pilihan tampilan/isi berubah (memicu susun ulang)
 * @param susun    async () => { blob, namaFile } — menyusun PDF dari data yang sudah dipegang
 * @param siap     false = data belum ada (tampilkan `cadangan`)
 * @param cadangan elemen pengganti sebelum PDF pertama jadi (mis. SampulMini)
 * @param onBlob   ({ blob, namaFile, kunci }) → pemanggil memakainya untuk Unduh
 * @param judul    judul popout layar penuh
 */
export default function PratinjauLangsung({ kunci, susun, siap, cadangan = null, onBlob, judul = 'Pratinjau', sub }) {
  const [doc, setDoc] = useState(null)
  const [halaman, setHalaman] = useState(1)
  const [status, setStatus] = useState('kosong') // kosong | menyusun | siap | galat
  const [galat, setGalat] = useState(null)
  const [penuh, setPenuh] = useState(null) // { url, namaFile }
  const urutan = useRef(0)
  const kanvasUtama = useRef(null)
  const wadah = useRef(null)
  const thumbs = useRef([])
  const terakhir = useRef(null)
  const akar = useRef(null)
  const [lompat, setLompat] = useState(false)

  // HP/tablet: tombol melayang ke pratinjau selama kartu laporannya terlihat & pratinjau belum.
  useEffect(() => {
    const kartu = akar.current?.closest('.pembuat-laporan')
    if (!kartu || !akar.current || typeof IntersectionObserver === 'undefined') return
    const lihat = { kartu: false, diri: false }
    const segar = () => setLompat(lihat.kartu && !lihat.diri)
    const io = new IntersectionObserver((daftar) => {
      for (const e of daftar) { if (e.target === kartu) lihat.kartu = e.isIntersecting; else lihat.diri = e.isIntersecting }
      segar()
    }, { threshold: 0.05 })
    io.observe(kartu); io.observe(akar.current)
    return () => io.disconnect()
  }, [])

  // Susun ulang setelah jeda; hasil yang sudah basi (pilihan berubah lagi) dibuang.
  useEffect(() => {
    if (!siap) return
    const no = ++urutan.current
    setStatus(s => (s === 'kosong' ? 'kosong' : 'menyusun'))
    const jeda = setTimeout(async () => {
      try {
        const [hasil, pdfjs] = await Promise.all([susun(), muatPdfjs()])
        if (no !== urutan.current) return
        const data = new Uint8Array(await hasil.blob.arrayBuffer())
        const baru = await pdfjs.getDocument({ data }).promise
        if (no !== urutan.current) { baru.destroy(); return }
        terakhir.current = { ...hasil, kunci }
        onBlob?.(terakhir.current)
        setDoc(lama => { lama?.destroy?.(); return baru })
        setHalaman(h => Math.min(h, baru.numPages))
        setGalat(null)
        setStatus('siap')
      } catch (e) {
        if (no !== urutan.current) return
        setGalat(e?.response?.data?.message || e?.message || 'Pratinjau gagal disusun')
        setStatus('galat')
      }
    }, JEDA_MS)
    return () => clearTimeout(jeda)
  }, [kunci, siap]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { urutan.current++ }, [])

  // Halaman utama: ikut lebar kolom.
  const gambarUtama = useCallback(async () => {
    if (!doc || !kanvasUtama.current || !wadah.current) return
    try { await gambarHalaman(doc, halaman, kanvasUtama.current, wadah.current.clientWidth) } catch { /* dokumen diganti di tengah jalan */ }
  }, [doc, halaman])
  useEffect(() => { gambarUtama() }, [gambarUtama])
  useEffect(() => {
    if (!wadah.current || typeof ResizeObserver === 'undefined') return
    let jeda
    const ro = new ResizeObserver(() => { clearTimeout(jeda); jeda = setTimeout(gambarUtama, 120) })
    ro.observe(wadah.current)
    return () => { ro.disconnect(); clearTimeout(jeda) }
  }, [gambarUtama])

  // Gambar kecil semua halaman (berurutan, ringan) untuk lompat ke slide lain.
  useEffect(() => {
    if (!doc) return
    let batal = false
    ;(async () => {
      for (let i = 1; i <= doc.numPages && !batal; i++) {
        const k = thumbs.current[i - 1]
        if (k) { try { await gambarHalaman(doc, i, k, LEBAR_THUMB) } catch { /* lewati halaman ini */ } }
      }
    })()
    return () => { batal = true }
  }, [doc])

  const jumlah = doc?.numPages ?? 0
  const geser = (arah) => setHalaman(h => Math.max(1, Math.min(jumlah, h + arah)))
  const bukaPenuh = () => {
    if (!terakhir.current?.blob) return
    setPenuh({ url: URL.createObjectURL(terakhir.current.blob), namaFile: terakhir.current.namaFile })
  }
  useEffect(() => () => { if (penuh?.url) URL.revokeObjectURL(penuh.url) }, [penuh])

  return (
    <div className="pl-langsung" ref={akar}>
      <div className="pl-pratinjau-label">
        <span>Pratinjau Langsung</span>
        <small className={`pl-langsung-status ${status}`} aria-live="polite">
          {status === 'menyusun' || (status === 'kosong' && siap) ? 'memperbarui…' : status === 'galat' ? 'gagal' : status === 'siap' ? 'sesuai pilihan' : ''}
        </small>
      </div>

      <div className="pl-langsung-layar" ref={wadah}>
        {doc ? (
          <canvas ref={kanvasUtama} className="pl-langsung-kanvas" aria-label={`Halaman ${halaman} dari ${jumlah}`} />
        ) : cadangan}
        {doc && status === 'menyusun' && <span className="pl-langsung-tirai"><span className="spinner" /></span>}
      </div>
      {status === 'galat' && galat && <p className="pl-pesan pl-pesan-peringatan">{galat}</p>}

      {jumlah > 0 && (
        <>
          <div className="pl-langsung-nav">
            <button type="button" className="btn btn-ghost" onClick={() => geser(-1)} disabled={halaman <= 1} aria-label="Halaman sebelumnya">‹</button>
            <span><b>{halaman}</b> / {jumlah}</span>
            <button type="button" className="btn btn-ghost" onClick={() => geser(1)} disabled={halaman >= jumlah} aria-label="Halaman berikutnya">›</button>
            <button type="button" className="btn btn-ghost pl-langsung-penuh" onClick={bukaPenuh} title="Buka layar penuh">⛶ Layar Penuh</button>
          </div>
          <div className="pl-langsung-thumbs" role="tablist" aria-label="Halaman">
            {Array.from({ length: jumlah }, (_, i) => (
              <button key={`${i}-${jumlah}`} type="button" role="tab" aria-selected={halaman === i + 1}
                className={`pl-langsung-thumb${halaman === i + 1 ? ' aktif' : ''}`} onClick={() => setHalaman(i + 1)} title={`Halaman ${i + 1}`}>
                <canvas ref={el => { thumbs.current[i] = el }} />
                <span>{i + 1}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className={`pl-langsung-lompat${lompat ? ' tampil' : ''}`}
        onClick={() => akar.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
        <span aria-hidden>👁</span> Pratinjau{jumlah ? ` · ${jumlah} hal` : ''}
      </button>

      {penuh && <PdfPopout judul={judul} sub={sub} url={penuh.url} namaFile={penuh.namaFile} onClose={() => setPenuh(null)} />}
    </div>
  )
}
