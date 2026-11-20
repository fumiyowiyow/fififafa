// Korporasi (PT) tidak lapor mingguan sendiri: ia dianggap SATU dengan unit di bawahnya (indukId).
// Bila salah satu unit di bawahnya sudah lapor, PT ikut dianggap sudah lapor (keputusan user 9 Nov 2026).
// `units` = daftar unit berisi { id, nama, tipe, indukId, sudahLapor }; diubah di tempat, lalu dikembalikan.
export function laporLewatAnak(units) {
  for (const u of units) {
    if (u.tipe !== 'KORPORASI' || u.sudahLapor) continue
    const anak = units.find(a => a.indukId === u.id && a.sudahLapor)
    if (anak) { u.sudahLapor = true; u.laporLewat = anak.nama }
  }
  return units
}
