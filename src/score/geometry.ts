/** Score geometry in PAGE units (the unscaled, fixed-width score page). */

export interface Rect { x: number; y: number; w: number; h: number }

export interface NoteBox extends Rect {
  id: string
  cx: number
  cy: number
  measure: number   // 1-based measure index
  staff: number     // global staff (1-based)
  system: number    // system index
}

export interface MeasureBox extends Rect {
  num: number       // 1-based measure index
  staves: Rect[]    // staff-line rects, top → bottom
  system: number
}

export interface SystemBox extends Rect {
  index: number
  first: number     // first measure index in the system
  last: number
}

export interface ScoreGeometry {
  width: number
  height: number
  measures: MeasureBox[]          // measures[num - 1]
  systems: SystemBox[]
  notes: Map<string, NoteBox>
  order: string[]                 // all rendered noteIds in score order
}

export const rectContains = (r: Rect, x: number, y: number, pad = 0) =>
  x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export function measureBox(g: ScoreGeometry, num: number): MeasureBox | undefined {
  return g.measures[num - 1]
}

export function systemOfMeasure(g: ScoreGeometry, num: number): SystemBox | undefined {
  const m = g.measures[num - 1]
  return m ? g.systems[m.system] : undefined
}

/** Split a measure range into per-system segments [{system, x0, x1}] */
export function segmentsForRange(g: ScoreGeometry, start: number, end: number) {
  const segs: Array<{ system: SystemBox; x0: number; x1: number; first: number; last: number }> = []
  for (let m = start; m <= end; m++) {
    const mb = g.measures[m - 1]
    if (!mb) continue
    const last = segs[segs.length - 1]
    if (last && last.system.index === mb.system) { last.x1 = mb.x + mb.w; last.last = m }
    else segs.push({ system: g.systems[mb.system], x0: mb.x, x1: mb.x + mb.w, first: m, last: m })
  }
  return segs
}

/** Group note boxes by system, each group sorted left → right. */
export function notesBySystem(g: ScoreGeometry, ids: string[]): NoteBox[][] {
  const groups = new Map<number, NoteBox[]>()
  for (const id of ids) {
    const n = g.notes.get(id)
    if (!n) continue
    const arr = groups.get(n.system)
    if (arr) arr.push(n); else groups.set(n.system, [n])
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, arr]) => arr.sort((a, b) => a.cx - b.cx))
}
