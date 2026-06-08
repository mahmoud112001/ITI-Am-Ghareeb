import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RatingModal from '../RatingModal'

// ── Mock axios module ─────────────────────────────────────────────────────────
jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(() => Promise.resolve({ data: { success: true, rating: {} } })),
  },
}))

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries:   { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderModal(props = {}) {
  const onClose   = props.onClose   || jest.fn()
  const onSuccess = props.onSuccess || jest.fn()
  return render(
    <QueryClientProvider client={makeClient()}>
      <RatingModal routeId="ALEX-MICRO-01" onClose={onClose} onSuccess={onSuccess} />
    </QueryClientProvider>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('RatingModal', () => {
  test('renders the modal with title', () => {
    renderModal()
    expect(screen.getByText('قيّم الخط ده')).toBeInTheDocument()
  })

  test('renders subtitle text', () => {
    renderModal()
    expect(screen.getByText('هل المعلومات دي صح ومحدّثة؟')).toBeInTheDocument()
  })

  test('submit button is disabled by default (no selection)', () => {
    renderModal()
    const btn = screen.getByText('أرسل التقييم')
    expect(btn).toBeDisabled()
  })

  test('submit button is enabled after selecting نعم', () => {
    renderModal()
    fireEvent.click(screen.getByText(/نعم/))
    const btn = screen.getByText('أرسل التقييم')
    expect(btn).not.toBeDisabled()
  })

  test('submit button is enabled after selecting لأ', () => {
    renderModal()
    fireEvent.click(screen.getByText(/لأ/))
    const btn = screen.getByText('أرسل التقييم')
    expect(btn).not.toBeDisabled()
  })

  test('comment textarea has maxLength of 280', () => {
    renderModal()
    const textarea = screen.getByPlaceholderText(/إضافة تعليق/)
    expect(textarea).toHaveAttribute('maxLength', '280')
  })

  test('char counter updates as user types', () => {
    renderModal()
    const textarea = screen.getByPlaceholderText(/إضافة تعليق/)
    fireEvent.change(textarea, { target: { value: 'التعريفة اتغيرت' } })
    expect(screen.getByText(/\d+ \/ 280/)).toBeInTheDocument()
    expect(screen.queryByText('0 / 280')).not.toBeInTheDocument()
  })

  test('shows initial char counter 0 / 280', () => {
    renderModal()
    expect(screen.getByText('0 / 280')).toBeInTheDocument()
  })

  test('calls onClose when X button is clicked', () => {
    const onClose = jest.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByLabelText('إغلاق'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('submitting calls the mutation (post to /api/ratings)', async () => {
    const api = require('../../lib/axios').default
    api.post.mockResolvedValueOnce({ data: { success: true, rating: {} } })

    renderModal()
    fireEvent.click(screen.getByText(/نعم/))
    fireEvent.click(screen.getByText('أرسل التقييم'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/ratings',
        expect.objectContaining({ routeId: 'ALEX-MICRO-01', isAccurate: true })
      )
    })
  })

  test('shows success message after successful submission', async () => {
    const api = require('../../lib/axios').default
    api.post.mockResolvedValueOnce({ data: { success: true, rating: {} } })

    renderModal()
    fireEvent.click(screen.getByText(/نعم/))
    fireEvent.click(screen.getByText('أرسل التقييم'))

    await waitFor(() => {
      expect(screen.getByText(/شكراً على تقييمك/)).toBeInTheDocument()
    })
  })
})
