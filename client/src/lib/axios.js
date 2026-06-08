import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ── In-memory token store ─────────────────────────────────────────────────────
let accessTokenRef = null
let refreshTokenRef = null

/**
 * setTokens — update in-memory token refs.
 * Call after login, register, refresh, and on logout (pass nulls).
 */
export function setTokens(access, refresh) {
  accessTokenRef = access
  refreshTokenRef = refresh
}

/**
 * getAccessToken — used by useAIChat hook to attach Bearer token to fetch calls.
 */
export function getAccessToken() {
  return accessTokenRef
}

// ── Axios instance ────────────────────────────────────────────────────────────
// baseURL is '' so that Vite proxy intercepts /api/* in dev.
// A full URL like http://localhost:5000 would bypass the proxy → CORS error.
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

    // Only attempt refresh if:
    // 1. It's a 401 response
    // 2. We haven't already retried this request
    // 3. We have a refresh token available
    if (
      error.response?.status === 401 &&
      !originalConfig._retry &&
      refreshTokenRef
    ) {
      originalConfig._retry = true

      try {
        // Attempt token refresh — must use full BASE_URL (bypasses proxy intentionally)
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken: refreshTokenRef,
        })

        const { accessToken, refreshToken } = data
        setTokens(accessToken, refreshToken)

        // Retry original request with new access token
        originalConfig.headers.Authorization = `Bearer ${accessToken}`
        return api(originalConfig)
      } catch (refreshError) {
        // Refresh failed — clear tokens and redirect to login
        setTokens(null, null)
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
