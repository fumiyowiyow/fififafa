import prisma from '../prisma.js'

// Lingkup data induk freelancer = circle (atau rumah usaha) pencatat; antar circle terisolasi (aturan keras).
export async function lingkupStudio(studioId) {
  const st = await prisma.studio.findUnique({ where: { id: studioId }, select: { circleId: true, rumahUsahaId: true } })
  const kunci = st?.circleId ? `c:${st.circleId}` : st?.rumahUsahaId ? `r:${st.rumahUsahaId}` : `s:${studioId}`
  const filter = st?.circleId ? { circleId: st.circleId } : st?.rumahUsahaId ? { rumahUsahaId: st.rumahUsahaId } : { id: studioId }
  const ids = (await prisma.studio.findMany({ where: filter, select: { id: true } })).map(s => s.id)
  return { kunci, ids }
}
/** where Prisma: freelancer yang terlihat oleh unit `studioId` (13 Nov 2026, masukan tim — ada freelancer yang tidak mau dimunculkan ke studio lain):
 *  milik unit ini · pernah mengerjakan order unit ini · dibagikan unit lain di circle yang sama · data lama tanpa pencatat (masih selingkup circle). */
export const whereFreelancerTerlihat = (l, studioId) => ({ OR: [
  { studioId },
  { assignments: { some: { order: { studioId } } } },
  { bagikan: true, OR: [{ lingkupKunci: l.kunci }, { studioId: { in: l.ids } }] },
  { studioId: null, OR: [{ lingkupKunci: l.kunci }, { assignments: { some: { order: { studioId: { in: l.ids } } } } }] },
] })

/** Freelance yang ditambahkan dari order (Buat order / Tim order) otomatis masuk data induk Freelancer lingkup ini (12 Nov 2026, masukan tim).
 *  Cocok nama (tanpa beda huruf besar/kecil) di antara yang terlihat oleh unit ini → dipakai; belum ada → dibuat (hanya nama; kontak & rekening dilengkapi di menu Freelancer). */
export async function pastikanFreelancer(studioId, nama) {
  const l = await lingkupStudio(studioId)
  const ada = await prisma.talentEksternal.findFirst({ where: { nama: { equals: nama, mode: 'insensitive' }, ...whereFreelancerTerlihat(l, studioId) }, select: { id: true } })
  if (ada) return ada.id
  return (await prisma.talentEksternal.create({ data: { nama, lingkupKunci: l.kunci, studioId } })).id
}
