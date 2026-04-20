'use client'
import { useEffect } from 'react'

declare global {
  interface Window {
    MathJax?: {
      typesetPromise: (nodes?: HTMLElement[]) => Promise<void>
    }
  }
}

export function useMathJax(deps: unknown[] = []) {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export async function typesetElement(el: HTMLElement | null) {
  if (typeof window !== 'undefined' && window.MathJax?.typesetPromise && el) {
    await window.MathJax.typesetPromise([el])
  }
}
