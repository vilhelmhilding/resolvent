export type Lang = 'en' | 'sv'

export interface BilingualText {
  en: string
  sv: string
}

export type VizType =
  | 'function_plot'
  | 'scalar'
  | 'spiral_sum'
  | 'unit_circle'
  | 'complex_point'
  | 'parametric_curve'

export interface VizConfig {
  type: VizType
  params: Record<string, unknown>
}

export interface AnalysisPart {
  latex: string
  name: BilingualText
  category: BilingualText
  explanation: BilingualText
  insight: BilingualText
  animation_effect: BilingualText
  viz: VizConfig | null
  color: string
}

export interface DerivationStep {
  latex: string
  note: BilingualText
}

export interface AnalysisData {
  latex: string
  summary: BilingualText
  intuition: BilingualText
  example: BilingualText | null
  main_viz: VizConfig | null
  steps: DerivationStep[]
  parts: AnalysisPart[]
}

export interface Slider {
  name: string
  min: number
  max: number
  default: number
  step: number
}

export interface AnimConfig {
  kmax?: number
  tmin?: number
  tmax?: number
}

export interface AnimParams {
  k: number
  t: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
