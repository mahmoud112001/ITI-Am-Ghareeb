import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import AmGhareebAvatar from '../components/AmGhareebAvatar'

function EyeIcon({ open }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ── Validation helpers ────────────────────────────────────────────────────────
function validateName(v) {
  if (!v) return ''
  if (v.trim().length < 2) return 'الاسم يجب أن يكون حرفين على الأقل'
  return ''
}
function validateEmail(v) {
  if (!v) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'بريد إلكتروني غير صحيح'
  return ''
}
function validatePassword(v) {
  if (!v) return ''
  if (!/(?=.*[A-Z])(?=.*\d)/.test(v)) return 'كلمة المرور يجب أن تحتوي على حرف كبير ورقم'
  return ''
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched]   = useState({ name: false, email: false, password: false })
  const [apiError, setApiError] = useState('')

  const nameErr     = validateName(name)
  const emailErr    = validateEmail(email)
  const passwordErr = validatePassword(password)

  const hasErrors = !name || !email || !password || !!nameErr || !!emailErr || !!passwordErr

  const mutation = useMutation({
    mutationFn: () => register(name.trim(), email.trim(), password),
    onSuccess:  () => navigate('/dashboard'),
    onError:    (err) => {
      setApiError(err?.response?.data?.message || 'حدث خطأ، حاول مرة أخرى')
    },
  })

  function handleSubmit() {
    setTouched({ name: true, email: true, password: true })
    setApiError('')
    if (hasErrors) return
    mutation.mutate()
  }

  function blur(field) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  return (
    <div
      className="min-h-screen flex items-start justify-center pt-10 pb-16 px-4"
      style={{ backgroundColor: '#FDF6EC' }}
      dir="rtl"
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl p-8"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        {/* Avatar */}
        <div className="flex justify-center mb-4">
          <AmGhareebAvatar size={80} />
        </div>

        <h1
          className="text-center text-2xl font-bold mb-1"
          style={{ color: '#1B2A4A', fontFamily: 'Cairo, sans-serif' }}
        >
          انضم لعم غريب
        </h1>
        <h2
          className="text-center text-sm font-medium mb-7"
          style={{ color: '#F4A833', fontFamily: 'Cairo, sans-serif' }}
        >
          سجّل وابدأ تسأل عن مواصلات الإسكندرية
        </h2>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>
            الاسم الكامل
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all"
            style={{
              borderColor: touched.name && nameErr ? '#DC2626' : '#D1D5DB',
              fontFamily:  'Cairo, sans-serif',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#F4A833')}
            onBlur={(e) => {
              blur('name')
              e.target.style.borderColor = touched.name && nameErr ? '#DC2626' : '#D1D5DB'
            }}
            placeholder="أحمد علي"
            autoComplete="name"
          />
          {touched.name && nameErr && (
            <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{nameErr}</p>
          )}
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>
            البريد الإلكتروني
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all"
            style={{
              borderColor: touched.email && emailErr ? '#DC2626' : '#D1D5DB',
              fontFamily:  'Cairo, sans-serif',
              direction:   'ltr',
              textAlign:   'right',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#F4A833')}
            onBlur={(e) => {
              blur('email')
              e.target.style.borderColor = touched.email && emailErr ? '#DC2626' : '#D1D5DB'
            }}
            placeholder="example@mail.com"
            autoComplete="email"
          />
          {touched.email && emailErr && (
            <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{emailErr}</p>
          )}
        </div>

        {/* Password */}
        <div className="mb-5">
          <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>
            كلمة المرور
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all pl-10"
              style={{
                borderColor: touched.password && passwordErr ? '#DC2626' : '#D1D5DB',
                fontFamily:  'Cairo, sans-serif',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#F4A833')}
              onBlur={(e) => {
                blur('password')
                e.target.style.borderColor = touched.password && passwordErr ? '#DC2626' : '#D1D5DB'
              }}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {touched.password && passwordErr && (
            <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{passwordErr}</p>
          )}
        </div>

        {/* API error */}
        {apiError && (
          <p className="text-sm font-medium mb-4 text-center" style={{ color: '#DC2626' }}>
            {apiError}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending || hasErrors}
          className="w-full rounded-lg py-3 text-base font-bold text-white transition-opacity flex items-center justify-center gap-2"
          style={{
            backgroundColor: '#1B2A4A',
            opacity:         mutation.isPending || hasErrors ? 0.6 : 1,
            fontFamily:      'Cairo, sans-serif',
            cursor:          hasErrors ? 'not-allowed' : 'pointer',
          }}
        >
          {mutation.isPending ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              جاري إنشاء الحساب...
            </>
          ) : (
            'إنشاء الحساب'
          )}
        </button>

        {/* Login link */}
        <p
          className="text-center text-sm mt-6"
          style={{ color: '#6B7280', fontFamily: 'Cairo, sans-serif' }}
        >
          عندك حساب؟{' '}
          <Link to="/login" className="font-bold hover:underline" style={{ color: '#F4A833' }}>
            سجّل الدخول
          </Link>
        </p>
      </div>
    </div>
  )
}
