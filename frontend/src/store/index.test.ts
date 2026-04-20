import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './index'

beforeEach(() => {
  useStore.getState().reset()
  useStore.setState({ lang: 'en', is3D: false, auth: null, animSpeed: 1 })
})

describe('lang / is3D', () => {
  it('defaults to en and 2D', () => {
    const { lang, is3D } = useStore.getState()
    expect(lang).toBe('en')
    expect(is3D).toBe(false)
  })

  it('setLang updates language', () => {
    useStore.getState().setLang('sv')
    expect(useStore.getState().lang).toBe('sv')
  })

  it('setIs3D toggles mode', () => {
    useStore.getState().setIs3D(true)
    expect(useStore.getState().is3D).toBe(true)
  })
})

describe('chatHistory', () => {
  it('starts empty', () => {
    expect(useStore.getState().chatHistory).toEqual([])
  })

  it('appendChatMessage adds to end', () => {
    const s = useStore.getState()
    s.appendChatMessage({ role: 'user', content: 'hello' })
    s.appendChatMessage({ role: 'assistant', content: 'hi' })
    const h = useStore.getState().chatHistory
    expect(h).toHaveLength(2)
    expect(h[1].content).toBe('hi')
  })

  it('updateLastChatMessage replaces last message content', () => {
    const s = useStore.getState()
    s.appendChatMessage({ role: 'assistant', content: 'typing...' })
    s.updateLastChatMessage('final answer')
    const h = useStore.getState().chatHistory
    expect(h[0].content).toBe('final answer')
  })

  it('updateLastChatMessage is a no-op on empty history', () => {
    expect(() => useStore.getState().updateLastChatMessage('x')).not.toThrow()
    expect(useStore.getState().chatHistory).toHaveLength(0)
  })

  it('setChatHistory replaces entire history', () => {
    useStore.getState().appendChatMessage({ role: 'user', content: 'old' })
    useStore.getState().setChatHistory([{ role: 'user', content: 'new' }])
    expect(useStore.getState().chatHistory).toHaveLength(1)
    expect(useStore.getState().chatHistory[0].content).toBe('new')
  })
})

describe('params / animConfig', () => {
  it('defaults k=1, t=0', () => {
    const { params } = useStore.getState()
    expect(params.k).toBe(1)
    expect(params.t).toBe(0)
  })

  it('setParams updates params', () => {
    useStore.getState().setParams({ k: 5, t: 2 })
    expect(useStore.getState().params).toEqual({ k: 5, t: 2 })
  })

  it('setAnimConfig updates config', () => {
    useStore.getState().setAnimConfig({ sliders: [{ name: 'k', min: 1, max: 10, default: 1, step: 1 }] } as never)
    expect((useStore.getState().animConfig as never as { sliders: unknown[] }).sliders).toHaveLength(1)
  })
})

describe('reset', () => {
  it('clears analysis, chat, and resets params', () => {
    const s = useStore.getState()
    s.appendChatMessage({ role: 'user', content: 'msg' })
    s.setParams({ k: 10, t: 5 })
    s.setAnalysisData({ latex: 'x^2' } as never)
    s.reset()
    const after = useStore.getState()
    expect(after.chatHistory).toHaveLength(0)
    expect(after.analysisData).toBeNull()
    expect(after.params).toEqual({ k: 1, t: 0 })
  })
})

describe('auth', () => {
  it('starts null', () => expect(useStore.getState().auth).toBeNull())

  it('setAuth stores user', () => {
    useStore.getState().setAuth({ userId: 'u1', username: 'alice' })
    expect(useStore.getState().auth?.username).toBe('alice')
  })

  it('setAuth(null) clears user', () => {
    useStore.getState().setAuth({ userId: 'u1', username: 'alice' })
    useStore.getState().setAuth(null)
    expect(useStore.getState().auth).toBeNull()
  })
})
