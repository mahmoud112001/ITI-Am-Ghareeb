import { useState, useCallback } from 'react'
import { getAccessToken } from '../lib/axios'

// ── Welcome message ───────────────────────────────────────────────────────────
const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: 'أهلاً يا فنان! 👋 أنا عم غريب، دليلك في مواصلات الإسكندرية. إسألني عن أي خط مشروع أو محطة وأنا هوريلك أحسن طريقة!',
  timestamp: Date.now(),
  isStreaming: false,
}

// ── Simple UUID generator ─────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ── useAIChat hook ────────────────────────────────────────────────────────────
export function useAIChat() {
  const [messages, setMessages]      = useState([WELCOME_MESSAGE])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError]            = useState(null)

  const sendMessage = useCallback(async (origin, destination, text) => {
    if (!text?.trim()) return

    const userMsg = {
      id: uid(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }

    const assistantId = uid()
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    }

    // Add user message + empty assistant placeholder
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)
    setError(null)

    try {
      const token = getAccessToken()

      const response = await fetch(`${API_BASE}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          origin:      origin?.trim() || '',
          destination: destination?.trim() || '',
          message:     text.trim(),
        }),
      })

      if (!response.ok) {
        // Parse JSON error before SSE starts
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || `خطأ ${response.status}`)
      }

      // ── Parse SSE stream ──────────────────────────────────────────────────
      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep last incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()

          // [DONE] is a plain string sentinel — never JSON.parse it
          if (payload === '[DONE]') {
            setIsStreaming(false)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
              )
            )
            continue
          }

          try {
            const parsed = JSON.parse(payload)

            if (parsed.text) {
              // Append chunk to assistant message
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.text }
                    : m
                )
              )
            }

            if (parsed.error) {
              // Error sent via SSE (headers already flushed)
              setError(parsed.error)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: parsed.error, isStreaming: false }
                    : m
                )
              )
              setIsStreaming(false)
            }
          } catch {
            // Non-JSON SSE line — skip silently
          }
        }
      }
    } catch (err) {
      const errMsg = err.message || 'حدث خطأ، حاول مرة تانية'
      setError(errMsg)
      setIsStreaming(false)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: errMsg, isStreaming: false }
            : m
        )
      )
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([WELCOME_MESSAGE])
    setIsStreaming(false)
    setError(null)
  }, [])

  return { messages, isStreaming, error, sendMessage, clearMessages }
}
