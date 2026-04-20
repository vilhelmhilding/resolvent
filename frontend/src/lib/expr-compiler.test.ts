import { describe, it, expect } from 'vitest'
import { makeFn } from './expr-compiler'

describe('makeFn', () => {
  it('evaluates a simple expression', () => {
    const f = makeFn('x**2', ['x'])
    expect(f(3)).toBe(9)
  })

  it('converts ^ to ** automatically', () => {
    const f = makeFn('x^2', ['x'])
    expect(f(4)).toBe(16)
  })

  it('converts ln to log', () => {
    const f = makeFn('ln(x)', ['x'])
    expect(f(Math.E)).toBeCloseTo(1)
  })

  it('supports multiple variables', () => {
    const f = makeFn('x + k', ['x', 'k'])
    expect(f(3, 7)).toBe(10)
  })

  it('returns NaN for an empty expression', () => {
    const f = makeFn('', ['x'])
    expect(Number.isNaN(f(1))).toBe(true)
  })

  it('returns NaN for null/undefined', () => {
    expect(Number.isNaN(makeFn(null, ['x'])(1))).toBe(true)
    expect(Number.isNaN(makeFn(undefined, ['x'])(1))).toBe(true)
  })

  it('returns NaN for a syntax error, not throws', () => {
    const f = makeFn('(((', ['x'])
    expect(Number.isNaN(f(1))).toBe(true)
  })

  it('supports Math functions via mathExt', () => {
    const f = makeFn('sin(x)', ['x'])
    expect(f(0)).toBeCloseTo(0)
    expect(f(Math.PI / 2)).toBeCloseTo(1)
  })

  it('caches compiled functions — same reference for same inputs', () => {
    const a = makeFn('x^3', ['x'])
    const b = makeFn('x^3', ['x'])
    expect(a).toBe(b)
  })

  it('evaluates expression with semicolon separator (multi-statement)', () => {
    const f = makeFn('x * 2; x * 3', ['x'])
    expect(f(5)).toBe(15)
  })

  it('Gaussian exp(-x^2) peaks at 0', () => {
    // x^2 → x**2; but unary minus before ** is a JS syntax error,
    // so the compiler must wrap it: -x**2 → -(x**2)
    const f = makeFn('exp(-(x^2))', ['x'])
    expect(f(0)).toBeCloseTo(1)
    expect(f(2)).toBeLessThan(0.1)
  })
})
