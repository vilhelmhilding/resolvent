'use client'
import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import { analyzeImage, analyzeLatex } from '@/lib/api'
import { typesetElement } from '@/hooks/useMathJax'
import { TopBar } from './TopBar'
import { UploadZone } from './upload/UploadZone'
import { ImageCropper } from './upload/ImageCropper'
import { AnalysisResult } from './analysis/AnalysisResult'
import { AuthModal } from './auth/AuthModal'
import { Dashboard } from './dashboard/Dashboard'
import type { AnalysisData, Slider } from '@/types/analysis'

type Phase = 'upload' | 'crop' | 'loading' | 'result' | 'dashboard'
type InputMode = 'image' | 'latex'

const LOADING_MSGS = {
  sv: ['Extraherar uttrycket...', 'Analyserar struktur...', 'Bygger visualiseringar...'],
  en: ['Extracting expression...', 'Analyzing structure...', 'Building visualizations...'],
}

const LOADING_MSGS_POST = {
  sv: ['Analyserar deluttryck...', 'Beräknar visualiseringar...', 'Slutför analys...'],
  en: ['Analyzing sub-expressions...', 'Computing visualizations...', 'Finalizing analysis...'],
}

function LaTeXPreview({ latex, lang }: { latex: string; lang: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && latex) typesetElement(ref.current)
  }, [latex])
  if (!latex.trim()) return null
  return <div ref={ref} className="latex-preview">{`$$${latex}$$`}</div>
}

function IdentifiedPreview({ latex, lang }: { latex: string; lang: string }) {
  const ref = useRef<HTMLDivElement>(null)

  function scaleEq() {
    const box = ref.current
    if (!box) return
    const mjx = box.querySelector<HTMLElement>('mjx-container')
    if (!mjx) return
    mjx.style.zoom = ''
    const avail = box.clientWidth - 48
    if (mjx.scrollWidth > avail) mjx.style.zoom = String(avail / mjx.scrollWidth)
  }

  useEffect(() => {
    if (!ref.current) return
    typesetElement(ref.current).then(scaleEq)
    window.addEventListener('resize', scaleEq)
    return () => window.removeEventListener('resize', scaleEq)
  }, [latex])
  return (
    <div className="loading-identified">
      <div className="loading-identified-label">{lang === 'sv' ? 'Identifierad' : 'Identified'}</div>
      <div ref={ref} className="loading-identified-eq">{`$$${latex}$$`}</div>
    </div>
  )
}

function buildAnimCfg(sliders: Slider[]) {
  const cfg: { kmax?: number; tmin?: number; tmax?: number } = {}
  for (const s of sliders) {
    if (s.name === 'k') cfg.kmax = s.max
    if (s.name === 't') { cfg.tmin = s.min; cfg.tmax = s.max }
  }
  return cfg
}

export function ClientApp() {
  const lang = useStore(s => s.lang)
  const auth = useStore(s => s.auth)
  const { setAnalysisData, setChatHistory, setIsAnimating, setParams, setAnimConfig, reset } = useStore()
  const chatHistory = useStore(s => s.chatHistory)

  const [phase, setPhase]         = useState<Phase>('upload')
  const [inputMode, setInputMode] = useState<InputMode>('image')
  const [latexInput, setLatexInput] = useState('')
  const [image, setImage]         = useState<HTMLImageElement | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [result, setResult]       = useState<{ analysis: AnalysisData; sliders: Slider[] } | null>(null)
  const [showAuth, setShowAuth]   = useState(false)
  const [savedId, setSavedId]     = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [identified, setIdentified] = useState<{ latex: string } | null>(null)
  const prevPhaseRef              = useRef<Phase>('upload')

  // Auto-save chat 1.5 s after last assistant message completes
  useEffect(() => {
    if (!savedId || !auth) return
    const last = chatHistory[chatHistory.length - 1]
    if (!last || last.role !== 'assistant' || !last.content) return
    const timer = setTimeout(async () => {
      await fetch(`/api/analyses/${savedId}/chat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_history: chatHistory }),
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [chatHistory, savedId, auth])

  function onImage(img: HTMLImageElement) {
    setImage(img); setPhase('crop'); setError(null)
  }

  function applyResult(analysis: AnalysisData, sliders: Slider[]) {
    const cfg = buildAnimCfg(sliders)
    reset()
    setAnimConfig(cfg)
    setParams({ k: 1, t: cfg.tmin ?? 0 })
    setAnalysisData(analysis)
    setChatHistory([])
    setResult({ analysis, sliders })
    setSavedId(null)
    setSaveState('idle')
    setPhase('result')
  }

  async function runAnalysis(fn: () => Promise<{ ok: true; analysis: AnalysisData; sliders: Slider[] } | { ok: false; error: string }>) {
    setPhase('loading'); setError(null); setIdentified(null)
    try {
      const res = await fn()
      if (!res.ok) { setError(res.error); setPhase('upload'); setIdentified(null); return }
      setIdentified(null)
      applyResult(res.analysis, res.sliders)
    } catch (e) {
      setError((lang === 'sv' ? 'Kunde inte nå servern: ' : 'Could not reach server: ') + (e as Error).message)
      setPhase('upload'); setIdentified(null)
    }
  }

  function onConfirm(dataUrl: string) {
    runAnalysis(() => analyzeImage(dataUrl, (latex) => setIdentified({ latex })))
  }

  function onLatexSubmit(e: React.FormEvent) {
    e.preventDefault()
    const latex = latexInput.trim()
    if (!latex) return
    runAnalysis(() => analyzeLatex(latex, (lat) => setIdentified({ latex: lat })))
  }

  function newAnalysis() {
    setIsAnimating(false)
    setParams({ k: 1, t: 0 })
    setResult(null); setImage(null)
    setSavedId(null); setSaveState('idle')
    setPhase('upload'); setError(null)
  }

  async function saveAnalysis() {
    if (!result || !auth) { setShowAuth(true); return }
    setSaveState('saving')
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: result.analysis, sliders: result.sliders, chat_history: chatHistory }),
      })
      const data = await res.json()
      if (data.ok) { setSavedId(data.id); setSaveState('saved') }
      else setSaveState('idle')
    } catch { setSaveState('idle') }
  }

  function openDashboard() {
    prevPhaseRef.current = phase
    setPhase('dashboard')
  }

  function closeDashboard() {
    setPhase(prevPhaseRef.current === 'result' ? 'result' : 'upload')
  }

  function onLoadFromDashboard(data: { id: string; analysis: AnalysisData; sliders: Slider[]; chat_history: { role: 'user' | 'assistant'; content: string }[] }) {
    const cfg = buildAnimCfg(data.sliders)
    reset()
    setAnimConfig(cfg)
    setParams({ k: 1, t: cfg.tmin ?? 0 })
    setAnalysisData(data.analysis)
    setChatHistory(data.chat_history)
    setResult({ analysis: data.analysis, sliders: data.sliders })
    setSavedId(data.id)
    setSaveState('saved')
    setPhase('result')
  }

  const newLabel   = lang === 'sv' ? 'Ny analys' : 'New analysis'
  const saveLabel  = saveState === 'saving' ? '...' : saveState === 'saved' ? (lang === 'sv' ? 'Sparad ✓' : 'Saved ✓') : (lang === 'sv' ? 'Spara' : 'Save')
  const uploadLabel = lang === 'sv' ? 'ANALYSERA EKVATION' : 'ANALYZE EQUATION'
  const latexPlaceholder = lang === 'sv'
    ? 'Klistra in LaTeX, t.ex. \\int_{-\\infty}^{\\infty} e^{-x^2} dx'
    : 'Paste LaTeX, e.g. \\int_{-\\infty}^{\\infty} e^{-x^2} dx'

  return (
    <>
      <div className={`page-content${showAuth ? ' page-blur' : ''}`}>
        <div className="print-header"><h1>Resolvent</h1></div>
        <TopBar onAuthClick={() => setShowAuth(true)} onDashboard={openDashboard} onHome={newAnalysis} />

      {phase === 'upload' && (
        <section className="card" id="upload-section">
          <div className="section-label">{uploadLabel}</div>
          <div className="input-mode-tabs">
            <button className={`input-mode-tab${inputMode === 'image' ? ' active' : ''}`} onClick={() => setInputMode('image')}>
              {lang === 'sv' ? 'Bild' : 'Image'}
            </button>
            <button className={`input-mode-tab${inputMode === 'latex' ? ' active' : ''}`} onClick={() => setInputMode('latex')}>
              LaTeX
            </button>
          </div>
          {inputMode === 'image' ? (
            <UploadZone onImage={onImage} />
          ) : (
            <form className="latex-input-form" onSubmit={onLatexSubmit}>
              <textarea
                className="latex-textarea"
                value={latexInput}
                onChange={e => setLatexInput(e.target.value)}
                placeholder={latexPlaceholder}
                rows={3}
                spellCheck={false}
              />
              <LaTeXPreview latex={latexInput} lang={lang} />
              <button type="submit" className="btn-primary" disabled={!latexInput.trim()}>
                {lang === 'sv' ? 'Analysera' : 'Analyze'}
              </button>
            </form>
          )}
        </section>
      )}

      {phase === 'crop' && image && (
        <section className="card" id="upload-section">
          <div className="section-label">{uploadLabel}</div>
          <ImageCropper image={image} onConfirm={onConfirm} onCancel={() => { setImage(null); setPhase('upload') }} />
        </section>
      )}

      {phase === 'loading' && (
        <div className="loader">
          <svg className="spinner" viewBox="0 0 52 26" xmlns="http://www.w3.org/2000/svg">
            <path d="M 26,13 C 26,4 50,4 50,13 C 50,22 26,22 26,13 C 26,4 2,4 2,13 C 2,22 26,22 26,13"
              fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              pathLength="1" strokeDasharray="1" />
          </svg>
          {identified ? (
            <IdentifiedPreview latex={identified.latex} lang={lang} />
          ) : (
            <div className="loading-messages">
              {LOADING_MSGS[lang].map((m, i) => (
                <div key={i} className="loading-msg" style={{ animationDelay: `${i * 2.5}s` }}>{m}</div>
              ))}
            </div>
          )}
          {identified && (
            <div className="loading-messages" style={{ marginTop: 16 }}>
              {LOADING_MSGS_POST[lang].map((m, i) => (
                <div key={i} className="loading-msg" style={{ animationDelay: `${i * 2.5}s` }}>{m}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {phase === 'result' && result && (
        <>
          <main id="result-container">
            <AnalysisResult analysis={result.analysis} sliders={result.sliders} />
          </main>
          <div id="new-analysis-wrapper">
            {auth && (
              <button
                className={`btn-secondary${saveState === 'saved' ? ' btn-saved' : ''}`}
                onClick={saveAnalysis}
                disabled={saveState === 'saving' || saveState === 'saved'}
              >
                {saveLabel}
              </button>
            )}
            {!auth && (
              <button className="btn-secondary" onClick={() => setShowAuth(true)}>
                {lang === 'sv' ? 'Logga in för att spara' : 'Log in to save'}
              </button>
            )}
            <button className="btn-primary" onClick={newAnalysis}>{newLabel}</button>
          </div>
        </>
      )}

      {phase === 'dashboard' && (
        <Dashboard onBack={closeDashboard} onLoad={onLoadFromDashboard} />
      )}

      <footer className="footer">
        Created by{' '}
        <a href="https://github.com/vilhelmhilding" target="_blank" rel="noopener noreferrer">
          @vilhelmhilding
        </a>
      </footer>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}
