import { makeFn } from '../../expr-compiler'
import { stablePlotRange, hidePlot, getCtx, drawGrid, fillUnder, drawDotMarker, niceTicks, fmtTick } from '../shared'
import type { Renderer } from '../types'

export const drawFunctionPlot: Renderer = (canvas, params, color, anim, animConfig) => {
  if (!params?.expr) { hidePlot(canvas); return }

  const { ctx, w, h } = getCtx(canvas)
  const pad   = 42
  const plotW = w - 2 * pad
  const plotH = h - 2 * pad

  const expr  = String(params.expr)
  const xmin  = typeof params.xmin === 'number' ? params.xmin : -5
  const xmax  = typeof params.xmax === 'number' ? params.xmax : 5
  const STEPS = 400
  const fn    = makeFn(expr, ['x', 't', 'k'])
  const t     = anim.t
  const k     = anim.k

  const usesX     = /\bx\b/.test(expr)
  const swapTforX = !usesX && /\bt\b/.test(expr)

  const range = stablePlotRange(canvas, params, fn, animConfig)
  if (!range) { hidePlot(canvas); return }
  const { ymin, ymax, p95 } = range

  const pts: { x: number; y: number }[] = []
  for (let i = 0; i <= STEPS; i++) {
    const x = xmin + (i / STEPS) * (xmax - xmin)
    let y: number
    try { y = swapTforX ? fn(0, x, k) : fn(x, t, k) } catch { y = NaN }
    pts.push({ x, y: isFinite(y) ? y : NaN })
  }

  // In swapTforX mode, cut off the active portion at current t so the curve builds over time.
  const tCutoff = swapTforX ? Math.min(t, xmax) : xmax

  const toCanvasX = (x: number) => pad + ((x - xmin) / (xmax - xmin)) * plotW
  const toCanvasY = (y: number) => pad + plotH - ((y - ymin) / (ymax - ymin)) * plotH

  ctx.clearRect(0, 0, w, h)
  drawGrid(ctx, w, h, pad)

  // axes
  const ax0 = (ymin <= 0 && ymax >= 0) ? toCanvasY(0) : h - pad
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1
  ctx.beginPath()
  if (ymin <= 0 && ymax >= 0) { ctx.moveTo(pad, ax0); ctx.lineTo(w - pad, ax0) }
  if (xmin <= 0 && xmax >= 0) { const ax = toCanvasX(0); ctx.moveTo(ax, pad); ctx.lineTo(ax, h - pad) }
  ctx.stroke()

  // axis labels
  ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px -apple-system, sans-serif'
  ctx.textAlign = 'left';  ctx.fillText(fmtTick(xmin), pad, h - pad + 14)
  ctx.textAlign = 'right'; ctx.fillText(fmtTick(xmax), w - pad, h - pad + 14)
  ctx.textAlign = 'left';  ctx.fillText(fmtTick(p95), pad + 4, pad + 11)
  ctx.fillStyle = '#9ca3af'; ctx.font = 'italic 10.5px -apple-system, sans-serif'
  ctx.textAlign = 'right'; ctx.fillText('x', w - pad + 10, ax0 + 4)
  ctx.textAlign = 'left';  ctx.fillText('f', (xmin <= 0 && xmax >= 0) ? toCanvasX(0) + 4 : pad + 4, pad - 4)

  // x-axis ticks
  const xTicks2 = niceTicks(xmin, xmax)
  const xRange2 = xmax - xmin
  ctx.fillStyle = '#94a3b8'; ctx.font = '9.5px -apple-system, sans-serif'; ctx.textAlign = 'center'
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1
  for (const v of xTicks2) {
    if (Math.abs(v - xmin) < xRange2 * 0.08 || Math.abs(v - xmax) < xRange2 * 0.08) continue
    const cx2 = toCanvasX(v)
    ctx.beginPath(); ctx.moveTo(cx2, ax0 - 3); ctx.lineTo(cx2, ax0 + 3); ctx.stroke()
    ctx.fillText(fmtTick(v), cx2, ax0 + 13)
  }

  // y-axis ticks
  const yTicks2 = niceTicks(ymin, ymax)
  const yRange2 = ymax - ymin
  const yAxisX = (xmin <= 0 && xmax >= 0) ? toCanvasX(0) : pad
  ctx.textAlign = 'right'
  for (const v of yTicks2) {
    if (v === 0) continue
    if (Math.abs(v - ymax) < yRange2 * 0.08) continue
    const cy2 = toCanvasY(v)
    if (cy2 < pad || cy2 > h - pad) continue
    ctx.beginPath(); ctx.moveTo(yAxisX - 3, cy2); ctx.lineTo(yAxisX + 3, cy2); ctx.stroke()
    ctx.fillText(fmtTick(v), yAxisX - 5, cy2 + 3)
  }

  // clip all drawing to plot area
  ctx.save()
  ctx.beginPath()
  ctx.rect(pad, pad, plotW, plotH)
  ctx.clip()

  // fill under curve — ghost (full) in swapTforX mode, active (up to tCutoff) always
  const activePts = pts.map(p => ({
    x: toCanvasX(p.x),
    y: (isNaN(p.y) || p.y < ymin || p.y > ymax || p.x > tCutoff) ? NaN : toCanvasY(p.y),
  }))
  if (swapTforX) {
    // dim ghost fill for the full curve
    const ghostPts = pts.map(p => ({
      x: toCanvasX(p.x),
      y: isNaN(p.y) || p.y < ymin || p.y > ymax ? NaN : toCanvasY(p.y),
    }))
    ctx.save()
    ctx.globalAlpha = 0.12
    fillUnder(ctx, ghostPts, color, ax0, pad, h)
    ctx.restore()
  }
  fillUnder(ctx, activePts, color, ax0, pad, h)

  // ghost stroke in swapTforX mode
  if (swapTforX) {
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'
    ctx.beginPath()
    let gDown = false
    for (let i = 0; i <= STEPS; i++) {
      const { x, y } = pts[i]
      if (isNaN(y) || y < ymin || y > ymax) { gDown = false; continue }
      const cx2 = toCanvasX(x), cy2 = toCanvasY(y)
      if (!gDown) { ctx.moveTo(cx2, cy2); gDown = true } else ctx.lineTo(cx2, cy2)
    }
    ctx.stroke()
    ctx.restore()
  }

  // stroke active curve with glow
  ctx.save()
  ctx.shadowColor = color + '40'
  ctx.shadowBlur  = 6
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'
  ctx.beginPath()
  let penDown = false
  for (let i = 0; i <= STEPS; i++) {
    const { x, y } = pts[i]
    if (x > tCutoff || isNaN(y) || y < ymin || y > ymax) { penDown = false; continue }
    if (penDown && i > 0 && !isNaN(pts[i - 1].y)) {
      const dy = Math.abs(toCanvasY(y) - toCanvasY(pts[i - 1].y))
      if (dy > plotH * 0.4) penDown = false
    }
    const cx2 = toCanvasX(x), cy2 = toCanvasY(y)
    if (!penDown) { ctx.moveTo(cx2, cy2); penDown = true } else ctx.lineTo(cx2, cy2)
  }
  ctx.stroke()
  ctx.restore()

  // In swapTforX mode (t on x-axis): draw a moving dot at current t position.
  // Only when a t-slider is actually configured — if tmin is undefined the expression
  // probably used t instead of x by mistake and we shouldn't draw a confusing dot.
  if (swapTforX && animConfig.tmin !== undefined && t >= xmin && t <= xmax) {
    let dotY: number
    try { dotY = fn(0, t, k) } catch { dotY = NaN }
    if (isFinite(dotY) && dotY >= ymin && dotY <= ymax) {
      drawDotMarker(ctx, toCanvasX(t), toCanvasY(dotY), color)
    }
  }

  ctx.restore() // end clip
}
