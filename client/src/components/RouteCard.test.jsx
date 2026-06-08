import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RouteCard from '../RouteCard'

// ── Mock data ─────────────────────────────────────────────────────────────────
const mockRoute = {
  _id:     'route-abc-123',
  routeId: 'ALEX-MICRO-01',
  type:    'microbus',
  nameAr:  'محطة مصر ← سيدي بشر',
  nameEn:  'Misr Station → Sidi Bishr',
  fare:    { min: 8, max: 12 },
  peakHours: [],
  stations: [
    { order: 1, nameAr: 'محطة مصر',  nameEn: 'Misr Station', coords: { lat: 31.19, lng: 29.90 } },
    { order: 2, nameAr: 'كليوباترا', nameEn: 'Cleopatra',    coords: { lat: 31.21, lng: 29.95 } },
    { order: 3, nameAr: 'سيدي بشر',  nameEn: 'Sidi Bishr',   coords: { lat: 31.25, lng: 30.01 } },
  ],
}

const accuracyNull = { percentage: null, label: 'غير مقيّم بعد', total: 0,  accurate: 0  }
const accuracyHigh = { percentage: 85,   label: 'دقيق جداً',     total: 20, accurate: 17 }
const accuracyMid  = { percentage: 65,   label: 'دقيق نسبياً',   total: 10, accurate: 6  }
const accuracyLow  = { percentage: 40,   label: 'غير موثوق',     total: 5,  accurate: 2  }

function renderCard(accuracyStats = accuracyNull, onRateClick = jest.fn()) {
  return render(
    <MemoryRouter>
      <RouteCard route={mockRoute} accuracyStats={accuracyStats} onRateClick={onRateClick} />
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('RouteCard', () => {
  test('renders route nameAr', () => {
    renderCard()
    expect(screen.getByText('محطة مصر ← سيدي بشر')).toBeInTheDocument()
  })

  test('renders fare range', () => {
    renderCard()
    expect(screen.getByText(/8.*12.*جنيه/)).toBeInTheDocument()
  })

  test('shows "غير مقيّم بعد" badge when percentage is null', () => {
    renderCard(accuracyNull)
    expect(screen.getByText(/غير مقيّم بعد/)).toBeInTheDocument()
  })

  test('shows green badge text when percentage >= 80', () => {
    renderCard(accuracyHigh)
    const badge = screen.getByText(/دقيق جداً/)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ color: '#065F46' })
  })

  test('shows amber badge text when percentage is 60–79', () => {
    renderCard(accuracyMid)
    const badge = screen.getByText(/دقيق نسبياً/)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ color: '#92400E' })
  })

  test('shows red badge text when percentage < 60', () => {
    renderCard(accuracyLow)
    const badge = screen.getByText(/غير موثوق/)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ color: '#991B1B' })
  })

  test('calls onRateClick with routeId when rate button is clicked', () => {
    const onRateClick = jest.fn()
    renderCard(accuracyNull, onRateClick)
    fireEvent.click(screen.getByText('قيّم الخط'))
    expect(onRateClick).toHaveBeenCalledWith('ALEX-MICRO-01')
  })

  test('renders all station nameAr values in the stepper', () => {
    renderCard()
    expect(screen.getByText('محطة مصر')).toBeInTheDocument()
    expect(screen.getByText('كليوباترا')).toBeInTheDocument()
    expect(screen.getByText('سيدي بشر')).toBeInTheDocument()
  })

  test('shows total ratings count when total > 0', () => {
    renderCard(accuracyHigh)
    expect(screen.getByText(/من 20 تقييم/)).toBeInTheDocument()
  })

  test('renders microbus type badge with label مشروع', () => {
    renderCard()
    expect(screen.getByText('مشروع')).toBeInTheDocument()
  })
})
