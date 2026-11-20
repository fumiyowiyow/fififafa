// Dipakai untuk elemen non-button (biasanya <div>) yang bertindak sebagai kontrol klik —
// kartu navigasi, baris expand/collapse, dll — supaya tetap bisa diakses via keyboard
// (Tab + Enter/Space) dan terbaca sebagai kontrol oleh screen reader (dipasangkan dengan
// role="button" tabIndex={0} di elemen yang sama). Dipisah dari konversi ke <button> asli
// karena banyak dari elemen ini membungkus <button> lain di dalamnya (edit/hapus) — nesting
// <button> di dalam <button> adalah HTML tidak valid.
export function onActivate(handler) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler(e)
    }
  }
}
