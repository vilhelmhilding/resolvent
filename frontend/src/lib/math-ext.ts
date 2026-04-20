const mathExt = Object.create(Math) as typeof Math & {
  factorial: (n: number) => number
  gamma: (z: number) => number
}

mathExt.factorial = (n: number): number => {
  const k = Math.round(Math.abs(n))
  if (k > 170) return Infinity
  let r = 1
  for (let i = 2; i <= k; i++) r *= i
  return r
}

mathExt.gamma = function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
  z -= 1
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  let x = c[0]
  for (let i = 1; i <= 8; i++) x += c[i] / (z + i)
  const t = z + 7.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
}

export { mathExt }
