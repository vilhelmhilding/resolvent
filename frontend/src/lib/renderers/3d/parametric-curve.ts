import { makeFn } from '../../expr-compiler'
import { hidePlot, getCtx } from '../shared'
import { project3D, draw3DAxes } from './camera'
import type { Renderer } from '../types'
import type { Camera } from './camera'

export function makeParametricCurve3D(cam: Camera): Renderer {
  return (canvas, params, color) => {
    if (!params?.x || !params?.y) { hidePlot(canvas); return }
    const { ctx, w, h } = getCtx(canvas)
    ctx.clearRect(0, 0, w, h)

    const TMIN = typeof params.tmin === 'number' ? params.tmin : 0
    const TMAX = typeof params.tmax === 'number' ? params.tmax : 6.2832
    const xFn  = makeFn(String(params.x), ['t'])
    const yFn  = makeFn(String(params.y), ['t'])

    const STEPS = 500
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    const allPts: { x: number; y: number }[] = []
    for (let i = 0; i <= STEPS; i++) {
      const t = TMIN + (i / STEPS) * (TMAX - TMIN)
      let px: number, py: number
      try { px = xFn(t); py = yFn(t) } catch { px = NaN; py = NaN }
      allPts.push({ x: isFinite(px) ? px : NaN, y: isFinite(py) ? py : NaN })
      if (isFinite(px)) { minX = Math.min(minX, px); maxX = Math.max(maxX, px) }
      if (isFinite(py)) { minY = Math.min(minY, py); maxY = Math.max(maxY, py) }
    }
    const cX = (minX + maxX) / 2, cY = (minY + maxY) / 2
    const range = Math.max(maxX - minX, maxY - minY, 0.1) * 1.3
    const toX3  = (px: number) => (px - cX) / range * 2
    const toY3  = (py: number) => (py - cY) / range * 2

    draw3DAxes(ctx, w, h, cam, 'x', 'y', '')

    ctx.save()
    ctx.shadowColor = color + '55'; ctx.shadowBlur = 8
    ctx.strokeStyle = color; ctx.lineWidth = 2.2
    let pen = false; ctx.beginPath()
    for (let i = 0; i <= STEPS; i++) {
      if (isNaN(allPts[i].x) || isNaN(allPts[i].y)) { pen = false; continue }
      const { sx, sy } = project3D(toX3(allPts[i].x), toY3(allPts[i].y), 0, w, h, cam)
      if (!pen) { ctx.moveTo(sx, sy); pen = true } else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()
  }
}
