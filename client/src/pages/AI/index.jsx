import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatUSD } from '../../utils/format'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'

const STATUS_CONFIG = {
  SANGAT_BAIK:      { color: 'var(--green)', icon: '🚀', label: 'Sangat Baik' },
  BAIK:             { color: 'var(--cyan)', icon: '✅', label: 'Baik' },
  CUKUP:            { color: 'var(--amber)', icon: '🟡', label: 'Cukup' },
  PERLU_PERHATIAN:  { color: '#f97316', icon: '⚠️', label: 'Perlu Perhatian' },
  KRITIS:           { color: 'var(--red)', icon: '🔴', label: 'Kritis' },
}

const HIGHLIGHT_COLOR = {
  positif: { bg: 'var(--green-subtle)',  color: 'var(--green)', icon: '✅' },
  negatif: { bg: 'var(--red-subtle)',    color: 'var(--red)', icon: '⚠️' },
  info:    { bg: 'var(--cyan-subtle)',   color: 'var(--cyan)', icon: 'ℹ️' },
}

const PRIORITAS_COLOR = {
  tinggi: { bg: 'var(--red-subtle)',    color: 'var(--red)'  },
  sedang: { bg: 'var(--amber-subtle)', color: 'var(--amber)'  },
  rendah: { bg: 'var(--green-subtle)', color: 'var(--green)'  },
}

// ── Markdown renderer ringan (tanpa library) ─────────────
function renderMd(text) {
  if (!text) return null

  const parseInline = (str) => {
    const parts = []
    const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
    let last = 0, m, k = 0
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index))
      if (m[1] !== undefined) parts.push(<strong key={k++}>{m[1]}</strong>)
      else                    parts.push(<em key={k++}>{m[2]}</em>)
      last = re.lastIndex
    }
    if (last < str.length) parts.push(str.slice(last))
    return parts.length ? parts : str
  }

  const lines   = text.split('\n')
  const out     = []
  let   buf     = []
  let   listType = null

  const flush = () => {
    if (!buf.length) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    out.push(
      <Tag key={`l${out.length}`} style={{ paddingLeft: 18, margin: '6px 0', lineHeight: 1.6 }}>
        {buf.map((item, i) => <li key={i} style={{ marginBottom: 3 }}>{parseInline(item)}</li>)}
      </Tag>
    )
    buf = []; listType = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^#{1,3} /.test(line)) {
      flush()
      const lvl  = line.match(/^(#+)/)[1].length
      const txt  = line.replace(/^#+\s/, '')
      const sz   = [16, 14, 13][lvl - 1] ?? 13
      out.push(
        <div key={i} style={{ fontWeight: 800, fontSize: sz, marginTop: lvl === 1 ? 14 : 10, marginBottom: 4, color: 'var(--accent-light)' }}>
          {parseInline(txt)}
        </div>
      )
    } else if (/^\d+\. /.test(line)) {
      if (listType !== 'ol') { flush(); listType = 'ol' }
      buf.push(line.replace(/^\d+\. /, ''))
    } else if (/^[*-] (?!\*)/.test(line)) {
      if (listType !== 'ul') { flush(); listType = 'ul' }
      buf.push(line.replace(/^[*-] /, ''))
    } else if (line.trim() === '') {
      flush()
      if (out.length && out[out.length - 1]?.type !== 'br') out.push(<br key={`br${i}`} />)
    } else {
      flush()
      out.push(<div key={i} style={{ marginBottom: 2 }}>{parseInline(line)}</div>)
    }
  }
  flush()
  return out
}

function SetupPrompt() {
  return (
    <div style={{ maxWidth: 540, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🤖</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
        AI Intelligence
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
        Fitur ini menggunakan Google Gemini untuk menganalisis data ekosistem {ECOSYSTEM_NAME} secara otomatis dan memberikan insight + rekomendasi.
      </p>
      <div className="card" style={{ textAlign: 'left', padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Setup API Key:</div>
        {[
          'Buka aistudio.google.com (gratis)',
          'Klik "Get API key" → Create API key',
          'Tambahkan ke .env server:',
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i+1}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s}</span>
          </div>
        ))}
        <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-light)', marginTop: 4 }}>
          GEMINI_API_KEY=AIza...
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Gemini 1.5 Flash — gratis hingga 1.500 request/hari
      </div>
    </div>
  )
}

export default function AI() {
  const [insights, setInsights]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [noKey, setNoKey]         = useState(false)
  const [chat, setChat]           = useState([])
  const [question, setQuestion]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const fetchInsights = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/api/ai/insights')
      setInsights(r.data.data)
    } catch (err) {
      if (err.response?.data?.code === 'NO_API_KEY') {
        setNoKey(true)
      } else {
        setError(err.response?.data?.message || 'Gagal mengambil insight')
      }
    }
    setLoading(false)
  }

  const sendChat = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    const q = question.trim()
    setQuestion('')
    setChat(prev => [...prev, { role: 'user', text: q }])
    setChatLoading(true)
    try {
      const r = await api.post('/api/ai/chat', { pertanyaan: q })
      setChat(prev => [...prev, { role: 'ai', text: r.data.data.jawaban }])
    } catch (err) {
      if (err.response?.data?.code === 'NO_API_KEY') setNoKey(true)
      else setChat(prev => [...prev, { role: 'ai', text: '❌ Gagal: ' + (err.response?.data?.message || 'Error') }])
    }
    setChatLoading(false)
  }

  if (noKey) return <SetupPrompt />

  const cfg = insights ? STATUS_CONFIG[insights.status] ?? STATUS_CONFIG.CUKUP : null

  return (
    <>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>🤖 AI Intelligence</h1>
            <p>Analisis otomatis ekosistem {ECOSYSTEM_NAME} oleh Gemini AI</p>
          </div>
          <button className="btn btn-primary" onClick={fetchInsights} disabled={loading} style={{ minWidth: 160 }}>
            {loading
              ? <><span className="spinner"/>Menganalisis...</>
              : insights ? '🔄 Refresh Insight' : '✨ Generate Insight'
            }
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Insight Result */}
      {insights && (
        <>
          {/* Score Card */}
          <div className="card" style={{ marginBottom: 20, background: `linear-gradient(135deg, ${cfg.color}12, transparent)`, borderTop: `3px solid ${cfg.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="color-mix(in srgb, var(--text) 7%, transparent)" strokeWidth="8"/>
                    <circle cx="40" cy="40" r="32" fill="none" stroke={cfg.color} strokeWidth="8"
                      strokeDasharray={`${2*Math.PI*32*(insights.skorKesehatan/100)} ${2*Math.PI*32*(1-insights.skorKesehatan/100)}`}
                      strokeLinecap="round"/>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>{insights.skorKesehatan}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color }}>{cfg.icon} {cfg.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Dianalisis: {new Date(insights.generatedAt).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 24, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {[
                  { label: 'Omset Minggu Ini', val: formatUSD(insights.ekosistem.totalOmsetMinggu) },
                  { label: 'Omset Bulan Ini',  val: formatUSD(insights.ekosistem.totalOmsetBulan)  },
                  { label: 'Studio Lapor',     val: `${insights.ekosistem.sudahLapor}/${insights.ekosistem.totalStudio}` },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              {insights.ringkasan}
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 20 }}>
            {/* Highlights */}
            <div className="card">
              <div className="card-header"><span className="card-title">📊 Highlights</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {insights.highlights?.map((h, i) => {
                  const hcfg = HIGHLIGHT_COLOR[h.tipe] ?? HIGHLIGHT_COLOR.info
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: hcfg.bg, borderRadius: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{hcfg.icon}</span>
                      <span style={{ fontSize: 13, color: hcfg.color, lineHeight: 1.5 }}>{h.pesan}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rekomendasi */}
            <div className="card">
              <div className="card-header"><span className="card-title">🎯 Rekomendasi</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.rekomendasi?.map((r, i) => {
                  const pcfg = PRIORITAS_COLOR[r.prioritas] ?? PRIORITAS_COLOR.sedang
                  return (
                    <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 8, borderLeft: `3px solid ${pcfg.color}` }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: pcfg.bg, color: pcfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {r.prioritas}
                        </span>
                        {r.target !== 'ALL' && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {r.target}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{r.aksi}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Prediksi */}
          {insights.prediksi && (
            <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent), color-mix(in srgb, var(--cyan) 5%, transparent))' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>🔮</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Prediksi AI</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{insights.prediksi}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Chat Interface */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">💬 Tanya AI tentang Ekosistem</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Powered by Gemini</span>
        </div>

        {/* Chat History */}
        {chat.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
            {chat.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 16px', borderRadius: 12,
                  fontSize: 13, lineHeight: 1.6,
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-surface)',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius:  m.role === 'ai'   ? 4 : 12,
                }}>
                  {m.role === 'ai' ? renderMd(m.text) : m.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 16px', borderRadius: 12, background: 'var(--bg-surface)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: `bounce 1s ${i*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {chat.length === 0 && !loading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Contoh pertanyaan:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                'Studio mana yang paling butuh perhatian?',
                'Bagaimana tren omset bulan ini?',
                'Apa strategi terbaik untuk meningkatkan laporan mingguan?',
                'Circle mana yang paling produktif?',
              ].map(q => (
                <button key={q} onClick={() => setQuestion(q)}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent-light)' }}
                  onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-secondary)' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={sendChat} style={{ display: 'flex', gap: 10 }}>
          <input
            className="form-input"
            style={{ flex: 1, paddingLeft: 14 }}
            placeholder={`Tanya apa saja tentang ekosistem ${ECOSYSTEM_NAME}...`}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={chatLoading}
          />
          <button type="submit" className="btn btn-primary" disabled={chatLoading || !question.trim()} style={{ minWidth: 80 }}>
            {chatLoading ? <span className="spinner"/> : 'Kirim'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  )
}
