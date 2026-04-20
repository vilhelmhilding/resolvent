import { makeFn } from '../../expr-compiler'
import { hidePlot, getCtx, drawDotMarker, niceTicks, fmtTick } from '../shared'
import { project3D, draw3DAxes, draw3DFloorGrid } from './camera'
import type { Renderer } from '../types'
import type { Camera } from './camera'

export function makeScalar3D(cam: Camera): Renderer {
  return (canvas, params, color, anim) => {
    if (!params?.value) { hidePlot(canvas); return }
    const { ctx, w, h } = getCtx(canvas)
    ctx.clearRect(0, 0, w, h)

    const k = anim.k, t_s3 = anim.t, KMAX = 30
    const valFn = makeFn(String(params.value), ['k', 't'])
    const values: number[] = []
    for (let kk = 1; kk <= KMAX; kk++) {
      let v: number; try { v = valFn(kk, t_s3) } catch { v = NaN }
      values.push(isFinite(v) ? v : NaN)
    }
    const valid = values.filter(v => !isNaN(v))
    if (!valid.length) { hidePlot(canvas); return }

    const nx = (kk: number) => (kk - 1) / (KMAX - 1) * 2 - 1
    const minV3 = Math.min(...valid), maxV3 = Math.max(...valid)
    const spread3 = maxV3 - minV3, absAvg3 = valid.reduce((s, v) => s + Math.abs(v), 0) / valid.length

    if (spread3 < 0.02 * (absAvg3 || 1)) {
      const v0 = valid[0], yNorm = v0 === 0 ? 0 : 0.6 * Math.sign(v0)
      draw3DFloorGrid(ctx, w, h, cam)
      draw3DAxes(ctx, w, h, cam, 'k', 'aₖ', '')
      ctx.save()
      ctx.strokeStyle = color + '18'; ctx.lineWidth = 0.8
      for (let kk = 1; kk <= KMAX; kk++) {
        const pF = project3D(nx(kk), -1.0, 0, w, h, cam), pT = project3D(nx(kk), yNorm, 0, w, h, cam)
        ctx.beginPath(); ctx.moveTo(pF.sx, pF.sy); ctx.lineTo(pT.sx, pT.sy); ctx.stroke()
      }
      ctx.restore()
      ctx.save()
      ctx.shadowColor = color + '50'; ctx.shadowBlur = 6
      ctx.strokeStyle = color; ctx.lineWidth = 2.2
      let pen = false; ctx.beginPath()
      for (let kk = 1; kk <= KMAX; kk++) {
        const { sx, sy } = project3D(nx(kk), yNorm, 0, w, h, cam)
        if (!pen) { ctx.moveTo(sx, sy); pen = true } else ctx.lineTo(sx, sy)
      }
      ctx.stroke()
      ctx.restore()
      const pLbl = project3D(nx(1), yNorm, 0, w, h, cam)
      const valStrC = Math.abs(v0) < 0.001 || Math.abs(v0) >= 10000 ? v0.toExponential(2) : parseFloat(v0.toPrecision(3)).toString()
      ctx.fillStyle = color; ctx.font = 'bold 11px -apple-system, sans-serif'; ctx.textAlign = 'left'
      ctx.fillText(valStrC, pLbl.sx + 4, pLbl.sy - 8)
      return
    }

    const allPos = valid.every(v => v > 0), allNeg = valid.every(v => v < 0)
    const useLog = (allPos || allNeg) && (maxV3 / (minV3 || 1e-300) > 1000)
    const plotVals = useLog ? values.map(v => isNaN(v) ? NaN : (allPos ? Math.log10(v) : -Math.log10(-v))) : values
    const pv3 = plotVals.filter(v => !isNaN(v))
    const pv3min = Math.min(...pv3), pv3max = Math.max(...pv3), pv3span = (pv3max - pv3min) || 1
    const ny = (v: number) => {
      const idx = useLog ? (allPos ? Math.log10(Math.max(v, 1e-300)) : -Math.log10(Math.max(-v, 1e-300))) : v
      return ((idx - pv3min) / pv3span) * 2 - 1
    }

    const kTicks3 = niceTicks(1, KMAX).map(v => ({ norm: nx(v), label: fmtTick(v) }))
    const yTicks3 = niceTicks(pv3min, pv3max).map(v => ({ norm: Math.max(-1, Math.min(1, ((useLog ? (allPos ? Math.log10(Math.max(v,1e-300)) : -Math.log10(Math.max(-v,1e-300))) : v) - pv3min) / pv3span * 2 - 1)), label: fmtTick(v) }))
    draw3DFloorGrid(ctx, w, h, cam)
    draw3DAxes(ctx, w, h, cam, 'k', useLog ? 'log₁₀' : 'aₖ', '', [0, 0, 0], { x: kTicks3, y: yTicks3 })

    const kCont = k, kInt = Math.round(k)

    ctx.save()
    ctx.strokeStyle = color + '18'; ctx.lineWidth = 0.8
    for (let kk = 1; kk <= KMAX; kk++) {
      if (isNaN(values[kk - 1])) continue
      const pF = project3D(nx(kk), -1.0, 0, w, h, cam)
      const pT = project3D(nx(kk), Math.max(-1, Math.min(1, ny(values[kk - 1]))), 0, w, h, cam)
      ctx.beginPath(); ctx.moveTo(pF.sx, pF.sy); ctx.lineTo(pT.sx, pT.sy); ctx.stroke()
    }
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = color + '28'; ctx.lineWidth = 1.4
    let pen = false; ctx.beginPath()
    for (let kk = 1; kk <= KMAX; kk++) {
      if (isNaN(values[kk - 1])) { pen = false; continue }
      const { sx, sy } = project3D(nx(kk), Math.max(-1, Math.min(1, ny(values[kk - 1]))), 0, w, h, cam)
      if (!pen) { ctx.moveTo(sx, sy); pen = true } else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.shadowColor = color + '50'; ctx.shadowBlur = 6
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; pen = false; ctx.beginPath()
    for (let kk = 1; kk <= KMAX; kk++) {
      if (isNaN(values[kk - 1])) { pen = false; continue }
      if (kk > kCont + 0.5) break
      const { sx, sy } = project3D(nx(kk), Math.max(-1, Math.min(1, ny(values[kk - 1]))), 0, w, h, cam)
      if (!pen) { ctx.moveTo(sx, sy); pen = true } else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
    ctx.restore()

    if (kInt >= 1 && kInt <= KMAX && !isNaN(values[kInt - 1])) {
      const p = project3D(nx(kInt), Math.max(-1, Math.min(1, ny(values[kInt - 1]))), 0, w, h, cam)
      drawDotMarker(ctx, p.sx, p.sy, color, 5.5)
    }
  }
}
