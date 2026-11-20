// PILIHAN TAMPILAN DOKUMEN — dipakai bersama pembuat Progress Report, Weekly Report, dan SKB
// (diadaptasi dari playgroundecos.app, 13 Okt 2026): tema (Ekosistem / Kertas), huruf, latar
// sampul bergaya, atau foto sendiri dengan enam tata letak.
// 9 Okt 2026 (arahan Owner): ukuran & warna huruf; ubin "Unggah Foto" dibuat menonjol supaya
// langsung terlihat bisa dikustomisasi; foto yang diunggah TERSIMPAN di server untuk
// circle/unit itu (galeri, maks 12) sehingga sewaktu-waktu bisa diganti atau dipakai lagi
// tanpa unggah ulang — peramban hanya mengingat foto mana yang terakhir dipilih.
// Nilainya satu objek { tema, font, ukuran, warna, warnaKustom, gayaLatar, pakaiFoto, tataFoto, foto };
// gaya efektif = foto bila pakaiFoto & fotonya ada, selain itu gayaLatar.
import { useCallback, useEffect, useRef, useState } from 'react'
import SampulMini from '../../components/laporan/SampulMini'
import {
  GAYA_LATAR, GAYA_FOTO, TATA_FOTO, PILIHAN_TEMA, PILIHAN_FONT, PILIHAN_UKURAN, WARNA_HURUF, NAMA_TEMA,
  temaEfektif, cssFont, warnaHurufHex, kontrasHuruf, skalaUkuran,
} from '../../components/laporan/gayaLatar'
import {
  kecilkanFotoSampul, buatThumb, ambilFotoSampul, simpanFotoSampul, fotoTerpilihId, ingatFotoTerpilih,
  daftarFotoServer, ambilFotoServer, unggahFotoServer, hapusFotoServer,
} from '../../components/laporan/fotoSampul'
import { daftarkanFontPratinjau } from '../../components/laporan/fontPratinjau'

export function Langkah({ no, judul, ket, children }) {
  return (
    <div className="pl-langkah">
      <div className="pl-langkah-kepala">
        <span className="pl-no" aria-hidden>{no}</span>
        <div>
          <h3>{judul}</h3>
          {ket && <p>{ket}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

/** Gaya efektif yang dikirim ke penyusun PDF. */
export const gayaDari = (t) => (t.pakaiFoto && t.foto ? GAYA_FOTO : t.gayaLatar)

/** Kalimat penjelas tema (Ekosistem: Terang / Gelap, senada mode aplikasi). */
function ketTema(tema) {
  return PILIHAN_TEMA.find(t => t.id === tema)?.ket ?? PILIHAN_TEMA[0].ket
}

const GALERI_KOSONG = { foto: [], bolehUbah: false, maks: 12, memuat: false, gagal: false }

/**
 * 11 Okt 2026 (arahan Owner): contoh halaman pindah ke Pratinjau Langsung (PDF asli) di kolom
 * kanan supaya langkah Tema & Huruf rapi. Weekly Report memakai galeri sampulnya sendiri
 * (`gayaDaftar` + `Ubin` berfoto profil unit) dan satu tata letak foto (`tataFotoAktif` false).
 * @param noAwal    nomor langkah pertama (dua langkah: Tema & Huruf, Latar Sampul)
 * @param kunciFoto kunci galeri foto sampul (lingkup laporan / unit): 'ekosistem' | 'circle:<id>' | 'rumah-usaha:<id>' | 'unit:<id>'
 * @param judulDok  teks di pratinjau ubin ("Progress Report" / "SKB")
 */
export default function PilihanTampilan({
  noAwal = 3, nilai, onUbah, kunciFoto, situs, ekosistem = false, slotWarna = 1, nama, namaFoto, judulDok,
  gayaDaftar = GAYA_LATAR, Ubin = SampulMini, ubinTambahan = null, tataFotoAktif = true,
  judulLatar = 'Latar Sampul', ketLatar = 'Dipakai di sampul, pembatas bagian, dan halaman penutup. Foto sendiri tersimpan untuk circle/unit-nya.',
}) {
  const { tema, font, ukuran = 'normal', warna = 'tema', warnaKustom = null, gayaLatar, pakaiFoto, tataFoto, foto } = nilai
  const [pesanFoto, setPesanFoto] = useState(null)
  const [galeri, setGaleri] = useState(GALERI_KOSONG)
  const [fotoId, setFotoId] = useState(null)   // foto galeri yang sedang dipakai dokumen ini
  const [sibuk, setSibuk] = useState(false)
  const inputFoto = useRef(null)
  const ubah = (patch) => onUbah(v => ({ ...v, ...patch }))
  const temaEf = temaEfektif(tema, ekosistem ? null : situs)
  const css = cssFont(font, temaEf)
  const gaya = gayaDari(nilai)
  const hurufHex = warnaHurufHex(warna, temaEf, warnaKustom)
  const kontras = hurufHex ? kontrasHuruf(hurufHex, temaEf) : null
  const daftarWarna = WARNA_HURUF[temaEf] ?? WARNA_HURUF.terang
  const hurufBawaan = temaEf === 'gelap' ? '#E8EAED' : '#3C3C3C' // = tinta TEMA_PDF terang/gelap
  const labelSasaran = namaFoto ?? nama

  useEffect(daftarkanFontPratinjau, [])

  const muatGaleri = useCallback(async (kunci) => {
    setGaleri(g => ({ ...g, memuat: true, gagal: false }))
    try {
      const d = await daftarFotoServer(kunci)
      setGaleri({ foto: d?.foto ?? [], bolehUbah: !!d?.bolehUbah, maks: d?.maks ?? 12, memuat: false, gagal: !d })
      return d
    } catch {
      setGaleri({ ...GALERI_KOSONG, gagal: true })
      return null
    }
  }, [])

  // Foto sampul diingat PER LINGKUP/UNIT: ganti pilihan → salinan di peramban + galeri milik pilihan itu.
  useEffect(() => {
    if (!kunciFoto) return
    let batal = false
    setPesanFoto(null)
    const cache = ambilFotoSampul(kunciFoto)
    const idTerpilih = fotoTerpilihId(kunciFoto)
    setFotoId(idTerpilih)
    onUbah(v => ({ ...v, foto: cache }))
    muatGaleri(kunciFoto).then(async (d) => {
      if (batal || !d) return
      const ada = idTerpilih && d.foto.some(f => f.id === idTerpilih)
      if (idTerpilih && !ada) { ingatFotoTerpilih(kunciFoto, null); setFotoId(null) } // dihapus pengurus lain
      if (ada && !cache) {
        // Dipilih di perangkat lain: ambil foto penuhnya supaya dokumen ini langsung memakainya.
        try {
          const penuh = await ambilFotoServer(idTerpilih)
          if (!batal && penuh) { simpanFotoSampul(kunciFoto, penuh); onUbah(v => ({ ...v, foto: penuh })) }
        } catch { /* biarkan tanpa foto */ }
      }
    })
    return () => { batal = true }
  }, [kunciFoto, onUbah, muatGaleri])

  async function pilihFoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !kunciFoto) return
    setPesanFoto(null)
    setSibuk(true)
    try {
      const dataUrl = await kecilkanFotoSampul(file)
      ubah({ foto: dataUrl, pakaiFoto: true })
      simpanFotoSampul(kunciFoto, dataUrl)
      if (galeri.bolehUbah) {
        try {
          const thumb = await buatThumb(dataUrl)
          const f = await unggahFotoServer(kunciFoto, { nama: file.name.replace(/\.[^.]+$/, '').slice(0, 80), dataUrl, thumb })
          setGaleri(g => ({ ...g, foto: [f, ...g.foto].slice(0, g.maks) }))
          setFotoId(f.id)
          ingatFotoTerpilih(kunciFoto, f.id)
          setPesanFoto(`Foto disimpan untuk ${labelSasaran} — bisa dipilih lagi kapan saja dari galeri di bawah, oleh pengurus mana pun.`)
        } catch (err) {
          setFotoId(null)
          ingatFotoTerpilih(kunciFoto, null)
          setPesanFoto(err?.response?.data?.message || 'Foto dipakai di peramban ini saja — gagal disimpan ke galeri.')
        }
      } else {
        setFotoId(null)
        ingatFotoTerpilih(kunciFoto, null)
        setPesanFoto(`Foto dipakai di peramban ini saja — hanya pengurus ${labelSasaran} yang bisa menyimpannya ke galeri.`)
      }
    } catch (err) {
      setPesanFoto(err.message || 'Foto tidak bisa dipakai')
    } finally { setSibuk(false) }
  }

  async function pakaiDariGaleri(f) {
    if (!kunciFoto || sibuk) return
    setSibuk(true)
    setPesanFoto(null)
    try {
      const penuh = await ambilFotoServer(f.id)
      if (!penuh) throw new Error('Foto galeri kosong')
      ubah({ foto: penuh, pakaiFoto: true })
      simpanFotoSampul(kunciFoto, penuh)
      setFotoId(f.id)
      ingatFotoTerpilih(kunciFoto, f.id)
    } catch (err) {
      setPesanFoto(err?.response?.data?.message || err.message || 'Foto galeri gagal dimuat')
    } finally { setSibuk(false) }
  }

  /** Lepas foto dari dokumen ini (tidak menghapus dari galeri). */
  function lepasFoto() {
    simpanFotoSampul(kunciFoto, null)
    ingatFotoTerpilih(kunciFoto, null)
    setFotoId(null)
    ubah({ foto: null, pakaiFoto: false })
    setPesanFoto(null)
  }

  async function hapusDariGaleri(f) {
    if (!galeri.bolehUbah || sibuk) return
    if (!window.confirm(`Hapus foto "${f.nama || 'tanpa nama'}" dari galeri ${labelSasaran}? Pengurus lain juga tidak bisa memakainya lagi.`)) return
    setSibuk(true)
    try {
      await hapusFotoServer(f.id)
      setGaleri(g => ({ ...g, foto: g.foto.filter(x => x.id !== f.id) }))
      if (fotoId === f.id) lepasFoto()
      setPesanFoto('Foto dihapus dari galeri.')
    } catch (err) {
      setPesanFoto(err?.response?.data?.message || 'Gagal menghapus foto')
    } finally { setSibuk(false) }
  }

  const skala = skalaUkuran(ukuran)
  const ubin = { tema: temaEf, font: css, slotWarna, nama, judulDok, warnaHuruf: hurufHex, skala, ...(ubinTambahan ?? {}) }
  return (
    <>
      <Langkah no={noAwal} judul="Tema & Huruf" ket={ketTema(tema, situs, ekosistem)}>
        <div className="pl-tema" role="radiogroup" aria-label="Tema dokumen">
          {PILIHAN_TEMA.map(t => (
            <button key={t.id} type="button" role="radio" aria-checked={tema === t.id} title={t.ket}
              className={`filter-org-pil${tema === t.id ? ' aktif' : ''}`} onClick={() => ubah({ tema: t.id })}>
              <span className="pl-emoji" aria-hidden>{t.id === 'otomatis' ? '🌐' : '🎨'}</span>
              <span>{t.nama}</span>
              {t.id === 'otomatis' && <span className="pl-tema-hasil">{NAMA_TEMA[temaEf]}</span>}
            </button>
          ))}
        </div>
        <div className="pl-font" role="radiogroup" aria-label="Huruf judul">
          {PILIHAN_FONT.map(f => {
            const aktif = font === f.id
            return (
              <button key={f.id} type="button" role="radio" aria-checked={aktif} title={f.ket}
                className={`pl-font-pil${aktif ? ' aktif' : ''}`} onClick={() => ubah({ font: f.id })}>
                <span className="pl-font-aa" style={{ fontFamily: cssFont(f.id, temaEf) }}>Aa</span>
                <span className="pl-font-nama">{f.nama}</span>
              </button>
            )
          })}
        </div>
        <div className="pl-huruf-atur">
          <div className="pl-huruf-blok">
            <div className="pl-sublabel">Ukuran Huruf</div>
            <div className="pl-ukuran" role="radiogroup" aria-label="Ukuran huruf">
              {PILIHAN_UKURAN.map(u => (
                <button key={u.id} type="button" role="radio" aria-checked={ukuran === u.id} title={u.ket}
                  className={`filter-org-pil${ukuran === u.id ? ' aktif' : ''}`} onClick={() => ubah({ ukuran: u.id })}>
                  <span className="pl-ukuran-aa" style={{ fontSize: `${Math.round(13 * u.skala)}px` }} aria-hidden>Aa</span>
                  <span>{u.nama}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="pl-huruf-blok">
            <div className="pl-sublabel">Warna Huruf</div>
            <div className="pl-warna" role="radiogroup" aria-label="Warna huruf">
              {daftarWarna.map(w => (
                <button key={w.id} type="button" role="radio" aria-checked={warna === w.id} title={w.hex ?? 'Warna bawaan tema'}
                  className={`filter-org-pil${warna === w.id ? ' aktif' : ''}`} onClick={() => ubah({ warna: w.id })}>
                  <span className="pl-warna-contoh" style={{ background: w.hex ?? hurufBawaan }} aria-hidden />
                  <span>{w.nama}</span>
                </button>
              ))}
              <label className={`filter-org-pil pl-warna-kustom${warna === 'kustom' ? ' aktif' : ''}`} title="Pilih warna sendiri">
                <input type="color" value={warnaKustom ?? hurufBawaan} aria-label="Warna huruf sendiri"
                  onChange={e => ubah({ warna: 'kustom', warnaKustom: e.target.value.toUpperCase() })} />
                <span>Warna Lain</span>
              </label>
            </div>
            {kontras != null && kontras < 3 && (
              <p className="pl-pesan pl-pesan-peringatan">{`Warna ini kurang kontras dengan latar ${NAMA_TEMA[temaEf]} (rasio ${kontras.toFixed(1)}) — teks bisa sulit dibaca.`}</p>
            )}
          </div>
        </div>
      </Langkah>

      <Langkah no={noAwal + 1} judul={judulLatar} ket={ketLatar}>
        <div className="pl-galeri" role="radiogroup" aria-label="Gaya latar sampul">
          {gayaDaftar.map(g => {
            const aktif = gaya === g.id
            return (
              <button key={g.id} type="button" role="radio" aria-checked={aktif} title={g.ket}
                className={`pl-gaya${aktif ? ' aktif' : ''}`} onClick={() => ubah({ gayaLatar: g.id, pakaiFoto: false })}>
                <Ubin ringkas gaya={g.id} {...ubin} />
                <span className="pl-gaya-nama">{temaEf === 'kosmik' ? g.kosmik : g.nama}</span>
              </button>
            )
          })}
          <div className={`pl-gaya pl-gaya-foto${gaya === GAYA_FOTO ? ' aktif' : ''}`}>
            <button type="button" role="radio" aria-checked={gaya === GAYA_FOTO} disabled={sibuk}
              title={foto ? 'Pakai foto sendiri' : 'Unggah foto untuk sampul'}
              onClick={() => (foto ? ubah({ pakaiFoto: true }) : inputFoto.current?.click())}>
              <Ubin ringkas gaya={GAYA_FOTO} tataFoto={tataFoto} foto={foto} {...ubin} />
              <span className="pl-gaya-nama">
                <span className="pl-emoji" aria-hidden>📷</span>
                {foto ? 'Foto Sendiri' : 'Unggah Foto'}
                <span className="pl-kustom-tanda">Kustom</span>
              </span>
            </button>
            <div className="pl-foto-aksi">
              <button type="button" onClick={() => inputFoto.current?.click()} disabled={sibuk}>{foto ? 'Ganti' : 'Pilih Berkas'}</button>
              {foto && <button type="button" onClick={lepasFoto} disabled={sibuk}>Lepas</button>}
            </div>
            <input ref={inputFoto} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pilihFoto} />
          </div>
        </div>
        {pesanFoto && <p className="pl-pesan">{pesanFoto}</p>}

        {kunciFoto && (galeri.foto.length || galeri.memuat) ? (
          <div className="pl-galeri-foto">
            <div className="pl-sublabel">
              {`Foto tersimpan untuk ${labelSasaran}`}
              <small>{galeri.memuat ? 'memuat…' : `${galeri.foto.length}/${galeri.maks}`}</small>
            </div>
            <div className="pl-galeri-foto-daftar">
              {galeri.foto.map(f => (
                <div key={f.id} className={`pl-foto-ubin${fotoId === f.id ? ' aktif' : ''}`}>
                  <button type="button" onClick={() => pakaiDariGaleri(f)} disabled={sibuk} title={f.nama || 'Pakai foto ini'} aria-pressed={fotoId === f.id}>
                    {f.thumb ? <img src={f.thumb} alt={f.nama || 'Foto sampul'} /> : <span className="pl-emoji" aria-hidden>📷</span>}
                  </button>
                  <span className="pl-foto-nama">{f.nama || 'Tanpa nama'}</span>
                  {galeri.bolehUbah && (
                    <button type="button" className="pl-foto-hapus" onClick={() => hapusDariGaleri(f)} disabled={sibuk} aria-label={`Hapus ${f.nama || 'foto'} dari galeri`}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : kunciFoto && !galeri.memuat && !galeri.gagal ? (
          <p className="pl-pesan">{`Belum ada foto tersimpan untuk ${labelSasaran}. Foto yang diunggah ${galeri.bolehUbah ? 'akan disimpan di galeri ini.' : 'hanya dipakai di peramban ini.'}`}</p>
        ) : null}

        {gaya === GAYA_FOTO && tataFotoAktif && (
          <div className="pl-tata">
            <div className="pl-sublabel">Tata Letak Foto</div>
            <div className="pl-tata-daftar" role="radiogroup" aria-label="Tata letak foto">
              {TATA_FOTO.map(t => {
                const aktif = tataFoto === t.id
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={aktif} title={t.ket}
                    className={`pl-gaya pl-tata-ubin${aktif ? ' aktif' : ''}`} onClick={() => ubah({ tataFoto: t.id })}>
                    <SampulMini ringkas gaya={GAYA_FOTO} tataFoto={t.id} foto={foto} {...ubin} />
                    <span className="pl-gaya-nama">{t.nama}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Langkah>
    </>
  )
}
