'use client'
import { useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { useAnimation } from '@/hooks/useAnimation'
import type { Slider } from '@/types/analysis'

interface Props {
  sliders: Slider[]
}

export function AnimControls({ sliders }: Props) {
  const isAnimating  = useStore(s => s.isAnimating)
  const params       = useStore(s => s.params)
  const animConfig   = useStore(s => s.animConfig)
  const animSpeed    = useStore(s => s.animSpeed)
  const setAnimSpeed = useStore(s => s.setAnimSpeed)
  const { toggle, seek, getPos, stop } = useAnimation()

  const scrubRef  = useRef<HTMLInputElement>(null)
  const isDragging = useRef(false)

  // Drive the scrubber imperatively so RAF and user drag never fight
  useEffect(() => {
    let raf: number
    function tick() {
      if (!isDragging.current && scrubRef.current) {
        scrubRef.current.value = String(Math.round(getPos() * 1000))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getPos])

  const hasK = sliders.some(s => s.name === 'k')
  const hasT = sliders.some(s => s.name === 't')
  const kmax = animConfig.kmax ?? 30
  const tmin = animConfig.tmin ?? 0
  const tmax = animConfig.tmax ?? (2 * Math.PI)

  const kDisplay = Math.round(params.k)
  const tDisplay = params.t.toFixed(tmax - tmin > 10 ? 1 : 2)

  const valueLabel = hasK && hasT
    ? `k = ${kDisplay}  ·  t = ${tDisplay}`
    : hasK ? `k = ${kDisplay}`
    : hasT ? `t = ${tDisplay}`
    : ''

  const speeds = [0.5, 1, 2, 4]

  return (
    <div className="anim-controls-full">
      <div className="anim-value-label">{valueLabel}</div>
      <div className="anim-row">
        <button className="play-btn" onClick={toggle} aria-label={isAnimating ? 'Pause' : 'Play'}>
          {isAnimating
            ? <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><rect x="2" y="2" width="4" height="12" rx="1"/><rect x="10" y="2" width="4" height="12" rx="1"/></svg>
            : <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><polygon points="3,2 14,8 3,14"/></svg>
          }
        </button>
        <input
          ref={scrubRef}
          type="range"
          className="anim-scrubber"
          min={0} max={1000} step={1}
          defaultValue={0}
          onPointerDown={() => { isDragging.current = true; stop() }}
          onPointerUp={() => { isDragging.current = false }}
          onChange={e => seek(Number(e.target.value) / 1000)}
        />
        <div className="anim-speed-btns">
          {speeds.map(s => (
            <button
              key={s}
              className={`speed-btn${animSpeed === s ? ' active' : ''}`}
              onClick={() => setAnimSpeed(s)}
            >
              {s === 0.5 ? '½×' : `${s}×`}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
