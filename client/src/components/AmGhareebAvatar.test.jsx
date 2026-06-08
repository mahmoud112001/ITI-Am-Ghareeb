import { render, screen } from '@testing-library/react'
import AmGhareebAvatar from '../AmGhareebAvatar'

describe('AmGhareebAvatar', () => {
  test('renders without crashing at default size 48', () => {
    const { container } = render(<AmGhareebAvatar />)
    expect(container.firstChild).not.toBeNull()
  })

  test('renders an SVG element', () => {
    const { container } = render(<AmGhareebAvatar />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  test('applies default size of 48 to width and height attributes', () => {
    const { container } = render(<AmGhareebAvatar />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '48')
    expect(svg).toHaveAttribute('height', '48')
  })

  test('applies custom size prop to width and height', () => {
    const { container } = render(<AmGhareebAvatar size={120} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '120')
    expect(svg).toHaveAttribute('height', '120')
  })

  test('applies custom className to the SVG element', () => {
    const { container } = render(<AmGhareebAvatar className="mx-auto my-custom" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('mx-auto')
    expect(svg).toHaveClass('my-custom')
  })

  test('has correct viewBox', () => {
    const { container } = render(<AmGhareebAvatar />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100')
  })

  test('renders collar rect when size > 60', () => {
    const { container } = render(<AmGhareebAvatar size={80} />)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(1)
  })

  test('does not render collar rect when size <= 60', () => {
    const { container: c48 } = render(<AmGhareebAvatar size={48} />)
    const { container: c80 } = render(<AmGhareebAvatar size={80} />)
    // Size 80 should have more elements (collar adds a rect)
    expect(c80.querySelectorAll('rect').length).toBeGreaterThan(
      c48.querySelectorAll('rect').length
    )
  })
})
