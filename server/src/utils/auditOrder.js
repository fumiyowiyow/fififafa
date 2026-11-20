import prisma from '../prisma.js'
import { impSekarang } from './konteks.js'

// Jejak audit perubahan order (audit OGS TransactionAuditLog). Gagal mencatat TIDAK boleh menggagalkan aksi utama.
const teks = (v) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 300))
/** Bandingkan field; kembalikan hanya yang berubah: [{field, dari, ke}] */
export function bedaField(lama, baru, fields) {
  const out = []
  for (const f of fields) {
    if (!(f in baru)) continue
    const a = teks(lama[f]), b = teks(baru[f])
    if (a !== b) out.push({ field: f, dari: a, ke: b })
  }
  return out
}
export async function catatAudit(orderId, userId, aksi, perubahan = [{ field: null, dari: null, ke: null }]) {
  try {
    let nama = userId ? (await prisma.user.findUnique({ where: { id: userId }, select: { nama: true } }))?.nama ?? 'Pengguna' : 'Sistem'
    if (!perubahan.length) return
    const imp = impSekarang() // aksi saat Super Admin menyamar → tandai siapa pelaku sebenarnya
    if (imp) nama = `${nama} (disamar oleh ${(await prisma.user.findUnique({ where: { id: imp }, select: { nama: true } }))?.nama ?? 'Super Admin'})`
    await prisma.auditOrder.createMany({ data: perubahan.map(p => ({ orderId, userId, nama, aksi, field: p.field ?? null, dari: p.dari ?? null, ke: p.ke ?? null })) })
  } catch { /* abaikan */ }
}
