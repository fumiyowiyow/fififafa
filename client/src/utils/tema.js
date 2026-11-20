// Mode tampilan aplikasi (13 Okt 2026): 'light' | 'dark', dipasang sebagai <html data-theme>.
// Nilai awal dipasang skrip kecil di index.html SEBELUM React jalan (biar gak kedip); di sini
// cuma baca/ubah. Pilihan diingat per perangkat (localStorage 'md-tema'); belum pernah
// memilih = ikut setelan sistem. Warnanya sendiri: :root / :root[data-theme="light"] di
// styles/index.css.
import { useEffect, useState } from 'react'

const KUNCI = 'md-tema'
const EVENT = 'md-tema-berubah'

export function temaSekarang() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

export function aturTema(tema) {
  const t = tema === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', t)
  try { localStorage.setItem(KUNCI, t) } catch { /* mode privat: cukup berlaku sesi ini */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }))
}

/** [tema, aturTema] — ikut berubah kalau tema diganti dari tempat lain. */
export function useTema() {
  const [tema, setTema] = useState(temaSekarang)
  useEffect(() => {
    const ikut = () => setTema(temaSekarang())
    window.addEventListener(EVENT, ikut)
    return () => window.removeEventListener(EVENT, ikut)
  }, [])
  return [tema, aturTema]
}
