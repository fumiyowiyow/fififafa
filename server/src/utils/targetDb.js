import prisma from '../prisma.js'

/** Target omset (USD) per unit per bulan: bila unit punya target per AKUN, target unit = jumlah target akunnya (OGS); selain itu target unit langsung. */
export async function targetUnitRows(studioIds, tahun, bulan = null) {
  if (!studioIds.length) return []
  const bw = bulan ? { bulan } : {}
  const akunStudio = await prisma.akunProduksi.findMany({ where: { studioId: { in: studioIds } }, select: { id: true, studioId: true } })
  const studioDariAkun = new Map(akunStudio.map(a => [a.id, a.studioId]))
  const [unit, akunRows] = await Promise.all([
    prisma.targetOmsetUnit.findMany({ where: { studioId: { in: studioIds }, tahun, ...bw } }),
    prisma.targetOmsetAkun.findMany({ where: { akunId: { in: akunStudio.map(a => a.id) }, tahun, ...bw }, select: { akunId: true, bulan: true, targetUsd: true } }),
  ])
  const akun = akunRows.map(a => ({ ...a, akun: { studioId: studioDariAkun.get(a.akunId) } }))
  const kunci = new Map() // `${studioId}|${bulan}` → {studioId, bulan, targetUsd, dariAkun}
  for (const u of unit) kunci.set(`${u.studioId}|${u.bulan}`, { studioId: u.studioId, bulan: u.bulan, targetUsd: u.targetUsd, dariAkun: false })
  const jumlahAkun = new Map()
  for (const a of akun) { const k = `${a.akun.studioId}|${a.bulan}`; jumlahAkun.set(k, (jumlahAkun.get(k) ?? 0) + a.targetUsd) }
  for (const [k, v] of jumlahAkun) { if (v > 0) { const [studioId, b] = k.split('|'); kunci.set(k, { studioId, bulan: Number(b), targetUsd: Math.round(v * 100) / 100, dariAkun: true }) } }
  return [...kunci.values()]
}
