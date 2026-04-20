import { makeFn } from '../../expr-compiler'
import { hidePlot, getCtx, drawDotMarker, fmtTick } from '../shared'
import { project3D, draw3DAxes } from './camera'
import type { Renderer } from '../types'
import type { Camera } from './camera'

export function makeComplexPoint3D(cam: Camera): Renderer {
  return (canvas, params, color, anim) => {
    if (!params?.real || !params?.imag) { hidePlot(canvas); return }
    const { ctx, w, h } = getCtx(canvas)
    const t3  = anim.t
    const rf  = makeFn(String(params.real), ['k', 't'])
    const imf = makeFn(String(params.imag), ['k', 't'])
    const hasK = /\bk\b/.test(String(params.real)) || /\bk\b/.test(String(params.imag))
    const hasT = /\bt\b/.test(String(params.real)) || /\bt\b/.test(String(params.imag))
    const isStatic = !hasT && (!hasK || Math.hypot(rf(30, t3) - rf(1, t3), imf(30, t3) - imf(1, t3)) < 0.001)
    ctx.clearRect(0, 0, w, h)

    const reImTicks = [-1, -0.5, 0.5, 1].map(v => ({ norm: v, label: fmtTick(v) }))
    const kTicksCP  = [5, 10, 20, 30].map(k => ({ norm: (k - 1) / 29 * 1.8 - 0.9, label: String(k) }))

    if (isStatic) {
      draw3DAxes(ctx, w, h, cam, 'Re', '', 'Im', [0, 0, 0], { x: reImTicks, z: reImTicks })
      const re0 = rf(1, t3), im0 = imf(1, t3)
      const mag = Math.hypot(re0, im0) || 1, sc = 0.8 / mag
      const p0 = project3D(0, 0, 0, w, h, cam), p1 = project3D(re0 * sc, 0, im0 * sc, w, h, cam)
      ctx.save()
      ctx.strokeStyle = color + 'aa'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
      ctx.save()
      ctx.shadowColor = color + '55'; ctx.shadowBlur = 7
      ctx.strokeStyle = color; ctx.lineWidth = 2.2
      ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke()
      ctx.restore()
      drawDotMarker(ctx, p1.sx, p1.sy, color, 5.5)
      return
    }

    const k = anim.k, KMAX = 30, STEPS = 300
    let maxMag = 0
    for (let kk = 1; kk <= KMAX; kk++) maxMag = Math.max(maxMag, Math.hypot(rf(kk, t3), imf(kk, t3)))
    const sc = maxMag > 0 ? 1.0 / (maxMag * 1.1) : 1
    const toY = (kk: number) => (kk - 1) / (KMAX - 1) * 1.8 - 0.9

    draw3DAxes(ctx, w, h, cam, 'Re', 'k', 'Im', [0, 0, 0], { x: reImTicks, y: kTicksCP, z: reImTicks })

    ctx.save()
    ctx.strokeStyle = color + '22'; ctx.lineWidth = 1.3; ctx.beginPath()
    for (let i = 0; i <= STEPS; i++) {
      const kk = 1 + (KMAX - 1) * i / STEPS
      const { sx, sy } = project3D(rf(kk, t3) * sc, toY(kk), imf(kk, t3) * sc, w, h, cam)
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.shadowColor = color + '50'; ctx.shadowBlur = 7
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath()
    for (let i = 0; i <= STEPS; i++) {
      const kk = 1 + (k - 1) * i / STEPS
      const { sx, sy } = project3D(rf(kk, t3) * sc, toY(kk), imf(kk, t3) * sc, w, h, cam)
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()

    const { sx, sy } = project3D(rf(k, t3) * sc, toY(k), imf(k, t3) * sc, w, h, cam)
    drawDotMarker(ctx, sx, sy, color, 5.5)
  }
}
