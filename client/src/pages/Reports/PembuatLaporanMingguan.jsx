// ─────────────────────────────────────────────────────────────────────────
// PEMBUAT WEEKLY REPORT per unit usaha (diadaptasi dari playgroundecos.app, 13 Okt 2026).
// Langkah:
//   1. Pilih unit usaha (dikelompokkan per circle)  2. Periode (bulan)
//   3. Penilaian Talent — Ekosistem memakai Penilaian Kader (SDM › Performa Kader), bukan Evaluasi
//      Mingguan Playground: daftar status bulan ini + centang "masuk laporan"; mengisinya di SDM
//   4. Tema & huruf · 5. Latar sampul (PilihanTampilan bersama)
// 10 Okt 2026 (arahan Owner): langkah Renstra/KPI & Kustomisasi DIHAPUS — isi laporan
// sepenuhnya dari data aplikasi; halaman Team = evaluasi mingguan FINAL (draft belum
// dihitung). Semua halaman tercetak; Renstra hanya muncul bila unit punya Goal bulan itu.
// Isi datang dari server: GET /api/reports/mingguan.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatRp } from '../../utils/format'
import SampulMiniMingguan from '../../components/laporan/SampulMiniMingguan'
import PratinjauLangsung from './PratinjauLangsung'
import PilihanTampilan, { Langkah, gayaDari } from './PilihanTampilan'
import PilihDaftar from './PilihDaftar'
import LogoOrganisasi from './LogoOrganisasi'
import { GAYA_FOTO, GAYA_MINGGUAN, ISI_MINGGUAN_BAWAAN, temaEfektif, cssFont, warnaHurufHex, skalaUkuran } from '../../components/laporan/gayaLatar'
import { buatLaporanMingguan, ambilDataMingguan, unduhBlob, panaskanPdf, pilihanTerakhir } from '../../components/laporan/buatProgressReport'
import { simpanPreferensi, kunciFotoUnit } from '../../components/laporan/fotoSampul'
import '../../components/filter-organisasi.css'
import './pembuat-laporan.css'
import { LABEL_TIPE_UNIT } from '../../utils/tipeUnit'

const LABEL_TIPE = LABEL_TIPE_UNIT
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
/** Kelompokkan unit per circle/rumah usaha (urutan server sudah benar). */
function kelompokkan(unit) {
  const peta = new Map()
  for (const u of unit) {
    const k = u.organisasi ? `${u.organisasi.jenis}:${u.organisasi.id}` : 'tanpa'
    if (!peta.has(k)) peta.set(k, { kunci: k, org: u.organisasi, unit: [] })
    peta.get(k).unit.push(u)
  }
  return [...peta.values()]
}

const STATUS_EVAL = { BAIK: 'Baik', PERHATIAN: 'Perhatian', KRITIS: 'Kritis' }
const KELAS_EVAL = { BAIK: 'baik', PERHATIAN: 'perhatian', KRITIS: 'kritis' }
// Tiruan isi laporan (tanpa basis data) — Weekly Report memakai `isi` semua halaman,
// Renstra & kustomisasi kosong (langkahnya dihapus 10 Okt 2026).
const KOSONG = Object.freeze({})

// Ceklis "masuk laporan" per talent (arahan Owner 12 Okt 2026) — diingat per unit & bulan di
// peramban ini; yang tidak dicentang tidak dapat halaman Team (kustom.tim[userId].sembunyi).
const kunciKeluar = (unit, bulan, tahun) => `md-mingguan-tim-keluar:${unit}:${tahun}-${bulan}`
function ambilKeluar(unit, bulan, tahun) {
  try { const v = JSON.parse(localStorage.getItem(kunciKeluar(unit, bulan, tahun)) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function simpanKeluar(unit, bulan, tahun, daftar) {
  try { localStorage.setItem(kunciKeluar(unit, bulan, tahun), JSON.stringify(daftar)) } catch { /* peramban menolak penyimpanan */ }
}

/** Langkah 3: status Penilaian Kader tiap talent bulan itu (data laporan dari server, `r.tim`) +
 *  centang "masuk laporan". Penilaiannya sendiri diisi di SDM › Performa Kader. */
function PenilaianTalent({ tim, dimuat, keluar = [], onKeluar, onNavigate }) {
  if (!dimuat) return <div className="pl-muat"><span className="spinner" /> Memuat penilaian…</div>
  if (!tim.length) return <p className="pl-pesan">Unit ini belum punya Koordinator/talent — halaman Team tidak tercetak.</p>
  return (
    <>
      <div className="pl-evaluasi">
        {tim.map(a => {
          const masuk = !keluar.includes(a.userId)
          return (
            <div key={a.userId} className={`pl-evaluasi-baris${masuk ? '' : ' keluar'}`}>
              <label className="pl-evaluasi-cek" title={masuk ? 'Masuk laporan — klik untuk mengeluarkan' : 'Tidak masuk laporan — klik untuk memasukkan'}>
                <input type="checkbox" checked={masuk} onChange={ev => onKeluar?.(a.userId, !ev.target.checked)} aria-label={`${a.nama} masuk laporan`} />
              </label>
              <div className="pl-evaluasi-orang">
                <b>{a.nama}</b>
                <span className="pl-catatan">{a.label}{a.mingguDinilai ? ` · ${a.mingguDinilai}× dinilai bulan ini` : a.tanggalPenilaian ? ` · pakai penilaian terakhir ${new Date(a.tanggalPenilaian).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' · belum pernah dinilai'}</span>
              </div>
              <div className="pl-evaluasi-aksi">
                <span className={`evm-status ${a.status ? KELAS_EVAL[a.status] : 'belum'}`}>{a.status ? STATUS_EVAL[a.status] : 'Belum'}</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="pl-catatan">
        Centang = talent masuk halaman Team laporan ({tim.length - tim.filter(a => keluar.includes(a.userId)).length} dari {tim.length}). Status dari Penilaian Kader bulan ini; kalau belum ada, dipakai penilaian terakhir yang sudah diisi (Baik ≥ 3 · Perhatian &lt; 3 · Kritis &lt; 2).{' '}
        {onNavigate && <button type="button" className="pl-tautan" onClick={() => onNavigate('SDM', { tab: 'kader' })}>Isi penilaian di SDM › Performa Kader →</button>}
      </p>
    </>
  )
}

export default function PembuatLaporanMingguan({ awalUnit = null, onNavigate }) {
  const { data, loading, error } = useApi('/api/reports/mingguan/unit')
  const daftar = useMemo(() => data?.unit ?? [], [data])
  const grup = useMemo(() => kelompokkan(daftar), [daftar])
  const awalPilihan = useMemo(() => pilihanTerakhir(null, 'mingguan'), [])
  const kini = useMemo(() => new Date(), [])
  const [studioId, setStudioId] = useState(null)
  // Bawaan = bulan berjalan: Weekly Report dibuat sambil bulan berjalan (acuan "per 30 September").
  const [bulan, setBulan] = useState(kini.getMonth() + 1)
  const [tahun, setTahun] = useState(kini.getFullYear())
  const [tampilan, setTampilan] = useState(() => {
    const { tema, font, tataFoto, gayaLatar, pakaiFoto, ukuran, warna, warnaKustom } = awalPilihan
    return { tema, font, tataFoto, gayaLatar, pakaiFoto, ukuran, warna, warnaKustom, foto: null }
  })
  // Data LENGKAP laporan (bukan ringkas): dipakai ringkasan langkah DAN Pratinjau Langsung, jadi
  // mengganti tema/huruf/sampul tidak perlu ambil ulang ke server.
  const [isiData, setIsiData] = useState(null)
  const [galatIsi, setGalatIsi] = useState(null)
  // Foto profil unit (Studio.logoUrl) — sampul Weekly memajangnya; null = logo otomatis.
  const [profil, setProfil] = useState(undefined)
  // Rincian gaji per orang = dokumen internal; sengaja tidak diingat (aturan SKB).
  const [rinciGaji, setRinciGaji] = useState(false)
  const [proses, setProses] = useState(false)
  const [galat, setGalat] = useState(null)
  const hasilTerakhir = useRef(null)
  // Dinaikkan setiap evaluasi disimpan → data (halaman Team) dimuat ulang.
  const [versiEvaluasi, setVersiEvaluasi] = useState(0)
  // Talent yang TIDAK dimasukkan ke laporan (ceklis langkah 3), per unit & bulan.
  const [keluar, setKeluar] = useState([])
  useEffect(() => { if (studioId) setKeluar(ambilKeluar(studioId, bulan, tahun)) }, [studioId, bulan, tahun])
  const ubahKeluar = (userId, keluarkan) => setKeluar(daftar => {
    const baru = keluarkan ? [...new Set([...daftar, userId])] : daftar.filter(x => x !== userId)
    if (studioId) simpanKeluar(studioId, bulan, tahun, baru)
    return baru
  })
  const kustomTim = useMemo(() => (keluar.length ? { tim: Object.fromEntries(keluar.map(id => [id, { sembunyi: true }])) } : KOSONG), [keluar])

  const pilihUnit = useCallback((id) => { setStudioId(id); setIsiData(null); setProfil(undefined) }, [])

  // Bawaan: unit dari tautan Bio Unit, lalu unit tempat pemakai berposisi.
  useEffect(() => {
    if (studioId || !data) return
    const id = daftar.some(u => u.id === awalUnit) ? awalUnit : (data.bawaan ?? daftar[0]?.id ?? null)
    if (id) pilihUnit(id)
  }, [data, daftar, awalUnit, studioId, pilihUnit])

  useEffect(() => {
    if (!studioId) return
    let batal = false
    setGalatIsi(null)
    const jeda = setTimeout(() => {
      ambilDataMingguan({ studioId, bulan, tahun, rinciGaji })
        .then(d => { if (!batal) setIsiData(d) })
        .catch(err => { if (!batal) setGalatIsi(err?.response?.data?.message || 'Data unit gagal dimuat') })
    }, 250)
    return () => { batal = true; clearTimeout(jeda) }
  }, [studioId, bulan, tahun, rinciGaji, versiEvaluasi])

  const { tema, font, tataFoto, gayaLatar, pakaiFoto, foto, ukuran, warna, warnaKustom } = tampilan
  const gaya = gayaDari(tampilan)
  useEffect(() => { simpanPreferensi({ mingguan: { gayaLatar, pakaiFoto, tema, font, tataFoto, ukuran, warna, warnaKustom, isi: ISI_MINGGUAN_BAWAAN } }) }, [gayaLatar, pakaiFoto, tema, font, tataFoto, ukuran, warna, warnaKustom])

  const unit = daftar.find(u => u.id === studioId) ?? null
  const slot = unit?.organisasi?.slotWarna ?? 1
  const temaEf = temaEfektif(tema, unit?.situs)
  const labelBulan = `${NAMA_BULAN[bulan - 1]} ${tahun}`
  const jenisLabel = [LABEL_TIPE[unit?.tipe] ?? 'Unit Usaha', unit?.organisasi?.nama].filter(Boolean).join(' · ')
  const tahunPilihan = useMemo(() => [kini.getFullYear() - 1, kini.getFullYear()], [kini])
  const r = isiData && isiData.unit?.id === studioId ? isiData : null
  const fotoProfil = profil !== undefined ? profil : (r?.unit?.logoUrl ?? null)
  const dinilai = r ? r.tim.filter(t => t.mingguDinilai > 0).length : 0

  // Satu set pilihan → satu dokumen. `kunci` berubah = Pratinjau Langsung menyusun ulang.
  const pilihanPdf = {
    studioId, bulan, tahun, tema, font, ukuran, warna, warnaKustom, tataFoto, gaya, foto: gaya === GAYA_FOTO ? foto : null,
    renstra: KOSONG, isi: ISI_MINGGUAN_BAWAAN, kustom: kustomTim, rinciGaji,
  }
  const kunci = JSON.stringify({ ...pilihanPdf, foto: pilihanPdf.foto ? pilihanPdf.foto.length : 0, profil: fotoProfil ? fotoProfil.length : 0, v: versiEvaluasi, d: r?.dibuat ?? null })
  const susun = () => buatLaporanMingguan({ ...pilihanPdf, data: { ...r, unit: { ...r.unit, logoUrl: fotoProfil } } })

  async function unduh() {
    if (!r || proses) return
    setGalat(null)
    setProses(true)
    try {
      const hasil = hasilTerakhir.current?.kunci === kunci ? hasilTerakhir.current : await susun()
      unduhBlob(hasil.blob, hasil.namaFile)
    } catch (err) {
      setGalat(err?.response?.data?.message || err?.message || 'Gagal menyusun Weekly Report')
    } finally {
      setProses(false)
    }
  }

  return (
    <section className="card pembuat-laporan" onMouseEnter={() => panaskanPdf('mingguan')} onFocus={() => panaskanPdf('mingguan')}>
      <header className="pl-kepala">
        <span className="pl-ikon" aria-hidden>🗓</span>
        <div>
          <h2>Weekly Report Unit</h2>
          <p>Slide 16:9 satu unit satu bulan — Financial Forecasting (gaji yang sudah dibayar tercentang), kas & sumber dana, omset per platform tiap minggu, order & lead yang berjalan, goals, dan penilaian tiap talent — semuanya langsung dari data aplikasi.</p>
        </div>
      </header>

      <div className="pl-tubuh">
        <div className="pl-kiri">
          <Langkah no={1} judul="Pilih Unit Usaha" ket={unit ? `${unit.nama} · ${jenisLabel}` : 'Hanya unit yang kamu pegang (Koordinator / Kader / Pendamping) atau yang berada di circle yang kamu pimpin.'}>
            {loading ? (
              <div className="pl-muat"><span className="spinner" /> Memuat daftar unit…</div>
            ) : error ? (
              <div className="login-error">Daftar unit gagal dimuat.</div>
            ) : !daftar.length ? (
              <p className="pl-pesan">Belum ada unit yang berkaitan denganmu — Weekly Report hanya bisa dibuat oleh pengurus unitnya.</p>
            ) : (
              <>
              <PilihDaftar id="pl-pilih-unit-mingguan" label="Unit usaha" nilai={studioId} onUbah={pilihUnit} kosong="Pilih unit usaha…"
                terpilih={unit ? { slotWarna: unit.organisasi?.slotWarna ?? 1, jenis: unit.organisasi?.jenis } : null}
                grup={grup.map(g => ({
                  kunci: g.kunci, label: grup.length > 1 ? (g.org?.nama ?? 'Tanpa Circle') : null,
                  pilihan: g.unit.map(u => ({ id: u.id, nama: u.nama, ket: LABEL_TIPE[u.tipe] ?? u.tipe, slotWarna: g.org?.slotWarna ?? 1, jenis: g.org?.jenis })),
                }))} />
              {unit ? (
                <LogoOrganisasi jenis="unit" id={unit.id} nama={unit.nama} slotWarna={unit.organisasi?.slotWarna ?? 1}
                  judul="Foto Profil Unit" wajib onMuat={setProfil} onUbah={setProfil} />
              ) : null}
              </>
            )}
          </Langkah>

          <Langkah no={2} judul="Periode" ket={r ? `${r.minggu.length} minggu · ${r.omset.jumlahLaporan} laporan omset · ${r.forecasting.jumlahPos} pos pengeluaran · ${r.tim.length} anggota (${dinilai} sudah dinilai) · ${r.potensi.jumlah} order berjalan` : galatIsi ?? 'Bulan berjalan dicetak sebagai data per hari ini.'}>
            <div className="pl-periode">
              <select className="form-input" value={bulan} onChange={e => setBulan(Number(e.target.value))} aria-label="Bulan">
                {NAMA_BULAN.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select className="form-input" value={tahun} onChange={e => setTahun(Number(e.target.value))} aria-label="Tahun">
                {tahunPilihan.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {r && (
                <span className="pl-periode-ringkas">
                  Omset <b>{formatRp(r.omset.totalIdr)}</b> · Pengeluaran <b>{formatRp(r.forecasting.totalPengeluaran)}</b>
                </span>
              )}
            </div>
          </Langkah>

          <Langkah no={3} judul="Penilaian Talent" ket={r ? `${r.tim.length} talent · ${dinilai} sudah dinilai bulan ini (Penilaian Kader).` : 'Status tiap talent dari Penilaian Kader — tersambung langsung dengan SDM › Performa Kader.'}>
            <PenilaianTalent tim={r?.tim ?? []} dimuat={!!r || !studioId} keluar={keluar} onKeluar={ubahKeluar} onNavigate={onNavigate} />
          </Langkah>

          <PilihanTampilan noAwal={4} nilai={tampilan} onUbah={setTampilan}
            kunciFoto={studioId ? kunciFotoUnit(studioId) : null} situs={unit?.situs} slotWarna={slot}
            nama={unit?.nama ?? 'Nama Unit'} namaFoto={unit?.nama} judulDok="Weekly Report"
            gayaDaftar={GAYA_MINGGUAN} Ubin={SampulMiniMingguan} ubinTambahan={{ profil: fotoProfil }}
            judulLatar="Sampul Weekly"
            ketLatar="Tujuh gaya, semuanya memajang foto profil unit (langkah 1; logo otomatis bila belum diunggah). Unggah foto sendiri → pilih tata letaknya seperti Monthly." />
        </div>

        <aside className="pl-kanan" aria-label="Pratinjau Weekly Report">
          <PratinjauLangsung kunci={kunci} siap={!!r} susun={susun}
            onBlob={(h) => { hasilTerakhir.current = h }}
            judul={`Weekly Report · ${unit?.nama ?? ''}`} sub={labelBulan}
            cadangan={<SampulMiniMingguan gaya={gaya} tataFoto={tataFoto} tema={temaEf} font={cssFont(font, temaEf)} warnaHuruf={warnaHurufHex(warna, temaEf, warnaKustom)} skala={skalaUkuran(ukuran)} slotWarna={slot}
              nama={unit?.nama ?? 'Nama Unit'} profil={fotoProfil} foto={foto} />} />
          <ul className="pl-fakta">
            <li><span aria-hidden>🖼️</span> 16:9 siap presentasi</li>
            <li><span aria-hidden>🗓</span> {r ? `Per ${r.tanggalLabel}` : labelBulan}</li>
          </ul>
          <label className="pl-centang" title="Hanya untuk pengurus. Jangan bagikan dokumen yang memuat gaji anggota.">
            <input type="checkbox" checked={rinciGaji} onChange={e => setRinciGaji(e.target.checked)} />
            <span>Rinci gaji per orang <b>(dokumen internal)</b></span>
          </label>
          {galat && <div className="login-error" role="alert">{galat}</div>}
          <div className="pl-aksi">
            <button type="button" className="btn btn-primary" onClick={unduh} disabled={!r || proses}>
              {proses ? <><span className="spinner" /> Menyusun PDF…</> : <>⬇ Unduh Weekly Report</>}
            </button>
          </div>
          <p className="pl-catatan">Nomor rekening tidak pernah dicetak. Penilaian talent diambil dari SDM › Performa Kader bulan yang dipilih.</p>
        </aside>
      </div>
    </section>
  )
}
