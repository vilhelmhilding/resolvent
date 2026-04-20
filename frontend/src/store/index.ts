import { create } from 'zustand'
import type { AnalysisData, AnimConfig, AnimParams, ChatMessage, Lang } from '@/types/analysis'
import type { Camera } from '@/lib/renderers/3d/camera'

export interface AuthUser { userId: string; username: string }

interface ResolventStore {
  lang: Lang
  is3D: boolean
  params: AnimParams
  animConfig: AnimConfig
  animSpeed: number
  isAnimating: boolean
  analysisData: AnalysisData | null
  chatHistory: ChatMessage[]
  cam3d: Camera
  auth: AuthUser | null

  setLang: (lang: Lang) => void
  setIs3D: (is3D: boolean) => void
  setParams: (params: AnimParams) => void
  setAnimConfig: (cfg: AnimConfig) => void
  setAnimSpeed: (speed: number) => void
  setIsAnimating: (v: boolean) => void
  setAnalysisData: (data: AnalysisData | null) => void
  setChatHistory: (history: ChatMessage[]) => void
  appendChatMessage: (msg: ChatMessage) => void
  updateLastChatMessage: (content: string) => void
  setCam3d: (cam: Camera) => void
  setAuth: (auth: AuthUser | null) => void
  reset: () => void
}

export const useStore = create<ResolventStore>((set) => ({
  lang: 'en',
  is3D: false,
  params: { k: 1, t: 0 },
  animConfig: {},
  animSpeed: 1,
  isAnimating: false,
  analysisData: null,
  chatHistory: [],
  cam3d: { rotX: 0.45, rotY: 0.55 },
  auth: null,

  setLang: (lang) => set({ lang }),
  setIs3D: (is3D) => set({ is3D }),
  setParams: (params) => set({ params }),
  setAnimConfig: (animConfig) => set({ animConfig }),
  setAnimSpeed: (animSpeed) => set({ animSpeed }),
  setIsAnimating: (isAnimating) => set({ isAnimating }),
  setAnalysisData: (analysisData) => set({ analysisData }),
  setChatHistory: (chatHistory) => set({ chatHistory }),
  appendChatMessage: (msg) => set(s => ({ chatHistory: [...s.chatHistory, msg] })),
  updateLastChatMessage: (content) => set(s => {
    if (!s.chatHistory.length) return s
    const h = [...s.chatHistory]
    h[h.length - 1] = { ...h[h.length - 1], content }
    return { chatHistory: h }
  }),
  setCam3d: (cam3d) => set({ cam3d }),
  setAuth: (auth) => set({ auth }),
  reset: () => set({
    params: { k: 1, t: 0 },
    animConfig: {},
    isAnimating: false,
    analysisData: null,
    chatHistory: [],
  }),
}))
