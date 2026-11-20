import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatRp, formatUSD, getBulanLabel } from '../../utils/format'

// HALAMAN "WEB CIRCLE" (14 Nov 2026, permintaan Founder): ringkasan semua circle & unit web circle tanpa membuka alamatnya satu per satu.
// Data dibaca langsung dari database yang sama (bukan salinan) — server: /api/web-circle/ringkasan (controllers/ringkasanCircle.js).
// Isi mengikuti wilayah orang yang membuka: Founder/Co-Founder semua, Kepala Circle circle-nya, Koordinator/Pendamping unitnya.
// Angka web circle = BAYANGAN; omset resmi tetap Laporan Omset (Keuangan).
// Tampilan (revisi 14 Nov sore, masukan Founder): uang ditulis PENUH dalam rupiah — tanpa singkatan "M/B" (di Indonesia "M" dibaca miliar);
// isi kartu berupa baris berlabel; tabel hanya kolom utama, rinciannya muncul saat baris unit diklik.

const labelBulan = (b) => getBulanLabel(Number(b.slice(5, 7)), Number(b.slice(0, 4))) // 'YYYY-MM' → 'November 2026'
const JENIS = { korporasi: 'Korporasi', circle: 'Circle', rumah: 'Rumah Usaha' }
const STATUS_TARGET = { ahead: 'var(--green)', 'on-track': 'var(--green)', behind: 'var(--amber)', critical: 'var(--red)' }
const MERAH = 'var(--red)', REDUP = 'var(--text-muted)'
const uang = (n) => <span style={{ color: n < 0 ? MERAH : undefined, whiteSpace: 'nowrap' }}>{formatRp(n)}</span>

/** Satu baris "label ...... nilai" di kartu & rincian. */
function Baris({ label, nilai, warna }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: warna ?? 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }}>{nilai}</span>
    </div>
  )
}

function Kartu({ judul, nilai, warna, baris }) {
  return (
    <div className={`stat-card ${warna ?? ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{judul}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{nilai}</div>
      <div>{baris.map(([l, v, w]) => <Baris key={l} label={l} nilai={v} warna={w} />)}</div>
    </div>
  )
}

function Blok({ judul, children }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{judul}</div>
      {children}
    </div>
  )
}

function Rincian({ u }) {
  const p = u.produksi, t = u.target
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, padding: '4px 0 8px', whiteSpace: 'normal' }}>
      <Blok judul="Antrean per tahap">
        {p.alir.map(a => <Baris key={a.kunci} label={a.label} nilai={`${a.jumlah} order`} warna={a.jumlah ? undefined : REDUP} />)}
        <Baris label="Selesai hari ini" nilai={`${p.selesaiHariIni} order`} />
      </Blok>
      <Blok judul={`Nilai order masuk bulan ini (${u.nilai.jumlahMasuk} order)`}>
        <Baris label="Sudah selesai (Done)" nilai={uang(u.nilai.done)} />
        <Baris label="Sudah Delivery, belum Done" nilai={uang(u.nilai.delivery)} />
        <Baris label="Masih dikerjakan" nilai={uang(u.nilai.dikerjakan)} />
        <Baris label="Target bulan ini" nilai={t?.targetUsd ? `${formatUSD(t.targetUsd)}, tercapai ${t.persen}%` : 'belum diisi'} warna={t?.targetUsd ? STATUS_TARGET[t.status] : REDUP} />
      </Blok>
      <Blok judul="Tagihan ke klien">
        <Baris label="Belum dibayar (sudah Delivery/Done)" nilai={uang(u.belumDibayar.sisa)} />
        <Baris label="Jumlah project" nilai={`${u.belumDibayar.jumlah} project`} />
        <Baris label="Belum dibuatkan tagihan" nilai={`${u.belumDibayar.belumDitagih} project`} warna={u.belumDibayar.belumDitagih ? 'var(--amber)' : undefined} />
        <Baris label="Belum lunas, masih dikerjakan" nilai={uang(u.belumDibayar.masihDikerjakan)} />
      </Blok>
      <Blok judul={`Keuangan unit bulan ini${u.buku.ditutup ? ' (sudah ditutup)' : ''}`}>
        <Baris label="Uang masuk" nilai={uang(u.buku.masuk)} />
        <Baris label="Uang keluar" nilai={uang(u.buku.keluar)} />
        <Baris label="Laba rugi" nilai={uang(u.buku.hasil)} />
        <Baris label="Kas akhir" nilai={uang(u.buku.kasAkhir)} />
      </Blok>
      <Blok judul="Omset resmi dibanding order (USD)">
        {u.omset.periodeBerlaporan > 0 ? <>
          <Baris label={`Laporan Omset (${u.omset.periodeBerlaporan} dari ${u.omset.jumlahPeriode} minggu)`} nilai={formatUSD(u.omset.laporanUsd)} />
          <Baris label="Order web circle, minggu yang sama" nilai={formatUSD(u.omset.orderBersihUsd)} />
          <Baris label="Selisih" nilai={formatUSD(u.omset.selisihUsd)} warna={Math.abs(u.omset.selisihUsd) > 1 ? 'var(--amber)' : 'var(--green)'} />
        </> : <div style={{ fontSize: 13, color: REDUP }}>Belum ada Laporan Omset bulan ini.</div>}
      </Blok>
      <Blok judul="Pemakaian 7 hari terakhir">
        <Baris label="Order baru" nilai={`${u.pemakaian.orderBaru7} order`} />
        <Baris label="Anggota tim yang presensi" nilai={`${u.pemakaian.presensi7} dari ${u.pemakaian.anggota} orang`} />
      </Blok>
    </div>
  )
}

const TH = ({ children, kanan }) => <th style={{ textAlign: kanan ? 'right' : 'left', whiteSpace: 'nowrap' }}>{children}</th>
const angkaBuruk = (n) => ({ textAlign: 'right', color: n ? MERAH : REDUP, fontWeight: n ? 700 : 400 })

function TabelKelompok({ k }) {
  const [buka, setBuka] = useState(() => new Set())
  const alih = (id) => setBuka(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>
          <TH>Unit</TH><TH kanan>Order berjalan</TH><TH kanan>Lewat deadline</TH><TH kanan>Macet</TH>
          <TH kanan>Nilai order bulan ini</TH><TH kanan>Belum dibayar klien</TH><TH kanan>Laba rugi bulan ini</TH>
        </tr></thead>
        <tbody>{k.unit.map(u => u.galat ? (
          <tr key={u.studioId}><td><strong>{u.nama}</strong></td><td colSpan={6} style={{ color: MERAH }}>{u.galat}</td></tr>
        ) : [
          <tr key={u.studioId} onClick={() => alih(u.studioId)} style={{ cursor: 'pointer' }} title="Klik untuk melihat rincian unit">
            <td style={{ whiteSpace: 'nowrap' }}><span style={{ color: REDUP, display: 'inline-block', width: 16 }}>{buka.has(u.studioId) ? '▾' : '▸'}</span><strong>{u.nama}</strong>{!u.dihitung && <span style={{ fontSize: 11, color: REDUP }}> (tidak masuk total)</span>}</td>
            <td style={{ textAlign: 'right' }}>{u.produksi.aktif}</td>
            <td style={angkaBuruk(u.produksi.lewatDeadline)}>{u.produksi.lewatDeadline}</td>
            <td style={angkaBuruk(u.produksi.macet)}>{u.produksi.macet}</td>
            <td style={{ textAlign: 'right' }}>{uang(u.nilai.total)}</td>
            <td style={{ textAlign: 'right' }}>{uang(u.belumDibayar.sisa)}</td>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>{uang(u.buku.hasil)}</td>
          </tr>,
          buka.has(u.studioId) && <tr key={u.studioId + '-rinci'}><td colSpan={7}><Rincian u={u} /></td></tr>,
        ])}</tbody>
      </table>
    </div>
  )
}

export default function WebCircle() {
  const { data: d, loading, error, refetch } = useApi('/api/web-circle/ringkasan')
  return (
    <>
      <div className="page-header">
        <h1>Web Circle</h1>
        <p>Ringkasan kerja harian semua unit web circle: antrean produksi, nilai order, tagihan klien, dan keuangan unit, tanpa membuka web circle satu per satu.</p>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, lineHeight: 1.6 }}>
        💡 Angka dibaca langsung dari web circle (selalu terbaru) dan berstatus <strong>bayangan</strong>. Omset resmi tetap dari Laporan Omset di menu Keuangan.
        {d && !d.semuaWilayah && <> Kamu melihat unit dalam wewenangmu saja.</>}
        {' '}Klik nama unit untuk melihat rinciannya. <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={refetch}>Muat ulang</span>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
      {loading && !d ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: REDUP }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
          Mengumpulkan data semua unit...
        </div>
      ) : d && (
        <>
          {d.kelompok.length === 0 && <div className="card" style={{ color: REDUP }}>Belum ada unit web circle dalam wewenangmu.</div>}
          {/* Grid sendiri (bukan .stat-grid 2 kolom di ponsel): angka rupiah penuh butuh lebar, jadi kartu turun satu per baris di layar sempit */}
          {d.kelompok.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
            <Kartu warna="purple" judul="Order sedang berjalan" nilai={`${d.total.aktif} order`} baris={[
              ['Lewat deadline', `${d.total.lewatDeadline} order`, d.total.lewatDeadline ? MERAH : undefined],
              ['Macet lebih dari 1 hari kerja', `${d.total.macet} order`, d.total.macet ? MERAH : undefined],
              ['Jumlah unit', `${d.total.unit} unit`],
            ]} />
            <Kartu warna="cyan" judul={`Nilai order masuk ${labelBulan(d.bulan)}`} nilai={formatRp(d.total.nilai)} baris={[
              ['Sudah selesai (Done)', formatRp(d.total.done)],
              ['Sudah Delivery, belum Done', formatRp(d.total.delivery)],
              ['Masih dikerjakan', formatRp(d.total.dikerjakan)],
            ]} />
            <Kartu warna="amber" judul="Belum dibayar klien" nilai={formatRp(d.total.belumDibayar)} baris={[
              ['Project sudah Delivery/Done', `${d.total.belumDibayarProject} project`],
              ['Belum dibuatkan tagihan', `${d.total.belumDitagih} project`, d.total.belumDitagih ? 'var(--amber)' : undefined],
            ]} />
            <Kartu warna={d.total.hasil < 0 ? 'red' : 'green'} judul={`Laba rugi ${labelBulan(d.bulan)}`} nilai={uang(d.total.hasil)} baris={[
              ['Uang masuk', formatRp(d.total.masuk)],
              ['Uang keluar', formatRp(d.total.keluar)],
              ['Kas akhir semua unit', uang(d.total.kasAkhir)],
            ]} />
          </div>}

          {d.kelompok.map(k => (
            <div key={`${k.jenis}-${k.id}`} className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title">{k.nama} <span style={{ fontSize: 12, fontWeight: 500, color: REDUP }}>{JENIS[k.jenis]}, {k.unit.length} unit</span></span>
                {k.alamat && <a className="card-action" href={k.alamat} target="_blank" rel="noreferrer noopener">Buka web circle ↗</a>}
              </div>
              <TabelKelompok k={k} />
            </div>
          ))}
          <p style={{ fontSize: 12, color: REDUP, lineHeight: 1.6 }}>{d.catatan} Macet = pekerjaan yang tertahan lebih dari satu hari kerja (sama dengan Analitik, Kondisi hari ini). Laba rugi dan kas = buku besar web circle bulan berjalan (Tutup bulan), status bayangan.</p>
        </>
      )}
    </>
  )
}
