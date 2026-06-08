import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/layout/Navbar'

// ── Lazy pages ────────────────────────────────────────────────────────────────
const HomePage      = lazy(() => import('./pages/HomePage'))
const SearchPage    = lazy(() => import('./pages/SearchPage'))
const MapPage       = lazy(() => import('./pages/MapPage'))
const AIChatPage    = lazy(() => import('./pages/AIChatPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AdminPage     = lazy(() => import('./pages/AdminPage'))
const LoginPage     = lazy(() => import('./pages/LoginPage'))
const RegisterPage  = lazy(() => import('./pages/RegisterPage'))

// ── React Query client ────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// ── Arabic loading fallback ───────────────────────────────────────────────────
function PageLoader() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: '#FDF6EC' }}
      dir="rtl"
    >
      <div
        className="w-10 h-10 rounded-full border-4 animate-spin mb-3"
        style={{ borderColor: '#F4A833', borderTopColor: 'transparent' }}
      />
      <p
        className="text-base font-medium"
        style={{ color: '#1B2A4A', fontFamily: 'Cairo, sans-serif' }}
      >
        جاري التحميل...
      </p>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <Navbar />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public */}
                <Route path="/"          element={<HomePage />} />
                <Route path="/search"    element={<SearchPage />} />
                <Route path="/map"       element={<MapPage />} />
                <Route path="/login"     element={<LoginPage />} />
                <Route path="/register"  element={<RegisterPage />} />

                {/* Protected — authenticated users */}
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <AIChatPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Protected — admin only */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all → home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
