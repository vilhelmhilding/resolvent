import { mathExt } from './math-ext'

type CompiledFn = (...args: number[]) => number

const fnCache = new Map<string, CompiledFn>()

export function makeFn(expr: string | undefined | null, vars: string[]): CompiledFn {
  if (!expr || typeof expr !== 'string' || !expr.trim()) return () => NaN

  const key = vars.join(',') + '|' + expr
  const cached = fnCache.get(key)
  if (cached) return cached

  const argList = vars.join(',')
  let src = expr.trim()
  src = src.replace(/\^/g, '**')
  src = src.replace(/\bln\b/g, 'log')
  src = src.replace(/\bMath\./g, '')

  let fn: CompiledFn
  try {
    let body: string
    if (/\breturn\b/.test(src)) {
      body = `with (_mathExt) { ${src} }`
    } else if (/\{/.test(src)) {
      const lastBrace = src.lastIndexOf('}')
      const ret = lastBrace >= 0 ? src.substring(lastBrace + 1).trim() : ''
      if (ret && lastBrace >= 0) {
        body = `with (_mathExt) { ${src.substring(0, lastBrace + 1)} return (${ret}); }`
      } else {
        body = `with (_mathExt) { return (${src}); }`
      }
    } else {
      const lastSemi = src.lastIndexOf(';')
      if (lastSemi >= 0 && lastSemi < src.length - 1) {
        body = `with (_mathExt) { ${src.substring(0, lastSemi + 1)} return (${src.substring(lastSemi + 1).trim()}); }`
      } else {
        body = `with (_mathExt) { return (${src}); }`
      }
    }
    // eslint-disable-next-line no-new-func
    fn = new Function('_mathExt', argList, body).bind(null, mathExt) as CompiledFn
  } catch (e) {
    console.warn('[resolvent] Bad expression:', expr, '→', (e as Error).message)
    fn = () => NaN
  }

  fnCache.set(key, fn)
  return fn
}
