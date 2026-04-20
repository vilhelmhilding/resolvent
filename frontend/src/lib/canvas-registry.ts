const registry = new Map<string, () => void>()

export function registerCanvas(id: string, drawFn: () => void): void {
  registry.set(id, drawFn)
}

export function unregisterCanvas(id: string): void {
  registry.delete(id)
}

export function drawAll(): void {
  registry.forEach(fn => { try { fn() } catch { /* ignore per-canvas errors */ } })
}
