/**
 * Skyline — Vertical contour tracking for collision avoidance
 *
 * Port of MuseScore's skyline.cpp/h
 *
 * A Skyline maintains two contour lines per staff:
 *   - north: the highest (lowest y value) point at each x position
 *   - south: the lowest (highest y value) point at each x position
 *
 * When placing a new element, you check its shape against the skyline
 * to find the minimum distance needed to avoid collision. Then you
 * add the element's shape to the skyline for future elements to avoid.
 */

import { Shape, type ShapeRect } from './Shape'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAXIMUM_Y = 1e6
const MINIMUM_Y = -1e6

// ─── SkylineSegment ───────────────────────────────────────────────────────────

export interface SkylineSegment {
  x: number        // start x position
  y: number        // contour y value (min for north, max for south)
  w: number        // width of this segment
  staffSpan: number // cross-staff span (0 = same staff)
}

// ─── SkylineLine ──────────────────────────────────────────────────────────────

export class SkylineLine {
  private readonly north: boolean
  private seg: SkylineSegment[] = []

  constructor(isNorth: boolean) {
    this.north = isNorth
  }

  clear(): void {
    this.seg = []
  }

  get segments(): readonly SkylineSegment[] { return this.seg }
  get valid(): boolean { return this.seg.length > 0 }

  isValidSegment(s: SkylineSegment): boolean {
    return this.north ? (s.y !== MAXIMUM_Y) : (s.y !== MINIMUM_Y)
  }

  /** Maximum extent (most extreme y value across all segments) */
  max(): number {
    if (this.north) {
      let val = MAXIMUM_Y
      for (const s of this.seg) val = Math.min(val, s.y)
      return val
    } else {
      let val = MINIMUM_Y
      for (const s of this.seg) val = Math.max(val, s.y)
      return val
    }
  }

  // ── Add methods ───────────────────────────────────────────────────────────

  addShape(s: Shape): void {
    for (const r of s.elements) {
      this.addRect(r)
    }
  }

  addRect(r: ShapeRect): void {
    if (this.north) {
      this.add(r.x, r.y, r.width, 0)
    } else {
      this.add(r.x, r.y + r.height, r.width, 0)
    }
  }

  /**
   * Add a horizontal extent to the skyline contour.
   *
   * This is the core algorithm — handles 6 cases (A-F) for inserting
   * a new rectangle into the sorted segment list.
   *
   * (skyline.cpp:137-219)
   */
  add(x: number, y: number, w: number, span = 0): void {
    // Clamp to x >= 0
    if (x < 0) {
      w -= -x
      x = 0
      if (w <= 0) return
    }

    let idx = this.findIndex(x)
    let cx = this.seg.length === 0 ? 0 : this.seg[idx]?.x ?? 0

    while (idx < this.seg.length) {
      const seg = this.seg[idx]
      const cy = seg.y

      // Case A: new rect ends before current segment
      if ((x + w) <= cx) return

      // Case B: new rect starts after current segment
      if (x > (cx + seg.w)) {
        cx += seg.w
        idx++
        continue
      }

      // Skip if existing contour is already more extreme
      if ((this.north && cy <= y) || (!this.north && cy >= y)) {
        cx += seg.w
        idx++
        continue
      }

      // Case E: new rect completely inside existing segment (split)
      if (x >= cx && (x + w) < (cx + seg.w)) {
        const w1 = x - cx
        const w2 = w
        const w3 = seg.w - (w1 + w2)
        if (w1 > 1e-7) {
          seg.w = w1
          idx++
          this.insertAt(idx, x, y, w2, span)
        } else {
          seg.w = w2
          seg.y = y
        }
        if (w3 > 1e-7) {
          idx++
          this.insertAt(idx, x + w2, cy, w3, span)
        }
        return
      }

      // Case F: new rect completely covers existing segment
      if (x <= cx && (x + w) >= (cx + seg.w)) {
        seg.y = y
      }
      // Case C: new rect overlaps start of existing segment
      else if (x < cx) {
        const w1 = x + w - cx
        seg.w -= w1
        this.insertAt(idx, cx, y, w1, span)
        return
      }
      // Case D: new rect starts inside existing segment
      else {
        const w1 = x - cx
        const w2 = seg.w - w1
        if (w2 > 1e-7) {
          seg.w = w1
          cx += w1
          idx++
          this.insertAt(idx, cx, y, w2, span)
        }
      }

      cx += this.seg[idx].w
      idx++
    }

    // Append remaining
    if (x >= cx) {
      if (x > cx) {
        const cy = this.north ? MAXIMUM_Y : MINIMUM_Y
        this.seg.push({ x: cx, y: cy, w: x - cx, staffSpan: span })
      }
      this.seg.push({ x, y, w, staffSpan: span })
    } else if (x + w > cx) {
      this.seg.push({ x: cx, y, w: x + w - cx, staffSpan: span })
    }
  }

  // ── Distance calculation ──────────────────────────────────────────────────

  /**
   * Minimum distance between this skyline line and another.
   * This = south line (above), sl = north line (below).
   *
   * (skyline.cpp:242-281)
   */
  minDistance(sl: SkylineLine): number {
    let dist = MINIMUM_Y

    let x1 = 0
    let x2 = 0
    let kIdx = 0

    for (let iIdx = 0; iIdx < this.seg.length; iIdx++) {
      const iSeg = this.seg[iIdx]
      if (iSeg.staffSpan > 0) continue

      // Advance k past segments that end before i starts
      while (kIdx < sl.seg.length && (x2 + sl.seg[kIdx].w) < x1) {
        x2 += sl.seg[kIdx].w
        kIdx++
      }
      if (kIdx >= sl.seg.length) break

      // Check overlapping segments
      for (;;) {
        const kSeg = sl.seg[kIdx]
        if ((x1 + iSeg.w > x2) && (x1 < x2 + kSeg.w) && kSeg.staffSpan >= 0) {
          dist = Math.max(dist, iSeg.y - kSeg.y)
        }
        if (x2 + kSeg.w < x1 + iSeg.w) {
          x2 += kSeg.w
          kIdx++
          if (kIdx >= sl.seg.length) break
        } else {
          break
        }
      }
      if (kIdx >= sl.seg.length) break
      x1 += iSeg.w
    }
    return dist
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private findIndex(x: number): number {
    // Binary search using upper_bound logic
    let lo = 0, hi = this.seg.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (x < this.seg[mid].x) hi = mid
      else lo = mid + 1
    }
    return lo > 0 ? lo - 1 : 0
  }

  private insertAt(idx: number, x: number, y: number, w: number, span: number): void {
    const xr = x + w
    // Adjust next segment's x if it would overlap
    if (idx < this.seg.length && xr > this.seg[idx].x) {
      this.seg[idx].x = xr
    }
    this.seg.splice(idx, 0, { x, y, w, staffSpan: span })
  }
}

// ─── Skyline ──────────────────────────────────────────────────────────────────

export class Skyline {
  private _north = new SkylineLine(true)
  private _south = new SkylineLine(false)

  get north(): SkylineLine { return this._north }
  get south(): SkylineLine { return this._south }

  clear(): void {
    this._north.clear()
    this._south.clear()
  }

  /** Add a shape's bounding boxes to both north and south skylines */
  addShape(s: Shape): void {
    for (const r of s.elements) {
      this._north.add(r.x, r.y, r.width, 0)
      this._south.add(r.x, r.y + r.height, r.width, 0)
    }
  }

  /** Add a single rectangle */
  addRect(r: ShapeRect): void {
    this._north.add(r.x, r.y, r.width, 0)
    this._south.add(r.x, r.y + r.height, r.width, 0)
  }

  /**
   * Minimum distance between this skyline (above) and another skyline (below).
   * Returns the gap needed so the south of this doesn't overlap with the north of s.
   *
   * (skyline.cpp:232-237)
   */
  minDistance(s: Skyline): number {
    return this._south.minDistance(s._north)
  }
}
