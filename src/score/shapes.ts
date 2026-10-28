/** SVG path helpers for overlay shapes (page units). */

type P = { x: number; y: number }

function catmull(pts: P[]): string {
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

/** Organic capsule around note centers (sorted left→right). Caps: round or flat (system break). */
export function blobPath(centers: P[], r: number, leftFlat = false, rightFlat = false): string {
  if (centers.length === 0) return ''
  const pts = [...centers].sort((a, b) => a.x - b.x)
  if (pts.length === 1) {
    const { x, y } = pts[0]
    return `M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y} Z`
  }
  const upper = pts.map(p => ({ x: p.x, y: p.y - r }))
  const lower = pts.map(p => ({ x: p.x, y: p.y + r })).reverse()
  const first = pts[0], last = pts[pts.length - 1]
  let d = `M${upper[0].x.toFixed(1)} ${upper[0].y.toFixed(1)}` + catmull(upper)
  d += rightFlat ? ` L${last.x} ${last.y + r}` : ` A${r} ${r} 0 0 1 ${last.x} ${last.y + r}`
  d += catmull(lower)
  d += leftFlat ? ` L${first.x} ${first.y - r}` : ` A${r} ${r} 0 0 1 ${first.x} ${first.y - r}`
  return d + ' Z'
}

/** Smooth freehand path from flat [x,y,…] points (quadratic midpoints). */
export function strokePath(points: number[]): string {
  if (points.length < 2) return ''
  if (points.length <= 4) return `M${points[0]} ${points[1]} L${points[points.length - 2]} ${points[points.length - 1]}`
  let d = `M${points[0].toFixed(1)} ${points[1].toFixed(1)}`
  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = (points[i] + points[i + 2]) / 2, my = (points[i + 1] + points[i + 3]) / 2
    d += ` Q${points[i].toFixed(1)} ${points[i + 1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`
  }
  d += ` L${points[points.length - 2].toFixed(1)} ${points[points.length - 1].toFixed(1)}`
  return d
}

/** Distance from point to a polyline given as flat points. */
export function distToPolyline(x: number, y: number, pts: number[]): number {
  let best = Infinity
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3]
    const dx = bx - ax, dy = by - ay
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)))
  }
  if (pts.length === 2) best = Math.hypot(x - pts[0], y - pts[1])
  return best
}

/** Parse "M x y L x y …" style path into flat points (fallback for old strokes without points). */
export function pathToPoints(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
}
