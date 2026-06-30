import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import AmGhareebAvatar from '../components/AmGhareebAvatar'
import api from '../lib/axios'

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function ratingTarget(rating) {
  if (rating.type === 'travelPlan') return `رحلة من ${rating.routeIds?.length || 0} خط`
  return rating.route?.nameAr || rating.route?.localName || rating.route?.routeId || 'خط مواصلات'
}

export default function ProfilePage() {
  const { user, verifyEmail, resendVerificationOtp, changePassword } = useAuth()
  const [otp, setOtp] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [formMessage, setFormMessage] = useState('')

  const { data: ratings = [], isLoading: ratingsLoading } = useQuery({
    queryKey: ['my-ratings', user?._id],
    queryFn: () => api.get('/api/auth/me/ratings').then((res) => res.data.ratings),
    enabled: !!user?._id,
  })

  const verifyMutation = useMutation({
    mutationFn: () => verifyEmail(otp),
    onSuccess: (data) => {
      setFormMessage(data.message || 'تم تأكيد البريد بنجاح')
      setOtp('')
    },
    onError: (err) => setFormMessage(err?.response?.data?.message || 'تعذر تأكيد البريد'),
  })

  const resendMutation = useMutation({
    mutationFn: resendVerificationOtp,
    onSuccess: (data) => setFormMessage(data.message || 'تم إرسال كود جديد'),
    onError: (err) => setFormMessage(err?.response?.data?.message || 'تعذر إرسال الكود'),
  })

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: (data) => {
      setFormMessage(data.message || 'تم تغيير كلمة المرور')
      setCurrentPassword('')
      setNewPassword('')
    },
    onError: (err) => setFormMessage(err?.response?.data?.message || 'تعذر تغيير كلمة المرور'),
  })

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#FDF6EC', fontFamily: 'Cairo, sans-serif' }} dir="rtl">
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="flex items-center gap-4 mb-6">
          <AmGhareebAvatar size={64} />
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#1B2A4A' }}>الملف الشخصي</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>بياناتك وتقييماتك وإعدادات الحساب</p>
          </div>
        </div>

        {formMessage && (
          <div className="rounded-xl px-4 py-3 mb-5 text-sm font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            {formMessage}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <section className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#1B2A4A' }}>بيانات الحساب</h2>
            <div className="space-y-3 text-sm">
              <p><span className="font-bold" style={{ color: '#6B7280' }}>الاسم: </span>{user?.name}</p>
              <p><span className="font-bold" style={{ color: '#6B7280' }}>البريد الإلكتروني: </span>{user?.email}</p>
              <p>
                <span className="font-bold" style={{ color: '#6B7280' }}>حالة البريد: </span>
                <span style={{ color: user?.emailVerified ? '#065F46' : '#92400E' }}>
                  {user?.emailVerified ? 'مؤكد' : 'في انتظار التأكيد'}
                </span>
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex mt-5 rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
            >
              عمليات البحث الأخيرة والخطوط المحفوظة
            </Link>
          </section>

          <section className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#1B2A4A' }}>تأكيد البريد الإلكتروني</h2>
            {user?.emailVerified ? (
              <p className="text-sm font-semibold" style={{ color: '#065F46' }}>بريدك الإلكتروني مؤكد بالفعل.</p>
            ) : (
              <div className="space-y-3">
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: '#D1D5DB', direction: 'ltr', textAlign: 'center' }}
                  placeholder="123456"
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => verifyMutation.mutate()}
                    disabled={verifyMutation.isPending || otp.length !== 6}
                    className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
                    style={{ backgroundColor: '#1B2A4A', color: '#FFFFFF' }}
                  >
                    تأكيد
                  </button>
                  <button
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending}
                    className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
                    style={{ backgroundColor: '#E5E7EB', color: '#374151' }}
                  >
                    إرسال كود جديد
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl p-5 shadow-sm mb-5" style={{ backgroundColor: '#FFFFFF' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: '#1B2A4A' }}>تغيير كلمة المرور</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="rounded-lg border px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: '#D1D5DB' }}
              placeholder="كلمة المرور الحالية"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-lg border px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: '#D1D5DB' }}
              placeholder="كلمة المرور الجديدة"
            />
          </div>
          <button
            onClick={() => passwordMutation.mutate()}
            disabled={passwordMutation.isPending || !currentPassword || !newPassword}
            className="mt-3 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: '#1B2A4A', color: '#FFFFFF' }}
          >
            حفظ كلمة المرور
          </button>
        </section>

        <section className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: '#1B2A4A' }}>آخر تقييماتك ورسائلك</h2>
          {ratingsLoading ? (
            <p className="text-sm" style={{ color: '#6B7280' }}>جاري تحميل التقييمات...</p>
          ) : ratings.length === 0 ? (
            <p className="text-sm" style={{ color: '#6B7280' }}>لم تكتب أي تقييمات بعد.</p>
          ) : (
            <div className="space-y-3">
              {ratings.map((rating) => (
                <article key={rating._id} className="rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex justify-between gap-3 flex-wrap">
                    <p className="font-bold text-sm" style={{ color: '#1B2A4A' }}>{ratingTarget(rating)}</p>
                    <span className="text-xs font-bold" style={{ color: rating.isAccurate ? '#065F46' : '#991B1B' }}>
                      {rating.isAccurate ? 'دقيق' : 'غير دقيق'}
                    </span>
                  </div>
                  <p className="text-sm mt-2" style={{ color: '#374151' }}>
                    {rating.comment || 'لم تكتب رسالة مع هذا التقييم.'}
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>{formatDate(rating.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
