'use client'
import { useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { registerCanvas, unregisterCanvas } from '@/lib/canvas-registry'
import { drawers2D, buildDrawers3D } from '@/lib/renderers'
import type { Camera } from '@/lib/renderers/3d/camera'
import type { RendererMap } from '@/lib/renderers/types'

interface Props {
  id: string
  type: string
  vizParams: Record<string, unknown>
  color: string
  width: number
  height: number
  className?: string
  onMouseDown?: (e: React.MouseEvent) => void
  onTouchStart?: (e: React.TouchEvent) => void
}

export function VizCanvas({ id, type, vizParams, color, width, height, className, onMouseDown, onTouchStart }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const camCacheRef = useRef<Camera | null>(null)
  const mapCacheRef = useRef<RendererMap | null>(null)
  const drawFnRef   = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // HiDPI: size the backing buffer to physical pixels, CSS keeps logical size
    const dpr = window.devicePixelRatio || 1
    canvas.width  = Math.round(width  * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.dataset.w = String(width)
    canvas.dataset.h = String(height)

    const drawFn = () => {
      if (!canvas) return
      const { params, is3D, cam3d, animConfig } = useStore.getState()
      let drawMap: RendererMap
      if (is3D) {
        if (cam3d !== camCacheRef.current) {
          mapCacheRef.current = buildDrawers3D(cam3d)
          camCacheRef.current = cam3d
        }
        drawMap = mapCacheRef.current!
      } else {
        drawMap = drawers2D
      }
      const drawer = drawMap[type]
      if (drawer) {
        try { drawer(canvas, vizParams, color, params, animConfig) }
        catch (e) { console.warn('[resolvent] draw error:', e) }
      }
    }

    drawFnRef.current = drawFn
    registerCanvas(id, drawFn)
    drawFn()

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) registerCanvas(id, drawFn)
        else unregisterCanvas(id)
      },
      { rootMargin: '200px' },
    )
    obs.observe(canvas)

    return () => {
      obs.disconnect()
      unregisterCanvas(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type, color, width, height, JSON.stringify(vizParams)])

  // Redraw immediately whenever 2D/3D mode switches
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      if (state.is3D !== prev.is3D) drawFnRef.current?.()
    })
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: '100%', maxWidth: width, height: 'auto', aspectRatio: `${width}/${height}` }}
      data-viz-type={type}
      className={className}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    />
  )
}
