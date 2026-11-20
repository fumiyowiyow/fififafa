import { useEffect, useMemo, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import {
  PERSONAL, TEMPLATE_TEKNIS, LABEL_PROGRAM, CATATAN_LAMPIRAN, labelTriwulan, rentangTriwulan,
  bulanTriwulan, bulanTriwulanBerikut, kuartalSekarang, geserKuartal, kecilkanFoto, daftarMentor,
} from '../../utils/raport'
import s from './raport.module.css'

/* ══ RAPORT SISWA VOKASI / KBU (13 Okt 2026) ═══════════════════════════════════
   Tab di hub SDM, format raport Karir Anak: Renstra Belajar → Perkembangan Personal (12 aspek)
   → Perkembangan Teknis → Renstra Selanjutnya → Input Mentor → Lampiran Karya; Kesan Belajar
   ditulis siswanya sendiri. Per triwulan (Jul–Sep, Okt–Des, …), skor 1–10. Mentor (ditunjuk per
   siswa) & pengelola unit menulis; siswa membaca yang TERBIT. Hak per siswa dicek server. */

const STATUS = {
  null:   { label: 'Belum dibuat', cls: '' },
  DRAFT:  { label: 'Draft',        cls: 'warning' },
  TERBIT: { label: 'Terbit',       cls: 'success' },
}
const RENSTRA_KOSONG = [0, 1, 2].map(() => ({ teknis: '', nonTeknis: '', checklist: '' }))
const pesanGalat = (e, cadangan) => e?.response?.data?.message ?? cadangan
const fmtSkor = (n) => (n == null ? '—' : Number(n).toFixed(1).replace('.', ','))

function PilihPeriode({ periode, onUbah }) {
  return (
    <div className={s.periode}>
      <button className="btn btn-ghost" onClick={() => onUbah(geserKuartal(periode, -1))} aria-label="Periode sebelumnya">‹</button>
      <div className={s.periodeTeks}>
        <strong>{rentangTriwulan(periode.tahun, periode.kuartal)}</strong>
        <span>{labelTriwulan(periode.tahun, periode.kuartal)}</span>
      </div>
      <button className="btn btn-ghost" onClick={() => onUbah(geserKuartal(periode, 1))} aria-label="Periode berikutnya">›</button>
    </div>
  )
}

function Skor({ nilai, onPilih, label }) {
  return (
    <div className={s.skor} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button key={n} type="button" disabled={!onPilih}
          className={`${s.skorBtn} ${nilai === n ? s.skorAktif : nilai != null && n < nilai ? s.skorLewat : ''}`}
          aria-checked={nilai === n} role="radio" aria-label={`${label} skor ${n}`}
          onClick={() => onPilih?.(nilai === n ? null : n)}>{n}</button>
      ))}
    </div>
  )
}

// ── Daftar siswa ────────────────────────────────────────────────────────────
function DaftarSiswa({ periode, onBuka }) {
  const [cari, setCari] = useState('')
  const { data, loading, error } = useApi(`/api/raport/siswa?tahun=${periode.tahun}&kuartal=${periode.kuartal}`, [periode.tahun, periode.kuartal])
  const semua = useMemo(() => (data ?? []).filter(x => x.hak !== 'siswa'), [data])
  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return semua.filter(x => !q || [x.nama, x.unit, ...daftarMentor(x.mentor)].some(v => v?.toLowerCase().includes(q)))
  }, [semua, cari])
  const ringkas = useMemo(() => {
    const r = { TERBIT: 0, DRAFT: 0, belum: 0, tanpaMentor: 0 }
    for (const x of semua) { if (x.raport) r[x.raport.status] += 1; else r.belum += 1; if (!x.mentor?.length) r.tanpaMentor += 1 }
    return r
  }, [semua])

  if (loading) return <div className={s.muat}><span className="spinner" /></div>
  if (error) return <div className="card">{error}</div>
  if (semua.length === 0) {
    return (
      <div className={`card ${s.kosong}`}>
        Belum ada siswa Vokasi/KBU yang kamu bimbing atau kelola. Status siswa diatur di SDM › Anggota (Status Keanggotaan),
        lalu mentornya ditunjuk di sini oleh pengelola unit.
      </div>
    )
  }
  return (
    <>
      <div className={s.ringkas}>
        <div><strong>{semua.length}</strong><span>siswa</span></div>
        <div><strong>{ringkas.TERBIT}</strong><span>terbit</span></div>
        <div><strong>{ringkas.DRAFT}</strong><span>draft</span></div>
        <div><strong>{ringkas.belum}</strong><span>belum dibuat</span></div>
        {ringkas.tanpaMentor > 0 && <div><strong className={s.peringatan}>{ringkas.tanpaMentor}</strong><span>tanpa mentor</span></div>}
        <input className={`form-input ${s.cari}`} placeholder="Cari nama, unit, mentor…" value={cari} onChange={e => setCari(e.target.value)} />
      </div>
      <div className={s.daftar}>
        {daftar.map(x => {
          const st = STATUS[x.raport?.status ?? null]
          return (
            <button key={x.id} className={`card ${s.baris}`} onClick={() => onBuka(x.id)}>
              <div className={s.barisUtama}>
                <div className={s.nama}>{x.nama}</div>
                <div className={s.meta}>
                  {LABEL_PROGRAM[x.statusKeanggotaan]}{x.kelas ? ` · Kelas ${x.kelas}` : ''}{x.unit ? ` · ${x.unit}` : ''}
                </div>
                <div className={s.meta}>
                  Mentor: {x.mentor?.length ? daftarMentor(x.mentor).join(', ') : <em className={s.peringatan}>belum ditunjuk</em>}
                  {x.fokusKompetensi ? ` · Fokus: ${x.fokusKompetensi}` : ''}
                </div>
              </div>
              <span className={`badge ${st.cls}`}>{st.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// ── Data siswa (mentor, fokus, TTL, mulai program) ───────────────────────────
function DataSiswa({ siswa, onTersimpan }) {
  const bolehMentor = siswa.hak === 'kelola'
  const tgl = (v) => (v ? String(v).slice(0, 10) : '')
  const [form, setForm] = useState({
    mentorIds: (siswa.mentor ?? []).map(m => m.id), fokusKompetensi: siswa.fokusKompetensi ?? '', tempatLahir: siswa.tempatLahir ?? '',
    tanggalLahir: tgl(siswa.tanggalLahir), tanggalMulaiProgram: tgl(siswa.tanggalMulaiProgram),
  })
  const [kandidat, setKandidat] = useState([])
  const [simpan, setSimpan] = useState(false)
  const [pesan, setPesan] = useState(null)
  useEffect(() => {
    if (!bolehMentor) return
    api.get('/api/raport/mentor-kandidat').then(r => setKandidat(r.data.data ?? [])).catch(() => {})
  }, [bolehMentor])
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const namaMentor = (id) => kandidat.find(k => k.id === id)?.nama ?? siswa.mentor?.find(m => m.id === id)?.nama ?? '…'

  const kirim = async () => {
    setSimpan(true); setPesan(null)
    try {
      const { mentorIds, ...body } = form
      for (const k of ['tanggalLahir', 'tanggalMulaiProgram']) body[k] = body[k] || null
      if (bolehMentor) body.mentorIds = mentorIds
      const r = await api.patch(`/api/raport/siswa/${siswa.id}`, body)
      setPesan({ ok: true, teks: 'Data siswa tersimpan' })
      onTersimpan?.(r.data.data)
    } catch (e) { setPesan({ ok: false, teks: pesanGalat(e, 'Gagal menyimpan') }) }
    setSimpan(false)
  }

  return (
    <div className={s.programGrid}>
      <div className={`${s.field} ${s.fieldLebar}`}>
        <span>Mentor {bolehMentor && <small className={s.redup}>(bisa lebih dari satu, maks. 5)</small>}</span>
        {bolehMentor ? (
          <div className={s.mentorDaftar}>
            {form.mentorIds.map(id => (
              <span key={id} className={s.mentorChip}>
                {namaMentor(id)}
                <button type="button" title="Lepas mentor" onClick={() => setForm(f => ({ ...f, mentorIds: f.mentorIds.filter(x => x !== id) }))}>✕</button>
              </span>
            ))}
            {form.mentorIds.length < 5 && (
              <select className="form-input" value="" onChange={e => { const id = e.target.value; if (id) setForm(f => ({ ...f, mentorIds: [...f.mentorIds, id] })) }}>
                <option value="">{form.mentorIds.length ? '+ Tambah mentor…' : '— pilih mentor —'}</option>
                {kandidat.filter(k => k.id !== siswa.id && !form.mentorIds.includes(k.id)).map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            )}
          </div>
        ) : <div className={s.statis}>{daftarMentor(siswa.mentor).join(', ') || '—'}</div>}
      </div>
      <label className={s.field}><span>Fokus kompetensi</span><input className="form-input" placeholder="mis. 3D Modeling, Rigging, Market" value={form.fokusKompetensi} onChange={set('fokusKompetensi')} /></label>
      <label className={s.field}><span>Tempat lahir</span><input className="form-input" placeholder="mis. Semarang" value={form.tempatLahir} onChange={set('tempatLahir')} /></label>
      <label className={s.field}><span>Tanggal lahir</span><input type="date" className="form-input" value={form.tanggalLahir} onChange={set('tanggalLahir')} /></label>
      <label className={s.field}><span>Mulai program</span><input type="date" className="form-input" value={form.tanggalMulaiProgram} onChange={set('tanggalMulaiProgram')} /></label>
      <div className={s.programAksi}>
        <button className="btn btn-ghost" onClick={kirim} disabled={simpan}>{simpan ? 'Menyimpan…' : 'Simpan data siswa'}</button>
        {pesan && <span className={pesan.ok ? s.ok : s.galat}>{pesan.teks}</span>}
      </div>
    </div>
  )
}

function TabelRenstra({ nilai, bulan, ubah, petunjuk }) {
  const set = (i, k, v) => ubah(nilai.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  return (
    <div className={s.renstra}>
      {nilai.map((r, i) => (
        <div key={i} className={s.renstraBaris}>
          <div className={s.renstraBulan}><strong>Bulan {i + 1}</strong><span>{bulan[i]}</span></div>
          {[['teknis', 'Teknis'], ['nonTeknis', 'Non Teknis'], ['checklist', 'Checklist']].map(([k, label]) => (
            <label key={k} className={s.field}>
              <span>{label}</span>
              {ubah
                ? <textarea className="form-input" rows={3} placeholder={petunjuk[k]} value={r[k]} onChange={e => set(i, k, e.target.value)} />
                : <div className={s.statisPanjang}>{r[k] || '—'}</div>}
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}

function DaftarSkor({ item, label, ubahItem, hapus }) {
  return (
    <div className={s.skorDaftar}>
      {item.map((x, i) => (
        <div key={i} className={s.skorItem}>
          <div className={s.skorKepala}>
            {label(x, i)}
            {hapus && <button className={s.hapus} title="Hapus" onClick={() => hapus(i)}>✕</button>}
          </div>
          <Skor nilai={x.skor} label={typeof x.nama === 'string' ? x.nama : x.kunci} onPilih={ubahItem ? (v) => ubahItem(i, { skor: v }) : null} />
          {ubahItem
            ? <textarea className="form-input" rows={2} placeholder="Deskripsi singkat perkembangannya" value={x.deskripsi} onChange={e => ubahItem(i, { deskripsi: e.target.value })} />
            : <div className={s.statisPanjang}>{x.deskripsi || ''}</div>}
        </div>
      ))}
    </div>
  )
}

function Acuan({ acuan }) {
  if (!acuan) return null
  return (
    <div className={s.acuan}>
      <strong>Acuan — Penilaian Kader periode ini</strong> <span className={s.redup}>(tidak tercetak, skala 1–5)</span>
      {acuan.jumlahPenilaian === 0
        ? <p className={s.redup}>Belum ada Penilaian Kader periode ini.</p>
        : <p className={s.redup}>{acuan.aspek.map(a => `${a.label} ${fmtSkor(a.skor)}`).join(' · ')} — dari {acuan.jumlahPenilaian} penilaian.</p>}
    </div>
  )
}

function Lampiran({ userId, periode, bisaUbah, onPesan }) {
  const [foto, setFoto] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => {
    let batal = false
    api.get(`/api/raport/${userId}/lampiran?tahun=${periode.tahun}&kuartal=${periode.kuartal}`)
      .then(r => { if (!batal) setFoto(r.data.data ?? []) }).catch(() => { if (!batal) setFoto([]) })
    return () => { batal = true }
  }, [userId, periode.tahun, periode.kuartal])

  const unggah = async (e) => {
    const berkas = [...(e.target.files ?? [])]
    e.target.value = ''
    setSibuk(true)
    for (const f of berkas) {
      try {
        const dataUrl = await kecilkanFoto(f)
        const r = await api.post(`/api/raport/${userId}/lampiran`, { ...periode, dataUrl, keterangan: '' })
        setFoto(v => [...(v ?? []), r.data.data])
      } catch (err) { onPesan({ ok: false, teks: pesanGalat(err, err.message || 'Gagal mengunggah foto') }); break }
    }
    setSibuk(false)
  }
  const hapus = async (id) => {
    try { await api.delete(`/api/raport/lampiran/${id}`); setFoto(v => v.filter(x => x.id !== id)) }
    catch (err) { onPesan({ ok: false, teks: pesanGalat(err, 'Gagal menghapus foto') }) }
  }

  if (foto === null) return <div className={s.muat}><span className="spinner" /></div>
  return (
    <>
      {foto.length === 0 && <p className={s.redup}>Belum ada foto karya. Halaman Lampiran Karya tidak dicetak kalau kosong.</p>}
      <div className={s.lampiran}>
        {foto.map(f => (
          <figure key={f.id} className={s.lampiranItem}>
            <img src={f.dataUrl} alt={f.keterangan || 'Karya siswa'} />
            {bisaUbah && <button className={s.lampiranHapus} onClick={() => hapus(f.id)} title="Hapus foto">✕</button>}
          </figure>
        ))}
      </div>
      {bisaUbah && foto.length < 6 && (
        <label className="btn btn-ghost" style={{ marginTop: 10 }}>
          {sibuk ? 'Mengunggah…' : '+ Tambah foto karya'}
          <input type="file" accept="image/*" multiple hidden onChange={unggah} disabled={sibuk} />
        </label>
      )}
      <p className={s.skala}>Maks. 6 foto. Di PDF tercetak catatan: “{CATATAN_LAMPIRAN}”.</p>
    </>
  )
}

const PETUNJUK_BELAJAR = { teknis: 'mis. BISA, karena … (evaluasi target teknis bulan ini)', nonTeknis: 'mis. BISA, karena …', checklist: 'mis. SUDAH, karena …' }
const PETUNJUK_SELANJUTNYA = { teknis: 'Target teknis bulan ini', nonTeknis: 'Target sikap / non-teknis', checklist: 'Berjalan / daftar capaian' }

// ── Editor / pembaca satu raport ─────────────────────────────────────────────
function Editor({ userId, periode, onKembali }) {
  const [muat, setMuat] = useState(true)
  const [galat, setGalat] = useState(null)
  const [d, setD] = useState(null)
  const [isi, setIsi] = useState(null)
  const [kotor, setKotor] = useState(false)
  const [sibuk, setSibuk] = useState(null)
  const [pesan, setPesan] = useState(null)

  const isiDari = (raport, bawaan) => ({
    renstraBelajar: raport?.renstraBelajar?.length ? raport.renstraBelajar : bawaan?.renstraBelajar?.length ? bawaan.renstraBelajar : RENSTRA_KOSONG,
    personal: PERSONAL.map(p => {
      const x = (raport?.personal ?? []).find(v => v.kunci === p.kunci)
      return { kunci: p.kunci, skor: x?.skor ?? null, deskripsi: x?.deskripsi ?? '' }
    }),
    teknis: (raport?.teknis?.length ? raport.teknis : bawaan?.teknis ?? []).map(k => ({ nama: k.nama, skor: k.skor ?? null, deskripsi: k.deskripsi ?? '' })),
    renstraSelanjutnya: raport?.renstraSelanjutnya?.length ? raport.renstraSelanjutnya : RENSTRA_KOSONG,
    untukSiswa: raport?.untukSiswa ?? '', untukOrangTua: raport?.untukOrangTua ?? '', kesanBelajar: raport?.kesanBelajar ?? '',
  })

  const muatUlang = () => api.get(`/api/raport/${userId}?tahun=${periode.tahun}&kuartal=${periode.kuartal}`).then(r => r.data.data)
  useEffect(() => {
    let batal = false
    setMuat(true); setGalat(null); setPesan(null)
    muatUlang()
      .then(data => { if (batal) return; setD(data); setIsi(isiDari(data.raport, data.bawaan)); setKotor(false) })
      .catch(e => { if (!batal) setGalat(pesanGalat(e, 'Gagal memuat raport')) })
      .finally(() => { if (!batal) setMuat(false) })
    return () => { batal = true }
  }, [userId, periode.tahun, periode.kuartal]) // eslint-disable-line react-hooks/exhaustive-deps

  if (muat) return <div className={s.muat}><span className="spinner" /></div>
  if (galat) return <div className="card">{galat} <button className="btn btn-ghost" onClick={onKembali}>Kembali</button></div>

  const { siswa, raport, identitas, acuan } = d
  const bisaTulis = siswa.hak === 'kelola' || siswa.hak === 'mentor'
  const terbit = raport?.status === 'TERBIT'
  const ubahable = bisaTulis && !terbit
  const ubah = (patch) => { setIsi(v => ({ ...v, ...patch })); setKotor(true) }
  const ubahDaftar = (kunci) => (i, patch) => ubah({ [kunci]: isi[kunci].map((x, j) => (j === i ? { ...x, ...patch } : x)) })

  const panggil = async (aksi, fn, sukses) => {
    setSibuk(aksi); setPesan(null)
    try {
      await fn()
      const segar = await muatUlang()
      setD(segar); setIsi(isiDari(segar.raport, segar.bawaan)); setKotor(false)
      setPesan({ ok: true, teks: sukses })
    } catch (e) { setPesan({ ok: false, teks: pesanGalat(e, 'Gagal') }) }
    setSibuk(null)
  }
  const kirimDraft = () => api.put(`/api/raport/${userId}`, { ...periode, ...isi, teknis: isi.teknis.filter(k => k.nama.trim()) })
  const aksiSimpan = () => panggil('simpan', kirimDraft, 'Draft tersimpan')
  const aksiTerbit = () => {
    if (!window.confirm('Terbitkan raport? Setelah terbit, raport bisa dilihat siswanya. Untuk mengubah, tarik kembali dulu.')) return
    panggil('terbit', async () => { if (kotor) await kirimDraft(); return api.post(`/api/raport/${userId}/terbit`, periode) }, 'Raport diterbitkan')
  }
  const aksiTarik = () => {
    if (!window.confirm('Tarik raport kembali ke draft? Siswa tidak bisa melihatnya sampai diterbitkan lagi.')) return
    panggil('tarik', () => api.post(`/api/raport/${userId}/tarik`, periode), 'Raport kembali ke draft')
  }
  const unduh = async () => {
    setSibuk('pdf'); setPesan(null)
    try {
      const [{ buatRaportPdf }, { unduhBlob }, lamp] = await Promise.all([
        import('../../components/laporan/RaportPDF'), import('../../components/laporan/buatProgressReport'),
        api.get(`/api/raport/${userId}/lampiran?tahun=${periode.tahun}&kuartal=${periode.kuartal}`),
      ])
      const raportPdf = terbit ? raport : { ...(raport ?? {}), ...isi, status: 'DRAFT' }
      const blob = await buatRaportPdf({ ...periode, identitas, foto: d.foto, raport: raportPdf, lampiran: lamp.data.data ?? [] })
      const nama = (identitas?.nama ?? 'Siswa').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
      unduhBlob(blob, `Raport-${nama}-${periode.tahun}-T${periode.kuartal}${terbit ? '' : '-DRAFT'}.pdf`)
    } catch (e) { setPesan({ ok: false, teks: 'Gagal membuat PDF: ' + (e.message || 'galat') }) }
    setSibuk(null)
  }
  const pakaiTemplate = (nama) => {
    if (isi.teknis.length && !window.confirm('Ganti daftar kompetensi teknis dengan template ini?')) return
    ubah({ teknis: TEMPLATE_TEKNIS[nama].map(n => ({ nama: n, skor: null, deskripsi: '' })) })
  }
  const terisiPersonal = isi.personal.filter(p => p.skor != null).length

  return (
    <>
      <div className={s.kepala}>
        <button className={s.tautan} onClick={onKembali}>‹ Kembali</button>
        <div>
          <h2 className={s.judul}>{identitas?.nama}</h2>
          <div className={s.meta}>
            {LABEL_PROGRAM[identitas?.program]}{identitas?.kelas ? ` · Kelas ${identitas.kelas}` : ''}{identitas?.sekolah ? ` · ${identitas.sekolah}` : ''}
            {identitas?.unit ? ` · ${identitas.unit}` : ''}{identitas?.tinggalDengan ? ` · Tinggal: ${identitas.tinggalDengan}` : ''}
          </div>
          <div className={s.meta}>Periode {rentangTriwulan(periode.tahun, periode.kuartal)}</div>
        </div>
        <span className={`badge ${STATUS[raport?.status ?? null].cls}`}>{STATUS[raport?.status ?? null].label}</span>
      </div>

      {bisaTulis && (
        <section className={`card ${s.bagian}`}>
          <h3>Data siswa</h3>
          <DataSiswa key={siswa.id} siswa={siswa} onTersimpan={(baru) => setD(v => ({ ...v, siswa: baru, identitas: terbit ? v.identitas : { ...v.identitas, fokusKompetensi: baru.fokusKompetensi, mentor: daftarMentor(baru.mentor), tempatLahir: baru.tempatLahir, tanggalLahir: baru.tanggalLahir, tanggalMulaiProgram: baru.tanggalMulaiProgram } }))} />
          {!d.foto && <p className={s.redup}>Siswa belum punya foto profil — halaman Profil di raport memakai inisial. Foto diatur di profil anggota.</p>}
        </section>
      )}

      <section className={`card ${s.bagian}`}>
        <h3>Kesan Belajar <small>ditulis siswa dari akunnya</small></h3>
        {isi.kesanBelajar
          ? <div className={s.statisPanjang}>{isi.kesanBelajar}</div>
          : <p className={s.redup}>Siswa belum menulis Kesan Belajar periode ini. Ingatkan siswa membuka SDM › Raport Siswa di akunnya.</p>}
      </section>

      <section className={`card ${s.bagian}`}>
        <h3>1 · Renstra Belajar <small>rencana periode ini + evaluasinya{raport ? '' : ' — terisi dari Renstra Selanjutnya raport sebelumnya'}</small></h3>
        <TabelRenstra nilai={isi.renstraBelajar} bulan={bulanTriwulan(periode.kuartal)} ubah={ubahable ? (v) => ubah({ renstraBelajar: v }) : null} petunjuk={PETUNJUK_BELAJAR} />
      </section>

      <section className={`card ${s.bagian}`}>
        <h3>2 · Perkembangan Personal <small>{terisiPersonal}/12 diberi skor · skala 1–10</small></h3>
        {ubahable && <Acuan acuan={acuan} />}
        <DaftarSkor item={isi.personal} label={(x) => <strong>{PERSONAL.find(p => p.kunci === x.kunci)?.label}</strong>} ubahItem={ubahable ? ubahDaftar('personal') : null} />
      </section>

      <section className={`card ${s.bagian}`}>
        <h3>3 · Perkembangan Teknis{identitas?.fokusKompetensi ? ` — ${identitas.fokusKompetensi}` : ''} <small>skala 1–10</small></h3>
        {ubahable && (
          <div className={s.template}>
            <span className={s.redup}>Pakai template:</span>
            {Object.keys(TEMPLATE_TEKNIS).map(n => <button key={n} className="btn btn-ghost" onClick={() => pakaiTemplate(n)}>{n}</button>)}
          </div>
        )}
        {isi.teknis.length === 0 && <p className={s.redup}>Belum ada kompetensi. Pilih template di atas atau tambahkan sendiri.</p>}
        <DaftarSkor item={isi.teknis}
          label={(x, i) => ubahable
            ? <input className="form-input" placeholder="Nama kompetensi" value={x.nama} onChange={e => ubahDaftar('teknis')(i, { nama: e.target.value })} />
            : <strong>{x.nama}</strong>}
          ubahItem={ubahable ? ubahDaftar('teknis') : null}
          hapus={ubahable ? (i) => ubah({ teknis: isi.teknis.filter((_, j) => j !== i) }) : null} />
        {ubahable && isi.teknis.length < 12 && <button className="btn btn-ghost" onClick={() => ubah({ teknis: [...isi.teknis, { nama: '', skor: null, deskripsi: '' }] })}>+ Tambah kompetensi</button>}
      </section>

      <section className={`card ${s.bagian}`}>
        <h3>4 · Renstra Selanjutnya <small>rencana {bulanTriwulanBerikut(periode.kuartal).join(', ')} — otomatis jadi Renstra Belajar raport berikutnya</small></h3>
        <TabelRenstra nilai={isi.renstraSelanjutnya} bulan={bulanTriwulanBerikut(periode.kuartal)} ubah={ubahable ? (v) => ubah({ renstraSelanjutnya: v }) : null} petunjuk={PETUNJUK_SELANJUTNYA} />
      </section>

      <section className={`card ${s.bagian}`}>
        <h3>5 · Input dari Mentor</h3>
        {[['untukSiswa', 'Untuk siswa', 'Saran untuk siswa: apa yang perlu dibiasakan & dilatih.'], ['untukOrangTua', 'Untuk orang tua / wali', 'Bagaimana orang tua bisa mendukung di rumah.']].map(([k, label, bantu]) => (
          <label key={k} className={s.field}>
            <span>{label}</span>
            {ubahable
              ? <textarea className="form-input" rows={4} placeholder={bantu} value={isi[k]} onChange={e => ubah({ [k]: e.target.value })} />
              : <div className={s.statisPanjang}>{isi[k] || '—'}</div>}
          </label>
        ))}
      </section>

      <section className={`card ${s.bagian}`}>
        <h3>6 · Lampiran Karya</h3>
        <Lampiran userId={userId} periode={periode} bisaUbah={ubahable} onPesan={setPesan} />
      </section>

      <div className={s.aksi}>
        {ubahable && <button className="btn btn-ghost" onClick={aksiSimpan} disabled={!!sibuk}>{sibuk === 'simpan' ? 'Menyimpan…' : 'Simpan draft'}</button>}
        {ubahable && <button className="btn btn-primary" onClick={aksiTerbit} disabled={!!sibuk}>{sibuk === 'terbit' ? 'Menerbitkan…' : 'Terbitkan'}</button>}
        {bisaTulis && terbit && <button className="btn btn-ghost" onClick={aksiTarik} disabled={!!sibuk}>{sibuk === 'tarik' ? 'Menarik…' : 'Tarik ke draft'}</button>}
        <span className={s.spasi} />
        <button className="btn btn-primary" onClick={unduh} disabled={!!sibuk}>{sibuk === 'pdf' ? 'Membuat PDF…' : terbit ? 'Unduh PDF' : 'Unduh PDF (draft)'}</button>
      </div>
      {pesan && <p className={pesan.ok ? s.ok : s.galat}>{pesan.teks}</p>}
      {kotor && ubahable && <p className={s.redup}>Ada perubahan yang belum disimpan.</p>}
      {raport?.penulis && <p className={s.redup}>Terakhir ditulis oleh {raport.penulis.nama}.</p>}
    </>
  )
}

// ── Sisi siswa: Kesan Belajar + raport terbit ────────────────────────────────
function KesanSaya({ userId, periode }) {
  const [teks, setTeks] = useState(null)
  const [terbit, setTerbit] = useState(false)
  const [pesan, setPesan] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => {
    api.get(`/api/raport/${userId}?tahun=${periode.tahun}&kuartal=${periode.kuartal}`)
      .then(r => { const x = r.data.data; setTerbit(!!x.raport); setTeks(x.raport ? x.raport.kesanBelajar ?? '' : x.kesanBelajar ?? '') })
      .catch(() => setTeks(''))
  }, [userId, periode.tahun, periode.kuartal])
  const simpan = async () => {
    setSibuk(true); setPesan(null)
    try { await api.put(`/api/raport/${userId}/kesan`, { ...periode, kesanBelajar: teks }); setPesan({ ok: true, teks: 'Kesan Belajar tersimpan' }) }
    catch (e) { setPesan({ ok: false, teks: pesanGalat(e, 'Gagal menyimpan') }) }
    setSibuk(false)
  }
  if (teks === null) return null
  return (
    <section className={`card ${s.bagian}`}>
      <h3>Kesan Belajar — {rentangTriwulan(periode.tahun, periode.kuartal)}</h3>
      {terbit ? <div className={s.statisPanjang}>{teks || '—'}</div> : (
        <>
          <p className={s.redup}>Ceritakan pengalaman belajarmu 3 bulan ini: apa yang kamu pelajari, apa yang menyenangkan, dan apa yang berubah dari dirimu. Tulisan ini akan masuk ke raportmu.</p>
          <textarea className="form-input" rows={6} value={teks} onChange={e => setTeks(e.target.value)} style={{ width: '100%' }} />
          <div className={s.aksi}>
            <button className="btn btn-primary" onClick={simpan} disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Simpan'}</button>
            {pesan && <span className={pesan.ok ? s.ok : s.galat}>{pesan.teks}</span>}
          </div>
        </>
      )}
    </section>
  )
}

function RaportSaya({ userId, onBuka }) {
  const { data, loading } = useApi('/api/raport/saya', [])
  const periodeIni = kuartalSekarang()
  const terbit = (data ?? []).filter(r => r.status === 'TERBIT')
  return (
    <>
      <KesanSaya userId={userId} periode={periodeIni} />
      <h3 className={s.subjudul}>Raport yang sudah terbit</h3>
      {loading ? <div className={s.muat}><span className="spinner" /></div>
        : !terbit.length ? <div className={`card ${s.kosong}`}>Belum ada raport yang diterbitkan untukmu.</div>
        : (
          <div className={s.daftar}>
            {terbit.map(r => (
              <button key={`${r.tahun}-${r.kuartal}`} className={`card ${s.baris}`} onClick={() => onBuka(r)}>
                <div className={s.barisUtama}>
                  <div className={s.nama}>{rentangTriwulan(r.tahun, r.kuartal)}</div>
                  <div className={s.meta}>{labelTriwulan(r.tahun, r.kuartal)}</div>
                </div>
                <span className="badge success">Terbit</span>
              </button>
            ))}
          </div>
        )}
    </>
  )
}

export default function Raport() {
  const { user } = useAuth()
  const [periode, setPeriode] = useState(kuartalSekarang)
  const [buka, setBuka] = useState(null) // userId
  const siswaSendiri = ['SISWA_VOKASI', 'SISWA_KBU'].includes(user?.statusKeanggotaan)
  const [mode, setMode] = useState('bimbingan')
  const pengurus = (user?.roles ?? []).some(r => ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KOORDINATOR', 'PENDAMPING'].includes(r.roleType)) || (user?.jumlahSiswaBimbingan ?? 0) > 0
  const tampilSaya = siswaSendiri && (!pengurus || mode === 'saya')

  return (
    <>
      <div className="page-header">
        <h1>Raport Siswa</h1>
        <p>Raport Karir Anak untuk siswa Vokasi & KBU per 3 bulan — ditulis mentor, dibaca siswa, orang tua & sekolah.</p>
      </div>
      {siswaSendiri && pengurus && !buka && (
        <div className={s.mode}>
          <button className={`btn ${mode === 'bimbingan' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('bimbingan')}>Siswa bimbingan</button>
          <button className={`btn ${mode === 'saya' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('saya')}>Raport saya</button>
        </div>
      )}
      {buka ? (
        <Editor userId={buka} periode={periode} onKembali={() => setBuka(null)} />
      ) : tampilSaya ? (
        <RaportSaya userId={user.id} onBuka={(r) => { setPeriode({ tahun: r.tahun, kuartal: r.kuartal }); setBuka(user.id) }} />
      ) : (
        <>
          <PilihPeriode periode={periode} onUbah={setPeriode} />
          <DaftarSiswa periode={periode} onBuka={setBuka} />
        </>
      )}
    </>
  )
}
