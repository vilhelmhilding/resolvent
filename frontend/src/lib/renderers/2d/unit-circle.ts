import { makeFn } from '../../expr-compiler'
import { clearAndAxes, hidePlot, drawDotMarker } from '../shared'
import type { Renderer } from '../types'

export const drawUnitCircle: Renderer = (canvas, params, color, anim) => {
  if (!params?.real || !params?.imag) { hidePlot(canvas); return }
  const { ctx, w, h } = clearAndAxes(canvas, 'Re', 'Im')
  const cx = w / 2, cy = h / 2
  const r  = Math.min(w, h) * 0.36

  // axis ticks at ±0.5 and ±1
  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1
  ctx.fillStyle = '#94a3b8'; ctx.font = '9.5px -apple-system, sans-serif'
  for (const v of [-1, -0.5, 0.5, 1]) {
    const px2 = cx + v * r, py2 = cy - v * r
    ctx.beginPath(); ctx.moveTo(px2, cy - 3); ctx.lineTo(px2, cy + 3); ctx.stroke()
    ctx.textAlign = 'center'; ctx.fillText(String(v), px2, cy + 13)
    ctx.beginPath(); ctx.moveTo(cx - 3, py2); ctx.lineTo(cx + 3, py2); ctx.stroke()
    if (v !== 0) { ctx.textAlign = 'right'; ctx.fillText(String(v), cx - 5, py2 + 3) }
  }
  const KMAX = 30

  const t_uc = anim.t
  const reFn  = makeFn(String(params.real), ['k', 't'])
  const imFn  = makeFn(String(params.imag), ['k', 't'])

  // unit circle — subtle dashed ring
  ctx.save()
  ctx.strokeStyle = color + '22'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4])
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  const hasK = /\bk\b/.test(String(params.real)) || /\bk\b/.test(String(params.imag))
  const hasT = /\bt\b/.test(String(params.real)) || /\bt\b/.test(String(params.imag))
  const re1 = reFn(1, t_uc), im1 = imFn(1, t_uc)
  const isStatic = !hasT && (!hasK || Math.hypot(reFn(1.5, t_uc) - re1, imFn(1.5, t_uc) - im1) < 0.001)

  if (isStatic) {
    const px = cx + re1 * r, py = cy - im1 * r
    ctx.save()
    ctx.strokeStyle = color + 'aa'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4])
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
    ctx.strokeStyle = color; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
    drawDotMarker(ctx, px, py, color, 5)
    return
  }

  const k = anim.k
  const tForK = hasT && !hasK
  const evalAt = (kk: number): [number, number] => tForK
    ? [reFn(0, (kk / KMAX) * 2 * Math.PI), imFn(0, (kk / KMAX) * 2 * Math.PI)]
    : [reFn(kk, t_uc), imFn(kk, t_uc)]

  const STEPS = 300

  // ghost trail
  ctx.save()
  ctx.strokeStyle = color + '18'; ctx.lineWidth = 1.2; ctx.beginPath()
  for (let i = 0; i <= STEPS; i++) {
    const [re, im] = evalAt(k + (KMAX - k) * i / STEPS)
    const x = cx + re * r, y = cy - im * r
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // active path
  ctx.save()
  ctx.shadowColor = color + '55'; ctx.shadowBlur = 5
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath()
  for (let i = 0; i <= STEPS; i++) {
    const [re, im] = evalAt(1 + (k - 1) * i / STEPS)
    const x = cx + re * r, y = cy - im * r
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // phasor arm + tip
  const [pRe, pIm] = evalAt(k)
  const px = cx + pRe * r, py = cy - pIm * r
  ctx.save()
  ctx.strokeStyle = color + 'cc'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4])
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
  drawDotMarker(ctx, px, py, color, 5.5)
}
