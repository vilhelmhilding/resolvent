'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/store'
import { typesetElement } from '@/hooks/useMathJax'
import type { AnalysisData, Slider } from '@/types/analysis'

interface SavedItem {
  id: string
  latex: string
  summary_en: string
  summary_sv: string
  created_at: string
  expires_at: string
}

interface LoadedAnalysis {
  id: string
  analysis: AnalysisData
  sliders: Slider[]
  chat_history: { role: 'user' | 'assistant'; content: string }[]
}

interface Props {
  onBack: () => void
  onLoad: (data: LoadedAnalysis) => void
}

function fmtDate(iso: string, lang: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (lang === 'sv') {
    if (diffDays === 0) return 'Idag'
    if (diffDays === 1) return 'Igår'
    if (diffDays < 7) return `${diffDays} dagar sedan`
    return d.toLocaleDateString('sv', { month: 'short', day: 'numeric' })
  }
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function EquationCell({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) typesetElement(ref.current) }, [latex])
  return <div ref={ref} className="dash-item-eq">{`$${latex}$`}</div>
}

function SummaryCell({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const body = text.trimEnd()
  const display = body.endsWith('.') ? body : body + '.'
  useEffect(() => { if (ref.current) typesetElement(ref.current) }, [text])
  return <p ref={ref} className="dash-item-summary">{display}</p>
}

export function Dashboard({ onBack, onLoad }: Props) {
  const lang = useStore(s => s.lang)
  const [items, setItems]     = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError]     = useState('')

  const T = {
    back:    lang === 'sv' ? '← Tillbaka'                  : '← Back',
    empty:   lang === 'sv' ? 'Inga sparade analyser ännu.' : 'No saved analyses yet.',
    clear:   lang === 'sv' ? 'Rensa allt'                  : 'Clear all',
    heading: lang === 'sv' ? 'Sparade analyser'            : 'Saved analyses',
    confirmClear: lang === 'sv' ? 'Ta bort alla analyser?' : 'Delete all saved analyses?',
    errServer: lang === 'sv' ? 'Kunde inte nå servern'     : 'Could not reach server',
    errLoad:   lang === 'sv' ? 'Kunde inte ladda analysen' : 'Could not load analysis',
  }

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analyses')
      const data = await res.json()
      if (data.ok) setItems(data.analyses)
      else setError(data.detail ?? T.errServer)
    } catch { setError(T.errServer) }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  useEffect(() => { fetchList() }, [fetchList])

  async function loadItem(id: string) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/analyses/${id}`)
      const data = await res.json()
      if (data.ok) onLoad({ id, analysis: data.analysis, sliders: data.sliders, chat_history: data.chat_history ?? [] })
      else setError(data.detail ?? T.errLoad)
    } catch { setError(T.errServer) }
    finally { setLoadingId(null) }
  }

  async function deleteItem(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/analyses/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(x => x.id !== id))
  }

  async function clearAll() {
    if (!confirm(T.confirmClear)) return
    await fetch('/api/analyses', { method: 'DELETE' })
    setItems([])
  }

  return (
    <div className="dashboard">
      <div className="dash-header">
        <button className="dash-back-btn" onClick={onBack}>{T.back}</button>
        <h2 className="dash-heading">{T.heading}</h2>
        {items.length > 0 && (
          <button className="dash-clear-btn" onClick={clearAll}>{T.clear}</button>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="dash-loading">
          <div className="dash-spinner" />
        </div>
      ) : items.length === 0 ? (
        <p className="dash-empty">{T.empty}</p>
      ) : (
        <div className="dash-list">
          {items.map(item => (
            <div
              key={item.id}
              className={`dash-item${loadingId === item.id ? ' dash-item--loading' : ''}`}
              onClick={() => loadingId !== item.id && loadItem(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && loadingId !== item.id && loadItem(item.id)}
            >
              <div className="dash-item-body">
                <EquationCell latex={item.latex} />
                <SummaryCell text={(lang === 'sv' ? item.summary_sv : item.summary_en) || item.summary_en} />
              </div>
              <div className="dash-item-meta">
                <span className="dash-item-date">{fmtDate(item.created_at, lang)}</span>
                <button
                  className="dash-item-delete"
                  onClick={(e) => deleteItem(item.id, e)}
                  title={lang === 'sv' ? 'Ta bort' : 'Delete'}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
