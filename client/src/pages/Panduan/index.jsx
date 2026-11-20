import { useAuth } from '../../context/AuthContext'
import { ECOSYSTEM_NAME, TELEGRAM_BOT } from '../../config/ecosystem'
import { alfa } from '../../utils/warna'
import { ALAMAT_TUMBUH } from '../Raport/PindahKeTumbuh'
import LabelJalur from '../../components/common/LabelJalur'

const ADMIN_ROLES  = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL']
const KOOR_ROLES   = ['KOORDINATOR', 'PENDAMPING']

function getTier(roles = []) {
  if (roles.some(r => ADMIN_ROLES.includes(r.roleType))) return 'admin'
  if (roles.some(r => KOOR_ROLES.includes(r.roleType)))  return 'koordinator'
  return 'dasar'
}

// Label ADVISOR "Super Admin" (bukan "Advisor" polos) -- samain ke getRoleLabel canonical di
// client/src/utils/roles.js, biar gak ketuker sama PENASIHAT ("Advisor" posisi studio, role beda).
function getRoleLabel(roleType) {
  const map = {
    ADVISOR: 'Super Admin', KEPALA_EKOSISTEM: 'Kepala Ekosistem',
    KEPALA_CIRCLE: 'Kepala Circle', KEPALA_RUMAH_USAHA: 'Kepala Rumah Usaha', ADMIN_FUNGSIONAL: 'Admin Fungsional',
    PENDAMPING: 'Pendamping', KOORDINATOR: 'Koordinator',
    KADER: 'Kader', KARYAWAN: 'Karyawan', MAGANG: 'Magang',
  }
  return map[roleType] ?? roleType
}

// `params` = tab tujuan di halaman hub (mis. { tab: 'koperasi' } di Keuangan).
function PageCard({ emoji, title, desc, page, params, onNavigate, color = 'var(--accent)' }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.2s', cursor: 'pointer',
    }}
      onClick={() => onNavigate(page, params)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{title}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
      <button onClick={e => { e.stopPropagation(); onNavigate(page, params) }}
        style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color, background: 'none',
          border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        Buka halaman →
      </button>
    </div>
  )
}

function TaskItem({ freq, freqColor, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 14, paddingBottom: 16,
      borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: alfa(freqColor, 13), color: freqColor, whiteSpace: 'nowrap' }}>
          {freq}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  )
}

// Isi panduan mengikuti menu ringkas (13 Okt 2026): Keuangan & SDM adalah hub bertab -- teks
// menyebut "Menu › Tab", dan kartu membuka tab yang tepat lewat `params`.
// Anak magang (temuan trial 22 Okt 2026): absen tetap di web circle, laporan harian di Jalur Tumbuh.
function TierDasar({ onNavigate, magang }) {
  return (
    <>
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Tugas Rutinmu</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {magang && <>
            <TaskItem freq="Setiap hari" freqColor="var(--red)"
              title="Absen masuk & pulang"
              desc="Absen di web circle seperti biasa: tekan Masuk saat mulai, Pulang saat selesai. Izin atau sakit juga dicatat di sana." />
            <TaskItem freq="Setiap hari" freqColor="var(--red)"
              title="Kirim laporan harian"
              desc={<>Laporan harian ditulis di <b>Jalur Tumbuh</b>: buka <a href={ALAMAT_TUMBUH} target="_blank" rel="noopener noreferrer">tumbuh.kariranak.com</a>, masuk dengan email &amp; sandi Ekosistem-mu, lalu klik <b>Tulis laporan</b> di Beranda — paling lambat jam 20.00. Ceritakan apa yang kamu kerjakan dan pelajari hari itu.</>} />
          </>}
          <TaskItem freq="Setiap bulan" freqColor="var(--cyan)"
            title="Lapor simpanan Koperasi"
            desc="Buka Keuangan › Koperasi → klik Lapor Setoran di baris namamu. Transfer dulu ke rekening koperasi, upload bukti ke Google Drive, tempel linknya." />
          <TaskItem freq="Kapan saja" freqColor="var(--green)"
            title="Lengkapi data diri di Profil"
            desc="Pastikan foto profil, nomor WA, rekening bank, dan data lainnya sudah terisi. Data ini dipakai untuk keperluan administrasi." />
          <TaskItem freq="Kapan saja" freqColor="var(--amber)"
            title="Baca Pengumuman"
            desc="Cek halaman Pengumuman secara berkala untuk info terbaru dari koordinator dan manajemen ekosistem." />
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Halaman yang Perlu Kamu Tahu</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          <PageCard emoji="👤" title="Profil Saya" page="Profile" onNavigate={onNavigate} color="var(--green)"
            desc="Edit data diri, foto profil, nomor rekening, dan ganti password." />
          <PageCard emoji="🏦" title="Koperasi" page="Finance" params={{ tab: 'koperasi' }} onNavigate={onNavigate} color="var(--cyan)"
            desc="Ada di menu Keuangan. Lapor setoran simpanan bulanan, tempel bukti transfer, tunggu konfirmasi admin." />
          <PageCard emoji="📣" title="Pengumuman" page="Announcement" onNavigate={onNavigate} color="var(--amber)"
            desc="Baca info terbaru dari koordinator dan manajemen. Termasuk pengumuman ekosistem, circle, dan studio." />
          <PageCard emoji="📅" title="Kalender" page="Calendar" onNavigate={onNavigate} color="var(--pink)"
            desc="Lihat jadwal event ekosistem, deadline, dan kegiatan studio yang akan datang." />
        </div>
      </section>
    </>
  )
}

// "Mana yang dipakai?" (1 Nov 2026) -- selama mode bayangan web circle ada dua jalur angka uang.
// Kamus istilahnya: openspec.md § KAMUS ISTILAH UANG. Web circle sendiri tidak diubah (keputusan user 1 Nov 2026).
const JALUR_UANG = [
  ['Pengeluaran', 'resmi', 'Keuangan › Pengeluaran (yang dicatat di web circle › Keuangan › Minggu ini ikut muncul di sana)', 'Biaya', 'web circle › Biaya & Kas'],
  ['Kas rekening', 'resmi', 'saldo di Unit › Bio Studio › Rekening Bank (atau tombol Update Kas)', 'Kas akhir buku besar', 'web circle › Tutup bulan'],
  ['Biaya rutin (CPM)', 'resmi', 'Unit › Bio Studio › Biaya rutin bulanan', 'Item tetap', 'web circle › Tutup bulan › Item tetap'],
  ['Omzet laporan', 'resmi', 'Keuangan › Laporan Omset (diisi tiap Sabtu)', 'Omzet order', 'web circle › Penjualan / Bayangan omzet'],
]

function JalurUang() {
  return (
    <section style={{ marginTop: 32 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 8 }}>Angka uang: mana yang dipakai?</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
        <LabelJalur jenis="resmi" /> masuk laporan {ECOSYSTEM_NAME} — ini yang wajib diisi.{' '}
        <LabelJalur jenis="bayangan" /> uji coba di web circle, belum masuk laporan. Laporan, Forecasting
        dan Rekap {ECOSYSTEM_NAME} hanya menghitung angka resmi.
      </p>
      <div className="list-ringkas" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        {JALUR_UANG.map(([resmi, , tempat, bayangan, tempatBayangan]) => (
          <div key={resmi} className="item-ringkas" style={{ padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}>
            <div><b>{resmi}</b> <LabelJalur jenis="resmi" /> <span style={{ color: 'var(--text-secondary)' }}>— {tempat}</span></div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>beda dengan <b>{bayangan}</b> <LabelJalur jenis="bayangan" /> — {tempatBayangan}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TierKoordinator({ onNavigate, studioNama }) {
  return (
    <>
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Tugas Rutinmu</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <TaskItem freq="Setiap Sabtu ⚡" freqColor="var(--red)"
            title="Isi Laporan Omset Mingguan"
            desc={`Deadline Sabtu! Buka Keuangan › Laporan Omset → Input Laporan. Isi omset per platform (Fiverr, Etsy, Upwork, VGen, dll)${studioNama ? ` untuk ${studioNama}` : ''}. Kas terisi otomatis dari saldo Rekening Bank — kamu tidak perlu mengetiknya.`} />
          <TaskItem freq="Setiap ada belanja" freqColor="var(--amber)"
            title="Catat pengeluaran per item"
            desc="Keuangan › Pengeluaran: pilih unit & bulan, buka minggunya, lalu catat tanggal, kategori, nama, jumlah. Total di Laporan Omset minggu itu terisi otomatis. Biaya rutin (THP, langganan, support) sudah masuk CPM, jangan dicatat lagi." />
          <TaskItem freq="Saat saldo berubah" freqColor="var(--cyan)"
            title="Perbarui saldo Rekening Bank"
            desc="Keuangan › Financial Forecasting → buka circle-mu → tombol Update Kas di baris studio. Bisa juga lewat Unit › Bio Studio › Rekening Bank. Kas di laporan & dashboard ikut otomatis." />
          <TaskItem freq="Setiap bulan" freqColor="var(--accent)"
            title="Isi Penilaian Kader"
            desc="SDM › Performa Kader → pilih anggotamu → tab Penilaian Kader. Minimal sebulan sekali. Hasilnya muncul sebagai Kondisi Tim studiomu di Kepatuhan Laporan." />
          <TaskItem freq="Setiap bulan" freqColor="var(--green)"
            title="Lapor simpanan Koperasi"
            desc="Keuangan › Koperasi. Kamu bisa lapor untuk dirimu sendiri dan untuk anggota studiomu yang belum lapor." />
          <TaskItem freq="Kapan perlu" freqColor="var(--pink)"
            title="Proses lamaran di Rekrutmen"
            desc="Angka merah di menu SDM berarti ada calon anggota baru menunggu. Buka SDM › Rekrutmen, geser status ke Seleksi → Diterima/Ditolak." />
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Halaman yang Perlu Kamu Kuasai</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          <PageCard emoji="📊" title="Laporan Omset" page="Finance" params={{ tab: 'omset' }} onNavigate={onNavigate} color="var(--red)"
            desc="Menu Keuangan, tab pertama. Isi setiap Sabtu: omset per platform & pengeluaran per item. Ada riwayat laporan juga." />
          <PageCard emoji="🧾" title="Pengeluaran" page="Finance" params={{ tab: 'pengeluaran' }} onNavigate={onNavigate} color="var(--amber)"
            desc="Menu Keuangan. Satu tempat untuk melihat & mencatat pengeluaran unitmu per bulan, dikelompokkan per minggu laporan." />
          <PageCard emoji="📈" title="Financial Forecasting" page="Finance" params={{ tab: 'forecasting' }} onNavigate={onNavigate} color="var(--cyan)"
            desc="Kas, CPM, omset & target studiomu dalam satu layar, plus tombol Update Kas." />
          <PageCard emoji="✍️" title="Performa Kader" page="SDM" params={{ tab: 'kader' }} onNavigate={onNavigate} color="var(--accent-light)"
            desc="Menu SDM. Isi Penilaian Kader anggotamu dan rekam riwayat perjalanan mereka." />
          <PageCard emoji="🏦" title="Koperasi" page="Finance" params={{ tab: 'koperasi' }} onNavigate={onNavigate} color="var(--green)"
            desc="Menu Keuangan. Lapor setoran untukmu dan anggota studiomu, pantau status bayar bulan ini." />
          <PageCard emoji="🎯" title="Goals & Roadmap" page="Goals" onNavigate={onNavigate} color="var(--amber)"
            desc="Update progress goals studiomu, tambah goal baru, dan pantau target yang sudah dicapai." />
          <PageCard emoji="🧑‍💼" title="Rekrutmen" page="SDM" params={{ tab: 'rekrutmen' }} onNavigate={onNavigate} color="var(--pink)"
            desc="Menu SDM. Proses calon anggota baru dari jalur Live-In, Referral, atau Langsung." />
          <PageCard emoji="📣" title="Pengumuman" page="Announcement" onNavigate={onNavigate} color="var(--amber)"
            desc="Baca pengumuman dan cek Checklist Mingguan yang bisa langsung kamu tandai & salin ke WA." />
        </div>
      </section>
    </>
  )
}

function TierAdmin({ onNavigate }) {
  return (
    <>
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Tugas Rutinmu</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <TaskItem freq="Setiap Sabtu" freqColor="var(--accent)"
            title="Pantau Kepatuhan Laporan"
            desc="Cek siapa yang sudah dan belum lapor omset, sekaligus Kondisi Tim tiap studio (dari Penilaian Kader). Hubungi yang belum lapor lewat Telegram atau koordinatornya." />
          <TaskItem freq="Setiap Sabtu" freqColor="var(--cyan)"
            title="Review keuangan studio"
            desc="Keuangan › Financial Forecasting: kas, CPM, omset & target semua unit per circle. Detail laporan per minggu ada di tab Laporan Omset & Rekap Bulanan." />
          <TaskItem freq="Setiap bulan" freqColor="var(--red)"
            title="Konfirmasi setoran Koperasi"
            desc="Angka merah di menu Keuangan = ada setoran menunggu. Buka Keuangan › Koperasi, cek bukti transfer, klik Konfirmasi." />
          <TaskItem freq="Setiap minggu" freqColor="var(--cyan)"
            title="Update kas Circle / Rumah Usaha"
            desc="Keuangan › Dana & Pos → Kas Circle & Rumah Usaha. Hasilnya tampil sebagai Pos Rumah di Financial Forecasting." />
          <TaskItem freq="Setiap bulan" freqColor="var(--green)"
            title="Input data keuangan bulanan"
            desc="Keuangan › Dana & Pos: update Dana Ekosistem (Dana PE, Forum, Berkah)." />
          <TaskItem freq="Awal bulan" freqColor="var(--accent-light)"
            title="Unduh Monthly Report"
            desc="Unduh Laporan → Monthly Report: pilih circle-mu (atau satu ekosistem), bulan lalu, tema Terang/Gelap & sampul. Lihat Pratinjau Langsung, lalu unduh PDF-nya." />
          <TaskItem freq="Kapan perlu" freqColor="var(--amber)"
            title="Kelola Anggota"
            desc="SDM › Anggota: onboarding anggota baru (dari Rekrutmen atau langsung), atur role, set studio/circle, nonaktifkan yang sudah keluar." />
          <TaskItem freq="Kapan perlu" freqColor="var(--pink)"
            title="Buat Pengumuman"
            desc="Kirim pengumuman ke ALL / Circle / Studio tertentu. Pengumuman juga bisa dikirim ke Telegram otomatis." />
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Halaman yang Perlu Kamu Kuasai</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          <PageCard emoji="🏥" title="Kepatuhan Laporan" page="Health" onNavigate={onNavigate} color="var(--accent)"
            desc="Siapa yang sudah/belum lapor, skor kepatuhan per studio & circle, dan Kondisi Tim dari Penilaian Kader." />
          <PageCard emoji="💰" title="Keuangan" page="Finance" params={{ tab: 'forecasting' }} onNavigate={onNavigate} color="var(--green)"
            desc="Satu menu untuk uang: Laporan Omset, Financial Forecasting, Rekap Bulanan, Koperasi, Dana & Pos." />
          <PageCard emoji="👥" title="SDM" page="SDM" onNavigate={onNavigate} color="var(--accent-light)"
            desc="Satu menu untuk orang: Anggota, Performa Kader, Rekrutmen, Payroll." />
          <PageCard emoji="📈" title="Performa" page="Performance" onNavigate={onNavigate} color="var(--cyan)"
            desc="Ranking omset studio per bulan. Lihat tren dan perbandingan performa antar studio." />
          <PageCard emoji="🗄️" title="Unit" page="MasterData" onNavigate={onNavigate} color="var(--cyan)"
            desc="Kelola circle, rumah usaha, studio, rekening bank studio, upload SKB, dan lihat struktur tim lengkap." />
          <PageCard emoji="📥" title="Unduh Laporan" page="Reports" onNavigate={onNavigate} color="var(--accent-light)"
            desc="Monthly Report slide 16:9 per circle/ekosistem dengan pratinjau langsung, plus laporan status mingguan & CSV." />
          <PageCard emoji="🎯" title="Goals & Roadmap" page="Goals" onNavigate={onNavigate} color="var(--amber)"
            desc="Buat dan pantau goals ekosistem, circle, dan studio. Update progress dan set deadline." />
          <PageCard emoji="📣" title="Pengumuman" page="Announcement" onNavigate={onNavigate} color="var(--pink)"
            desc="Buat pengumuman ke seluruh ekosistem atau target spesifik. Kirim juga ke Telegram otomatis." />
        </div>
      </section>
    </>
  )
}

export default function Panduan({ onNavigate }) {
  const { user } = useAuth()
  const roles = user?.roles ?? []
  const tier  = getTier(roles)

  const primaryRole = roles[0]
  const roleLabel   = getRoleLabel(primaryRole?.roleType)
  const studioNama  = primaryRole?.studio?.nama ?? null
  const circleNama  = primaryRole?.circle?.nama ?? null

  const tierMeta = {
    admin:       { label: 'Admin / Kepala', color: 'var(--accent)',  bg: 'color-mix(in srgb, var(--accent) 12%, transparent)',  emoji: '🏛️' },
    koordinator: { label: 'Koordinator',    color: 'var(--cyan)',  bg: 'color-mix(in srgb, var(--cyan) 12%, transparent)',   emoji: '🎯' },
    dasar:       { label: 'Anggota',        color: 'var(--green)',  bg: 'color-mix(in srgb, var(--green) 12%, transparent)',  emoji: '👤' },
  }[tier]

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1>Panduan Mulai dari Sini</h1>
        <p>Panduan lengkap penggunaan dashboard sesuai peranmu di ekosistem {ECOSYSTEM_NAME}</p>
      </div>

      {/* Welcome card */}
      <div style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--cyan) 6%, transparent))',
        border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: 14,
        padding: '24px 28px', margin: '24px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            Halo, {user?.nama?.split(' ')[0] ?? 'Anggota'}! 👋
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
              background: tierMeta.bg, color: tierMeta.color }}>
              {tierMeta.emoji} {roleLabel}
            </span>
            {studioNama && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                {studioNama}
              </span>
            )}
            {circleNama && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                {circleNama}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
            {tier === 'admin'       && 'Panduan di bawah disesuaikan untuk peranmu sebagai pengelola ekosistem. Kamu punya akses penuh ke semua fitur.'}
            {tier === 'koordinator' && 'Panduan di bawah disesuaikan untuk peranmu sebagai koordinator/pendamping. Fokus utamamu adalah laporan omset mingguan dan perkembangan tim.'}
            {tier === 'dasar'       && `Panduan di bawah disesuaikan untukmu. Fokus utama: Koperasi dan Profil. Task Kanban studiomu bisa dicek lewat Telegram Bot (@${TELEGRAM_BOT}).`}
          </p>
        </div>
        <div style={{ fontSize: 56, opacity: 0.7, flexShrink: 0 }}>{tierMeta.emoji}</div>
      </div>

      {/* Tier content */}
      {tier === 'admin'       && <TierAdmin       onNavigate={onNavigate} />}
      {tier === 'koordinator' && <TierKoordinator onNavigate={onNavigate} studioNama={studioNama} />}
      {tier !== 'dasar'       && <JalurUang />}
      {tier === 'dasar'       && <TierDasar       onNavigate={onNavigate} magang={roles.some(r => r.roleType === 'MAGANG')} />}

      {/* Footer note */}
      <div style={{ marginTop: 40, padding: '16px 20px', background: 'var(--bg-surface)',
        borderRadius: 10, border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>
          💡 <strong style={{ color: 'var(--text-secondary)' }}>Tips:</strong> Gunakan Telegram Bot <strong style={{ color: 'var(--text-secondary)' }}>@{TELEGRAM_BOT}</strong> untuk laporan omset, cek kas, dan status kanban langsung dari HP tanpa buka dashboard.
          Ketik <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>/help</code> di bot untuk lihat daftar perintah.
        </p>
      </div>
    </>
  )
}
