export interface Camera { rotX: number; rotY: number }
export interface ScreenPoint { sx: number; sy: number }

export function project3D(x3: number, y3: number, z3: number, w: number, h: number, cam: Camera): ScreenPoint {
  const { rotX, rotY } = cam
  const scale = Math.min(w, h) * 0.38
  const x1 = x3 * Math.cos(rotY) - z3 * Math.sin(rotY)
  const z1 = x3 * Math.sin(rotY) + z3 * Math.cos(rotY)
  const y1 = y3 * Math.cos(rotX) + z1 * Math.sin(rotX)
  return { sx: w / 2 + x1 * scale, sy: h / 2 - y1 * scale }
}

export type Tick3D = { norm: number; label: string }
export type AxisTickMap = { x?: Tick3D[]; y?: Tick3D[]; z?: Tick3D[] }

export function draw3DAxes(
  ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera,
  labX?: string | null, labY?: string | null, labZ?: string | null,
  origin: [number, number, number] = [0, 0, 0],
  ticks?: AxisTickMap,
): void {
  const [ox, oy, oz] = origin
  const lx = labX ?? 'x', ly = labY ?? 'y', lz = labZ ?? 'z';
  ([
    [[-1.2, oy, oz], [1.2, oy, oz], lx, labX, ticks?.x],
    [[ox, -1.2, oz], [ox, 1.2, oz], ly, labY, ticks?.y],
    [[ox, oy, -1.2], [ox, oy, 1.2], lz, labZ, ticks?.z],
  ] as [[number, number, number], [number, number, number], string, string | null | undefined, Tick3D[] | undefined][])
    .forEach(([from, to, label, raw, axisTicks]) => {
      if (raw === null) return
      const p0 = project3D(from[0], from[1], from[2], w, h, cam)
      const p1 = project3D(to[0], to[1], to[2], w, h, cam)
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke()
      if (label) {
        const adx = p1.sx - p0.sx, ady = p1.sy - p0.sy
        const alen = Math.hypot(adx, ady) || 1
        const nx = adx / alen, ny = ady / alen
        ctx.fillStyle = '#475569'; ctx.font = '11px -apple-system, sans-serif'
        ctx.textAlign = nx < -0.3 ? 'right' : 'left'
        ctx.fillText(label, p1.sx + nx * 10 + (nx >= -0.3 ? 4 : -4), p1.sy + ny * 10 + 4)
        ctx.textAlign = 'left'
      }
      if (axisTicks?.length) {
        const axW = p1.sx - p0.sx, axH = p1.sy - p0.sy
        const axLen = Math.hypot(axW, axH) || 1
        let px = -axH / axLen, py = axW / axLen
        // Orient perpendicular so labels go in the more "outward" canonical direction
        if (Math.abs(axW) >= Math.abs(axH)) { if (py < 0) { px = -px; py = -py } }
        else                                 { if (px < 0) { px = -px; py = -py } }
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.8
        ctx.fillStyle = '#94a3b8'; ctx.font = '9px -apple-system, sans-serif'
        ctx.textAlign = 'center'
        for (const { norm, label: tl } of axisTicks) {
          const t = (norm + 1.2) / 2.4
          const tx = p0.sx + t * (p1.sx - p0.sx), ty = p0.sy + t * (p1.sy - p0.sy)
          ctx.beginPath(); ctx.moveTo(tx + px * 3, ty + py * 3); ctx.lineTo(tx - px * 3, ty - py * 3); ctx.stroke()
          ctx.fillText(tl, tx + px * 10, ty + py * 10 + 3)
        }
        ctx.textAlign = 'left'
      }
    })
}

export function draw3DFloorGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera): void {
  const YF = -1.0
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 0.6
  for (let i = -4; i <= 4; i++) {
    const v = i / 4
    const p0 = project3D(v, YF, -1.0, w, h, cam); const p1 = project3D(v, YF,  1.0, w, h, cam)
    ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke()
    const q0 = project3D(-1.0, YF, v, w, h, cam); const q1 = project3D( 1.0, YF, v, w, h, cam)
    ctx.beginPath(); ctx.moveTo(q0.sx, q0.sy); ctx.lineTo(q1.sx, q1.sy); ctx.stroke()
  }
}
