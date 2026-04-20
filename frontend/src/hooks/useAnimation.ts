'use client'
import { useCallback } from 'react'
import { useStore } from '@/store'
import { drawAll } from '@/lib/canvas-registry'

const ANIM_PERIOD_MS = 7000

// Module-level singletons — all callers share one loop
let rafId:       number | null = null
let lastTick:    number        = 0
let animT:       number        = 0
let running:     boolean       = false

function step(now: number) {
  if (!running) return
  const dt = Math.min(now - lastTick, 100)
  lastTick = now

  const { animConfig, setParams, animSpeed } = useStore.getState()
  animT = (animT + (dt / ANIM_PERIOD_MS) * animSpeed) % 1

  const kmax = animConfig.kmax ?? 30
  const tmin = animConfig.tmin ?? 0
  const tmax = animConfig.tmax ?? (2 * Math.PI)

  setParams({ k: 1 + animT * (kmax - 1), t: tmin + animT * (tmax - tmin) })
  drawAll()
  rafId = requestAnimationFrame(step)
}

export function useAnimation() {
  const start = useCallback(() => {
    if (running) return
    running = true
    useStore.getState().setIsAnimating(true)
    lastTick = performance.now()
    rafId = requestAnimationFrame(step)
  }, [])

  const stop = useCallback(() => {
    running = false
    useStore.getState().setIsAnimating(false)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }, [])

  const toggle = useCallback(() => {
    if (running) stop(); else start()
  }, [start, stop])

  const seek = useCallback((pos: number) => {
    const clamped = Math.max(0, Math.min(1, pos))
    animT = clamped
    const { animConfig, setParams } = useStore.getState()
    const kmax = animConfig.kmax ?? 30
    const tmin = animConfig.tmin ?? 0
    const tmax = animConfig.tmax ?? (2 * Math.PI)
    setParams({ k: 1 + clamped * (kmax - 1), t: tmin + clamped * (tmax - tmin) })
    drawAll()
  }, [])

  const getPos = useCallback(() => animT, [])

  return { start, stop, toggle, seek, getPos }
}
