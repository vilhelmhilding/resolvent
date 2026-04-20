'use client'
import { useRef, useEffect, useCallback } from 'react'
import { useStore } from '@/store'
import { VizCanvas } from '@/components/viz/VizCanvas'
import { PartCard } from './PartCard'
import { ChatSection } from './ChatSection'
import { useAnimation } from '@/hooks/useAnimation'
import { useCamera3D } from '@/hooks/useCamera3D'
import { AnimControls } from './AnimControls'
import { DerivationSteps } from './DerivationSteps'
import { typesetElement } from '@/hooks/useMathJax'
import type { AnalysisData, Slider } from '@/types/analysis'

interface Props {
  analysis: AnalysisData
  sliders: Slider[]
}

function buildAnimConfig(sliders: Slider[]) {
  const cfg: { kmax?: number; tmin?: number; tmax?: number } = {}
  for (const s of sliders) {
    if (s.name === 'k') cfg.kmax = s.max
    if (s.name === 't') { cfg.tmin = s.min; cfg.tmax = s.max }
  }
  return cfg
}

export function AnalysisResult({ analysis, sliders }: Props) {
  const lang = useStore(s => s.lang)
  const { start } = useAnimation()
  const { onCanvasMouseDown, onCanvasTouchStart } = useCamera3D()
  const is3D = useStore(s => s.is3D)
  const containerRef = useRef<HTMLDivElement>(null)

  const setAnimConfig = useStore(s => s.setAnimConfig)
  const setParams     = useStore(s => s.setParams)

  useEffect(() => {
    const cfg = buildAnimConfig(sliders)
    setAnimConfig(cfg)
    setParams({ k: 1, t: cfg.tmin ?? 0 })
    if (containerRef.current) typesetElement(containerRef.current).then(() => {
      scaleEquationIfOverflow()
      if (sliders.length > 0) start()
    })
    window.addEventListener('resize', scaleEquationIfOverflow)
    return () => window.removeEventListener('resize', scaleEquationIfOverflow)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (containerRef.current) typesetElement(containerRef.current)
  }, [lang])

  function scaleEquationIfOverflow() {
    const box = containerRef.current?.querySelector<HTMLElement>('.equation-box')
    if (!box) return
    const mjx = box.querySelector<HTMLElement>('mjx-container')
    if (!mjx) return
    mjx.style.zoom = ''
    const availW = box.clientWidth - 48
    if (mjx.scrollWidth > availW) {
      mjx.style.zoom = String(availW / mjx.scrollWidth)
    }
  }

  const exportPdf = useCallback(() => {
    const result = containerRef.current
    const chatEl = document.getElementById('chat-section')
    if (!result) return
    const canvases = Array.from(result.querySelectorAll<HTMLCanvasElement>('canvas'))
    const replacements = canvases.map(canvas => {
      const img = new Image()
      img.src = canvas.toDataURL('image/png')
      img.className = canvas.className + ' canvas-print-img'
      canvas.parentNode!.insertBefore(img, canvas)
      canvas.hidden = true
      return { canvas, img }
    })
    const margin = 40
    const pageWidth = Math.min(document.body.clientWidth, 960) + margin * 2
    const rcTop = result.getBoundingClientRect().top
    const chatTop = chatEl?.getBoundingClientRect().top ?? window.innerHeight
    const footerEl = document.querySelector<HTMLElement>('.footer')
    const footerH = footerEl ? footerEl.offsetHeight + 24 : 0
    const pageHeight = Math.ceil(80 + (chatTop - rcTop) + footerH + margin * 2 + 120)
    const style = document.createElement('style')
    style.id = 'pdf-page-size'
    style.textContent = `@page { size: ${pageWidth}px ${pageHeight}px; margin: ${margin}px; }`
    document.head.appendChild(style)
    const restore = () => {
      replacements.forEach(({ canvas, img }) => { canvas.hidden = false; img.remove() })
      document.getElementById('pdf-page-size')?.remove()
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }, [])

  const exportChat = useCallback(() => {
    const history = useStore.getState().chatHistory
    if (!history.length) return
    const latex = analysis.latex
    const date = new Date().toISOString().split('T')[0]
    const header = `Resolvent — Chat Export\nExpression: ${latex}\nDate: ${date}\n\n---`
    const messages = history.map(m => `\n\n[${m.role === 'user' ? 'You' : 'Resolvent'}]\n${m.content}`).join('\n\n---')
    const blob = new Blob([header + messages], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'resolvent-chat.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }, [analysis.latex])

  const summary   = analysis.summary[lang]
  const intuition = analysis.intuition[lang]
  const exampleText = analysis.example?.[lang]

  const mainVizLabel = lang === 'sv' ? 'HUVUDVISUALISERING' : 'MAIN VISUALIZATION'
  const subExprLabel = lang === 'sv' ? 'DELUTTRYCK' : 'SUB-EXPRESSIONS'
  const intuitionLabel = lang === 'sv' ? 'Intuition:' : 'Intuition:'
  const exampleLabel   = lang === 'sv' ? 'Exempel:' : 'Example:'

  return (
    <div ref={containerRef}>
      <div className="equation-box">$${analysis.latex}$$</div>
      <div className="summary">{summary}</div>
      <div className="intuition">
        <strong>{intuitionLabel}</strong> <span>{intuition}</span>
      </div>
      {exampleText && (
        <div className="example-box">
          <strong>{exampleLabel}</strong> <span>{exampleText}</span>
        </div>
      )}

      {analysis.main_viz && (
        <div className="main-viz-container">
          <div className="section-label">{mainVizLabel}</div>
          <VizCanvas
            id="main-viz"
            type={analysis.main_viz.type}
            vizParams={analysis.main_viz.params}
            color="#6366f1"
            width={640}
            height={360}
            onMouseDown={is3D ? onCanvasMouseDown : undefined}
            onTouchStart={is3D ? onCanvasTouchStart : undefined}
          />
        </div>
      )}

      {sliders.length > 0 && <AnimControls sliders={sliders} />}

      {analysis.steps?.length > 0 && <DerivationSteps steps={analysis.steps} />}

      <div className="parts-grid">
        <div className="section-label">{subExprLabel}</div>
        {analysis.parts.map((part, i) => (
          <PartCard key={i} part={part} index={i} />
        ))}
      </div>

      <ChatSection />

      <div className="export-bar">
        <button className="btn-export" onClick={exportPdf}>
          {lang === 'sv' ? 'Exportera PDF' : 'Export PDF'}
        </button>
        <button className="btn-export" onClick={exportChat}>
          {lang === 'sv' ? 'Exportera chatt (.txt)' : 'Export chat (.txt)'}
        </button>
      </div>
    </div>
  )
}
