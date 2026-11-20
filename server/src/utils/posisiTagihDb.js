import prisma from '../prisma.js'
import { posisiTagih } from './tagihan.js'

/** Posisi tagih banyak order sekaligus (lihat `posisiTagih` di utils/tagihan.js) → Map orderId → { harga, dalamTagihan, terbit, dibayarLangsung, belumDitagih }. */
export async function muatPosisiTagih(orderIds) {
  if (!orderIds.length) return new Map()
  const [orders, item, termin] = await Promise.all([
    prisma.orderProduksi.findMany({ where: { id: { in: orderIds } }, select: { id: true, nilaiDisepakati: true, nilaiKotor: true, nilaiBersih: true } }),
    prisma.tagihanKomunitasItem.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true, jumlah: true, tagihan: { select: { status: true } } } }),
    prisma.terminBayarOrder.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true, jumlah: true, dibayarPada: true, tagihanId: true } }),
  ])
  const per = (arr, id) => arr.filter(x => x.orderId === id)
  return new Map(orders.map(o => [o.id, posisiTagih(o, per(item, o.id).map(i => ({ jumlah: i.jumlah, status: i.tagihan.status })), per(termin, o.id))]))
}
