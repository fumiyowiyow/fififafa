// Total kompensasi seseorang = THP dari semua posisi studio dia + bagian SHU dari semua studio
// yang dia miliki. SHU studio itu SATU angka tetap (studio.totalShu, "fix ditentukan" — bukan
// riwayat/dihitung dari kas), jadi bagian tiap pemilik dihitung on-the-fly:
// studio.totalShu * persenSaham / 100. Kalau studio.statusShu false, studio itu belum/tidak
// mengeluarkan SHU sama sekali -> dianggap 0 walau ada persenSaham.
export function computeTotalKompensasi(roles = [], studioPemilik = []) {
  const totalThp = roles.reduce((sum, r) => sum + (r.studioId && r.takeHomePay ? r.takeHomePay : 0), 0)
  const totalShu = studioPemilik.reduce((sum, p) => {
    if (!p.studio?.statusShu) return sum
    return sum + (p.studio.totalShu * p.persenSaham) / 100
  }, 0)
  return { totalThp, totalShu, totalKompensasi: totalThp + totalShu }
}
