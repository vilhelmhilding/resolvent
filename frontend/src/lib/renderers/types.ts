import type { AnimConfig, AnimParams } from '@/types/analysis'

export type { AnimConfig, AnimParams }

export type Renderer = (
  canvas: HTMLCanvasElement,
  params: Record<string, unknown>,
  color: string,
  anim: AnimParams,
  animConfig: AnimConfig,
) => void

export interface RendererMap {
  [key: string]: Renderer | undefined
  function_plot?: Renderer
  scalar?: Renderer
  spiral_sum?: Renderer
  unit_circle?: Renderer
  complex_point?: Renderer
  parametric_curve?: Renderer
}
