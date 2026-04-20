'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '@/store'

interface CropBox { x: number; y: number; w: number; h: number }
type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Props {
  image: HTMLImageElement
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

const EDGE_THRESHOLD = 28
const MIN_SIZE = 40
const MAX_DISPLAY_W = 600

export function ImageCropper({ image, onConfirm, onCancel }: Props) {
  const lang = useStore(s => s.lang)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cropBox, setCropBox] = useState<CropBox>({ x: 20, y: 20, w: 0, h: 0 })
  const [displayScale, setDisplayScale] = useState(1)

  const origScale = Math.min(1, MAX_DISPLAY_W / image.width)
  const cw = Math.round(image.width  * origScale)
  const ch = Math.round(image.height * origScale)

  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = cw; canvas.height = ch
    canvas.getContext('2d')!.drawImage(image, 0, 0, cw, ch)
    setCropBox({ x: 20, y: 20, w: cw - 40, h: ch - 40 })
  }, [image, cw, ch])

  useEffect(() => {
    const update = () => {
      if (canvasRef.current)
        setDisplayScale(canvasRef.current.getBoundingClientRect().width / cw)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [cw])

  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; startBox: CropBox } | null>(null)

  function detectMode(e: React.PointerEvent, el: HTMLDivElement): DragMode {
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const { width: w, height: h } = rect
    const T = EDGE_THRESHOLD
    const top = y < T, bot = y > h - T, left = x < T, right = x > w - T
    if (top && left)  return 'nw'; if (top && right)  return 'ne'
    if (bot && left)  return 'sw'; if (bot && right)  return 'se'
    if (top) return 'n'; if (bot) return 's'
    if (left) return 'w'; if (right) return 'e'
    return 'move'
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const mode = detectMode(e, e.currentTarget)
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startBox: { ...cropBox } }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [cropBox])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const { mode, startX, startY, startBox: b0 } = dragRef.current
    const dx = (e.clientX - startX) / displayScale
    const dy = (e.clientY - startY) / displayScale
    let { x, y, w, h } = b0

    if (mode === 'move') {
      x = Math.max(0, Math.min(cw - w, x + dx))
      y = Math.max(0, Math.min(ch - h, y + dy))
    } else {
      if (mode.includes('w')) {
        const nx = Math.max(0, Math.min(x + w - MIN_SIZE, x + dx))
        w += x - nx; x = nx
      }
      if (mode.includes('e')) w = Math.max(MIN_SIZE, Math.min(cw - x, w + dx))
      if (mode.includes('n')) {
        const ny = Math.max(0, Math.min(y + h - MIN_SIZE, y + dy))
        h += y - ny; y = ny
      }
      if (mode.includes('s')) h = Math.max(MIN_SIZE, Math.min(ch - y, h + dy))
    }
    setCropBox({ x, y, w, h })
  }, [displayScale, cw, ch])

  const cursors: Record<DragMode, string> = {
    move: 'move', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
  }

  function handleConfirm() {
    const scaleBack = image.width / cw
    const sx = cropBox.x * scaleBack, sy = cropBox.y * scaleBack
    const sw = cropBox.w * scaleBack, sh = cropBox.h * scaleBack
    const MAX_DIM = 2048
    const ds = Math.min(1, MAX_DIM / Math.max(sw, sh))
    const ow = Math.round(sw * ds), oh = Math.round(sh * ds)
    const off = document.createElement('canvas')
    off.width = ow; off.height = oh
    off.getContext('2d')!.drawImage(image, sx, sy, sw, sh, 0, 0, ow, oh)
    onConfirm(off.toDataURL('image/jpeg', 0.85))
  }

  const s = displayScale
  const boxStyle = {
    left:   cropBox.x * s,
    top:    cropBox.y * s,
    width:  cropBox.w * s,
    height: cropBox.h * s,
  }

  return (
    <div className="crop-area">
      <div className="section-label">
        {lang === 'sv' ? 'BESKÄR (DRA I FYRKANTEN)' : 'CROP (DRAG THE BOX)'}
      </div>
      <div className="crop-stage">
        <canvas ref={canvasRef} id="crop-canvas" />
        <div
          id="crop-box"
          style={{ ...boxStyle, position: 'absolute', cursor: 'move' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => { dragRef.current = null }}
          onPointerLeave={() => { dragRef.current = null }}
          onMouseMove={e => {
            if (!dragRef.current) {
              const mode = detectMode(e as unknown as React.PointerEvent, e.currentTarget)
              e.currentTarget.style.cursor = cursors[mode]
            }
          }}
        >
          {(['tl', 'tr', 'bl', 'br'] as const).map(pos => (
            <div key={pos} className={`crop-corner ${pos}`} />
          ))}
        </div>
      </div>
      <div className="crop-controls">
        <button className="btn-secondary" onClick={onCancel}>
          {lang === 'sv' ? 'Avbryt' : 'Cancel'}
        </button>
        <button className="btn-primary" onClick={handleConfirm}>
          {lang === 'sv' ? 'Analysera' : 'Analyze'}
        </button>
      </div>
    </div>
  )
}
