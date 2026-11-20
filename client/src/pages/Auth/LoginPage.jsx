import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ECOSYSTEM_NAME, ECOSYSTEM_NAME_FULL } from '../../config/ecosystem'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.response?.data?.message || 'Email atau password salah')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-mark" style={{ width: 48, height: 48, fontSize: 22, borderRadius: 14 }}>{ECOSYSTEM_NAME[0]}</div>
          <div>
            <div className="logo-name" style={{ fontSize: 20 }}>{ECOSYSTEM_NAME}</div>
            <div className="logo-sub">Ecosystem Dashboard</div>
          </div>
        </div>

        <div className="login-header">
          <h1>Selamat datang kembali</h1>
          <p>Masuk dengan akun ekosistem {ECOSYSTEM_NAME} kamu</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-wrap">
              <span className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <input
                type="email"
                className="form-input"
                placeholder="nama@domain-anda.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrap">
              <span className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
              >
                {showPass
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading
              ? <><span className="spinner"/> Masuk...</>
              : 'Masuk ke Dashboard'
            }
          </button>
        </form>

        <div className="login-footer">
          {ECOSYSTEM_NAME_FULL} · Internal System
        </div>
      </div>

      {/* Background decoration */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
    </div>
  )
}
