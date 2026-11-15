/**
 * Automatic collision avoidance for chord symbols.
 *
 * Chord symbols sit on one baseline above each system. When two neighbours would overlap
 * (dense passages — Liszt études, fast harmonic rhythm) the later one is bumped up to a
 * second row (then a third…), so every symbol stays close to its note but nothing overlaps.
 */

export const CHORD_FONT = "500 19px 'Times New Roman', Georgia, serif"
/** Vertical distance between stacked chord rows (page px) — a bit more than the 19px font. */
export const CHORD_ROW_STEP = 21
const GAP = 5

let ctx: CanvasRenderingContext2D | null | undefined

/** Rendered width of a chord symbol in page px (canvas measurement; falls back to an estimate). */
export function chordTextWidth(text: string): number {
  if (ctx === undefined) {
    try { ctx = document.createElement('canvas').getContext('2d') } catch { ctx = null }
    if (ctx) ctx.font = CHORD_FONT
  }
  if (ctx) {
    const w = ctx.measureText(text).width
    if (w > 0) return w
  }
  return text.length * 10.5
}

export interface ChordItem {
  id: string
  /** Left edge of the symbol (page px). */
  x: number
  text: string
  /** Chords with a user-set position keep it and take no part in stacking. */
  pinned?: boolean
}

/**
 * Assign each chord a row (0 = baseline, 1 = one step up, …) within one system.
 * Greedy left→right: a chord takes the lowest row whose last symbol ends before it starts.
 */
export function assignChordRows(items: ChordItem[], width: (text: string) => number = chordTextWidth): Map<string, number> {
  const rows = new Map<string, number>()
  const ends: number[] = []                       // right edge of the last symbol in each row
  const free = items.filter(i => !i.pinned).sort((a, b) => a.x - b.x)
  for (const it of free) {
    let r = ends.findIndex(end => it.x >= end + GAP)
    if (r < 0) { r = ends.length; ends.push(0) }
    ends[r] = it.x + width(it.text)
    rows.set(it.id, r)
  }
  return rows
}
