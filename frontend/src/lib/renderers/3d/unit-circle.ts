import { makeFn } from '../../expr-compiler'
import { hidePlot, getCtx, drawDotMarker, fmtTick } from '../shared'
import { project3D, draw3DAxes } from './camera'
import type { Renderer } from '../types'
import type { Camera } from './camera'

export function makeUnitCircle3D(cam: Camera): Renderer {
  return (canvas, params, color, anim) => {
    if (!params?.real || !params?.imag) { hidePlot(canvas); return }
    const { ctx, w, h } = getCtx(canvas)
    const t3  = anim.t
    const rf  = makeFn(String(params.real), ['k', 't'])
    const imf = makeFn(String(params.imag), ['k', 't'])
    const hasK = /\bk\b/.test(String(params.real)) || /\bk\b/.test(String(params.imag))
    const hasT = /\bt\b/.test(String(params.real)) || /\bt\b/.test(String(params.imag))
    const isStatic = !hasT && (!hasK || Math.hypot(rf(1.5, t3) - rf(1, t3), imf(1.5, t3) - imf(1, t3)) < 0.001)
    ctx.clearRect(0, 0, w, h)
    const KMAX3 = 30
    const reImTicks = [-1, -0.5, 0.5, 1].map(v => ({ norm: v, label: fmtTick(v) }))
    const kTicks    = [5, 10, 20, 30].map(k => ({ norm: (k - 1) / (KMAX3 - 1) * 1.8 - 0.9, label: String(k) }))

    if (isStatic) {
      draw3DAxes(ctx, w, h, cam, 'Re', '', 'Im', [0, 0, 0], { x: reImTicks, z: reImTicks })
      const re0 = rf(1, t3), im0 = imf(1, t3)
      // unit circle ring
      ctx.save()
      ctx.strokeStyle = color + '20'; ctx.lineWidth = 1; ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const a = (2 * Math.PI * i) / 60
        const { sx, sy } = project3D(Math.cos(a), 0, Math.sin(a), w, h, cam)
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
      }
      ctx.stroke()
      ctx.restore()
      const p0 = project3D(0, 0, 0, w, h, cam), p1 = project3D(re0, 0, im0, w, h, cam)
      ctx.save()
      ctx.shadowColor = color + '55'; ctx.shadowBlur = 7
      ctx.strokeStyle = color; ctx.lineWidth = 2.2
      ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke()
      ctx.restore()
      drawDotMarker(ctx, p1.sx, p1.sy, color, 5.5)
      return
    }

    const k = anim.k, KMAX = 30, STEPS = 300
    const toY = (kk: number) => (kk - 1) / (KMAX - 1) * 1.8 - 0.9
    const tForK = hasT && !hasK
    const evalUC3 = (kk: number): [number, number] => tForK
      ? [rf(0, (kk / KMAX) * 2 * Math.PI), imf(0, (kk / KMAX) * 2 * Math.PI)]
      : [rf(kk, t3), imf(kk, t3)]

    draw3DAxes(ctx, w, h, cam, 'Re', 'k', 'Im', [0, 0, 0], { x: reImTicks, y: kTicks, z: reImTicks })

    ctx.save()
    ctx.strokeStyle = color + '20'; ctx.lineWidth = 1.2; ctx.beginPath()
    for (let i = 0; i <= STEPS; i++) {
      const kk = 1 + (KMAX - 1) * i / STEPS
      const [re, im] = evalUC3(kk)
      const { sx, sy } = project3D(re, toY(kk), im, w, h, cam)
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.shadowColor = color + '50'; ctx.shadowBlur = 6
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath()
    for (let i = 0; i <= STEPS; i++) {
      const kk = 1 + (k - 1) * i / STEPS
      const [re, im] = evalUC3(kk)
      const { sx, sy } = project3D(re, toY(kk), im, w, h, cam)
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()

    const [dotRe, dotIm] = evalUC3(k)
    const origin = project3D(0, toY(k), 0, w, h, cam)
    const tip    = project3D(dotRe, toY(k), dotIm, w, h, cam)
    // phasor arm at current k level
    ctx.save()
    ctx.strokeStyle = color + 'cc'; ctx.lineWidth = 1.8; ctx.setLineDash([3, 4])
    ctx.beginPath(); ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(tip.sx, tip.sy); ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
    drawDotMarker(ctx, tip.sx, tip.sy, color, 6)
  }
}
