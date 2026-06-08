import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/axios'

const MAX_COMMENT = 280

export default function RatingModal({ routeId, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const [selected, setSelected]     = useState(null) // true | false | null
  const [comment, setComment]       = useState('')
  const [successMsg, setSuccessMsg] = useState(false)
  const [apiError, setApiError]     = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/api/ratings', {
        routeId,
        isAccurate: selected,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings', routeId] })
      setSuccessMsg(true)
      setTimeout(() => {
        onSuccess?.()
      }, 2000)
    },
    onError: (err) => {
      setApiError(err?.response?.data?.message || 'حدث خطأ، حاول مرة أخرى')
    },
  })

  function handleSubmit() {
    if (selected === null) return
    setApiError('')
    mutation.mutate()
  }

  // Close on overlay click
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 relative"
        style={{ backgroundColor: '#FFFFFF', fontFamily: 'Cairo, sans-serif' }}
        dir="rtl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="إغلاق"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Title */}
        <h2 className="text-lg font-bold mb-1" style={{ color: '#1B2A4A' }}>
          قيّم الخط ده
        </h2>
        <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
          هل المعلومات دي صح ومحدّثة؟
        </p>

        {/* Success state */}
        {successMsg ? (
          <div
            className="rounded-xl py-4 text-center font-bold text-base"
            style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
          >
            شكراً على تقييمك! ✓
          </div>
        ) : (
          <>
            {/* YES / NO toggle */}
            <div className="flex gap-3 mb-5">
              <button
                onClick={() => setSelected(true)}
                className="flex-1 rounded-xl py-3 text-sm font-bold border-2 transition-all"
                style={{
                  borderColor:     selected === true ? '#16A34A' : '#E5E7EB',
                  backgroundColor: selected === true ? '#D1FAE5' : '#FFFFFF',
                  color:           selected === true ? '#15803D' : '#6B7280',
                }}
              >
                نعم ✓
              </button>
              <button
                onClick={() => setSelected(false)}
                className="flex-1 rounded-xl py-3 text-sm font-bold border-2 transition-all"
                style={{
                  borderColor:     selected === false ? '#DC2626' : '#E5E7EB',
                  backgroundColor: selected === false ? '#FEE2E2' : '#FFFFFF',
                  color:           selected === false ? '#B91C1C' : '#6B7280',
                }}
              >
                لأ ✗
              </button>
            </div>

            {/* Comment textarea */}
            <div className="mb-5">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
                rows={4}
                maxLength={MAX_COMMENT}
                placeholder="إضافة تعليق — مثلاً: التعريفة اتغيرت أو فيه محطة جديدة (اختياري)"
                className="w-full rounded-xl border-2 px-3 py-2.5 text-sm resize-none outline-none transition-all"
                style={{
                  fontFamily:  'Cairo, sans-serif',
                  borderColor: '#E5E7EB',
                  lineHeight:  '1.6',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#F4A833')}
                onBlur={(e)  => (e.target.style.borderColor = '#E5E7EB')}
              />
              <div className="flex justify-end mt-1">
                <span
                  className="text-xs"
                  style={{ color: comment.length >= MAX_COMMENT * 0.9 ? '#DC2626' : '#9CA3AF' }}
                >
                  {comment.length} / {MAX_COMMENT}
                </span>
              </div>
            </div>

            {/* API error */}
            {apiError && (
              <p className="text-sm text-center mb-3" style={{ color: '#DC2626' }}>
                {apiError}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={selected === null || mutation.isPending}
              className="w-full rounded-xl py-3 text-base font-bold transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#F4A833',
                color:           '#1B2A4A',
                opacity:         selected === null || mutation.isPending ? 0.5 : 1,
                cursor:          selected === null ? 'not-allowed' : 'pointer',
              }}
            >
              {mutation.isPending ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: '#1B2A4A', borderTopColor: 'transparent' }}
                  />
                  جاري الإرسال...
                </>
              ) : (
                'أرسل التقييم'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
