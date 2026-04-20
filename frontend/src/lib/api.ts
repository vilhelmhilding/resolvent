import type { AnalysisData, ChatMessage, Slider } from '@/types/analysis'

export interface AnalyzeResponse {
  ok: true
  analysis: AnalysisData
  sliders: Slider[]
}

export interface ErrorResponse {
  ok: false
  error: string
}

export interface MainVizReadyData {
  summary:   Record<string, string>
  intuition: Record<string, string>
  example:   Record<string, string> | null
  main_viz:  { type: string; params: Record<string, unknown> }
  sliders:   Slider[]
}

export async function analyzeImage(
  dataUrl: string,
  onIdentified?:    (latex: string, example: Record<string, string> | null) => void,
  onMainVizReady?:  (data: MainVizReadyData) => void,
): Promise<AnalyzeResponse | ErrorResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl }),
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()!
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      let event: Record<string, unknown>
      try { event = JSON.parse(line.slice(6)) } catch { continue }
      if (event.type === 'identified') {
        onIdentified?.(
          event.latex as string,
          (event.example as Record<string, string>) ?? null,
        )
        await new Promise(r => setTimeout(r, 50))
      } else if (event.type === 'main_viz_ready') {
        onMainVizReady?.({
          summary:   event.summary   as Record<string, string>,
          intuition: event.intuition as Record<string, string>,
          example:   (event.example  as Record<string, string>) ?? null,
          main_viz:  event.main_viz  as MainVizReadyData['main_viz'],
          sliders:   event.sliders   as Slider[],
        })
      } else if (event.type === 'complete') {
        return { ok: true, analysis: event.analysis as AnalysisData, sliders: event.sliders as Slider[] }
      } else if (event.ok === false) {
        return { ok: false, error: event.error as string }
      }
    }
  }
  return { ok: false, error: 'Stream ended without result.' }
}

export async function analyzeLatex(
  latex: string,
  onIdentified?:   (latex: string, example: Record<string, string> | null) => void,
  onMainVizReady?: (data: MainVizReadyData) => void,
): Promise<AnalyzeResponse | ErrorResponse> {
  const res = await fetch('/api/analyze-latex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latex }),
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()!
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      let event: Record<string, unknown>
      try { event = JSON.parse(line.slice(6)) } catch { continue }
      if (event.type === 'identified') {
        onIdentified?.(event.latex as string, (event.example as Record<string, string>) ?? null)
        await new Promise(r => setTimeout(r, 50))
      } else if (event.type === 'main_viz_ready') {
        onMainVizReady?.({
          summary:   event.summary   as Record<string, string>,
          intuition: event.intuition as Record<string, string>,
          example:   (event.example  as Record<string, string>) ?? null,
          main_viz:  event.main_viz  as MainVizReadyData['main_viz'],
          sliders:   event.sliders   as Slider[],
        })
      } else if (event.type === 'complete') {
        return { ok: true, analysis: event.analysis as AnalysisData, sliders: event.sliders as Slider[] }
      } else if (event.ok === false) {
        return { ok: false, error: event.error as string }
      }
    }
  }
  return { ok: false, error: 'Stream ended without result.' }
}

export async function sendChatStream(
  message: string,
  analysisData: AnalysisData,
  history: ChatMessage[],
  lang: string,
  onChunk: (chunk: string) => void,
): Promise<{ ok: true } | ErrorResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, analysis_data: analysisData, history, lang }),
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()!
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      let event: Record<string, unknown>
      try { event = JSON.parse(line.slice(6)) } catch { continue }
      if (event.chunk) onChunk(event.chunk as string)
      else if (event.done) return { ok: true }
      else if (event.error) return { ok: false, error: event.error as string }
    }
  }
  return { ok: true }
}
