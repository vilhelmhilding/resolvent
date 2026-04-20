import { makeFn } from '../../expr-compiler'
import { hidePlot, getCtx, drawDotMarker, fmtTick, niceTicks } from '../shared'
import { project3D, draw3DAxes } from './camera'
import type { Renderer } from '../types'
import type { Camera } from './camera'

export function makeSpiralSum3D(cam: Camera): Renderer {
  return (canvas, params, color, anim) => {
    if (!params) { hidePlot(canvas); return }
    const trRaw = (params.term_real ?? params.real) as string | undefined
    const tiRaw = (params.term_imag ?? params.imag) as string | undefined
    if (!trRaw || !tiRaw) { hidePlot(canvas); return }

    const { ctx, w, h } = getCtx(canvas)
    ctx.clearRect(0, 0, w, h)

    const k     = Math.round(anim.k), KMAX = 50, t_sp3 = anim.t
    const reFn  = makeFn(trRaw, ['k', 't']), imFn = makeFn(tiRaw, ['k', 't'])
    const pts: { re: number; im: number }[] = [{ re: 0, im: 0 }]
    for (let kk = 1; kk <= KMAX; kk++) {
      const last = pts[pts.length - 1]
      let dr = 0, di = 0
      try { dr = reFn(kk, t_sp3); di = imFn(kk, t_sp3) } catch { /* keep 0 */ }
      pts.push({ re: last.re + (isFinite(dr) ? dr : 0), im: last.im + (isFinite(di) ? di : 0) })
    }
    let maxR = 0
    pts.forEach(p => { const m = Math.hypot(p.re, p.im); if (m > maxR) maxR = m })
    const sc = maxR > 0 ? 1.0 / (maxR * 1.1) : 1
    const toY = (i: number) => (i / KMAX) * 1.8 - 0.9

    const scTick = maxR > 0 ? (1.0 / 1.1) : 1  // value at sc=1 in data space
    const reImRange = scTick > 0 ? scTick : 1
    const reImTicks = niceTicks(-reImRange, reImRange).map(v => ({ norm: v * sc, label: fmtTick(v) }))
    const kTicksSS  = [5, 10, 20, 30].map(k => ({ norm: toY(k), label: String(k) }))
    draw3DAxes(ctx, w, h, cam, 'Re', 'k', 'Im', [0, 0, 0], { x: reImTicks, y: kTicksSS, z: reImTicks })

    ctx.save()
    ctx.strokeStyle = color + '18'; ctx.lineWidth = 1.1; ctx.beginPath()
    for (let i = 0; i <= KMAX; i++) {
      const { sx, sy } = project3D(pts[i].re * sc, toY(i), pts[i].im * sc, w, h, cam)
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.shadowColor = color + '50'; ctx.shadowBlur = 7
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath()
    for (let i = 0; i <= Math.min(k, KMAX); i++) {
      const { sx, sy } = project3D(pts[i].re * sc, toY(i), pts[i].im * sc, w, h, cam)
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()

    if (k >= 0 && k <= KMAX) {
      const { sx, sy } = project3D(pts[k].re * sc, toY(k), pts[k].im * sc, w, h, cam)
      drawDotMarker(ctx, sx, sy, color, 6.5)
    }
  }
}
