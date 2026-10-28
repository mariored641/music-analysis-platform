/** DOM-side results of the last render (not React state — elements aren't serializable). */
import type { Rect } from './geometry'

export interface Registry {
  noteEls: Map<string, Element>
  colorables: Element[]
  colorableRects: Rect[]
  scale: number
}

export const registry: Registry = { noteEls: new Map(), colorables: [], colorableRects: [], scale: 1 }

/** Resolve a stored element reference against the current render. */
export function resolveElement(ref: { index: number; tag: string; x: number; y: number }): number {
  const { colorables, colorableRects } = registry
  const el = colorables[ref.index]
  const r = colorableRects[ref.index]
  if (el && r && el.tagName === ref.tag && Math.abs(r.x - ref.x) < 3 && Math.abs(r.y - ref.y) < 3) return ref.index
  let best = -1, bestD = 6
  colorableRects.forEach((cr, i) => {
    if (colorables[i].tagName !== ref.tag) return
    const d = Math.hypot(cr.x - ref.x, cr.y - ref.y)
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}

/** Short readable description of a colorable element (for the inspector). */
export function describeElement(index: number): string {
  const el = registry.colorables[index]
  if (!el) return ''
  const text = el.textContent?.trim()
  if (text) return text
  const cls = (el.getAttribute('class') || el.parentElement?.getAttribute('class') || '').replace(/vf-/g, '')
  return cls || el.tagName
}
