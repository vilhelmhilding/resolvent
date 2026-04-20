import { describe, it, expect } from 'vitest'
import { mathExt } from './math-ext'

describe('mathExt.factorial', () => {
  it('computes 0! = 1', () => expect(mathExt.factorial(0)).toBe(1))
  it('computes 1! = 1', () => expect(mathExt.factorial(1)).toBe(1))
  it('computes 5! = 120', () => expect(mathExt.factorial(5)).toBe(120))
  it('computes 10! = 3628800', () => expect(mathExt.factorial(10)).toBe(3628800))
  it('handles negative input by using |n|', () => expect(mathExt.factorial(-4)).toBe(mathExt.factorial(4)))
  it('returns Infinity for n > 170', () => expect(mathExt.factorial(171)).toBe(Infinity))
})

describe('mathExt.gamma', () => {
  it('Γ(1) = 1', () => expect(mathExt.gamma(1)).toBeCloseTo(1, 10))
  it('Γ(2) = 1', () => expect(mathExt.gamma(2)).toBeCloseTo(1, 10))
  it('Γ(3) = 2', () => expect(mathExt.gamma(3)).toBeCloseTo(2, 10))
  it('Γ(5) = 24', () => expect(mathExt.gamma(5)).toBeCloseTo(24, 6))
  it('Γ(0.5) = sqrt(π)', () => expect(mathExt.gamma(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 8))
  it('Γ(n+1) = n! for integers 1–10', () => {
    for (let n = 1; n <= 10; n++) {
      expect(mathExt.gamma(n + 1)).toBeCloseTo(mathExt.factorial(n), 4)
    }
  })
})

describe('mathExt inherits Math', () => {
  it('exposes sin, cos, sqrt, PI', () => {
    expect(mathExt.sin(0)).toBe(0)
    expect(mathExt.cos(0)).toBe(1)
    expect(mathExt.sqrt(4)).toBe(2)
    expect(mathExt.PI).toBeCloseTo(3.14159, 5)
  })
})
