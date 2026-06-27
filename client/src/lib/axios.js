import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ── In-memory token store (initialised from localStorage on page load) ────────
let accessTokenRef  = localStorage.getItem('accessToken')
let refreshTokenRef = localStorage.getItem('refreshToken')

/**
 * setTokens — update in-memory refs AND persist to localStorage.
 * Pass (null, null) on logout to clear everything.
 */
export function setTokens(access, refresh) {
  accessTokenRef  = access
  refreshTokenRef = refresh

  if (access) {
    localStorage.setItem('accessToken',  access)
    localStorage.setItem('refreshToken', refresh)
  } else {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }
}

/**
 * getAccessToken — used by useAIChat hook to attach Bearer token to fetch calls.
 */
export function getAccessToken() {
  return accessTokenRef
}

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use(
  (config) => {
    if (accessTokenRef) {
      config.headers.Authorization = `Bearer ${accessTokenRef}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor: handle 401 → refresh → retry ───────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config

    if (
      error.response?.status === 401 &&
      !originalConfig._retry &&
      refreshTokenRef
    ) {
      originalConfig._retry = true

      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken: refreshTokenRef,
        })

        const { accessToken, refreshToken } = data
        setTokens(accessToken, refreshToken)

        originalConfig.headers.Authorization = `Bearer ${accessToken}`
        return api(originalConfig)
      } catch (refreshError) {
        setTokens(null, null)
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api