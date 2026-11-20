import jwt from 'jsonwebtoken'
import { konteks } from '../utils/konteks.js'

// Saat MENYAMAR (token bertanda `imp`, Super Admin meniru orang lain di web circle) tulisan yang berdampak uang/gaji/presensi DITOLAK
// (21 Okt 2026): presensi & lembur, persetujuan cuti, kas/buku/keuangan, tagihan, target, lembur, serta nilai/item/termin order.
// Menyamar untuk melihat & membantu alur kerja tetap boleh; aksi seperti ini harus dilakukan orangnya sendiri.
const TULIS_TERLARANG_SAAT_MENYAMAR = [
  /^\/api\/circle\/kehadiran\/(catat|lembur)(\/|\?|$)/, /^\/api\/circle\/kehadiran\/cuti\/[^/]+\/(setujui|tolak)/, /^\/api\/circle\/lembur/,
  /^\/api\/circle\/(kas|buku|keuangan|tagihan|penjualan)(\/|\?|$)/, /^\/api\/circle\/kaizen\/target/,
  /^\/api\/circle\/orders\/[^/?]+(\?|$)/, /^\/api\/circle\/orders\/[^/]+\/(item|samakan-nilai|termin)/, /^\/api\/circle\/setoran\//,
  /^\/api\/cpm-bulanan(\/|\?|$)/, /^\/api\/circle\/ltk\/[^/]+\/(deal|konversi)/, /^\/api\/circle\/marketing\/lead\/[^/]+\/jadi-order/, /^\/api\/circle\/orders(\?|$)/,
]

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    // Token dari web circle (aud:'circle') HANYA berlaku untuk /api/circle dan /api/auth — pekerja
    // produksi/marketing tidak bisa menjangkau API Ekosistem lain walau ada endpoint yang terlalu longgar.
    if (payload.aud === 'circle' && !/^\/api\/(circle|auth)(\/|\?|$)/.test(req.originalUrl)) {
      return res.status(403).json({ success: false, message: 'Akses ini hanya untuk Management Dashboard' })
    }
    if (payload.imp && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && TULIS_TERLARANG_SAAT_MENYAMAR.some(p => p.test(req.originalUrl))) {
      return res.status(403).json({ success: false, message: 'Tidak bisa saat menyamar — aksi yang berdampak uang/presensi harus dilakukan orangnya sendiri' })
    }
    req.user = payload
    konteks.run({ imp: payload.imp ?? null }, next)
  } catch {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa' })
  }
}
