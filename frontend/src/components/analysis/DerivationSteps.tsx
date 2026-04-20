'use client'
import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import { typesetElement } from '@/hooks/useMathJax'
import type { DerivationStep } from '@/types/analysis'

interface Props {
  steps: DerivationStep[]
}

export function DerivationSteps({ steps }: Props) {
  const lang = useStore(s => s.lang)
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && bodyRef.current) {
      typesetElement(bodyRef.current).then(() => {
        if (!bodyRef.current) return
        bodyRef.current.querySelectorAll<HTMLElement>('.derivation-step-latex').forEach(cell => {
          const mjx = cell.querySelector<HTMLElement>('mjx-container')
          if (!mjx) return
          mjx.style.zoom = ''
          const avail = cell.clientWidth - 8
          if (mjx.scrollWidth > avail) mjx.style.zoom = String(avail / mjx.scrollWidth)
        })
      })
    }
  }, [open, lang])

  if (!steps.length) return null

  const heading = lang === 'sv' ? 'Härledning steg för steg' : 'Step-by-step breakdown'
  const toggleLabel = open
    ? (lang === 'sv' ? 'Dölj' : 'Hide')
    : (lang === 'sv' ? 'Visa' : 'Show')

  return (
    <div className="derivation-section">
      <button className="derivation-toggle" onClick={() => setOpen(o => !o)}>
        <span className="derivation-heading">{heading}</span>
        <span className="derivation-toggle-label">{toggleLabel} {open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="derivation-body" ref={bodyRef}>
          {steps.map((step, i) => (
            <div className="derivation-step" key={i}>
              <div className="derivation-step-num">{i + 1}</div>
              <div className="derivation-step-content">
                <div className="derivation-step-latex">$${step.latex}$$</div>
                <div className="derivation-step-note">{step.note[lang]}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
