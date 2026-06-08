import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ProtectedRoute — guards a page behind authentication (and optionally admin role).
 *
 * Props:
 *   children      {ReactNode} — the page to render if authorized
 *   requireAdmin  {boolean}   — additionally require role === 'admin' (default false)
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isLoading } = useAuth()

  // Still resolving session (OAuth callback or initial load)
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ backgroundColor: '#FDF6EC' }}
        dir="rtl"
      >
        {/* Amber spinning circle */}
        <div
          className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mb-4"
          style={{ borderColor: '#F4A833', borderTopColor: 'transparent' }}
        />
        <p
          className="text-lg font-semibold"
          style={{ color: '#1B2A4A', fontFamily: 'Cairo, sans-serif' }}
        >
          جاري التحميل...
        </p>
      </div>
    )
  }

  // Not authenticated → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Authenticated but not admin → redirect to home
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
