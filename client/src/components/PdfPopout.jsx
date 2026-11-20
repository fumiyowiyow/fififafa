// ── Popout pratinjau PDF (arahan Owner 6 Sep 2026) ───────────────────────
// Pratinjau TIDAK membuka tab baru: modal langsung muncul saat tombol
// ditekan (tanpa menunggu render PDF), dokumen menyusul di dalamnya begitu
// blob siap — pustaka @react-pdf dipanaskan lebih awal oleh pemanggil supaya
// jeda nyaris tak terasa.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Mode LIHAT SAJA (arahan Owner 11 Okt 2026: SKB/SKP unit lain hanya bisa dipreview): halaman
 *  digambar pdf.js ke kanvas — tanpa tombol unduh dan tanpa penampil PDF bawaan peramban. */
function HalamanKanvas({ url }) {
  const wadah = useRef(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    let batal = false
    let doc = null
    ;(async () => {
      const { muatPdfjs, gambarHalaman } = await import('../pages/Reports/PratinjauLangsung')
      const pdfjs = await muatPdfjs()
      const data = new Uint8Array(await (await fetch(url)).arrayBuffer())
      doc = await pdfjs.getDocument({ data }).promise
      if (batal) return
      setN(doc.numPages)
      await new Promise(r => requestAnimationFrame(r))
      const kanvas = [...(wadah.current?.querySelectorAll('canvas') ?? [])]
      for (let i = 0; i < kanvas.length && !batal; i++) await gambarHalaman(doc, i + 1, kanvas[i], wadah.current.clientWidth - 24)
    })().catch(() => {})
    return () => { batal = true; doc?.destroy?.() }
  }, [url])
  return (
    <div ref={wadah} onContextMenu={e => e.preventDefault()}
      style={{ height: '100%', overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: n }, (_, i) => <canvas key={i} style={{ width: '100%', height: 'auto', borderRadius: 6, background: '#fff' }} />)}
      {!n && <div style={{ margin: 'auto', color: 'var(--text-muted)' }}><span className="spinner" /></div>}
    </div>
  )
}

export default function PdfPopout({ judul, sub, url, namaFile, onClose, autoUnduh = false, tanpaUnduh = false }) {
  const unduh = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = namaFile
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  // Mode "PDF": begitu dokumen siap di pratinjau, unduhan menyusul otomatis
  // (sekali saja) — arahan Owner: previewkan dulu, baru download otomatis.
  const sudahUnduh = useRef(false)
  useEffect(() => {
    if (autoUnduh && url && !sudahUnduh.current) { sudahUnduh.current = true; unduh() }
  }, [autoUnduh, url]) // eslint-disable-line react-hooks/exhaustive-deps

  // PORTAL ke body — WAJIB: pemanggilnya kerap berada di dalam .card /
  // .modal-box tema kaca yang ber-backdrop-filter, dan backdrop-filter
  // menjadikan elemen itu containing block untuk position:fixed → tanpa
  // portal, overlay terkurung & terpotong di dalam kartu (bug pratinjau).
  // z 400: menang dari laci biodata (drawer-panel z 301).
  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 400 }}>
      <div className="modal-box animate-pop-turun" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 1040, width: '96vw', height: '88vh', display: 'flex', flexDirection: 'column', padding: 0, gap: 0, overflow: 'hidden' }}>
        <div className="modal-header" style={{ flexShrink: 0, padding: '14px 18px', marginBottom: 0 }}>
          <div>
            <div className="modal-title">📄 {judul}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!tanpaUnduh && (
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={unduh} disabled={!url}>
                ⬇ Unduh PDF
              </button>
            )}
            <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: 'hsl(250 30% 8%)' }}>
          {url && tanpaUnduh ? (
            <HalamanKanvas url={url} />
          ) : url ? (
            <iframe title={judul} src={`${url}#toolbar=0&view=FitH`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
              <span className="spinner" style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 12.5 }}>Menyusun dokumen…</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
