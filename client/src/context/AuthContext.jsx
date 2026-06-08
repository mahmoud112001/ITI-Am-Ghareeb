import { createContext, useContext, useEffect, useState } from 'react'
import api, { setTokens, getAccessToken } from '../lib/axios'

const AuthContext = createContext(null)

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── On mount: restore session ───────────────────────────────────────────────
  useEffect(() => {
    async function restoreSession() {
      try {
        // Check for Google OAuth callback ?token= in URL
        const params = new URLSearchParams(window.location.search)
        const oauthToken = params.get('token')

        if (oauthToken) {
          // Store the access token (no refresh token from Google OAuth redirect)
          setTokens(oauthToken, null)

          try {
            // Fetch user profile with the new token
            const { data } = await api.get('/api/auth/me')
            setUser(data.user)
          } catch {
            // Token invalid or expired — stay logged out
          } finally {
            // Always clean the URL and unblock the UI
            const cleanUrl = window.location.pathname
            window.history.replaceState({}, '', cleanUrl)
            setIsLoading(false)
          }
          return
        }

        // No OAuth token — this is a regular page load.
        // We don't persist a refresh token in memory across page reloads
        // (no localStorage by design), so the user will need to log in again.
        // The refresh interceptor in axios.js handles mid-session token expiry.
        setIsLoading(false)
      } catch {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  // ── login — email + password ────────────────────────────────────────────────
  async function login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password })
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
    return data.user
  }

  // ── loginWithGoogle — redirect to server OAuth flow ─────────────────────────
  function loginWithGoogle() {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    window.location.href = `${apiUrl}/api/auth/google`
  }

  // ── register — create account and auto-login ────────────────────────────────
  async function register(name, email, password) {
    const { data } = await api.post('/api/auth/register', { name, email, password })
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
    return data.user
  }

  // ── logout — invalidate session on server, clear memory ─────────────────────
  async function logout() {
    try {
      // Fire and forget — we clear state regardless of server response
      await api.post('/api/auth/logout')
    } catch {
      // Intentionally ignored
    } finally {
      setTokens(null, null)
      setUser(null)
    }
  }

  // ── updateUser — merge partial update into user state ───────────────────────
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
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
