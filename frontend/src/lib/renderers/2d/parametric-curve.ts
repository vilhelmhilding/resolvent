import { makeFn } from '../../expr-compiler'
import { hidePlot, getCtx, niceTicks, fmtTick } from '../shared'
import type { Renderer } from '../types'

export const drawParametricCurve: Renderer = (canvas, params, color) => {
  if (!params?.x || !params?.y) { hidePlot(canvas); return }
  const { ctx, w, h } = getCtx(canvas)
  const cx = w / 2, cy = h / 2

  const TMIN = typeof params.tmin === 'number' ? params.tmin : 0
  const TMAX = typeof params.tmax === 'number' ? params.tmax : 6.2832
  const xFn  = makeFn(String(params.x), ['t'])
  const yFn  = makeFn(String(params.y), ['t'])

  const STEPS = 700
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
  const range = Math.max(maxX - minX, maxY - minY, 0.1) * 1.2
  const scale = Math.min(w, h) / range
  const toX = (px: number) => cx + (px - cX) * scale
  const toY = (py: number) => cy - (py - cY) * scale

  ctx.clearRect(0, 0, w, h)

  // axes
  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo(0, toY(0)); ctx.lineTo(w, toY(0))
  ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), h)
  ctx.stroke()
  ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px -apple-system, sans-serif'
  ctx.textAlign = 'right'; ctx.fillText('Re', w - 6, toY(0) - 7)
  ctx.textAlign = 'center'; ctx.fillText('Im', toX(0) + 13, 13)

  // Re ticks
  ctx.font = '9.5px -apple-system, sans-serif'; ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1
  for (const v of niceTicks(cX - range / 2, cX + range / 2)) {
    const px2 = toX(v); if (px2 < 0 || px2 > w) continue
    ctx.beginPath(); ctx.moveTo(px2, toY(0) - 3); ctx.lineTo(px2, toY(0) + 3); ctx.stroke()
    ctx.textAlign = 'center'; ctx.fillText(fmtTick(v), px2, toY(0) + 13)
  }
  // Im ticks
  for (const v of niceTicks(cY - range / 2, cY + range / 2)) {
    if (v === 0) continue
    const py2 = toY(v); if (py2 < 0 || py2 > h) continue
    ctx.beginPath(); ctx.moveTo(toX(0) - 3, py2); ctx.lineTo(toX(0) + 3, py2); ctx.stroke()
    ctx.textAlign = 'right'; ctx.fillText(fmtTick(v), toX(0) - 5, py2 + 3)
  }

  // subtle inner fill
  ctx.save()
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.4)
  grad.addColorStop(0, color + '12'); grad.addColorStop(1, color + '00')
  ctx.fillStyle = grad
  ctx.beginPath()
  let penDown = false
  for (let i = 0; i <= STEPS; i++) {
    if (isNaN(allPts[i].x) || isNaN(allPts[i].y)) { penDown = false; continue }
    const x = toX(allPts[i].x), y = toY(allPts[i].y)
    if (!penDown) { ctx.moveTo(x, y); penDown = true } else ctx.lineTo(x, y)
  }
  ctx.closePath(); ctx.fill()
  ctx.restore()

  // stroke with glow
  ctx.save()
  ctx.shadowColor = color + '50'; ctx.shadowBlur = 7
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath()
  penDown = false
  for (let i = 0; i <= STEPS; i++) {
    if (isNaN(allPts[i].x) || isNaN(allPts[i].y)) { penDown = false; continue }
    const x = toX(allPts[i].x), y = toY(allPts[i].y)
    if (!penDown) { ctx.moveTo(x, y); penDown = true } else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}
