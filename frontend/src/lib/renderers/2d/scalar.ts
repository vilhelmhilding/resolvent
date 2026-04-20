import { makeFn } from '../../expr-compiler'
import { hidePlot, stableVizRange, getCtx, drawDotMarker, niceTicks, fmtTick } from '../shared'
import type { Renderer } from '../types'

function drawConstantPanel(ctx: CanvasRenderingContext2D, w: number, h: number, v0: number, color: string) {
  ctx.clearRect(0, 0, w, h)
  const padL = 54, padR = 16, padT = 18, padB = 28
  const plotH = h - padT - padB
  const absV = Math.abs(v0) || 1e-10
  const yMin = v0 >= 0 ? 0 : v0 * 2
  const yMax = v0 >= 0 ? v0 * 2 : 0
  const span = yMax - yMin || absV
  const toY  = (v: number) => padT + plotH - ((v - yMin) / span) * plotH
  const lineY = toY(v0), zeroY = toY(0)

  ctx.font = '10.5px -apple-system, sans-serif'
  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB)
  ctx.moveTo(padL, h - padB); ctx.lineTo(w - padR, h - padB)
  ctx.moveTo(padL, zeroY); ctx.lineTo(w - padR, zeroY)
  ctx.stroke()

  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo(padL - 4, lineY); ctx.lineTo(padL, lineY); ctx.stroke()
  const valStr = Math.abs(v0) < 0.001 || Math.abs(v0) >= 10000
    ? v0.toExponential(2) : parseFloat(v0.toPrecision(3)).toString()
  ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(valStr, padL - 6, lineY + 4)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('0', padL - 6, v0 >= 0 ? h - padB + 4 : padT + 8)
  ctx.textAlign = 'center'
  ctx.fillText('1', padL, h - padB + 14)
  ctx.fillText('30', w - padR, h - padB + 14)
  ctx.textAlign = 'left'; ctx.fillText('k', w - padR + 4, h - padB + 4)

  // gradient fill
  const grad = ctx.createLinearGradient(padL, lineY, padL, h - padB)
  grad.addColorStop(0, color + '30'); grad.addColorStop(1, color + '05')
  ctx.fillStyle = grad
  ctx.fillRect(padL, Math.min(lineY, zeroY), w - padR - padL, Math.abs(lineY - zeroY))

  ctx.save()
  ctx.shadowColor = color + '50'; ctx.shadowBlur = 5
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(padL, lineY); ctx.lineTo(w - padR, lineY); ctx.stroke()
  ctx.restore()
}

export const drawScalar: Renderer = (canvas, params, color, anim, animConfig) => {
  if (!params?.value) { hidePlot(canvas); return }
  const { ctx, w, h } = getCtx(canvas)
  const padding = 42, plotW = w - 2 * padding, plotH = h - 2 * padding

  const k    = anim.k, t_sc = anim.t
  const valFn = makeFn(String(params.value), ['k', 't'])
  const KMAX  = 30

  const values: number[] = []
  for (let kk = 1; kk <= KMAX; kk++) {
    let v: number; try { v = valFn(kk, t_sc) } catch { v = NaN }
    values.push(isFinite(v) ? v : NaN)
  }
  const valid = values.filter(v => !isNaN(v))
  if (!valid.length) { hidePlot(canvas); return }

  const minV = Math.min(...valid), maxV = Math.max(...valid)
  const spread  = maxV - minV
  const absAvg  = valid.reduce((s, v) => s + Math.abs(v), 0) / valid.length
  if (spread < 0.02 * (absAvg || 1)) { drawConstantPanel(ctx, w, h, valid[0], color); return }

  const usesT  = /\bt\b/.test(String(params.value))
  const allValid = usesT
    ? stableVizRange(canvas, `sc|${params.value}`, () => {
        const tA = animConfig.tmin ?? 0, tB = animConfig.tmax ?? (2 * Math.PI)
        const all: number[] = []
        for (let ti = 0; ti < 8; ti++) {
          const ts = tA + (ti / 7) * (tB - tA)
          for (let kk = 1; kk <= KMAX; kk++) {
            let v: number; try { v = valFn(kk, ts) } catch { v = NaN }
            if (isFinite(v)) all.push(v)
          }
        }
        return all.length ? all : valid
      })
    : valid

  const scMin = Math.min(...allValid), scMax = Math.max(...allValid)
  const allPos = allValid.every(v => v > 0), allNeg = allValid.every(v => v < 0)
  const useLog = (allPos || allNeg) && (Math.max(...allValid.map(Math.abs)) / Math.min(...allValid.map(Math.abs)) > 1000)

  let plotVals: number[], yLo: number, yHi: number
  if (useLog) {
    plotVals = values.map(v => isNaN(v) ? NaN : (allPos ? Math.log10(v) : -Math.log10(-v)))
    const pv = plotVals.filter(v => !isNaN(v))
    yLo = Math.min(...pv); yHi = Math.max(...pv)
    const pad10 = (yHi - yLo) * 0.08 || 1; yLo -= pad10; yHi += pad10
  } else {
    plotVals = values
    const margin = (scMax - scMin) * 0.1 || 0.5; yLo = scMin - margin; yHi = scMax + margin
  }
  const ySpan = yHi - yLo || 1
  const toY = (v: number) => h - padding - ((v - yLo) / ySpan) * plotH

  ctx.clearRect(0, 0, w, h)

  // grid
  ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let i = 1; i < 4; i++) {
    const x = padding + i * (plotW / 4); ctx.moveTo(x, padding); ctx.lineTo(x, h - padding)
  }
  ctx.stroke()

  // axes
  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo(padding, h - padding); ctx.lineTo(w - padding, h - padding)
  ctx.moveTo(padding, padding); ctx.lineTo(padding, h - padding)
  const zeroInRange = !useLog && yLo < 0 && yHi > 0
  if (zeroInRange) { ctx.moveTo(padding, toY(0)); ctx.lineTo(w - padding, toY(0)) }
  ctx.stroke()
  const baselineY = zeroInRange ? toY(0) : h - padding

  ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px -apple-system, sans-serif'
  ctx.textAlign = 'right'; ctx.fillText('k', w - padding + 10, h - padding + 4)
  ctx.textAlign = 'left'; ctx.fillText(useLog ? 'log₁₀' : 'aₖ', padding + 4, padding - 4)

  // k-axis ticks
  ctx.font = '9.5px -apple-system, sans-serif'; ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1
  const kTickVals = niceTicks(1, KMAX)
  for (const kv of kTickVals) {
    const tx = padding + ((kv - 1) / (KMAX - 1)) * plotW
    ctx.beginPath(); ctx.moveTo(tx, h - padding - 3); ctx.lineTo(tx, h - padding + 3); ctx.stroke()
    ctx.textAlign = 'center'; ctx.fillText(fmtTick(kv), tx, h - padding + 13)
  }
  // y-axis ticks
  const yTickVals = niceTicks(yLo, yHi)
  const yAxisRange = yHi - yLo
  for (const yv of yTickVals) {
    if (Math.abs(yv - yHi) < yAxisRange * 0.08) continue
    const ty = toY(yv)
    if (ty < padding || ty > h - padding) continue
    ctx.beginPath(); ctx.moveTo(padding - 3, ty); ctx.lineTo(padding + 3, ty); ctx.stroke()
    ctx.textAlign = 'right'; ctx.fillText(fmtTick(yv), padding - 5, ty + 3)
  }

  // ghost full range
  ctx.save()
  ctx.strokeStyle = color + '28'; ctx.lineWidth = 1.5; ctx.beginPath()
  let first = true
  for (let kk = 1; kk <= KMAX; kk++) {
    if (isNaN(plotVals[kk - 1])) { first = true; continue }
    const x = padding + ((kk - 1) / (KMAX - 1)) * plotW, y = toY(plotVals[kk - 1])
    if (first) { ctx.moveTo(x, y); first = false } else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // gradient fill for active region
  const kInt = Math.round(k)
  const activeX = kInt >= 1 ? padding + ((Math.min(kInt, KMAX) - 1) / (KMAX - 1)) * plotW : padding
  const grad = ctx.createLinearGradient(0, padding, 0, baselineY)
  grad.addColorStop(0, color + '22'); grad.addColorStop(1, color + '04')
  ctx.save()
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.moveTo(padding, baselineY)
  first = true
  for (let kk = 1; kk <= Math.min(kInt, KMAX); kk++) {
    if (isNaN(plotVals[kk - 1])) { first = true; continue }
    const x = padding + ((kk - 1) / (KMAX - 1)) * plotW, y = toY(plotVals[kk - 1])
    if (first) { ctx.lineTo(x, y); first = false } else ctx.lineTo(x, y)
  }
  ctx.lineTo(activeX, baselineY); ctx.closePath(); ctx.fill()
  ctx.restore()

  // active stroke
  ctx.save()
  ctx.shadowColor = color + '45'; ctx.shadowBlur = 6
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath()
  first = true
  for (let kk = 1; kk <= Math.min(kInt, KMAX); kk++) {
    if (isNaN(plotVals[kk - 1])) { first = true; continue }
    const x = padding + ((kk - 1) / (KMAX - 1)) * plotW, y = toY(plotVals[kk - 1])
    if (first) { ctx.moveTo(x, y); first = false } else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // live value label + marker
  if (kInt >= 1 && kInt <= KMAX && !isNaN(plotVals[kInt - 1])) {
    const x = padding + ((kInt - 1) / (KMAX - 1)) * plotW, y = toY(plotVals[kInt - 1])
    drawDotMarker(ctx, x, y, color, 4.5)
    const v = values[kInt - 1]
    const label = Math.abs(v) >= 1e6 ? v.toExponential(1) : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 12px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('= ' + label, Math.min(x + 9, w - 70), Math.max(y - 8, 16))
  }
}
