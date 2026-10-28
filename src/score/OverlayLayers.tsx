import { memo } from 'react'
import type { ScoreGeometry } from './geometry'
import { notesBySystem, segmentsForRange } from './geometry'
import type { Selection } from '../store/selectionStore'
import type { FreehandAnnotation } from '../types/annotation'
import { registry } from './registry'
import { pathToPoints, strokePath } from './shapes'

/** Word-like selection band per system + element outline. */
export const SelectionLayer = memo(function SelectionLayer({ g, selection }: { g: ScoreGeometry; selection: Selection | null }) {
  if (!selection) return null
  if (selection.kind === 'element') {
    const idx = selection.element.index
    const r = registry.colorableRects[idx]
    if (!r) return null
    return <rect className="sel-element" x={r.x - 4} y={r.y - 4} width={r.w + 8} height={r.h + 8} rx={4} />
  }
  if (selection.wholeMeasures) {
    return (
      <g className="sel-band">
        {segmentsForRange(g, selection.measureStart, selection.measureEnd).map((s, i) => (
          <rect key={i} x={s.x0} y={s.system.y - 14} width={s.x1 - s.x0} height={s.system.h + 28} rx={6} />
        ))}
      </g>
    )
  }
  if (selection.noteIds.length < 2) {
    const n = g.notes.get(selection.noteIds[0])
    return n ? <circle className="sel-ring" cx={n.cx} cy={n.cy} r={Math.max(n.w, n.h) / 2 + 5} /> : null
  }
  return (
    <g className="sel-band">
      {notesBySystem(g, selection.noteIds).map((grp, i) => {
        // vertical extent: only the staves that hold selected notes
        const staves = grp.flatMap(n => {
          const m = g.measures[n.measure - 1]
          const idx = m ? Math.min(m.staves.length - 1, staffIndexAt(m.staves, n.cy)) : -1
          return idx >= 0 ? [m!.staves[idx]] : []
        })
        const x0 = grp[0].x - 7
        const x1 = grp[grp.length - 1].x + grp[grp.length - 1].w + 7
        const y0 = Math.min(...staves.map(s => s.y - 10), ...grp.map(n => n.y - 6))
        const y1 = Math.max(...staves.map(s => s.y + s.h + 10), ...grp.map(n => n.y + n.h + 6))
        return <rect key={i} x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={6} />
      })}
    </g>
  )
})

/** Index of the staff closest to a y position. */
function staffIndexAt(staves: { y: number; h: number }[], y: number) {
  let best = 0, bestD = Infinity
  staves.forEach((s, i) => {
    const d = y < s.y ? s.y - y : y > s.y + s.h ? y - s.y - s.h : 0
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}

export const PlaybackLayer = memo(function PlaybackLayer({ g, measure }: { g: ScoreGeometry; measure: number | null }) {
  if (!measure) return null
  const m = g.measures[measure - 1]
  if (!m) return null
  return <rect className="play-band" x={m.x} y={m.y - 10} width={m.w} height={m.h + 20} rx={4} />
})

export const StrokeLayer = memo(function StrokeLayer({ strokes }: { strokes: FreehandAnnotation[] }) {
  return (
    <g className="stroke-layer">
      {strokes.map(s => (
        <path key={s.id} d={s.points ? strokePath(s.points) : s.path} stroke={s.color} strokeWidth={s.strokeWidth}
          strokeOpacity={s.opacity ?? 0.85} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {s.label && <title>{s.label}</title>}
        </path>
      ))}
    </g>
  )
})

export function strokePoints(s: FreehandAnnotation): number[] {
  return s.points ?? pathToPoints(s.path)
}
