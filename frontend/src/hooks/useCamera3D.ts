'use client'
import { useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { drawAll } from '@/lib/canvas-registry'

export function useCamera3D() {
  const drag = useRef<{ x0: number; y0: number; rx0: number; ry0: number } | null>(null)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!drag.current || !useStore.getState().is3D) return
      const { x0, y0, rx0, ry0 } = drag.current
      const rotY = ry0 + (e.clientX - x0) * 0.013
      const rotX = Math.max(-1.3, Math.min(1.3, rx0 - (e.clientY - y0) * 0.013))
      useStore.getState().setCam3d({ rotX, rotY })
      document.querySelectorAll<HTMLElement>('canvas[data-viz-type]').forEach(c => { c.style.cursor = 'grabbing' })
      drawAll()
    }

    const onMouseUp = () => {
      if (drag.current && useStore.getState().is3D) {
        document.querySelectorAll<HTMLElement>('canvas[data-viz-type]').forEach(c => { c.style.cursor = 'grab' })
      }
      drag.current = null
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!drag.current || !useStore.getState().is3D || !e.touches[0]) return
      e.preventDefault()
      const t0 = e.touches[0]
      const { x0, y0, rx0, ry0 } = drag.current
      const rotY = ry0 + (t0.clientX - x0) * 0.013
      const rotX = Math.max(-1.3, Math.min(1.3, rx0 - (t0.clientY - y0) * 0.013))
      useStore.getState().setCam3d({ rotX, rotY })
      drawAll()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', () => { drag.current = null })
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!useStore.getState().is3D) return
    const { cam3d } = useStore.getState()
    drag.current = { x0: e.clientX, y0: e.clientY, rx0: cam3d.rotX, ry0: cam3d.rotY }
    e.preventDefault()
  }

  const onCanvasTouchStart = (e: React.TouchEvent) => {
    if (!useStore.getState().is3D || !e.touches[0]) return
    e.preventDefault()
    const { cam3d } = useStore.getState()
    const t0 = e.touches[0]
    drag.current = { x0: t0.clientX, y0: t0.clientY, rx0: cam3d.rotX, ry0: cam3d.rotY }
  }

  return { onCanvasMouseDown, onCanvasTouchStart }
}
