import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { formatRp } from '../../utils/format'
import { getWeekDates, getReportingPeriod } from '../../utils/week'
import PengeluaranMinggu, { LABEL_KATEGORI } from '../WeeklyReport/PengeluaranMinggu'
import ItemRingkas from '../../components/common/ItemRingkas'
import LabelJalur from '../../components/common/LabelJalur'

// ── Tab Pengeluaran (hub Keuangan, 1 Nov 2026) ───────────
// SATU tempat untuk melihat & mencatat Pengeluaran (resmi) per unit per bulan. Dulu daftarnya cuma
// nyelip di form Laporan Omset & popup Update Kas (dan cuma minggu ini). Data & API sama persis:
// GET/POST/DELETE /api/pengeluaran (rentang tanggal bebas); total mingguan laporan tetap dihitung
// server dari item (utils/pengeluaran.js). Dikelompokkan per periode laporan (utils/week.js).

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const FULL_ADMIN = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA']
const PELAPOR    = ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']

const pad = n => String(n).padStart(2, '0')
const tglPendek = (s) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

// Periode laporan yang jatuh di bulan itu (minggu Senin–Minggu, dipotong di batas bulan).
function periodeBulan(bulan, tahun) {
  const akhirBulan = `${tahun}-${pad(bulan)}-${pad(new Date(tahun, bulan, 0).getDate())}`
  const hasil = []
  let d = `${tahun}-${pad(bulan)}-01`
  while (d <= akhirBulan) {
    const p = getReportingPeriod(d)
    hasil.push(p)
    const n = new Date(p.periodeAkhir + 'T00:00:00'); n.setDate(n.getDate() + 1)
    d = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
  }
  return hasil
}

export default function Pengeluaran({ user, onNavigate, studioIdAwal }) {
  const roles = user?.roles ?? []
  const fullAdmin = roles.some(r => FULL_ADMIN.includes(r.roleType))
  const studioSaya = useMemo(() => {
    const m = new Map()
    roles.filter(r => PELAPOR.includes(r.roleType) && r.studio).forEach(r => m.set(r.studio.id, r.studio))
    return [...m.values()]
  }, [roles])

  // Atasan: daftar semua unit dari status minggu ini (server tetap menolak unit di luar wewenang).
  const mingguIni = getReportingPeriod(getWeekDates().start).periodeAwal
  const { data: statusData } = useApi(fullAdmin ? `/api/weekly-reports/status/week?weekStart=${mingguIni}` : null, [fullAdmin])
  const studios = fullAdmin && statusData?.length ? statusData.map(s => ({ id: s.id, nama: s.nama })) : studioSaya

  const sekarang = new Date()
  const [bulan, setBulan] = useState(sekarang.getMonth() + 1)
  const [tahun, setTahun] = useState(sekarang.getFullYear())
  const [studioId, setStudioId] = useState(studioIdAwal ?? '')
  const unit = studioId || studios[0]?.id || ''

  const periode = useMemo(() => periodeBulan(bulan, tahun), [bulan, tahun])
  const hariIni = `${sekarang.getFullYear()}-${pad(sekarang.getMonth() + 1)}-${pad(sekarang.getDate())}`
  const periodeKini = getReportingPeriod(hariIni).periodeAwal
  const awalBulan = periode[0].periodeAwal
  const akhirBulan = periode[periode.length - 1].periodeAkhir

  const [items, setItems] = useState(null)
  const [galat, setGalat] = useState(null)
  const muat = useCallback(() => {
    if (!unit) { setItems([]); return }
    api.get('/api/pengeluaran', { params: { studioId: unit, dari: awalBulan, sampai: akhirBulan } })
      .then(res => { setItems(res.data.data ?? []); setGalat(null) })
      .catch(err => { setItems([]); setGalat(err.response?.data?.message || 'Gagal memuat pengeluaran') })
  }, [unit, awalBulan, akhirBulan])
  useEffect(() => { setItems(null); muat() }, [muat])

  // CPM unit pada bulan yang dipilih: bulan berjalan = hitung langsung; bulan lewat = foto akhir bulan
  // yang boleh dikoreksi pengelola unit (/api/cpm-bulanan).
  const [cpm, setCpm] = useState(null)
  const [formCpm, setFormCpm] = useState(null) // { totalThp, totalPengeluaranRutin, totalShu } saat mengoreksi
  const [sibukCpm, setSibukCpm] = useState(false)
  const [galatCpm, setGalatCpm] = useState(null)
  const muatCpm = useCallback(() => {
    setCpm(null); setFormCpm(null); setGalatCpm(null)
    if (!unit) return
    api.get('/api/cpm-bulanan', { params: { studioId: unit, bulan, tahun } })
      .then(res => setCpm(res.data.data ?? null))
      .catch(() => {}) // 403 = bukan pengelola unit ini; kartu CPM disembunyikan
  }, [unit, bulan, tahun])
  useEffect(() => { muatCpm() }, [muatCpm])

  const mulaiKoreksiCpm = () => setFormCpm({
    totalThp: String(Math.round(cpm.totalThp)), totalPengeluaranRutin: String(Math.round(cpm.totalPengeluaranRutin)), totalShu: String(Math.round(cpm.totalShu)),
  })
  const simpanCpm = async () => {
    setSibukCpm(true); setGalatCpm(null)
    try {
      const res = await api.put('/api/cpm-bulanan', { studioId: unit, bulan, tahun, ...Object.fromEntries(Object.entries(formCpm).map(([k, v]) => [k, Number(v) || 0])) })
      setCpm(res.data.data); setFormCpm(null)
    } catch (err) { setGalatCpm(err.response?.data?.message || 'Gagal menyimpan') }
    finally { setSibukCpm(false) }
  }
  const resetCpm = async () => {
    if (!window.confirm(`Buang foto CPM ${MONTHS[bulan - 1]} ${tahun}? Bulan itu kembali dihitung dari kondisi sekarang.`)) return
    setSibukCpm(true); setGalatCpm(null)
    try {
      const res = await api.delete('/api/cpm-bulanan', { params: { studioId: unit, bulan, tahun } })
      setCpm(res.data.data); setFormCpm(null)
    } catch (err) { setGalatCpm(err.response?.data?.message || 'Gagal mengembalikan') }
    finally { setSibukCpm(false) }
  }

  // Minggu yang terbuka: bawaan minggu berjalan; bulan lain semua tertutup (cukup lihat total per minggu).
  const [terbuka, setTerbuka] = useState({})
  useEffect(() => {
    setTerbuka(periode.some(p => p.periodeAwal === periodeKini) ? { [periodeKini]: true } : {})
  }, [periode, periodeKini])

  const geser = (n) => {
    const t = tahun * 12 + (bulan - 1) + n
    setTahun(Math.floor(t / 12)); setBulan((t % 12) + 1)
  }

  const tanggalItem = (i) => String(i.tanggal).slice(0, 10)
  const totalBulan = (items ?? []).reduce((a, i) => a + i.jumlah, 0)
  const perKategori = Object.entries((items ?? []).reduce((a, i) => ({ ...a, [i.kategori]: (a[i.kategori] ?? 0) + i.jumlah }), {}))
    .sort((a, b) => b[1] - a[1])

  if (!studios.length) {
    return <div className="card" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Kamu belum memegang unit yang bisa dicatat pengeluarannya.</div>
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select className="form-input" style={{ padding: '6px 10px', width: 'auto', minWidth: 180, fontSize: 13 }}
          value={unit} onChange={e => setStudioId(e.target.value)} aria-label="Unit">
          {studios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => geser(-1)} aria-label="Bulan sebelumnya">◀</button>
          <strong style={{ fontSize: 14, minWidth: 130, textAlign: 'center' }}>{MONTHS[bulan - 1]} {tahun}</strong>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => geser(1)} aria-label="Bulan berikutnya">▶</button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        <LabelJalur jenis="resmi" /> Pengeluaran yang dicatat di sini masuk Laporan Omset minggu itu secara otomatis.
        Pengeluaran yang dicatat lewat web circle (Keuangan → Minggu ini) juga muncul di sini.
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card red">
          <div className="stat-label">Total Pengeluaran {MONTHS[bulan - 1]}</div>
          <div className="stat-value">{items === null ? '…' : formatRp(totalBulan)}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{items ? `${items.length} item` : ''}</div>
        </div>
        {cpm && (
          <div className="stat-card purple">
            <div className="stat-label">Biaya rutin (CPM) / bulan</div>
            <div className="stat-value">{formatRp(cpm.totalCpm)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Gaji {formatRp(cpm.totalThp)} + biaya rutin {formatRp(cpm.totalPengeluaranRutin)} + SHU {formatRp(cpm.totalShu)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {cpm.bisaDikoreksi
                ? (cpm.sumber === 'dikoreksi' ? `Dikoreksi oleh ${cpm.diubahOleh}` : cpm.sumber === 'foto' ? 'Foto akhir bulan' : 'Bulan lalu, belum difoto (dihitung dari kondisi sekarang)')
                : 'Dihitung otomatis dari Bio Studio'}
              {' · '}
              {cpm.bisaDikoreksi ? (
                <>
                  <button type="button" className="card-action" style={{ background: 'none', border: 'none', padding: 0 }} onClick={mulaiKoreksiCpm} disabled={!!formCpm}>Koreksi</button>
                  {cpm.sumber !== 'langsung' && <>{' · '}<button type="button" className="card-action" style={{ background: 'none', border: 'none', padding: 0 }} onClick={resetCpm} disabled={sibukCpm}>Hitung ulang</button></>}
                </>
              ) : (
                <button type="button" className="card-action" style={{ background: 'none', border: 'none', padding: 0 }}
                  onClick={() => onNavigate?.('MasterData')}>atur di Bio Studio</button>
              )}
            </div>
            {formCpm && (
              <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                {[['totalThp', 'Gaji anggota'], ['totalPengeluaranRutin', 'Biaya rutin'], ['totalShu', 'SHU']].map(([k, label]) => (
                  <label key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    {label}
                    <input type="number" min="0" className="form-input" style={{ paddingLeft: 10 }} value={formCpm[k]}
                      onChange={e => setFormCpm(f => ({ ...f, [k]: e.target.value }))} />
                  </label>
                ))}
                <div style={{ fontSize: 12 }}>Total: <b>{formatRp(['totalThp', 'totalPengeluaranRutin', 'totalShu'].reduce((a, k) => a + (Number(formCpm[k]) || 0), 0))}</b></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-ghost" onClick={simpanCpm} disabled={sibukCpm}>Simpan</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setFormCpm(null); setGalatCpm(null) }} disabled={sibukCpm}>Batal</button>
                </div>
              </div>
            )}
            {galatCpm && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{galatCpm}</div>}
          </div>
        )}
      </div>

      {perKategori.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {perKategori.map(([k, v]) => (
            <span key={k} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{LABEL_KATEGORI[k] ?? k}</span> <b>{formatRp(v)}</b>
            </span>
          ))}
        </div>
      )}

      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="list-ringkas">
          {periode.map(p => {
            const isi = (items ?? []).filter(i => tanggalItem(i) >= p.periodeAwal && tanggalItem(i) <= p.periodeAkhir)
            const total = isi.reduce((a, i) => a + i.jumlah, 0)
            const kunci = p.periodeAwal
            return (
              <ItemRingkas key={kunci}
                judul={`${tglPendek(p.periodeAwal)} – ${tglPendek(p.periodeAkhir)}${p.periodeAwal === periodeKini ? ' · minggu ini' : ''}`}
                sub={items === null ? 'memuat…' : isi.length ? `${isi.length} item` : 'belum ada'}
                nilai={items === null ? null : formatRp(total)}
                buka={!!terbuka[kunci]} onToggle={() => setTerbuka(t => ({ ...t, [kunci]: !t[kunci] }))}>
                <PengeluaranMinggu key={unit + kunci} studioId={unit} periodeAwal={p.periodeAwal} periodeAkhir={p.periodeAkhir}
                  onTotalChange={(t) => { if (items && t !== total) muat() }} />
              </ItemRingkas>
            )
          })}
        </div>
      </div>
    </>
  )
}
