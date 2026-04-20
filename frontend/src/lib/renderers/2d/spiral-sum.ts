import { makeFn } from '../../expr-compiler'
import { hidePlot, getCtx, drawDotMarker, niceTicks, fmtTick } from '../shared'
import type { Renderer } from '../types'

export const drawSpiralSum: Renderer = (canvas, params, color, anim) => {
  if (!params) { hidePlot(canvas); return }
  const trRaw = (params.term_real ?? params.real) as string | undefined
  const tiRaw = (params.term_imag ?? params.imag) as string | undefined
  if (!trRaw || !tiRaw) { hidePlot(canvas); return }

  const { ctx, w, h } = getCtx(canvas)
  const cx = w / 2, cy = h / 2
  const k      = Math.round(anim.k)
  const t_sp   = anim.t
  const reFn   = makeFn(trRaw, ['k', 't'])
  const imFn   = makeFn(tiRaw, ['k', 't'])

  const KMAX = 50
  const points: { re: number; im: number }[] = [{ re: 0, im: 0 }]
  for (let kk = 1; kk <= KMAX; kk++) {
    const last = points[points.length - 1]
    let dr = 0, di = 0
    try { dr = reFn(kk, t_sp); di = imFn(kk, t_sp) } catch { /* keep 0 */ }
    points.push({ re: last.re + (isFinite(dr) ? dr : 0), im: last.im + (isFinite(di) ? di : 0) })
  }

  let minRe = Infinity, maxRe = -Infinity, minIm = Infinity, maxIm = -Infinity
  points.forEach(p => {
    if (p.re < minRe) minRe = p.re; if (p.re > maxRe) maxRe = p.re
    if (p.im < minIm) minIm = p.im; if (p.im > maxIm) maxIm = p.im
  })
  const cRe = (minRe + maxRe) / 2, cIm = (minIm + maxIm) / 2
  const range = Math.max(maxRe - minRe, maxIm - minIm, 0.1) * 1.3
  const scale = Math.min(w, h) / range
  const toX = (re: number) => cx + (re - cRe) * scale
  const toY = (im: number) => cy - (im - cIm) * scale

  ctx.clearRect(0, 0, w, h)

  // axes
  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, toY(0)); ctx.lineTo(w, toY(0))
  ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), h)
  ctx.stroke()
  ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px -apple-system, sans-serif'
  ctx.textAlign = 'right'; ctx.fillText('Re', w - 6, toY(0) - 7)
  ctx.textAlign = 'center'; ctx.fillText('Im', toX(0) + 13, 13)

  // Re/Im ticks
  ctx.font = '9.5px -apple-system, sans-serif'; ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1
  for (const v of niceTicks(cRe - range / 2, cRe + range / 2)) {
    const px2 = toX(v); if (px2 < 0 || px2 > w) continue
    ctx.beginPath(); ctx.moveTo(px2, toY(0) - 3); ctx.lineTo(px2, toY(0) + 3); ctx.stroke()
    ctx.textAlign = 'center'; ctx.fillText(fmtTick(v), px2, toY(0) + 13)
  }
  for (const v of niceTicks(cIm - range / 2, cIm + range / 2)) {
    if (v === 0) continue
    const py2 = toY(v); if (py2 < 0 || py2 > h) continue
    ctx.beginPath(); ctx.moveTo(toX(0) - 3, py2); ctx.lineTo(toX(0) + 3, py2); ctx.stroke()
    ctx.textAlign = 'right'; ctx.fillText(fmtTick(v), toX(0) - 5, py2 + 3)
  }

  // origin dot
  ctx.fillStyle = '#d1d5db'
  ctx.beginPath(); ctx.arc(toX(0), toY(0), 2.5, 0, 2 * Math.PI); ctx.fill()

  // ghost full path
  ctx.save()
  ctx.strokeStyle = color + '18'; ctx.lineWidth = 1.2; ctx.beginPath()
  for (let i = 0; i <= KMAX; i++) {
    const x = toX(points[i].re), y = toY(points[i].im)
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // active path with glow
  ctx.save()
  ctx.shadowColor = color + '45'; ctx.shadowBlur = 6
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath()
  for (let i = 0; i <= Math.min(k, KMAX); i++) {
    const x = toX(points[i].re), y = toY(points[i].im)
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // step dots
  for (let i = 1; i <= Math.min(k, KMAX); i++) {
    ctx.fillStyle = color + '70'
    ctx.beginPath(); ctx.arc(toX(points[i].re), toY(points[i].im), 2, 0, 2 * Math.PI); ctx.fill()
  }

  // tip marker
  if (k >= 1 && k <= KMAX) {
    drawDotMarker(ctx, toX(points[k].re), toY(points[k].im), color, 6)
  }
}
