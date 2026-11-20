import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api, { setAccessToken, clearAccessToken } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Saat app load: coba silent refresh via httpOnly cookie
  // Tidak bergantung pada localStorage — token hanya di memory
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    api.post('/api/auth/refresh', {}, { signal: controller.signal })
      .then(res => {
        setAccessToken(res.data.data.accessToken)
        return api.get('/api/auth/me', { signal: controller.signal })
      })
      .then(res => setUser(res.data.data))
      .catch(() => {
        clearAccessToken()
        setUser(null)
      })
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })

    return () => { clearTimeout(timeout); controller.abort() }
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    const { accessToken, user: userData } = res.data.data
    setAccessToken(accessToken)
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout') } catch {}
    clearAccessToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
