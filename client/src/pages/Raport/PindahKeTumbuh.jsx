// Raport siswa PINDAH ke web Jalur Tumbuh (22 Okt 2026, keputusan Faizal): raport Karir Anak hanya diisi di
// https://tumbuh.kariranak.com — formatnya sama (disalin dari sini), ditambah data laporan harian, renstra, dan
// lembaga kolaborasi. Di Ekosistem belum pernah ada raport yang diisi (0 data), jadi tidak ada yang dipindah.
// Endpoint /api/raport di server sengaja belum dihapus.
export const ALAMAT_TUMBUH = 'https://tumbuh.kariranak.com'

export default function PindahKeTumbuh({ ringkas = false }) {
  return (
    <section className="card" style={{ marginBottom: ringkas ? 20 : 0 }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>🎓 Raport Siswa sekarang di Jalur Tumbuh</h3>
      <p style={{ marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Raport Karir Anak (Vokasi, SMK, KBU, Homeschooler) kini diisi dan diunduh di web pendidikan <b>Jalur Tumbuh</b>.
        Formatnya sama seperti di sini, ditambah data otomatis dari laporan harian, renstra bulanan, dan logo lembaga kolaborasi.
        {!ringkas && ' Akun untuk mentor dibuatkan admin Jalur Tumbuh.'}
      </p>
      <a className="btn btn-primary" href={ALAMAT_TUMBUH} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12, display: 'inline-block' }}>
        Buka Jalur Tumbuh →
      </a>
    </section>
  )
}
