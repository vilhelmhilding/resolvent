'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useStore } from '@/store'
import { typesetElement } from '@/hooks/useMathJax'

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/_{2}(.+?)_{2}/gs, '$1')
    .replace(/^[ \t]*[-*+]\s+/gm, '• ')
    .replace(/^[ \t]*\d+\.\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .trim()
}

export function ChatSection() {
  const lang         = useStore(s => s.lang)
  const analysisData = useStore(s => s.analysisData)
  const chatHistory  = useStore(s => s.chatHistory)
  const appendMsg    = useStore(s => s.appendChatMessage)
  const updateLastMsg = useStore(s => s.updateLastChatMessage)

  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)

  const placeholder  = lang === 'sv' ? 'Ställ en fråga...' : 'Ask a question...'
  const sendLabel    = lang === 'sv' ? 'Skicka' : 'Send'
  const sectionLabel = lang === 'sv' ? 'FRÅGA OM UTTRYCKET' : 'ASK ABOUT THE EXPRESSION'

  const scrollBottom = () => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }
  useEffect(scrollBottom, [chatHistory, streaming])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const msg = input.trim()
    if (!msg || !analysisData || streaming) return
    setInput('')
    appendMsg({ role: 'user', content: msg })
    setStreaming(true)

    // seed an empty assistant message that we'll grow in place
    appendMsg({ role: 'assistant', content: '' })

    const historyForApi = chatHistory.slice(-10)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, analysis_data: analysisData, history: historyForApi, lang }),
      })
      const data = await res.json()
      if (data.ok) {
        updateLastMsg(data.reply)
      } else {
        updateLastMsg('⚠ ' + (data.error ?? (lang === 'sv' ? 'Kunde inte hämta svar.' : 'Could not fetch reply.')))
      }
    } catch {
      updateLastMsg('⚠ ' + (lang === 'sv' ? 'Kunde inte nå servern.' : 'Could not reach server.'))
    } finally {
      setStreaming(false)
      setTimeout(() => {
        if (messagesRef.current) typesetElement(messagesRef.current)
      }, 80)
    }
  }, [input, analysisData, chatHistory, lang, appendMsg, updateLastMsg, streaming])

  return (
    <div className="chat-section" id="chat-section">
      <div className="section-label">{sectionLabel}</div>
      <div className="chat-messages" ref={messagesRef}>
        {chatHistory.map((msg, i) => {
          const isStreamingPlaceholder = streaming && i === chatHistory.length - 1 && msg.role === 'assistant' && msg.content === ''
          if (isStreamingPlaceholder) return null
          return (
            <div key={i} className={`chat-message chat-${msg.role}`}>
              {msg.role === 'assistant' ? stripMarkdown(msg.content) : msg.content}
            </div>
          )
        })}
        {streaming && chatHistory[chatHistory.length - 1]?.role === 'assistant' && chatHistory[chatHistory.length - 1]?.content === '' && (
          <div className="chat-message chat-assistant chat-typing">
            <span /><span /><span />
          </div>
        )}
      </div>
      <form className="chat-form" onSubmit={handleSubmit} autoComplete="off">
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          disabled={streaming}
        />
        <button type="submit" className="chat-send-btn" disabled={streaming}>
          {streaming ? '...' : sendLabel}
        </button>
      </form>
    </div>
  )
}
