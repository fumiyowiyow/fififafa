// ─────────────────────────────────────────────────────────────────────────
// PEMBUAT PROGRESS REPORT (diadaptasi dari playgroundecos.app, 13 Okt 2026) — lima langkah:
//   1. Lingkup: satu ekosistem atau circle/rumah usaha masing-masing
//   2. Periode
//   3. Tema & huruf: Ekosistem (gelap) atau Kertas (terang) + pilihan font
//   4. Latar sampul: enam gaya bertema, atau foto sendiri dengan enam tata letak
//   5. Isi: Leader & Key Person, laporan per unit, Financial Forecasting
// 11 Okt 2026 (arahan Owner): hanya Kepala Circle ke atas (server menyaring lingkup); kolom kanan
// = Pratinjau Langsung (PDF asli, disusun ulang dari data yang sudah dimuat setiap pilihan berubah).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { EKOSISTEM, EKOSISTEM_NAMA_PANJANG } from '../../config/ekosistem'
import SampulMini from '../../components/laporan/SampulMini'
import PratinjauLangsung from './PratinjauLangsung'
import PilihanTampilan, { Langkah, gayaDari } from './PilihanTampilan'
import PilihDaftar from './PilihDaftar'
import LogoOrganisasi from './LogoOrganisasi'
import { ISI_LAPORAN, GAYA_FOTO, temaEfektif, cssFont, warnaHurufHex, skalaUkuran } from '../../components/laporan/gayaLatar'
import { buatProgressReport, ambilDataProgres, unduhBlob, panaskanPdf, pilihanTerakhir, ISI_VERSI } from '../../components/laporan/buatProgressReport'
import { simpanPreferensi } from '../../components/laporan/fotoSampul'
import '../../components/filter-organisasi.css'
import './pembuat-laporan.css'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** Laporan bulanan dibuat setelah bulannya selesai → bawaan = bulan lalu. */
function bulanLalu() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { bulan: d.getMonth() + 1, tahun: d.getFullYear() }
}

/** Perkiraan jumlah halaman — hanya penunjuk, PDF sesungguhnya bisa sedikit berbeda. */
function perkiraanHalaman(pilihan, daftar, isi) {
  if (!pilihan) return null
  const unit = pilihan.unit ?? 0
  const perUnit = isi.unit || isi.rincian
  let n = 5 + (isi.tokoh ? 1 : 0) // sampul, pembatas, ringkasan, omset & kas, penutup
  if (pilihan.jenis === 'ekosistem') {
    const orgs = daftar.filter(l => l.jenis !== 'ekosistem' && l.unit > 0)
    n += 1 + orgs.length
    if (perUnit) n += orgs.length + (isi.unit ? unit : 0) + (isi.rincian ? unit : 0)
  } else if (perUnit) {
    n += 1 + (isi.unit ? unit : 0) + (isi.rincian ? unit : 0)
  }
  return n
}

export default function PembuatProgressReport() {
  const { data: lingkupData, loading, error } = useApi('/api/reports/progres/lingkup')
  const daftar = useMemo(() => lingkupData?.lingkup ?? [], [lingkupData])
  const awalPilihan = useMemo(() => pilihanTerakhir(), [])
  const awal = useMemo(bulanLalu, [])
  const [lingkup, setLingkup] = useState(null)
  const [bulan, setBulan] = useState(awal.bulan)
  const [tahun, setTahun] = useState(awal.tahun)
  const [tampilan, setTampilan] = useState(() => {
    const { tema, font, tataFoto, gayaLatar, pakaiFoto, ukuran, warna, warnaKustom } = awalPilihan
    return { tema, font, tataFoto, gayaLatar, pakaiFoto, ukuran, warna, warnaKustom, foto: null } // foto dimuat per lingkup oleh PilihanTampilan
  })
  const [isi, setIsi] = useState(awalPilihan.isi)
  const [proses, setProses] = useState(false)
  const [galat, setGalat] = useState(null)
  const [isiData, setIsiData] = useState(null)     // data laporan lingkup+periode (dimuat sekali)
  const hasilTerakhir = useRef(null)

  // Bawaan = circle utama pemakai (server yang memilih).
  useEffect(() => {
    if (!lingkup && lingkupData) setLingkup(lingkupData.bawaan ?? lingkupData.lingkup?.[0]?.kunci ?? null)
  }, [lingkupData, lingkup])

  const { tema, font, tataFoto, gayaLatar, pakaiFoto, foto, ukuran, warna, warnaKustom } = tampilan
  const gaya = gayaDari(tampilan)
  useEffect(() => { simpanPreferensi({ gayaLatar, pakaiFoto, tema, font, tataFoto, ukuran, warna, warnaKustom, isi, isiVersi: ISI_VERSI }) }, [gayaLatar, pakaiFoto, tema, font, tataFoto, ukuran, warna, warnaKustom, isi])

  // Data dimuat ulang hanya bila lingkup/periode/rincian berubah — tampilan tidak.
  useEffect(() => {
    if (!lingkup) return
    let batal = false
    setIsiData(null)
    const jeda = setTimeout(() => {
      ambilDataProgres({ lingkup, bulan, tahun, rinci: isi.rincian })
        .then(d => { if (!batal) setIsiData({ kunci: `${lingkup}|${bulan}|${tahun}|${isi.rincian}`, d }) })
        .catch(err => { if (!batal) setGalat(err?.response?.data?.message || 'Data laporan gagal dimuat') })
    }, 300)
    return () => { batal = true; clearTimeout(jeda) }
  }, [lingkup, bulan, tahun, isi.rincian])

  const pilihan = daftar.find(l => l.kunci === lingkup) ?? null
  const ekosistem = pilihan?.jenis === 'ekosistem'
  const namaTampil = pilihan?.nama ?? EKOSISTEM_NAMA_PANJANG
  const slot = ekosistem ? 1 : (pilihan?.slotWarna ?? 1)
  const temaEf = temaEfektif(tema, ekosistem ? null : pilihan?.situs)
  const bulanLabel = `${NAMA_BULAN[bulan - 1]} ${tahun}`
  const jenisLabel = ekosistem ? 'Laporan Satu Ekosistem' : pilihan?.jenis === 'rumah-usaha' ? 'Laporan Rumah Usaha' : 'Laporan Circle'
  const halaman = perkiraanHalaman(pilihan, daftar, isi)
  const tahunPilihan = useMemo(() => {
    const kini = new Date().getFullYear()
    return [kini - 2, kini - 1, kini]
  }, [])

  const dataSiap = isiData?.kunci === `${lingkup}|${bulan}|${tahun}|${isi.rincian}` ? isiData.d : null
  const pilihanPdf = { lingkup, bulan, tahun, tema, font, ukuran, warna, warnaKustom, tataFoto, isi, gaya, foto: gaya === GAYA_FOTO ? foto : null }
  const kunci = JSON.stringify({ ...pilihanPdf, foto: pilihanPdf.foto ? pilihanPdf.foto.length : 0, siap: !!dataSiap })
  const susun = () => buatProgressReport({ ...pilihanPdf, data: dataSiap })

  async function unduh() {
    if (!dataSiap || proses) return
    setGalat(null)
    setProses(true)
    try {
      const hasil = hasilTerakhir.current?.kunci === kunci ? hasilTerakhir.current : await susun()
      unduhBlob(hasil.blob, hasil.namaFile)
    } catch (err) {
      setGalat(err?.response?.data?.message || err?.message || 'Gagal menyusun laporan')
    } finally {
      setProses(false)
    }
  }

  return (
    <section className="card pembuat-laporan" onMouseEnter={panaskanPdf} onFocus={panaskanPdf}>
      <header className="pl-kepala">
        <span className="pl-ikon" aria-hidden>📊</span>
        <div>
          <h2>Monthly Report</h2>
          <p>Progress Report bulanan, slide 16:9 — per circle{ekosistem ? ' atau satu ekosistem' : ''}, lengkap dengan grafik omset, kas akhir, dan rincian pengeluaran. Khusus Kepala Circle ke atas.</p>
        </div>
      </header>

      <div className="pl-tubuh">
        <div className="pl-kiri">
          <Langkah no={1} judul="Pilih Lingkup" ket={ekosistem ? 'Seluruh circle & rumah usaha dalam satu dokumen.' : 'Laporan untuk satu circle beserta unit-unitnya.'}>
            {loading ? (
              <div className="pl-muat"><span className="spinner" /> Memuat daftar circle…</div>
            ) : error ? (
              <div className="login-error">Daftar circle gagal dimuat.</div>
            ) : !daftar.length ? (
              <p className="pl-pesan">Monthly Report hanya bisa diunduh oleh Kepala Circle (untuk circle-nya) ke atas.</p>
            ) : (
              <>
              <PilihDaftar id="pl-pilih-lingkup" label="Lingkup laporan" nilai={lingkup} onUbah={setLingkup} kosong="Pilih lingkup…"
                terpilih={pilihan ? { slotWarna: pilihan.slotWarna, jenis: pilihan.jenis, emoji: pilihan.jenis === 'ekosistem' ? '🌐' : null } : null}
                grup={[
                  { kunci: 'ekosistem', label: null, pilihan: daftar.filter(l => l.jenis === 'ekosistem').map(l => ({ id: l.kunci, nama: 'Satu Ekosistem', ket: `${l.unit} unit`, emoji: '🌐' })) },
                  { kunci: 'circle', label: 'Circle', pilihan: daftar.filter(l => l.jenis === 'circle').map(l => ({ id: l.kunci, nama: l.nama, ket: `${l.unit} unit`, slotWarna: l.slotWarna, jenis: l.jenis })) },
                  { kunci: 'rumah-usaha', label: 'Rumah Usaha', pilihan: daftar.filter(l => l.jenis === 'rumah-usaha').map(l => ({ id: l.kunci, nama: l.nama, ket: `${l.unit} unit`, slotWarna: l.slotWarna, jenis: l.jenis })) },
                ].filter(g => g.pilihan.length)} />
              {pilihan && pilihan.jenis !== 'ekosistem' ? (
                <LogoOrganisasi jenis={pilihan.jenis} id={pilihan.id ?? String(pilihan.kunci).split(':')[1]} nama={pilihan.nama} slotWarna={pilihan.slotWarna ?? 1} />
              ) : null}
              </>
            )}
          </Langkah>

          <Langkah no={2} judul="Periode">
            <div className="pl-periode">
              <select className="form-input" value={bulan} onChange={e => setBulan(Number(e.target.value))} aria-label="Bulan">
                {NAMA_BULAN.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select className="form-input" value={tahun} onChange={e => setTahun(Number(e.target.value))} aria-label="Tahun">
                {tahunPilihan.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </Langkah>

          <PilihanTampilan noAwal={3} nilai={tampilan} onUbah={setTampilan}
            kunciFoto={lingkup} situs={pilihan?.situs} ekosistem={ekosistem} slotWarna={slot} nama={namaTampil}
            namaFoto={ekosistem ? 'laporan ekosistem' : namaTampil} />

          <Langkah no={5} judul="Isi Laporan" ket="Ringkasan, Omset & Kas Akhir, dan penutup selalu ada.">
            <div className="pl-isi" role="group" aria-label="Isi laporan">
              {ISI_LAPORAN.map((o, i) => (
                <button key={o.id} type="button" aria-pressed={!!isi[o.id]} style={{ '--i': i }}
                  className={`filter-org-pil${isi[o.id] ? ' aktif' : ''}`}
                  onClick={() => setIsi(v => ({ ...v, [o.id]: !v[o.id] }))}>
                  <span className="pl-emoji" aria-hidden>{isi[o.id] ? '✅' : o.ikon}</span>
                  <span>{o.nama}</span>
                </button>
              ))}
            </div>
          </Langkah>
        </div>

        <aside className="pl-kanan" aria-label="Pratinjau Monthly Report">
          <PratinjauLangsung kunci={kunci} siap={!!dataSiap} susun={susun}
            onBlob={(h) => { hasilTerakhir.current = h }}
            judul={`Monthly Report · ${namaTampil}`} sub={bulanLabel}
            cadangan={<SampulMini gaya={gaya} tema={temaEf} tataFoto={tataFoto}
              font={cssFont(font, temaEf)} warnaHuruf={warnaHurufHex(warna, temaEf, warnaKustom)} slotWarna={slot} skala={skalaUkuran(ukuran)} nama={namaTampil}
              bulanLabel={bulanLabel} jenisLabel={jenisLabel} kopNama={EKOSISTEM?.nama ?? EKOSISTEM_NAMA_PANJANG} foto={foto} />} />
          <ul className="pl-fakta">
            <li><span aria-hidden>📄</span> {halaman ? `± ${halaman} halaman` : '—'}</li>
            <li><span aria-hidden>🖼️</span> 16:9 siap presentasi</li>
            <li><span aria-hidden>🗓</span> {bulanLabel}</li>
          </ul>
          {galat && <div className="login-error" role="alert">{galat}</div>}
          <div className="pl-aksi">
            <button type="button" className="btn btn-primary" onClick={unduh} disabled={!dataSiap || proses}>
              {proses ? <><span className="spinner" /> Menyusun PDF…</> : <>⬇ Unduh Monthly Report</>}
            </button>
          </div>
          <p className="pl-catatan">PDF disusun langsung di peramban. Foto sampul yang diunggah disimpan di galeri circle-nya supaya bisa dipakai lagi.</p>
        </aside>
      </div>

    </section>
  )
}
