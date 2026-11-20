// Transparansi warna yang aman untuk variabel tema (13 Okt 2026). Dulu ditulis `${warna}20`
// (sambung kode alpha hex) -- cuma jalan kalau `warna` berupa hex, rusak begitu warnanya
// var(--green) dkk (mode terang/gelap). color-mix menerima hex MAUPUN var().
export const alfa = (warna, persen) => `color-mix(in srgb, ${warna} ${persen}%, transparent)`
