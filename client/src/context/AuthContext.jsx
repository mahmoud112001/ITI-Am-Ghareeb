import { createContext, useContext, useEffect, useState } from 'react'
import api, { setTokens, getAccessToken } from '../lib/axios'

const AuthContext = createContext(null)

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── On mount: restore session ───────────────────────────────────────────────
  useEffect(() => {
    async function restoreSession() {
      try {
        // ── 1. Google OAuth callback (?token= in URL) ───────────────────────
        const params     = new URLSearchParams(window.location.search)
        const oauthToken = params.get('token')

        if (oauthToken) {
          setTokens(oauthToken, null)
          try {
            const { data } = await api.get('/api/auth/me')
            setUser(data.user)
          } catch {
            // Token invalid — stay logged out
          } finally {
            window.history.replaceState({}, '', window.location.pathname)
            setIsLoading(false)
          }
          return
        }

        // ── 2. Restore from localStorage (survives page refresh) ────────────
        const savedToken = localStorage.getItem('accessToken')
        if (savedToken) {
          try {
            // accessTokenRef is already set from localStorage in axios.js,
            // so this request goes out with the Bearer token attached.
            const { data } = await api.get('/api/auth/me')
            setUser(data.user)
          } catch {
            // Token expired or invalid — clear storage and stay logged out
            setTokens(null, null)
          } finally {
            setIsLoading(false)
          }
          return
        }

        setIsLoading(false)
      } catch {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  // ── login ─────────────────────────────────────────────────────────────────
  async function login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password })
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
    return data.user
  }

  // ── loginWithGoogle ───────────────────────────────────────────────────────
  function loginWithGoogle() {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    window.location.href = `${apiUrl}/api/auth/google`
  }

  // ── register ──────────────────────────────────────────────────────────────
  async function register(name, email, password) {
    const { data } = await api.post('/api/auth/register', { name, email, password })
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
    return data.user
  }

  // ── logout ────────────────────────────────────────────────────────────────
  async function logout() {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Intentionally ignored
    } finally {
      setTokens(null, null)
      setUser(null)
    }
  }

  // ── updateUser ────────────────────────────────────────────────────────────
  function updateUser(data) {
    setUser((prev) => ({ ...prev, ...data }))
  }

  const value = {
    user,
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── useAuth hook ──────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}