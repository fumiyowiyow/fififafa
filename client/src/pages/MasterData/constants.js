export { TIPE_UNIT as TIPE_OPTIONS } from '../../utils/tipeUnit'
export const CIRCLE_COLORS_DEFAULT = ['#7C3AED','#0D9488','#EA580C','#1D4ED8','#059669','#F59E0B','#EF4444','#EC4899']

// ADVISOR (role admin ecosystem-wide) -- label "Super Admin", biar gak ketuker sama PENASIHAT
// ("Advisor" posisi studio, role BEDA) -- lihat komentar sama di client/src/utils/roles.js.
export const ROLE_LABEL = { KOORDINATOR: 'Koordinator', KARYAWAN: 'Karyawan', MAGANG: 'Magang', KEPALA_CIRCLE: 'Kepala Circle', KEPALA_RUMAH_USAHA: 'Kepala Rumah Usaha', ADMIN_FUNGSIONAL: 'Admin', PENDAMPING: 'Pendamping', KADER: 'Kader', ADVISOR: 'Super Admin', KEPALA_EKOSISTEM: 'Kepala Ekosistem', DIGNITY: 'Dignity', PENASIHAT: 'Advisor' }
export const ROLE_COLOR = { KOORDINATOR: '#7C3AED', KARYAWAN: '#EA580C', MAGANG: '#84CC16', KEPALA_CIRCLE: '#0D9488', KEPALA_RUMAH_USAHA: '#0EA5E9', ADMIN_FUNGSIONAL: '#F59E0B', PENDAMPING: '#6366F1', DIGNITY: '#DB2777', PENASIHAT: '#A855F7' }

export function studioInitials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}
