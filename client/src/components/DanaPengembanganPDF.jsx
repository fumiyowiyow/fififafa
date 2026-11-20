import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { ECOSYSTEM_NAME, ECOSYSTEM_NAME_FULL } from '../config/ecosystem'

const TIPE_LABEL = {
  TRADER_MANUAL: 'Manual',
  BOT_CRYPTO:    'Bot Crypto',
  SAHAM:         'Saham',
  LAINNYA:       'Lainnya',
}

function fmtUsd(n) {
  const v = Number(n) || 0
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtRpShort(n) {
  if (!n && n !== 0) return 'Rp -'
  const v = Number(n) || 0
  if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(2)}M`
  if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(0)}jt`
  if (v >= 1e3) return `Rp ${Math.round(v / 1e3)}rb`
  return `Rp ${Math.round(v)}`
}
function fmtTanggal(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// P/L standar: equity delta disesuaikan modal masuk/keluar (withdraw/deposit), supaya tidak
// ketuker sama untung/rugi trading beneran — sama formula dengan yang dipakai di halaman.
function equityUnit(u) {
  return u.laporanTerakhir?.equityUsd ?? u.modalAwalUsd
}
function plUnit(u) {
  return equityUnit(u) - u.modalAwalUsd + (u.totalWithdrawUsd ?? 0) - (u.totalDepositUsd ?? 0)
}

const C = {
  dark: '#111827', gray: '#6B7280', light: '#F3F4F6', white: '#FFFFFF',
  purple: '#8B5CF6', cyan: '#06B6D4', green: '#10B981', red: '#EF4444',
}

const st = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: C.white, padding: 40 },
  logo: { position: 'absolute', top: 24, right: 32, fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.purple },
})

// Proporsi lebar kolom per tabel — nama unit (mis. "XAUUSD") pendek, tapi nama pengelola bisa
// panjang ("Mella Fitriansyah"), jadi Pengelola dapat porsi lebih besar dari Nama.
const RINGKASAN_FLEX = [1.3, 0.9, 1.6, 1.1, 1.1, 0.9] // Nama, Tipe, Pengelola, Modal Awal, Equity, P/L
const RIWAYAT_FLEX = [1.3, 1, 1.1, 1.7] // Periode, Equity, P/L Mingguan, Proses
const TRANSAKSI_FLEX = [1, 0.8, 1, 1.7] // Tanggal, Tipe, Jumlah, Keterangan

function SummaryPage({ pool, units, generatedAt }) {
  const totalEquityUsd = units.reduce((a, u) => a + equityUnit(u), 0)
  const totalPlUsd = units.reduce((a, u) => a + plUnit(u), 0)
  const kurs = pool?.kurs ?? 17000

  return (
    <Page size="A4" style={st.page}>
      <Text style={st.logo}>{ECOSYSTEM_NAME} ECOSYSTEM</Text>
      <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.dark, marginTop: 8 }}>Laporan Dana Pengembangan</Text>
      <Text style={{ fontSize: 11, color: C.gray, marginTop: 4, marginBottom: 18 }}>Dibuat {generatedAt}</Text>
      <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 18 }} />

      {/* Stat cards */}
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        {[
          { label: 'DANA AWAL', val: fmtUsd(pool?.totalPoolUsd), bg: C.purple },
          { label: 'SUDAH DIALOKASIKAN', val: fmtUsd(pool?.totalAlokasiUsd), bg: C.cyan },
          { label: 'BELUM DIALOKASIKAN', val: fmtUsd(pool?.sisaBelumDialokasikanUsd), bg: C.green },
        ].map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c.bg, borderRadius: 8, padding: 12, marginRight: i < 2 ? 10 : 0 }}>
            <Text style={{ fontSize: 8, color: '#FFFFFFCC', letterSpacing: 0.3, marginBottom: 4 }}>{c.label}</Text>
            <Text style={{ fontSize: 17, fontFamily: 'Helvetica-Bold', color: C.white }}>{c.val}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        {[
          { label: 'TOTAL EQUITY SAAT INI', val: fmtUsd(totalEquityUsd), bg: C.dark },
          { label: 'TOTAL P/L', val: `${totalPlUsd >= 0 ? '+' : '-'}${fmtUsd(Math.abs(totalPlUsd))}`, bg: totalPlUsd >= 0 ? C.green : C.red },
        ].map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c.bg, borderRadius: 8, padding: 12, marginRight: i < 1 ? 10 : 0 }}>
            <Text style={{ fontSize: 8, color: '#FFFFFFCC', letterSpacing: 0.3, marginBottom: 4 }}>{c.label}</Text>
            <Text style={{ fontSize: 17, fontFamily: 'Helvetica-Bold', color: C.white }}>{c.val}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 9, color: C.gray, marginBottom: 20 }}>
        Kurs live saat laporan dibuat: 1 USD = {fmtRpShort(kurs)}
      </Text>

      {/* Ringkasan Unit table */}
      <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 10 }}>Ringkasan Unit</Text>
      <View style={{ backgroundColor: C.light, borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', backgroundColor: C.dark, padding: '8px 10px' }}>
          {['Nama', 'Tipe', 'Pengelola', 'Modal Awal', 'Equity', 'P/L'].map((h, i) => (
            <Text key={i} style={{ flex: RINGKASAN_FLEX[i], marginRight: i < 5 ? 8 : 0, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.white }}>{h}</Text>
          ))}
        </View>
        {units.map((u, i) => {
          const equity = equityUnit(u)
          const pl = plUnit(u)
          return (
            <View key={u.id} style={{ flexDirection: 'row', padding: '8px 10px', backgroundColor: i % 2 === 0 ? C.white : C.light, borderBottom: '1px solid #E5E7EB' }}>
              <Text style={{ flex: RINGKASAN_FLEX[0], marginRight: 8, fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.dark }}>{u.nama}{!u.statusAktif ? ' (Nonaktif)' : ''}</Text>
              <Text style={{ flex: RINGKASAN_FLEX[1], marginRight: 8, fontSize: 9.5, color: C.gray }}>{TIPE_LABEL[u.tipe] ?? u.tipe}</Text>
              <Text style={{ flex: RINGKASAN_FLEX[2], marginRight: 8, fontSize: 9.5, color: C.gray }}>{u.pengelola?.nama ?? '—'}</Text>
              <Text style={{ flex: RINGKASAN_FLEX[3], marginRight: 8, fontSize: 9.5, color: C.gray }}>{fmtUsd(u.modalAwalUsd)}</Text>
              <Text style={{ flex: RINGKASAN_FLEX[4], marginRight: 8, fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.dark }}>{fmtUsd(equity)}</Text>
              <Text style={{ flex: RINGKASAN_FLEX[5], fontSize: 9.5, color: pl >= 0 ? C.green : C.red }}>{pl >= 0 ? '+' : '-'}{fmtUsd(Math.abs(pl))}</Text>
            </View>
          )
        })}
      </View>
    </Page>
  )
}

function UnitDetailPage({ unit, laporan, transaksi }) {
  const rows = [...laporan].sort((a, b) => new Date(b.periodeAwal) - new Date(a.periodeAwal))
  return (
    <Page size="A4" style={st.page}>
      <Text style={st.logo}>{ECOSYSTEM_NAME} ECOSYSTEM</Text>
      <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.dark, marginTop: 8 }}>{unit.nama}</Text>
      <Text style={{ fontSize: 10.5, color: C.gray, marginTop: 2, marginBottom: 16 }}>
        {TIPE_LABEL[unit.tipe] ?? unit.tipe} · Pengelola: {unit.pengelola?.nama ?? '—'} · Modal Awal: {fmtUsd(unit.modalAwalUsd)}
      </Text>
      <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 16 }} />

      <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 8 }}>Riwayat Mingguan</Text>
      <View style={{ backgroundColor: C.light, borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', backgroundColor: C.dark, padding: '8px 10px' }}>
          {['Periode', 'Equity', 'P/L Mingguan', 'Proses'].map((h, i) => (
            <Text key={i} style={{ flex: RIWAYAT_FLEX[i], marginRight: i < 3 ? 8 : 0, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.white }}>{h}</Text>
          ))}
        </View>
        {rows.map((l, i) => {
          const prevEquity = rows[i + 1]?.equityUsd ?? unit.modalAwalUsd
          const periodStart = rows[i + 1] ? new Date(rows[i + 1].periodeAkhir).getTime() : -Infinity
          const periodEnd = new Date(l.periodeAkhir).getTime()
          const txPeriode = (transaksi ?? []).filter((t) => {
            const d = new Date(t.tanggal).getTime()
            return d > periodStart && d <= periodEnd
          })
          const withdrawPeriode = txPeriode.filter((t) => t.tipe === 'WITHDRAW').reduce((a, t) => a + t.jumlahUsd, 0)
          const depositPeriode = txPeriode.filter((t) => t.tipe === 'DEPOSIT').reduce((a, t) => a + t.jumlahUsd, 0)
          const pl = (l.equityUsd - prevEquity) + withdrawPeriode - depositPeriode
          return (
            <View key={l.id} style={{ flexDirection: 'row', padding: '8px 10px', backgroundColor: i % 2 === 0 ? C.white : C.light, borderBottom: '1px solid #E5E7EB' }}>
              <Text style={{ flex: RIWAYAT_FLEX[0], marginRight: 8, fontSize: 9.5, color: C.gray }}>{fmtTanggal(l.periodeAwal)} - {fmtTanggal(l.periodeAkhir)}</Text>
              <Text style={{ flex: RIWAYAT_FLEX[1], marginRight: 8, fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.dark }}>{fmtUsd(l.equityUsd)}</Text>
              <Text style={{ flex: RIWAYAT_FLEX[2], marginRight: 8, fontSize: 9.5, color: pl >= 0 ? C.green : C.red }}>{pl >= 0 ? '+' : '-'}{fmtUsd(Math.abs(pl))}</Text>
              <Text style={{ flex: RIWAYAT_FLEX[3], fontSize: 9.5, color: C.gray }}>{l.prosesnya}</Text>
            </View>
          )
        })}
        {rows.length === 0 && (
          <View style={{ padding: 14 }}><Text style={{ fontSize: 10.5, color: C.gray, textAlign: 'center' }}>Belum ada laporan mingguan</Text></View>
        )}
      </View>

      {(transaksi ?? []).length > 0 && (
        <>
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.dark, marginTop: 20, marginBottom: 8 }}>Riwayat Deposit &amp; Withdraw</Text>
          <View style={{ backgroundColor: C.light, borderRadius: 8, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.dark, padding: '8px 10px' }}>
              {['Tanggal', 'Tipe', 'Jumlah', 'Keterangan'].map((h, i) => (
                <Text key={i} style={{ flex: TRANSAKSI_FLEX[i], marginRight: i < 3 ? 8 : 0, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.white }}>{h}</Text>
              ))}
            </View>
            {[...transaksi].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).map((t, i) => (
              <View key={t.id} style={{ flexDirection: 'row', padding: '8px 10px', backgroundColor: i % 2 === 0 ? C.white : C.light, borderBottom: '1px solid #E5E7EB' }}>
                <Text style={{ flex: TRANSAKSI_FLEX[0], marginRight: 8, fontSize: 9.5, color: C.gray }}>{fmtTanggal(t.tanggal)}</Text>
                <Text style={{ flex: TRANSAKSI_FLEX[1], marginRight: 8, fontSize: 9.5, color: t.tipe === 'DEPOSIT' ? C.green : C.red }}>{t.tipe === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}</Text>
                <Text style={{ flex: TRANSAKSI_FLEX[2], marginRight: 8, fontSize: 9.5, color: C.dark }}>{fmtUsd(t.jumlahUsd)}</Text>
                <Text style={{ flex: TRANSAKSI_FLEX[3], fontSize: 9.5, color: C.gray }}>{t.keterangan || '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Page>
  )
}

export default function DanaPengembanganPDF({ pool, units, laporanByUnit, transaksiByUnit, generatedAt }) {
  return (
    <Document title={`${ECOSYSTEM_NAME} Dana Pengembangan - ${generatedAt}`} author={ECOSYSTEM_NAME_FULL}>
      <SummaryPage pool={pool} units={units} generatedAt={generatedAt} />
      {units.map((u) => (
        <UnitDetailPage key={u.id} unit={u} laporan={laporanByUnit[u.id] ?? []} transaksi={transaksiByUnit?.[u.id] ?? []} />
      ))}
    </Document>
  )
}
