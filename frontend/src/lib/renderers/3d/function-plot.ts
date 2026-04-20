import { makeFn } from '../../expr-compiler'
import { stablePlotRange, hidePlot, getCtx, niceTicks, fmtTick } from '../shared'
import { project3D, draw3DAxes } from './camera'
import type { Renderer } from '../types'
import type { Camera } from './camera'

export function makeFunctionPlot3D(cam: Camera): Renderer {
  return (canvas, params, color, anim, animConfig) => {
    if (!params?.expr) { hidePlot(canvas); return }
    const { ctx, w, h } = getCtx(canvas)
    ctx.clearRect(0, 0, w, h)

    const expr = String(params.expr)
    const xmin = typeof params.xmin === 'number' ? params.xmin : -5
    const xmax = typeof params.xmax === 'number' ? params.xmax : 5
    const fn   = makeFn(expr, ['x', 't', 'k'])
    const tCur = anim.t, k = anim.k

    const usesX     = /\bx\b/.test(expr)
    const usesT     = /\bt\b/.test(expr)
    const swapTforX = !usesX && usesT

    const range = stablePlotRange(canvas, params, fn, animConfig)
    if (!range) { hidePlot(canvas); return }
    const { ymin: yRangeMin, ymax: yRangeMax } = range
    const yRangeSpan = Math.max(yRangeMax - yRangeMin, 0.001)

    const xnorm = (x3: number) => (x3 - xmin) / (xmax - xmin) * 2 - 1
    const ynorm = (y3: number) => Math.max(-1.0, Math.min(1.0, ((y3 - yRangeMin) / yRangeSpan) * 2 - 1))
    const y0norm = (yRangeMin <= 0 && yRangeMax >= 0)
      ? Math.max(-1.0, Math.min(1.0, ((0 - yRangeMin) / yRangeSpan) * 2 - 1))
      : (yRangeMin > 0 ? -1.0 : 1.0)
    const x0norm = (xmin <= 0 && xmax >= 0)
      ? Math.max(-1.0, Math.min(1.0, xnorm(0)))
      : (xmax < 0 ? 1.0 : -1.0)
    const XS = 300, DISC = 1.4

    const xTicks = niceTicks(xmin, xmax).map(v => ({ norm: xnorm(v), label: fmtTick(v) }))
    const yTicks = niceTicks(yRangeMin, yRangeMax).map(v => ({ norm: ynorm(v), label: fmtTick(v) }))
    draw3DAxes(ctx, w, h, cam, 'x', 'f', 'z', [x0norm, y0norm, 0], { x: xTicks, y: yTicks })

    // Always draw the single curve at current t (or swapped x) — continuous, no history
    const tEval = swapTforX ? 0 : tCur
    ctx.save()
    ctx.shadowColor = color + '60'; ctx.shadowBlur = 7
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'
    ctx.beginPath(); let pen = false; let prevY = NaN
    let tipXn = NaN, tipYn = NaN, tipVal = NaN
    for (let i = 0; i <= XS; i++) {
      const xv = xmin + (i / XS) * (xmax - xmin)
      const xArg = swapTforX ? 0 : xv
      const tArg = swapTforX ? xv : tEval
      if (swapTforX && xv > Math.min(tCur, xmax)) break
      let y: number; try { y = fn(xArg, tArg, k) } catch { y = NaN }
      if (!isFinite(y)) { pen = false; prevY = NaN; continue }
      const yn = ynorm(y)
      if (pen && !isNaN(prevY) && Math.abs(yn - prevY) > DISC) pen = false
      prevY = yn
      const { sx, sy } = project3D(xnorm(xv), yn, 0, w, h, cam)
      if (!pen) { ctx.moveTo(sx, sy); pen = true } else ctx.lineTo(sx, sy)
      tipXn = xnorm(xv); tipYn = yn; tipVal = y
    }
    ctx.stroke()
    ctx.restore()

    // Value label at curve tip
    if (isFinite(tipVal) && isFinite(tipXn)) {
      const { sx, sy } = project3D(tipXn, tipYn, 0, w, h, cam)
      const valStr = Math.abs(tipVal) < 0.001 || Math.abs(tipVal) >= 10000
        ? tipVal.toExponential(2)
        : parseFloat(tipVal.toPrecision(3)).toString()
      ctx.save()
      ctx.fillStyle = color
      ctx.font = 'bold 10.5px -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(valStr, sx + 5, sy - 5)
      ctx.restore()
    }
  }
}
