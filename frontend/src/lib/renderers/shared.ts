import type { AnimConfig } from '@/types/analysis'

export interface PlotRange {
  key: string
  ymin: number
  ymax: number
  yMid: number
  ySpan: number
  p95: number
}

const plotRangeCache = new WeakMap<HTMLCanvasElement, PlotRange>()
const vizRangeCache  = new WeakMap<HTMLCanvasElement, { key: string; data: unknown }>()

export function stableVizRange<T>(canvas: HTMLCanvasElement, key: string, sampleFn: () => T): T {
  const c = vizRangeCache.get(canvas)
  if (c && c.key === key) return c.data as T
  const data = sampleFn()
  vizRangeCache.set(canvas, { key, data })
  return data
}

export function stablePlotRange(
  canvas: HTMLCanvasElement,
  params: Record<string, unknown>,
  fn: (...a: number[]) => number,
  animConfig: AnimConfig,
): PlotRange | null {
  const expr = String(params.expr ?? '')
  const xmin = typeof params.xmin === 'number' ? params.xmin : -5
  const xmax = typeof params.xmax === 'number' ? params.xmax : 5
  const usesX = /\bx\b/.test(expr)
  const usesT = /\bt\b/.test(expr)
  const usesK = /\bk\b/.test(expr)
  const swapTforX = !usesX && usesT

  const tMin = animConfig.tmin ?? 0
  const tMax = animConfig.tmax ?? (2 * Math.PI)
  const kMax = animConfig.kmax ?? 30

  const key = `${expr}|${xmin}|${xmax}|${usesT ? `${tMin}|${tMax}` : 'st'}|${usesK ? kMax : 'sk'}|${swapTforX ? 'sw' : ''}`
  const cached = plotRangeCache.get(canvas)
  if (cached && cached.key === key) return cached

  const XS = 120, TS = usesT && !swapTforX ? 8 : 1, KS = usesK ? 6 : 1
  const ys: number[] = []
  for (let ki = 0; ki < KS; ki++) {
    const k = usesK ? 1 + (ki / Math.max(KS - 1, 1)) * (kMax - 1) : 1
    for (let ti = 0; ti < TS; ti++) {
      const t = usesT && !swapTforX ? tMin + (ti / Math.max(TS - 1, 1)) * (tMax - tMin) : 0
      for (let xi = 0; xi <= XS; xi++) {
        const xv = xmin + (xi / XS) * (xmax - xmin)
        let y: number
        try { y = swapTforX ? fn(0, xv, k) : fn(xv, t, k) } catch { y = NaN }
        if (isFinite(y)) ys.push(y)
      }
    }
  }
  if (!ys.length) return null
  ys.sort((a, b) => a - b)
  const n = ys.length
  const p1  = ys[Math.max(0, Math.floor(n * 0.01))]
  const p99 = ys[Math.min(n - 1, Math.floor(n * 0.99))]
  const span = Math.max(Math.abs(p99 - p1), 0.001) * 1.5
  const mid  = (p1 + p99) / 2
  const result: PlotRange = { key, ymin: mid - span / 2, ymax: mid + span / 2, yMid: mid, ySpan: span, p95: p99 }
  plotRangeCache.set(canvas, result)
  return result
}

export function niceTicks(min: number, max: number, maxCount = 4): number[] {
  if (!isFinite(min) || !isFinite(max) || max <= min) return []
  const range = max - min
  const rawStep = range / maxCount
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const step = mag * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10)
  const start = Math.ceil(min / step + 1e-9) * step
  const ticks: number[] = []
  for (let v = start; v <= max - step * 0.01; v = Math.round((v + step) / step) * step) ticks.push(v)
  return ticks
}

export function fmtTick(v: number): string {
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e4 || (abs > 0 && abs < 0.01)) return v.toExponential(1)
  if (Number.isInteger(v)) return String(v)
  return parseFloat(v.toPrecision(2)).toString()
}

export function hidePlot(canvas: HTMLCanvasElement): void {
  const container = canvas.closest('.part-viz-container') ?? canvas.parentElement
  if (container) (container as HTMLElement).style.display = 'none'
  else canvas.style.display = 'none'
}

/** Set up HiDPI scaling and return CSS-coordinate context + dimensions. */
export function getCtx(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = window.devicePixelRatio || 1
  const w = canvas.dataset.w ? +canvas.dataset.w : canvas.width / dpr
  const h = canvas.dataset.h ? +canvas.dataset.h : canvas.height / dpr
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

/** Subtle background grid lines. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad: number,
  countX = 4,
  countY = 4,
): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.045)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let i = 1; i < countX; i++) {
    const x = pad + i * ((w - 2 * pad) / countX)
    ctx.moveTo(x, pad); ctx.lineTo(x, h - pad)
  }
  for (let j = 1; j < countY; j++) {
    const y = pad + j * ((h - 2 * pad) / countY)
    ctx.moveTo(pad, y); ctx.lineTo(w - pad, y)
  }
  ctx.stroke()
  ctx.restore()
}

/** Gradient-fill the area under/above the curve to the zero baseline. */
export function fillUnder(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
  color: string,
  baselineY: number,
  topY: number,
  h: number,
): void {
  const grad = ctx.createLinearGradient(0, topY, 0, Math.max(baselineY, topY + (h - topY) * 0.6))
  grad.addColorStop(0, color + '28')
  grad.addColorStop(1, color + '00')
  ctx.save()
  ctx.fillStyle = grad

  let segStart = -1
  for (let i = 0; i < pts.length; i++) {
    const { x, y } = pts[i]
    if (isNaN(y)) {
      if (segStart !== -1) {
        ctx.lineTo(pts[i - 1].x, baselineY)
        ctx.closePath(); ctx.fill()
        segStart = -1
      }
      continue
    }
    if (segStart === -1) {
      segStart = i
      ctx.beginPath()
      ctx.moveTo(x, baselineY)
      ctx.lineTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  if (segStart !== -1) {
    ctx.lineTo(pts[pts.length - 1].x, baselineY)
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}

/** Draw horizontal + vertical axes with optional labels. Returns {ctx, w, h}. */
export function clearAndAxes(
  canvas: HTMLCanvasElement,
  labX?: string,
  labY?: string,
): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const { ctx, w, h } = getCtx(canvas)
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2)
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h)
  ctx.stroke()
  if (labX || labY) {
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px -apple-system, sans-serif'
    if (labX) { ctx.textAlign = 'right'; ctx.fillText(labX, w - 6, h / 2 - 7) }
    if (labY) { ctx.textAlign = 'center'; ctx.fillText(labY, w / 2 + 13, 13) }
  }
  ctx.restore()
  return { ctx, w, h }
}

/** Dot with white ring — modern endpoint marker. */
export function drawDotMarker(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  color: string,
  r = 5,
): void {
  ctx.save()
  ctx.shadowColor = color + '50'
  ctx.shadowBlur = 6
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(px, py, r, 0, 2 * Math.PI); ctx.fill()
  ctx.restore()
  ctx.fillStyle = 'white'
  ctx.beginPath(); ctx.arc(px, py, r * 0.44, 0, 2 * Math.PI); ctx.fill()
}
