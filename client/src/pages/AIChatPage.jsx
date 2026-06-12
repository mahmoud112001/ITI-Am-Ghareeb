import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/axios'
import { useAIChat } from '../hooks/useAIChat'
import AmGhareebAvatar from '../components/AmGhareebAvatar'
import ar from '../i18n/ar'

const { chat: t, common } = ar

// ── Station autocomplete (compact, inline) ────────────────────────────────────
function StationAutocomplete({ value, onChange, placeholder, stations }) {
  const [open, setOpen]               = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const wrapRef = useRef(null)

  const filtered = value.trim()
    ? stations.filter((s) => s.includes(value.trim())).slice(0, 5)
    : []

  function select(s) { onChange(s); setOpen(false); setHighlighted(-1) }

  function handleKey(e) {
    if (!open || !filtered.length) return
    if (e.key === 'ArrowDown')  { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); select(filtered[highlighted]) }
    if (e.key === 'Escape') setOpen(false)
  }

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1) }}
        onFocus={(e) => { setOpen(true); e.target.style.borderColor = '#F4A833' }}
        onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.3)' }}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none transition-all"
        style={{
          fontFamily:      'Cairo, sans-serif',
          borderColor:     'rgba(255,255,255,0.3)',
          backgroundColor: 'rgba(255,255,255,0.15)',
          color:           '#FFFFFF',
        }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute top-full mt-1 w-full rounded-xl shadow-xl overflow-hidden z-50"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              className="px-3 py-2 text-sm cursor-pointer"
              style={{
                fontFamily:      'Cairo, sans-serif',
                backgroundColor: i === highlighted ? '#FDF6EC' : '#FFFFFF',
                color:           '#1B2A4A',
                fontWeight:      i === highlighted ? 600 : 400,
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Bouncing dots for streaming state ─────────────────────────────────────────
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1 px-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display:         'inline-block',
            width:           7,
            height:          7,
            borderRadius:    '50%',
            backgroundColor: '#F4A833',
            animation:       `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes chatBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </span>
  )
}

// ── Arabic relative timestamp ─────────────────────────────────────────────────
function relativeAr(ts) {
  const diff  = Date.now() - ts
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (diff < 30000)  return common.now
  if (mins  < 60)    return common.minutesAgo(mins)
  if (hours < 24)    return common.hoursAgo(hours)
  return common.daysAgo(1)
}

// ── Send icon ─────────────────────────────────────────────────────────────────
function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

// ── AIChatPage ────────────────────────────────────────────────────────────────
export default function AIChatPage() {
  const [searchParams]  = useSearchParams()
  const [origin, setOrigin]           = useState(searchParams.get('origin')      || '')
  const [destination, setDestination] = useState(searchParams.get('destination') || '')
  const [inputText, setInputText]     = useState('')
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  const { messages, isStreaming, error, sendMessage, clearMessages } = useAIChat()

  // Stations for autocomplete
  const { data: stationsData } = useQuery({
    queryKey: ['stations'],
    queryFn:  () => api.get('/api/routes/stations').then((r) => r.data.stations),
    staleTime: Infinity,
  })
  const stations = stationsData || []

  // Auto-scroll to bottom on new message or streamed content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, messages[messages.length - 1]?.content])

  function handleSend() {
    const text = inputText.trim()
    if (!text || isStreaming) return
    setInputText('')
    sendMessage(origin, destination, text)
    inputRef.current?.focus()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{
        height:          'calc(100vh - 64px)',
        fontFamily:      'Cairo, sans-serif',
        backgroundColor: '#FDF6EC',
      }}
      dir="rtl"
    >
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4"
        style={{
          height:          56,
          backgroundColor: '#1B2A4A',
          borderBottom:    '2px solid #F4A833',
        }}
      >
        <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#F4A833' }}>
          {t.routeLabel}
        </span>
        <StationAutocomplete
          value={origin}
          onChange={setOrigin}
          placeholder={t.placeholderFrom}
          stations={stations}
        />
        <span className="text-white/50 flex-shrink-0 text-sm">←</span>
        <StationAutocomplete
          value={destination}
          onChange={setDestination}
          placeholder={t.placeholderTo}
          stations={stations}
        />
        <button
          onClick={clearMessages}
          className="flex-shrink-0 text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.2)' }}
          title={t.clearTitle}
        >
          {t.clearBtn}
        </button>
      </div>

      {/* ── MESSAGES AREA ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5"
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user'
          return (
            <div
              key={msg.id}
              className="flex items-end gap-2"
              style={{ justifyContent: isUser ? 'flex-start' : 'flex-end' }}
            >
              {/* Avatar — beside assistant bubble */}
              {!isUser && (
                <div className="flex-shrink-0 mb-1 order-2">
                  <AmGhareebAvatar size={32} />
                </div>
              )}

              <div
                className="flex flex-col"
                style={{
                  alignItems: isUser ? 'flex-start' : 'flex-end',
                  maxWidth:   '75%',
                  order:      isUser ? 0 : 1,
                }}
              >
                {/* Bubble */}
                <div
                  style={{
                    backgroundColor: isUser ? '#1B2A4A' : '#FFFFFF',
                    color:           isUser ? '#FFFFFF' : '#1B2A4A',
                    border:          isUser ? 'none' : '1px solid #E5E7EB',
                    borderRadius:    isUser
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                    padding:    '10px 14px',
                    fontSize:   14,
                    lineHeight: 1.65,
                    boxShadow:  '0 1px 4px rgba(0,0,0,0.07)',
                    wordBreak:  'break-word',
                  }}
                >
                  {msg.isStreaming && !msg.content
                    ? <TypingDots />
                    : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                        {msg.isStreaming && (
                          <span
                            style={{
                              display:         'inline-block',
                              width:           2,
                              height:          16,
                              backgroundColor: '#F4A833',
                              marginRight:     3,
                              verticalAlign:   'middle',
                              animation:       'blink 1s step-end infinite',
                            }}
                          />
                        )}
                      </span>
                    )
                  }
                </div>

                {/* Timestamp */}
                <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, paddingInline: 2 }}>
                  {relativeAr(msg.timestamp)}
                </span>
              </div>
            </div>
          )
        })}

        {/* Error card */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium text-center"
            style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
          >
            {t.errorMsg}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── BOTTOM INPUT BAR ─────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
        style={{
          backgroundColor: '#FFFFFF',
          borderTop:       '2px solid #1B2A4A',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKey}
          disabled={isStreaming}
          placeholder={isStreaming ? t.inputStreaming : t.inputIdle}
          className="flex-1 rounded-xl border-2 px-4 py-2.5 text-sm outline-none transition-all"
          style={{
            fontFamily:      'Cairo, sans-serif',
            borderColor:     '#E5E7EB',
            backgroundColor: isStreaming ? '#F9FAFB' : '#FFFFFF',
            color:           '#1B2A4A',
          }}
          onFocus={(e) => !isStreaming && (e.target.style.borderColor = '#F4A833')}
          onBlur={(e)  => (e.target.style.borderColor = '#E5E7EB')}
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isStreaming}
          className="flex-shrink-0 flex items-center justify-center rounded-xl transition-opacity"
          style={{
            width:           44,
            height:          44,
            backgroundColor: '#F4A833',
            color:           '#1B2A4A',
            opacity:         !inputText.trim() || isStreaming ? 0.45 : 1,
            cursor:          !inputText.trim() || isStreaming ? 'not-allowed' : 'pointer',
          }}
          aria-label={t.sendLabel}
        >
          <SendIcon />
        </button>
      </div>

      {/* Cursor blink keyframe */}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}