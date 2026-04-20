import { makeFn } from '../../expr-compiler'
import { clearAndAxes, hidePlot, stableVizRange, drawDotMarker } from '../shared'
import type { Renderer } from '../types'

export const drawComplexPoint: Renderer = (canvas, params, color, anim, animConfig) => {
  if (!params?.real || !params?.imag) { hidePlot(canvas); return }
  const { ctx, w, h } = clearAndAxes(canvas, 'Re', 'Im')
  const cx = w / 2, cy = h / 2
  const KMAX = 30

  const t_cp = anim.t
  const reFn  = makeFn(String(params.real), ['k', 't'])
  const imFn  = makeFn(String(params.imag), ['k', 't'])

  const usesT  = /\bt\b/.test(String(params.real)) || /\bt\b/.test(String(params.imag))
  const maxMag = usesT
    ? stableVizRange(canvas, `cp|${params.real}|${params.imag}`, () => {
        const tA = animConfig.tmin ?? 0, tB = animConfig.tmax ?? (2 * Math.PI)
        let mx = 0
        for (let ti = 0; ti < 8; ti++) {
          const ts = tA + (ti / 7) * (tB - tA)
          for (let kk = 1; kk <= KMAX; kk++) {
            const m = Math.hypot(reFn(kk, ts), imFn(kk, ts))
            if (m > mx) mx = m
          }
        }
        return mx
      })
    : (() => {
        let mx = 0
        for (let kk = 1; kk <= KMAX; kk++) {
          const m = Math.hypot(reFn(kk, t_cp), imFn(kk, t_cp))
          if (m > mx) mx = m
        }
        return mx
      })()

  const scale = (Math.min(w, h) * 0.4) / (maxMag * 1.1 || 1)

  const hasK = /\bk\b/.test(String(params.real)) || /\bk\b/.test(String(params.imag))
  const hasT = /\bt\b/.test(String(params.real)) || /\bt\b/.test(String(params.imag))
  const re1 = reFn(1, t_cp), im1 = imFn(1, t_cp)
  const isStatic = !hasT && (!hasK || Math.hypot(reFn(30, t_cp) - re1, imFn(30, t_cp) - im1) < 0.001)

  if (isStatic) {
    const px = cx + re1 * scale, py = cy - im1 * scale
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
  const STEPS = 300

  // faint trace
  ctx.save()
  ctx.strokeStyle = color + '40'; ctx.lineWidth = 1.3; ctx.beginPath()
  for (let i = 0; i <= STEPS; i++) {
    const kk = 1 + (k - 1) * i / STEPS
    const x = cx + reFn(kk, t_cp) * scale, y = cy - imFn(kk, t_cp) * scale
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // phasor arm
  const px = cx + reFn(k, t_cp) * scale, py = cy - imFn(k, t_cp) * scale
  ctx.save()
  ctx.strokeStyle = color + 'cc'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4])
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
  ctx.save()
  ctx.shadowColor = color + '55'; ctx.shadowBlur = 5
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
  ctx.restore()
  drawDotMarker(ctx, px, py, color, 5.5)
}
