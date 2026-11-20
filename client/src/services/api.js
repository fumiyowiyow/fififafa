import axios from 'axios'

// Token disimpan di memory — tidak di localStorage agar aman dari XSS
let _accessToken = null

export function setAccessToken(token) { _accessToken = token }
export function clearAccessToken()    { _accessToken = null  }
export function getAccessToken()      { return _accessToken  }

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`
  return config
})

// Satu promise refresh untuk semua request yang gagal bersamaan
let _refreshPromise = null

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry && !original.url?.includes('/api/auth/')) {
      original._retry = true
      try {
        if (!_refreshPromise) {
          _refreshPromise = axios.post(
            `${import.meta.env.VITE_API_URL || ''}/api/auth/refresh`,
            {},
            { withCredentials: true }
          ).finally(() => { _refreshPromise = null })
        }
        const { data } = await _refreshPromise
        setAccessToken(data.data.accessToken)
        original.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(original)
      } catch {
        clearAccessToken()
        window.location.href = '/'
      }
    }
    return Promise.reject(err)
  }
)

export default api
