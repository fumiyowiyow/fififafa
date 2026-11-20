import prisma from '../prisma.js'

// KAS PER REKENING web circle (12 Nov 2026, masukan timGrit). Daftar rekening TIDAK dibuat baru: memakai rekening unit di
// Bio studio Ekosistem (StudioRekening) supaya koordinator tidak mengisi dua kali. Web circle hanya memakai id + nama bank + saldo —
// nomor rekening & atas nama tidak pernah dikirim dari sini (aturan rekening). MODE BAYANGAN: saldo di Bio tidak ditulis.
export async function daftarRekening(studioId) {
  const r = await prisma.studioRekening.findMany({ where: { studioId }, orderBy: { createdAt: 'asc' }, select: { id: true, namaBank: true, saldo: true } })
  const hitung = {}, ke = {}
  for (const x of r) hitung[x.namaBank] = (hitung[x.namaBank] ?? 0) + 1
  // dua rekening bank yang sama dibedakan dengan nomor urut (tanpa membuka nomor rekening)
  return r.map(x => { ke[x.namaBank] = (ke[x.namaBank] ?? 0) + 1; return { id: x.id, nama: hitung[x.namaBank] > 1 ? `${x.namaBank} (${ke[x.namaBank]})` : x.namaBank, saldoBio: x.saldo } })
}
export async function rekeningSah(studioId, id) {
  if (!id) return true
  return !!(await prisma.studioRekening.findFirst({ where: { id, studioId }, select: { id: true } }))
}
// rekeningId dari body: undefined = tidak diubah, '' / null = dikosongkan
export const bacaRekeningId = (v) => (v === undefined ? undefined : v ? String(v) : null)
