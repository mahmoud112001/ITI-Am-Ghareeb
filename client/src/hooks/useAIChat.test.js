import { renderHook, act } from '@testing-library/react'
import { useAIChat } from '../useAIChat'

// ── Mock getAccessToken ───────────────────────────────────────────────────────
jest.mock('../../lib/axios', () => ({
  getAccessToken: jest.fn(() => 'mock-token'),
}))

// ── SSE stream builder helper ─────────────────────────────────────────────────
function makeSSEStream(events) {
  // events: array of strings like 'data: {"text":"chunk"}\n\n' or 'data: [DONE]\n\n'
  const body    = events.join('')
  const encoder = new TextEncoder()
  const encoded = encoder.encode(body)

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  })
}

function mockFetchOk(sseEvents) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok:   true,
      body: makeSSEStream(sseEvents),
    })
  )
}

function mockFetchError(status = 500, message = 'Server error') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok:     false,
      status,
      json:   () => Promise.resolve({ message }),
    })
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useAIChat', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('initial messages contains the welcome message', () => {
    const { result } = renderHook(() => useAIChat())
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].id).toBe('welcome')
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.messages[0].content).toContain('أهلاً يا فنان')
  })

  test('sendMessage adds user message immediately', async () => {
    mockFetchOk(['data: [DONE]\n\n'])
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('محطة مصر', 'سيدي بشر', 'إيه أحسن خط؟')
    })

    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg.content).toBe('إيه أحسن خط؟')
  })

  test('sendMessage adds assistant message placeholder after user message', async () => {
    mockFetchOk(['data: [DONE]\n\n'])
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('', '', 'سؤال تجريبي')
    })

    // welcome + user + assistant = 3
    expect(result.current.messages).toHaveLength(3)
    const assistantMsgs = result.current.messages.filter((m) => m.role === 'assistant')
    expect(assistantMsgs.some((m) => m.id !== 'welcome')).toBe(true)
  })

  test('SSE stream chunks are appended to assistant message content', async () => {
    mockFetchOk([
      'data: {"text":"روح "}\n\n',
      'data: {"text":"محطة "}\n\n',
      'data: {"text":"مصر"}\n\n',
      'data: [DONE]\n\n',
    ])
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('', '', 'فين محطة مصر؟')
    })

    const assistantMsg = result.current.messages.find(
      (m) => m.role === 'assistant' && m.id !== 'welcome'
    )
    expect(assistantMsg.content).toBe('روح محطة مصر')
  })

  test('[DONE] event sets isStreaming to false', async () => {
    mockFetchOk(['data: {"text":"ok"}\n\n', 'data: [DONE]\n\n'])
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('', '', 'test')
    })

    expect(result.current.isStreaming).toBe(false)
  })

  test('[DONE] event sets isStreaming flag on message to false', async () => {
    mockFetchOk(['data: {"text":"مرحبا"}\n\n', 'data: [DONE]\n\n'])
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('', '', 'hi')
    })

    const assistantMsg = result.current.messages.find(
      (m) => m.role === 'assistant' && m.id !== 'welcome'
    )
    expect(assistantMsg.isStreaming).toBe(false)
  })

  test('error event via SSE sets error state', async () => {
    mockFetchOk(['data: {"error":"حدث خطأ في الخادم"}\n\n'])
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('', '', 'test error')
    })

    expect(result.current.error).toBe('حدث خطأ في الخادم')
    expect(result.current.isStreaming).toBe(false)
  })

  test('fetch failure (non-ok status) sets error state', async () => {
    mockFetchError(500, 'Internal Server Error')
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('', '', 'test')
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.isStreaming).toBe(false)
  })

  test('clearMessages resets to welcome message only', async () => {
    mockFetchOk(['data: {"text":"ok"}\n\n', 'data: [DONE]\n\n'])
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('', '', 'hello')
    })

    expect(result.current.messages.length).toBeGreaterThan(1)

    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].id).toBe('welcome')
    expect(result.current.error).toBeNull()
    expect(result.current.isStreaming).toBe(false)
  })

  test('does not send empty or whitespace-only messages', async () => {
    global.fetch = jest.fn()
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('', '', '   ')
    })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(1) // only welcome
  })
})
