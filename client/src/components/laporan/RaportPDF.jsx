// ─────────────────────────────────────────────────────────────────────────
// RAPORT SISWA VOKASI / KBU — PDF A4 lanskap (13 Okt 2026).
// Meniru raport Karir Anak yang sudah dipakai (contoh: Vokasi Dhea & KBU Nanda, Jun–Agu 2026):
// 1 Sampul · 2 Pendahuluan · 3 Profil & Kesan Belajar · 4 Renstra Belajar · 5 Perkembangan
// Personal · 6 Perkembangan Teknis · 7 Renstra Selanjutnya · 8 Input dari Mentor · 9 Lampiran Karya.
// Huruf Playfair Display + Quattrocento (fontPdf.js daftarkanFontRaport), tabel pakai Jakarta.
// Warna disalin dari contoh — dokumen cetak untuk orang tua, sengaja tidak ikut tema aplikasi.
// ─────────────────────────────────────────────────────────────────────────
import { Document, Page, View, Text, Image, Svg, Path, StyleSheet } from '@react-pdf/renderer'
import { HURUF } from './pdf/primitif'
import { HURUF_RAPORT } from './fontPdf'
import {
  JUDUL_PROGRAM, PENDAHULUAN, PERSONAL, LABEL_PERSONAL, CATATAN_LAMPIRAN,
  rentangTriwulan, labelTriwulan, bulanTriwulan, bulanTriwulanBerikut, tanggalPanjang, daftarMentor,
} from '../../utils/raport'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import logoKarirAnak from '../../assets/raport/logo-karir-anak.png'

const W = {
  tinta: '#2F2F2F', redup: '#6F6F6F', abu: '#8A8A8A', garis: '#D9D9D9', kepala: '#F5F5F5',
  lime: '#A5E04C', biru: '#2A9BD0',
}
// Lingkaran skor: hijau limau → biru, satu warna per baris (seperti contoh).
const GRADASI = ['#8FDB5E', '#74CF7A', '#5FC38E', '#4DB6A2', '#3AA8B7', '#2A9BD0']

const s = StyleSheet.create({
  hal: { backgroundColor: '#FFFFFF', color: W.tinta, fontFamily: HURUF_RAPORT.isi, fontSize: 11, paddingVertical: 40, paddingHorizontal: 52 },
  judulBesar: { fontFamily: HURUF_RAPORT.judul, fontSize: 38, textAlign: 'center', marginBottom: 18 },
  judulKiri: { fontFamily: HURUF_RAPORT.judul, fontWeight: 700, fontSize: 26, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: W.garis, marginBottom: 18 },
  sisi: { position: 'absolute', left: -38, top: 160, fontFamily: HURUF_RAPORT.isi, fontSize: 6, color: '#B0B0B0', letterSpacing: 0.5, transform: 'rotate(-90deg)' },
  draft: { position: 'absolute', top: 220, left: 0, right: 0, textAlign: 'center', fontFamily: HURUF.jakarta, fontSize: 110, fontWeight: 800, color: '#000000', opacity: 0.06, transform: 'rotate(-20deg)' },
  kaki: { position: 'absolute', bottom: 18, left: 52, right: 52, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#B0B0B0' },
  // tabel renstra
  tabel: { borderWidth: 1.5, borderColor: W.garis },
  tBaris: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: W.garis },
  tSel: { padding: 9, borderRightWidth: 1.5, borderRightColor: W.garis, fontFamily: HURUF.jakarta, fontSize: 11.5, lineHeight: 1.45 },
  tKepala: { fontFamily: HURUF_RAPORT.judul, fontWeight: 700, fontSize: 15, textAlign: 'center', lineHeight: 1.3 },
  // skor
  skorBaris: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  bulat: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  angka: { fontFamily: HURUF_RAPORT.judul, fontSize: 21, color: '#FFFFFF' },
  aspek: { fontFamily: HURUF_RAPORT.judul, fontSize: 14 },
  desk: { fontSize: 10, color: W.redup, lineHeight: 1.35 },
})

function Draft({ terbit }) {
  return terbit ? null : <Text style={s.draft} fixed>DRAFT</Text>
}

function Halaman({ children, terbit, kaki, style }) {
  return (
    <Page size="A4" orientation="landscape" style={[s.hal, style]}>
      {children}
      {kaki && (
        <View style={s.kaki} fixed>
          <Text>{kaki}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      )}
      <Draft terbit={terbit} />
    </Page>
  )
}

function TabelRenstra({ judul, baris, bulan }) {
  const lebar = ['17%', '27.66%', '27.66%', '27.68%']
  const isi = [0, 1, 2].map(i => baris?.[i] ?? {})
  return (
    <>
      <Text style={[s.judulBesar, { textTransform: 'uppercase', marginBottom: 14 }]}>{judul}</Text>
      <View style={s.tabel}>
        <View style={[s.tBaris, { backgroundColor: W.kepala }]}>
          <View style={[s.tSel, { width: lebar[0] }]} />
          {['Teknis', 'Non Teknis', 'Checklist'].map((k, i) => (
            <View key={k} style={[s.tSel, { width: lebar[i + 1], justifyContent: 'center' }, i === 2 && { borderRightWidth: 0 }]}>
              <Text style={s.tKepala}>{k}</Text>
            </View>
          ))}
        </View>
        {isi.map((r, i) => (
          <View key={i} style={[s.tBaris, i === 2 && { borderBottomWidth: 0 }]} wrap={false}>
            <View style={[s.tSel, { width: lebar[0], backgroundColor: W.kepala, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={[s.tKepala, { fontSize: 16 }]}>Bulan {i + 1}</Text>
              <Text style={{ fontFamily: HURUF_RAPORT.isi, fontSize: 9.5, color: W.redup, marginTop: 4 }}>{bulan[i]}</Text>
            </View>
            {['teknis', 'nonTeknis', 'checklist'].map((k, j) => (
              <View key={k} style={[s.tSel, { width: lebar[j + 1], minHeight: 112 }, j === 2 && { borderRightWidth: 0 }]}>
                <TeksRenstra teks={r[k]} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </>
  )
}

// "BISA, karena ..." / "SUDAH, karena ..." — kata pertama yang ditulis kapital dicetak tebal.
function TeksRenstra({ teks }) {
  if (!teks) return <Text style={{ color: '#BBBBBB' }}>—</Text>
  const m = teks.match(/^([A-Z]{3,}[A-Z ]*)(,?)([\s\S]*)$/)
  if (!m) return <Text>{teks}</Text>
  return <Text><Text style={{ fontWeight: 700 }}>{m[1]}{m[2]}</Text>{m[3]}</Text>
}

function DaftarSkor({ item, label }) {
  const baris = Math.ceil(item.length / 2)
  const kolom = [item.slice(0, baris), item.slice(baris)]
  const tinggi = baris > 5 ? 66 : 76
  return (
    <View style={{ flexDirection: 'row' }}>
      {kolom.map((isi, k) => (
        <View key={k} style={{ width: '50%', paddingRight: k === 0 ? 16 : 0, paddingLeft: k === 1 ? 6 : 0 }}>
          {isi.map((x, i) => (
            <View key={i} style={[s.skorBaris, { height: tinggi }]} wrap={false}>
              <View style={[s.bulat, { backgroundColor: GRADASI[Math.min(i, GRADASI.length - 1)] }]}>
                <Text style={s.angka}>{x.skor ?? '–'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.aspek}>{label(x)}</Text>
                {x.deskripsi ? <Text style={s.desk}>{x.deskripsi}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function Puzzle() {
  // Dua keping puzzle (hijau & biru) seperti contoh — digambar sederhana.
  const keping = 'M10 20 h22 a8 8 0 1 1 16 0 h22 v22 a8 8 0 1 0 0 16 v22 h-22 a8 8 0 1 0 -16 0 h-22 v-22 a8 8 0 1 1 0 -16 z'
  return (
    <Svg width={190} height={130} viewBox="0 0 190 130">
      <Path d={keping} fill={W.lime} transform="translate(8 14) scale(1.25)" />
      <Path d={keping} fill={W.biru} transform="translate(86 6) scale(1.25)" />
    </Svg>
  )
}

/**
 * @param data { tahun, kuartal, identitas, foto, raport, lampiran: [{ dataUrl, keterangan }] }
 */
export default function RaportPDF({ data }) {
  const { tahun, kuartal, identitas: id = {}, foto, raport = {}, lampiran = [] } = data
  const terbit = raport?.status === 'TERBIT'
  const program = id.program === 'SISWA_KBU' ? 'SISWA_KBU' : 'SISWA_VOKASI'
  const panggilan = (id.nama ?? '').split(' ')[0]
  const kaki = `${ECOSYSTEM_NAME} · Karir Anak — Raport ${id.nama ?? ''} · ${labelTriwulan(tahun, kuartal)}`
  const ttl = [id.tempatLahir, tanggalPanjang(id.tanggalLahir)].filter(Boolean).join(', ')
  const personal = PERSONAL.map(p => (raport.personal ?? []).find(x => x.kunci === p.kunci) ?? { kunci: p.kunci, skor: null, deskripsi: '' })
  const teknis = raport.teknis ?? []
  const mentor = daftarMentor(id.mentor).length ? daftarMentor(id.mentor) : daftarMentor(raport?.penulis?.nama)
  const kolomFoto = lampiran.length <= 2 ? lampiran.length || 1 : lampiran.length <= 4 ? 2 : 3

  return (
    <Document title={`Raport ${id.nama ?? ''} — ${rentangTriwulan(tahun, kuartal)}`} author={`${ECOSYSTEM_NAME} · Karir Anak`}>
      {/* 1 · Sampul */}
      <Halaman terbit={terbit} style={{ justifyContent: 'center', paddingHorizontal: 72 }}>
        <View style={{ position: 'absolute', top: 30, right: 48, flexDirection: 'row', alignItems: 'center' }}>
          <Image src={logoKarirAnak} style={{ width: 112, height: 112 }} />
        </View>
        <Text style={{ fontFamily: HURUF_RAPORT.judul, fontWeight: 700, fontSize: 44, color: W.lime, marginTop: 70 }}>Raport</Text>
        <Text style={{ fontFamily: HURUF_RAPORT.judul, fontWeight: 700, fontSize: 44, lineHeight: 1.15, maxWidth: 640 }}>{JUDUL_PROGRAM[program]}</Text>
        <Text style={{ fontSize: 14, color: W.redup, marginTop: 14 }}>Periode: {rentangTriwulan(tahun, kuartal)}</Text>
        <Text style={{ fontFamily: HURUF_RAPORT.judul, fontSize: 18, marginTop: 34 }}>{id.nama}</Text>
      </Halaman>

      {/* 2 · Pendahuluan */}
      <Halaman terbit={terbit} kaki={kaki} style={{ paddingHorizontal: 72, paddingTop: 50 }}>
        <Text style={s.sisi} fixed>KARIR ANAK INDONESIA</Text>
        <Text style={{ fontFamily: HURUF_RAPORT.judul, fontSize: 38, marginBottom: 16 }}>Pendahuluan</Text>
        {PENDAHULUAN[program].map((p, i) => (
          <Text key={i} style={{ fontFamily: HURUF_RAPORT.judul, fontSize: 16, lineHeight: 1.9, textAlign: 'justify', color: '#444444', marginBottom: 18 }}>{p}</Text>
        ))}
      </Halaman>

      {/* 3 · Profil & Kesan Belajar */}
      <Halaman terbit={terbit} kaki={kaki} style={{ paddingHorizontal: 70 }}>
        <Text style={{ fontFamily: HURUF_RAPORT.judul, fontSize: 36, textAlign: 'center' }}>{id.nama}</Text>
        {ttl ? <Text style={{ fontWeight: 700, fontSize: 13, textAlign: 'center' }}>{ttl}</Text> : null}
        <View style={{ flexDirection: 'row', marginTop: 34 }}>
          <View style={{ width: 175, marginRight: 40 }}>
            {foto
              ? <Image src={foto} style={{ width: 175, height: 232, objectFit: 'cover' }} />
              : <View style={{ width: 175, height: 232, backgroundColor: W.kepala, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: HURUF_RAPORT.judul, fontSize: 48, color: '#C8C8C8' }}>{(id.nama ?? '?').slice(0, 1)}</Text></View>}
            <View style={{ marginTop: 10 }}>
              {[['Program', id.program === 'SISWA_KBU' ? 'Kelompok Belajar Usaha' : 'Vokasi'], ['Kelas', id.kelas], ['Sekolah', id.sekolah], ['Unit belajar', id.unit], ['Fokus', id.fokusKompetensi], ['Mentor', mentor.join(', ')]]
                .filter(([, v]) => v).map(([k, v]) => (
                  <Text key={k} style={{ fontSize: 8.5, color: W.redup, marginBottom: 1.5 }}><Text style={{ fontWeight: 700 }}>{k}:</Text> {v}</Text>
                ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: HURUF_RAPORT.judul, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Kesan Belajar</Text>
            <Text style={{ fontSize: 13, lineHeight: 1.6, textAlign: 'justify' }}>{raport.kesanBelajar || '—'}</Text>
          </View>
        </View>
      </Halaman>

      {/* 4 · Renstra Belajar */}
      <Halaman terbit={terbit} kaki={kaki} style={{ paddingHorizontal: 40 }}>
        <TabelRenstra judul="Renstra Belajar" baris={raport.renstraBelajar} bulan={bulanTriwulan(kuartal)} />
      </Halaman>

      {/* 5 · Perkembangan Personal */}
      <Halaman terbit={terbit} kaki={kaki}>
        <Text style={s.judulKiri}>Perkembangan Personal</Text>
        <DaftarSkor item={personal} label={(x) => LABEL_PERSONAL[x.kunci]} />
      </Halaman>

      {/* 6 · Perkembangan Teknis */}
      <Halaman terbit={terbit} kaki={kaki}>
        <Text style={s.judulKiri}>Perkembangan Teknis{id.fokusKompetensi ? ` — ${id.fokusKompetensi}` : ''}</Text>
        {teknis.length ? <DaftarSkor item={teknis} label={(x) => x.nama} /> : <Text style={{ color: W.abu }}>Belum ada kompetensi teknis yang dinilai.</Text>}
      </Halaman>

      {/* 7 · Renstra Selanjutnya */}
      <Halaman terbit={terbit} kaki={kaki} style={{ paddingHorizontal: 40 }}>
        <TabelRenstra judul="Renstra Selanjutnya" baris={raport.renstraSelanjutnya} bulan={bulanTriwulanBerikut(kuartal)} />
      </Halaman>

      {/* 8 · Input dari Mentor */}
      <Halaman terbit={terbit} kaki={kaki}>
        <Text style={s.judulBesar}>Input dari Mentor</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
          <View style={{ width: '33%', paddingRight: 10 }}>
            <Text style={{ fontFamily: HURUF_RAPORT.judul, fontSize: 18, marginBottom: 8 }}>Untuk {panggilan || 'Siswa'}</Text>
            <Text style={{ fontSize: 11.5, lineHeight: 1.55, color: W.redup }}>{raport.untukSiswa || '—'}</Text>
          </View>
          <View style={{ width: '34%', alignItems: 'center', paddingTop: 40 }}><Puzzle /></View>
          <View style={{ width: '33%', paddingLeft: 10 }}>
            <Text style={{ fontFamily: HURUF_RAPORT.judul, fontSize: 18, marginBottom: 8 }}>Untuk Orang Tua/Wali</Text>
            <Text style={{ fontSize: 11.5, lineHeight: 1.55, color: W.redup }}>{raport.untukOrangTua || '—'}</Text>
          </View>
        </View>
        <View style={{ position: 'absolute', bottom: 46, left: 52, right: 52, flexDirection: 'row', justifyContent: 'space-between' }}>
          {[...(mentor.length ? mentor : [null]).slice(0, 3).map(nama => ['Mentor', nama]), ['Orang Tua / Wali', null]].map(([peran, nama], i) => (
            <View key={i} style={{ width: 170, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: W.redup }}>{peran}</Text>
              <View style={{ width: '100%', borderBottomWidth: 1, borderBottomColor: '#BBBBBB', marginTop: 40, marginBottom: 3 }} />
              <Text style={{ fontSize: 10, fontWeight: 700 }}>{nama || ' '}</Text>
            </View>
          ))}
        </View>
      </Halaman>

      {/* 9 · Lampiran Karya (hanya kalau ada foto) */}
      {lampiran.length > 0 && (
        <Halaman terbit={terbit} kaki={kaki}>
          <Text style={[s.judulKiri, { fontWeight: 400 }]}>Lampiran Karya</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {lampiran.map((l, i) => (
              <View key={i} style={{ width: `${100 / kolomFoto}%`, padding: 4, alignItems: 'center' }}>
                <Image src={l.dataUrl} style={{ width: '100%', height: lampiran.length <= kolomFoto ? 330 : 165, objectFit: 'contain' }} />
                {l.keterangan ? <Text style={{ fontSize: 8.5, color: W.redup, marginTop: 3 }}>{l.keterangan}</Text> : null}
              </View>
            ))}
          </View>
          <Text style={{ fontWeight: 700, fontSize: 12, textAlign: 'center', marginTop: 14, paddingHorizontal: 90 }}>{CATATAN_LAMPIRAN}</Text>
        </Halaman>
      )}
    </Document>
  )
}

/** Render ke Blob (dimuat malas). */
export async function buatRaportPdf(data) {
  const [{ pdf }, { daftarkanFontRaport }] = await Promise.all([import('@react-pdf/renderer'), import('./fontPdf')])
  daftarkanFontRaport()
  return pdf(<RaportPDF data={data} />).toBlob()
}
