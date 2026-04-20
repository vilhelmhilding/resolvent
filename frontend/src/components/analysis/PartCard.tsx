'use client'
import { useStore } from '@/store'
import { VizCanvas } from '@/components/viz/VizCanvas'
import { useCamera3D } from '@/hooks/useCamera3D'
import type { AnalysisPart } from '@/types/analysis'

interface Props {
  part: AnalysisPart
  index: number
}

export function PartCard({ part, index }: Props) {
  const lang = useStore(s => s.lang)
  const is3D = useStore(s => s.is3D)
  const { onCanvasMouseDown, onCanvasTouchStart } = useCamera3D()

  const name       = part.name[lang]
  const cat        = part.category[lang]?.toUpperCase() ?? ''
  const expl       = part.explanation[lang]
  const insight    = part.insight?.[lang] ?? ''
  const animEffect = part.animation_effect?.[lang] ?? ''

  return (
    <section className="part" style={{ borderColor: part.color, animationDelay: `${300 + index * 55}ms` }}>
      <div className="part-header">
        <div className="part-latex" style={{ color: part.color }}>${part.latex}$</div>
        <div className="part-info">
          <div className="part-name" style={{ color: part.color }}>{name}</div>
          <div className="part-role">{cat}</div>
        </div>
      </div>
      <div className="part-explanation">{expl}</div>
      {insight    && <div className="part-insight">{insight}</div>}
      {animEffect && <div className="part-anim-effect">▶ {animEffect}</div>}
      {part.viz && part.viz.type && (
        <div className="part-viz-container">
          <VizCanvas
            id={`part-${index}`}
            type={part.viz.type}
            vizParams={part.viz.params}
            color={part.color}
            width={360}
            height={220}
            className="part-viz"
            onMouseDown={is3D ? onCanvasMouseDown : undefined}
            onTouchStart={is3D ? onCanvasTouchStart : undefined}
          />
        </div>
      )}
    </section>
  )
}
